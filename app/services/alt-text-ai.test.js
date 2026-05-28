import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateAltTextWithAI } from "./alt-text-ai.js";
import { MAX_LENGTH } from "./alt-text-generator.js";

// Mockeamos callAnthropicMessages para testear alt-text-ai en aislamiento.
vi.mock("./anthropic-fetch.js", () => ({
  callAnthropicMessages: vi.fn(),
}));

import { callAnthropicMessages } from "./anthropic-fetch.js";

const IMAGE_URL = "https://cdn.shopify.com/s/files/1/test.jpg";
const PRODUCT_TITLE = "Blue Denim Jacket";

function mockSuccess(text) {
  callAnthropicMessages.mockResolvedValue({
    content: [{ type: "text", text }],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Caso base
// ---------------------------------------------------------------------------
describe("generateAltTextWithAI — éxito básico", () => {
  it("devuelve el texto trimado de la respuesta", async () => {
    mockSuccess("  Blue denim jacket on white background  ");

    const result = await generateAltTextWithAI({
      imageUrl: IMAGE_URL,
      productTitle: PRODUCT_TITLE,
    });

    expect(result).toBe("Blue denim jacket on white background");
  });
});

// ---------------------------------------------------------------------------
// Strip de comillas dobles envolventes
// ---------------------------------------------------------------------------
describe("generateAltTextWithAI — strip de comillas", () => {
  it('quita comillas dobles envolventes ("Blue shirt" → Blue shirt)', async () => {
    mockSuccess('"Blue denim jacket front view"');

    const result = await generateAltTextWithAI({
      imageUrl: IMAGE_URL,
      productTitle: PRODUCT_TITLE,
    });

    expect(result).toBe("Blue denim jacket front view");
  });

  it("quita comillas simples envolventes", async () => {
    mockSuccess("'Classic blue jacket'");

    const result = await generateAltTextWithAI({
      imageUrl: IMAGE_URL,
      productTitle: PRODUCT_TITLE,
    });

    expect(result).toBe("Classic blue jacket");
  });
});

// ---------------------------------------------------------------------------
// Truncado a MAX_LENGTH
// ---------------------------------------------------------------------------
describe("generateAltTextWithAI — truncado", () => {
  it(`trunca a ${MAX_LENGTH} chars cuando el modelo devuelve texto más largo`, async () => {
    const longText = "A".repeat(200);
    mockSuccess(longText);

    const result = await generateAltTextWithAI({
      imageUrl: IMAGE_URL,
      productTitle: PRODUCT_TITLE,
    });

    expect(result.length).toBeLessThanOrEqual(MAX_LENGTH);
    // El helper truncate usa "…" como último char.
    expect(result.endsWith("…")).toBe(true);
  });

  it("no trunca texto que ya está dentro del límite", async () => {
    const shortText = "Blue jacket with zipper pockets";
    mockSuccess(shortText);

    const result = await generateAltTextWithAI({
      imageUrl: IMAGE_URL,
      productTitle: PRODUCT_TITLE,
    });

    expect(result).toBe(shortText);
  });
});

// ---------------------------------------------------------------------------
// Construcción del request (args pasados a callAnthropicMessages)
// ---------------------------------------------------------------------------
describe("generateAltTextWithAI — construcción del request", () => {
  it("pasa imagen como bloque url + texto con productTitle", async () => {
    mockSuccess("Blue jacket");

    await generateAltTextWithAI({
      imageUrl: IMAGE_URL,
      productTitle: PRODUCT_TITLE,
    });

    expect(callAnthropicMessages).toHaveBeenCalledOnce();
    const { messages, maxTokens, system } = callAnthropicMessages.mock.calls[0][0];

    // Debe haber un message de role user con dos bloques de contenido.
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    const content = messages[0].content;
    expect(content).toHaveLength(2);

    // Bloque imagen.
    expect(content[0].type).toBe("image");
    expect(content[0].source.type).toBe("url");
    expect(content[0].source.url).toBe(IMAGE_URL);

    // Bloque texto.
    expect(content[1].type).toBe("text");
    expect(content[1].text).toContain(PRODUCT_TITLE);

    // maxTokens controlado.
    expect(maxTokens).toBe(100);

    // system presente.
    expect(typeof system).toBe("string");
    expect(system.length).toBeGreaterThan(0);
  });

  it("incluye el locale en el texto del request cuando se provee", async () => {
    mockSuccess("Chaqueta azul de mezclilla");

    await generateAltTextWithAI({
      imageUrl: IMAGE_URL,
      productTitle: PRODUCT_TITLE,
      locale: "es",
    });

    const { messages } = callAnthropicMessages.mock.calls[0][0];
    const textBlock = messages[0].content[1];
    expect(textBlock.text).toContain('"es"');
  });

  it("NO incluye referencia a locale cuando no se provee", async () => {
    mockSuccess("Blue jacket");

    await generateAltTextWithAI({
      imageUrl: IMAGE_URL,
      productTitle: PRODUCT_TITLE,
    });

    const { messages } = callAnthropicMessages.mock.calls[0][0];
    const textBlock = messages[0].content[1];
    expect(textBlock.text).not.toContain("locale");
  });
});

// ---------------------------------------------------------------------------
// Respuesta sin texto → lanza
// ---------------------------------------------------------------------------
describe("generateAltTextWithAI — respuesta sin texto", () => {
  it("lanza cuando content está vacío", async () => {
    callAnthropicMessages.mockResolvedValue({ content: [] });

    await expect(
      generateAltTextWithAI({ imageUrl: IMAGE_URL, productTitle: PRODUCT_TITLE }),
    ).rejects.toThrow(/no usable text/);
  });

  it("lanza cuando content[0].text es string vacío", async () => {
    callAnthropicMessages.mockResolvedValue({
      content: [{ type: "text", text: "   " }],
    });

    await expect(
      generateAltTextWithAI({ imageUrl: IMAGE_URL, productTitle: PRODUCT_TITLE }),
    ).rejects.toThrow(/no usable text/);
  });

  it("lanza cuando callAnthropicMessages rechaza (ej. sin API key)", async () => {
    callAnthropicMessages.mockRejectedValue(
      new Error("ANTHROPIC_API_KEY is not set"),
    );

    await expect(
      generateAltTextWithAI({ imageUrl: IMAGE_URL, productTitle: PRODUCT_TITLE }),
    ).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});
