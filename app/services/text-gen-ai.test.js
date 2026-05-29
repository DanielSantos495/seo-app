import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateMetaTitle,
  generateMetaDescription,
  generateDescription,
} from "./text-gen-ai.js";

// Mockeamos callAnthropicMessages para testear text-gen-ai en aislamiento.
vi.mock("./anthropic-fetch.js", () => ({
  callAnthropicMessages: vi.fn(),
}));

import { callAnthropicMessages } from "./anthropic-fetch.js";

const SAMPLE_CONTEXT =
  "Store: Acme Shop\nProduct: Eco Bamboo Bottle\nType: Drinkware\nPrice: 29.99";

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
// generateMetaTitle
// ---------------------------------------------------------------------------
describe("generateMetaTitle", () => {
  it("devuelve texto trimado de la respuesta", async () => {
    mockSuccess("  Eco Bamboo Bottle — Stay Hydrated  ");
    const result = await generateMetaTitle({ context: SAMPLE_CONTEXT });
    expect(result).toBe("Eco Bamboo Bottle — Stay Hydrated");
  });

  it("quita comillas dobles envolventes", async () => {
    mockSuccess('"Eco Bamboo Bottle — Stay Hydrated"');
    const result = await generateMetaTitle({ context: SAMPLE_CONTEXT });
    expect(result).toBe("Eco Bamboo Bottle — Stay Hydrated");
  });

  it("quita comillas simples envolventes", async () => {
    mockSuccess("'Eco Bamboo Bottle — Stay Hydrated'");
    const result = await generateMetaTitle({ context: SAMPLE_CONTEXT });
    expect(result).toBe("Eco Bamboo Bottle — Stay Hydrated");
  });

  it("trunca a 60 chars cuando el modelo devuelve texto más largo", async () => {
    mockSuccess("A".repeat(80));
    const result = await generateMetaTitle({ context: SAMPLE_CONTEXT });
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result.endsWith("…")).toBe(true);
  });

  it("no trunca texto que ya está dentro del límite de 60", async () => {
    const text = "Eco Bamboo Water Bottle"; // 23 chars
    mockSuccess(text);
    const result = await generateMetaTitle({ context: SAMPLE_CONTEXT });
    expect(result).toBe(text);
  });

  it("pasa context y locale en el mensaje a callAnthropicMessages", async () => {
    mockSuccess("Botella de Bambú Eco");
    await generateMetaTitle({ context: SAMPLE_CONTEXT, locale: "es" });

    expect(callAnthropicMessages).toHaveBeenCalledOnce();
    const { messages, system } = callAnthropicMessages.mock.calls[0][0];

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toContain(SAMPLE_CONTEXT);
    expect(messages[0].content).toContain('"es"');
    expect(typeof system).toBe("string");
    expect(system.length).toBeGreaterThan(0);
  });

  it("NO incluye referencia a locale cuando no se provee", async () => {
    mockSuccess("Eco Bamboo Bottle");
    await generateMetaTitle({ context: SAMPLE_CONTEXT });

    const { messages } = callAnthropicMessages.mock.calls[0][0];
    expect(messages[0].content).not.toContain("locale");
  });

  it("lanza cuando content está vacío", async () => {
    callAnthropicMessages.mockResolvedValue({ content: [] });
    await expect(
      generateMetaTitle({ context: SAMPLE_CONTEXT }),
    ).rejects.toThrow(/no usable text/);
  });

  it("lanza cuando callAnthropicMessages rechaza", async () => {
    callAnthropicMessages.mockRejectedValue(
      new Error("ANTHROPIC_API_KEY is not set"),
    );
    await expect(
      generateMetaTitle({ context: SAMPLE_CONTEXT }),
    ).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});

// ---------------------------------------------------------------------------
// generateMetaDescription
// ---------------------------------------------------------------------------
describe("generateMetaDescription", () => {
  it("devuelve texto trimado de la respuesta", async () => {
    mockSuccess("  A sustainable bamboo bottle.  ");
    const result = await generateMetaDescription({ context: SAMPLE_CONTEXT });
    expect(result).toBe("A sustainable bamboo bottle.");
  });

  it("trunca a 160 chars cuando el modelo devuelve texto más largo", async () => {
    mockSuccess("B".repeat(200));
    const result = await generateMetaDescription({ context: SAMPLE_CONTEXT });
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result.endsWith("…")).toBe(true);
  });

  it("no trunca texto dentro del límite de 160", async () => {
    const text = "B".repeat(120);
    mockSuccess(text);
    const result = await generateMetaDescription({ context: SAMPLE_CONTEXT });
    expect(result).toBe(text);
  });

  it("pasa context y locale en el mensaje a callAnthropicMessages", async () => {
    mockSuccess("Una botella de bambú sostenible.");
    await generateMetaDescription({ context: SAMPLE_CONTEXT, locale: "es" });

    const { messages } = callAnthropicMessages.mock.calls[0][0];
    expect(messages[0].content).toContain(SAMPLE_CONTEXT);
    expect(messages[0].content).toContain('"es"');
  });

  it("lanza cuando content[0].text es string vacío", async () => {
    callAnthropicMessages.mockResolvedValue({
      content: [{ type: "text", text: "   " }],
    });
    await expect(
      generateMetaDescription({ context: SAMPLE_CONTEXT }),
    ).rejects.toThrow(/no usable text/);
  });

  it("lanza cuando callAnthropicMessages rechaza", async () => {
    callAnthropicMessages.mockRejectedValue(new Error("Network error"));
    await expect(
      generateMetaDescription({ context: SAMPLE_CONTEXT }),
    ).rejects.toThrow(/Network error/);
  });
});

