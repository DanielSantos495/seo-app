import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSettings, saveSettings } from "./shop-settings.js";

// Mock del cliente Prisma
vi.mock("../db.server.js", () => ({
  default: {
    shopSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import prisma from "../db.server.js";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getSettings
// ---------------------------------------------------------------------------

describe("getSettings", () => {
  it("devuelve brandContext de la fila cuando existe", async () => {
    prisma.shopSettings.findUnique.mockResolvedValue({
      id: "abc",
      shop: "test.myshopify.com",
      brandContext: "Eco-friendly brand focused on sustainability",
      updatedAt: new Date(),
    });

    const result = await getSettings("test.myshopify.com");
    expect(result).toEqual({ brandContext: "Eco-friendly brand focused on sustainability" });
  });

  it("devuelve brandContext vacío cuando no existe fila (no crea)", async () => {
    prisma.shopSettings.findUnique.mockResolvedValue(null);

    const result = await getSettings("new.myshopify.com");
    expect(result).toEqual({ brandContext: "" });
    // No debe haber llamado upsert/create
    expect(prisma.shopSettings.upsert).not.toHaveBeenCalled();
  });

  it("llama findUnique con el shop correcto", async () => {
    prisma.shopSettings.findUnique.mockResolvedValue(null);

    await getSettings("shop-x.myshopify.com");
    expect(prisma.shopSettings.findUnique).toHaveBeenCalledWith({
      where: { shop: "shop-x.myshopify.com" },
    });
  });
});

// ---------------------------------------------------------------------------
// saveSettings
// ---------------------------------------------------------------------------

describe("saveSettings", () => {
  it("llama upsert con la shape correcta", async () => {
    prisma.shopSettings.upsert.mockResolvedValue({
      id: "xyz",
      shop: "test.myshopify.com",
      brandContext: "Summer apparel brand",
      updatedAt: new Date(),
    });

    await saveSettings("test.myshopify.com", { brandContext: "Summer apparel brand" });

    expect(prisma.shopSettings.upsert).toHaveBeenCalledWith({
      where: { shop: "test.myshopify.com" },
      create: { shop: "test.myshopify.com", brandContext: "Summer apparel brand" },
      update: { brandContext: "Summer apparel brand" },
    });
  });

  it("coerce null brandContext a string vacío", async () => {
    prisma.shopSettings.upsert.mockResolvedValue({
      id: "xyz",
      shop: "test.myshopify.com",
      brandContext: "",
      updatedAt: new Date(),
    });

    await saveSettings("test.myshopify.com", { brandContext: null });

    expect(prisma.shopSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ brandContext: "" }),
        update: expect.objectContaining({ brandContext: "" }),
      }),
    );
  });

  it("coerce undefined brandContext a string vacío", async () => {
    prisma.shopSettings.upsert.mockResolvedValue({
      id: "xyz",
      shop: "test.myshopify.com",
      brandContext: "",
      updatedAt: new Date(),
    });

    await saveSettings("test.myshopify.com", {});

    expect(prisma.shopSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ brandContext: "" }),
        update: expect.objectContaining({ brandContext: "" }),
      }),
    );
  });

  it("sin segundo argumento usa brandContext vacío", async () => {
    prisma.shopSettings.upsert.mockResolvedValue({});

    await saveSettings("test.myshopify.com");

    expect(prisma.shopSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ brandContext: "" }),
        update: expect.objectContaining({ brandContext: "" }),
      }),
    );
  });
});
