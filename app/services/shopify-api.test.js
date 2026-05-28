// Tests para chooseAlts — el helper extraído que decide qué alt text asignar
// a cada imagen (AI vs determinístico). No requiere admin/GraphQL.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { chooseAlts } from "./shopify-api.js";

// chooseAlts importa resizeCdnUrl desde ./image-url.
// Lo mockeamos para que devuelva la URL sin cambios y el test sea predecible.
vi.mock("./image-url.js", () => ({
  resizeCdnUrl: vi.fn((url) => url),
}));

// Mock de ai-usage y alt-text-ai: chooseAlts no los importa directamente
// (los recibe como parámetro aiFn), pero sí los usa bulkFixAltTextsForProducts.
// Los mocks aquí son por si algún import transitivo los carga.
vi.mock("./ai-usage.js", () => ({
  remaining: vi.fn(),
  increment: vi.fn(),
}));

vi.mock("./alt-text-ai.js", () => ({
  generateAltTextWithAI: vi.fn(),
}));

// Fixtures reutilizables.
const makeImages = (ids) =>
  ids.map((id) => ({ id, url: `https://cdn.shopify.com/img/${id}.jpg` }));

const makeNaiveAlts = (ids) => {
  const m = new Map();
  ids.forEach((id) => m.set(id, `naive-alt-for-${id}`));
  return m;
};

