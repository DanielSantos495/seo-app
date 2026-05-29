import { describe, it, expect } from "vitest";
import {
  buildContext,
  MAX_MERCHANT_CONTEXT,
  MAX_DESC,
} from "./ai-context.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProduct(overrides = {}) {
  return {
    title: "Cool T-Shirt",
    productType: "Apparel",
    vendor: "Acme",
    tags: ["summer", "cotton"],
    price: "29.99",
    descriptionHtml: "<p>Great shirt for <b>everyday</b> use.</p>",
    ...overrides,
  };
}

function makeShop(overrides = {}) {
  return { name: "My Store", currencyCode: "USD", ...overrides };
}

// ---------------------------------------------------------------------------
// buildContext — vacío / sin input
// ---------------------------------------------------------------------------

describe("buildContext — sin input", () => {
  it("sin argumentos devuelve string vacío", () => {
    expect(buildContext()).toBe("");
  });

  it("objeto vacío devuelve string vacío", () => {
    expect(buildContext({})).toBe("");
  });

  it("shop vacío y sin producto devuelve string vacío", () => {
    expect(buildContext({ shop: { name: "", currencyCode: "" } })).toBe("");
  });
});

// ---------------------------------------------------------------------------
// buildContext — solo shop
// ---------------------------------------------------------------------------

describe("buildContext — shop", () => {
  it("incluye Store cuando name no está vacío", () => {
    const result = buildContext({ shop: makeShop() });
    expect(result).toContain("Store: My Store");
  });

  it("incluye Currency cuando currencyCode no está vacío", () => {
    const result = buildContext({ shop: makeShop() });
    expect(result).toContain("Currency: USD");
  });

  it("NO incluye Store si name está vacío", () => {
    const result = buildContext({ shop: makeShop({ name: "" }) });
    expect(result).not.toContain("Store:");
  });

  it("NO incluye Currency si currencyCode está vacío", () => {
    const result = buildContext({ shop: makeShop({ currencyCode: "" }) });
    expect(result).not.toContain("Currency:");
  });
});

// ---------------------------------------------------------------------------
// buildContext — merchantContext
// ---------------------------------------------------------------------------

describe("buildContext — merchantContext", () => {
  it("incluye Brand context cuando tiene valor", () => {
    const result = buildContext({ merchantContext: "Eco friendly brand" });
    expect(result).toContain("Brand context: Eco friendly brand");
  });

  it("NO incluye Brand context cuando está vacío", () => {
    const result = buildContext({ merchantContext: "" });
    expect(result).not.toContain("Brand context:");
  });

  it("trunca merchantContext a MAX_MERCHANT_CONTEXT chars", () => {
    const long = "x".repeat(MAX_MERCHANT_CONTEXT + 50);
    const result = buildContext({ merchantContext: long });
    const line = result.split("\n").find((l) => l.startsWith("Brand context:"));
    expect(line).toBeDefined();
    // "Brand context: " prefix (16 chars) + MAX_MERCHANT_CONTEXT chars max
    const value = line.replace("Brand context: ", "");
    expect(value.length).toBeLessThanOrEqual(MAX_MERCHANT_CONTEXT);
  });
});

// ---------------------------------------------------------------------------
// buildContext — producto
// ---------------------------------------------------------------------------

describe("buildContext — producto", () => {
  it("incluye Product: title", () => {
    const result = buildContext({ product: makeProduct() });
    expect(result).toContain("Product: Cool T-Shirt");
  });

  it("incluye Type cuando productType no está vacío", () => {
    const result = buildContext({ product: makeProduct() });
    expect(result).toContain("Type: Apparel");
  });

  it("incluye Vendor cuando vendor no está vacío", () => {
    const result = buildContext({ product: makeProduct() });
    expect(result).toContain("Vendor: Acme");
  });

  it("incluye Tags con los tags del producto", () => {
    const result = buildContext({ product: makeProduct() });
    expect(result).toContain("Tags: summer, cotton");
  });

  it("incluye Price cuando price no está vacío", () => {
    const result = buildContext({ product: makeProduct() });
    expect(result).toContain("Price: 29.99");
  });

  it("NO incluye Type si productType está vacío", () => {
    const result = buildContext({ product: makeProduct({ productType: "" }) });
    expect(result).not.toContain("Type:");
  });

  it("NO incluye Vendor si vendor está vacío", () => {
    const result = buildContext({ product: makeProduct({ vendor: "" }) });
    expect(result).not.toContain("Vendor:");
  });

  it("NO incluye Tags si tags es array vacío", () => {
    const result = buildContext({ product: makeProduct({ tags: [] }) });
    expect(result).not.toContain("Tags:");
  });

  it("NO incluye Price si price es null", () => {
    const result = buildContext({ product: makeProduct({ price: null }) });
    expect(result).not.toContain("Price:");
  });
});

// ---------------------------------------------------------------------------
// buildContext — descripción (stripHtml + truncación)
// ---------------------------------------------------------------------------

describe("buildContext — descripción", () => {
  it("incluye Current description con HTML strips", () => {
    const result = buildContext({
      product: makeProduct({ descriptionHtml: "<p>Great shirt for <b>everyday</b> use.</p>" }),
    });
    expect(result).toContain("Current description: Great shirt for everyday use.");
  });

  it("NO incluye Current description si descriptionHtml está vacío", () => {
    const result = buildContext({ product: makeProduct({ descriptionHtml: "" }) });
    expect(result).not.toContain("Current description:");
  });

  it("trunca descripción a MAX_DESC chars", () => {
    const longHtml = "<p>" + "word ".repeat(200) + "</p>";
    const result = buildContext({ product: makeProduct({ descriptionHtml: longHtml }) });
    const line = result.split("\n").find((l) => l.startsWith("Current description:"));
    expect(line).toBeDefined();
    const value = line.replace("Current description: ", "");
    expect(value.length).toBeLessThanOrEqual(MAX_DESC);
  });
});

// ---------------------------------------------------------------------------
// buildContext — tags: máximo 8
// ---------------------------------------------------------------------------

describe("buildContext — slicing de tags", () => {
  it("incluye máximo 8 tags aunque haya más", () => {
    const tags = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    const result = buildContext({ product: makeProduct({ tags }) });
    const line = result.split("\n").find((l) => l.startsWith("Tags:"));
    expect(line).toBeDefined();
    const tagsInLine = line.replace("Tags: ", "").split(", ");
    expect(tagsInLine.length).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// buildContext — orden y completeness con todos los campos
// ---------------------------------------------------------------------------

describe("buildContext — orden de líneas", () => {
  it("el orden es Store → Currency → Brand context → Product → Type → Vendor → Tags → Price → Current description", () => {
    const result = buildContext({
      shop: makeShop(),
      merchantContext: "Eco brand",
      product: makeProduct(),
    });
    const lines = result.split("\n").map((l) => l.split(":")[0]);
    expect(lines).toEqual([
      "Store",
      "Currency",
      "Brand context",
      "Product",
      "Type",
      "Vendor",
      "Tags",
      "Price",
      "Current description",
    ]);
  });
});