// ---------------------------------------------------------------------------
// generateDescription
// ---------------------------------------------------------------------------
describe("generateDescription", () => {
  it("devuelve texto plano multi-párrafo sin truncar texto válido corto", async () => {
    const plainText =
      "Eco Bamboo Bottle is crafted from 100% natural bamboo.\n\nStay hydrated in style with our durable bottle.";
    mockSuccess(plainText);
    const result = await generateDescription({ context: SAMPLE_CONTEXT });
    // No debe truncar texto válido corto.
    expect(result).toBe(plainText);
    // Debe conservar el separador de párrafos.
    expect(result).toContain("\n\n");
  });

  it("trunca a 1500 chars cuando el modelo devuelve texto muy largo", async () => {
    mockSuccess("C".repeat(2000));
    const result = await generateDescription({ context: SAMPLE_CONTEXT });
    expect(result.length).toBeLessThanOrEqual(1500);
    expect(result.endsWith("…")).toBe(true);
  });

  it("no trunca texto que mide exactamente el límite", async () => {
    const text = "D".repeat(1500);
    mockSuccess(text);
    const result = await generateDescription({ context: SAMPLE_CONTEXT });
    expect(result).toBe(text);
    expect(result.length).toBe(1500);
  });

  it("pasa context y locale en el mensaje a callAnthropicMessages", async () => {
    mockSuccess("Una descripción del producto.");
    await generateDescription({ context: SAMPLE_CONTEXT, locale: "fr" });

    const { messages } = callAnthropicMessages.mock.calls[0][0];
    expect(messages[0].content).toContain(SAMPLE_CONTEXT);
    expect(messages[0].content).toContain('"fr"');
  });

  it("lanza cuando content está vacío", async () => {
    callAnthropicMessages.mockResolvedValue({ content: [] });
    await expect(
      generateDescription({ context: SAMPLE_CONTEXT }),
    ).rejects.toThrow(/no usable text/);
  });

  it("lanza cuando callAnthropicMessages rechaza", async () => {
    callAnthropicMessages.mockRejectedValue(new Error("ANTHROPIC_API_KEY is not set"));
    await expect(
      generateDescription({ context: SAMPLE_CONTEXT }),
    ).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});