describe("chooseAlts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Caso 1: useAI=true, budget >= cantidad de imágenes → todas AI
  // ---------------------------------------------------------------------------
  it("useAI=true, budget >= imágenes → todas las imágenes reciben alt de AI", async () => {
    const images = makeImages(["img1", "img2", "img3"]);
    const naiveAlts = makeNaiveAlts(["img1", "img2", "img3"]);
    const aiFn = vi.fn().mockResolvedValue("ai-generated-alt");

    const { alts, aiUsed, naiveUsed } = await chooseAlts({
      missingImages: images,
      naiveAlts,
      useAI: true,
      aiBudget: 5, // más que suficiente
      aiFn,
      productTitle: "Awesome Product",
      locale: null,
    });

    // aiFn debe haberse llamado una vez por imagen.
    expect(aiFn).toHaveBeenCalledTimes(3);
    // Cada llamada recibe la URL (la de resizeCdnUrl, que devuelve igual),
    // el título y el locale.
    expect(aiFn).toHaveBeenCalledWith(
      "https://cdn.shopify.com/img/img1.jpg",
      "Awesome Product",
      null,
    );

    // Todos los alts son AI.
    expect(alts.size).toBe(3);
    expect(alts.get("img1")).toBe("ai-generated-alt");
    expect(alts.get("img2")).toBe("ai-generated-alt");
    expect(alts.get("img3")).toBe("ai-generated-alt");

    expect(aiUsed).toBe(3);
    expect(naiveUsed).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Caso 2: budget < cantidad de imágenes → primeras `budget` imágenes AI,
  //          el resto determinístico.
  // ---------------------------------------------------------------------------
  it("budget < imágenes → primeras budget imágenes AI, el resto determinístico", async () => {
    const images = makeImages(["img1", "img2", "img3", "img4"]);
    const naiveAlts = makeNaiveAlts(["img1", "img2", "img3", "img4"]);
    const aiFn = vi.fn().mockResolvedValue("ai-alt");

    const { alts, aiUsed, naiveUsed } = await chooseAlts({
      missingImages: images,
      naiveAlts,
      useAI: true,
      aiBudget: 2, // solo 2 créditos disponibles
      aiFn,
      productTitle: "Product",
      locale: "en",
    });

    // Solo 2 llamadas AI.
    expect(aiFn).toHaveBeenCalledTimes(2);

    // Las dos primeras van por AI, las dos últimas por naive.
    expect(alts.get("img1")).toBe("ai-alt");
    expect(alts.get("img2")).toBe("ai-alt");
    expect(alts.get("img3")).toBe("naive-alt-for-img3");
    expect(alts.get("img4")).toBe("naive-alt-for-img4");

    expect(aiUsed).toBe(2);
    expect(naiveUsed).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // Caso 3: aiFn lanza para una imagen → fallback determinístico, no aborta.
  // ---------------------------------------------------------------------------
  it("aiFn lanza → imagen usa fallback determinístico y el bulk no aborta", async () => {
    const images = makeImages(["img1", "img2"]);
    const naiveAlts = makeNaiveAlts(["img1", "img2"]);

    // img1 falla, img2 ok.
    const aiFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Anthropic API timeout"))
      .mockResolvedValueOnce("ai-alt-img2");

    const { alts, aiUsed, naiveUsed } = await chooseAlts({
      missingImages: images,
      naiveAlts,
      useAI: true,
      aiBudget: 10,
      aiFn,
      productTitle: "Product",
      locale: null,
    });

    // img1 usó naive por el error, img2 usó AI.
    expect(alts.get("img1")).toBe("naive-alt-for-img1");
    expect(alts.get("img2")).toBe("ai-alt-img2");

    expect(aiUsed).toBe(1);
    expect(naiveUsed).toBe(1);

    // No se propagó excepción: si chooseAlts hubiera lanzado, el test fallaría
    // en el await de arriba, no llegando a estas assertions.
  });

  // ---------------------------------------------------------------------------
  // Caso 4: useAI=false → nunca llama a aiFn, todo determinístico.
  // ---------------------------------------------------------------------------
  it("useAI=false → aiFn nunca se llama, todos los alts son determinísticos", async () => {
    const images = makeImages(["img1", "img2", "img3"]);
    const naiveAlts = makeNaiveAlts(["img1", "img2", "img3"]);
    const aiFn = vi.fn();

    const { alts, aiUsed, naiveUsed } = await chooseAlts({
      missingImages: images,
      naiveAlts,
      useAI: false,
      aiBudget: 100, // budget alto pero no importa
      aiFn,
      productTitle: "Product",
      locale: null,
    });

    expect(aiFn).not.toHaveBeenCalled();
    expect(alts.get("img1")).toBe("naive-alt-for-img1");
    expect(alts.get("img2")).toBe("naive-alt-for-img2");
    expect(alts.get("img3")).toBe("naive-alt-for-img3");

    expect(aiUsed).toBe(0);
    expect(naiveUsed).toBe(3);
  });

  // ---------------------------------------------------------------------------
  // Extra: useAI=true, budget=0 → nunca llama a aiFn (equivalente a free).
  // ---------------------------------------------------------------------------
  it("useAI=true pero budget=0 → sin llamadas AI (free plan / quota agotada)", async () => {
    const images = makeImages(["img1"]);
    const naiveAlts = makeNaiveAlts(["img1"]);
    const aiFn = vi.fn();

    const { alts, aiUsed, naiveUsed } = await chooseAlts({
      missingImages: images,
      naiveAlts,
      useAI: true,
      aiBudget: 0,
      aiFn,
      productTitle: "Product",
      locale: null,
    });

    expect(aiFn).not.toHaveBeenCalled();
    expect(alts.get("img1")).toBe("naive-alt-for-img1");
    expect(aiUsed).toBe(0);
    expect(naiveUsed).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Extra: imagen sin url → no llama AI aunque haya budget, usa naive.
  // ---------------------------------------------------------------------------
  it("imagen sin url → usa naive aunque haya budget AI disponible", async () => {
    const images = [{ id: "img1", url: null }];
    const naiveAlts = new Map([["img1", "naive-for-img1"]]);
    const aiFn = vi.fn();

    const { alts, aiUsed, naiveUsed } = await chooseAlts({
      missingImages: images,
      naiveAlts,
      useAI: true,
      aiBudget: 5,
      aiFn,
      productTitle: "Product",
      locale: null,
    });

    expect(aiFn).not.toHaveBeenCalled();
    expect(alts.get("img1")).toBe("naive-for-img1");
    expect(aiUsed).toBe(0);
    expect(naiveUsed).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Extra: lista vacía → devuelve map vacío sin llamadas.
  // ---------------------------------------------------------------------------
  it("missingImages vacío → map vacío, cero AI, cero naive", async () => {
    const aiFn = vi.fn();
    const { alts, aiUsed, naiveUsed } = await chooseAlts({
      missingImages: [],
      naiveAlts: new Map(),
      useAI: true,
      aiBudget: 10,
      aiFn,
      productTitle: "Product",
      locale: null,
    });

    expect(alts.size).toBe(0);
    expect(aiFn).not.toHaveBeenCalled();
    expect(aiUsed).toBe(0);
    expect(naiveUsed).toBe(0);
  });
});
