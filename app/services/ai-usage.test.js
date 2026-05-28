import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  currentPeriod,
  remainingFromUsed,
  estimatedCostUsd,
  getUsage,
  remaining,
  increment,
  AI_ALT_COST_USD,
  COST_ALERT_USD,
} from "./ai-usage.js";
import { PLAN } from "./plan.js";

// Mock del cliente Prisma — solo los métodos que usa ai-usage.js
vi.mock("../db.server.js", () => ({
  default: {
    aiUsage: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// Importamos el mock ya resuelto para poder configurar retornos
import prisma from "../db.server.js";

// ---------------------------------------------------------------------------
// currentPeriod
// ---------------------------------------------------------------------------
describe("currentPeriod", () => {
  it("devuelve 'YYYY-MM' en UTC para una fecha concreta", () => {
    const fecha = new Date("2026-05-15T10:00:00Z");
    expect(currentPeriod(fecha)).toBe("2026-05");
  });

  it("devuelve formato correcto para enero (mes con cero)", () => {
    const fecha = new Date("2025-01-01T00:00:00Z");
    expect(currentPeriod(fecha)).toBe("2025-01");
  });

  it("sin argumento devuelve un string con formato YYYY-MM", () => {
    const result = currentPeriod();
    expect(result).toMatch(/^\d{4}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// remainingFromUsed
// ---------------------------------------------------------------------------
describe("remainingFromUsed", () => {
  it("pro: 100 - 30 = 70", () => {
    expect(remainingFromUsed(PLAN.PRO, "aiAlt", 30)).toBe(70);
  });

  it("pro_plus: 500 - 200 = 300", () => {
    expect(remainingFromUsed(PLAN.PRO_PLUS, "aiAlt", 200)).toBe(300);
  });

  it("free: quota=0, clampea a 0 aunque used=0", () => {
    expect(remainingFromUsed(PLAN.FREE, "aiAlt", 0)).toBe(0);
  });

  it("clampea a 0 cuando used >= quota (no retorna negativo)", () => {
    expect(remainingFromUsed(PLAN.PRO, "aiAlt", 150)).toBe(0);
    expect(remainingFromUsed(PLAN.PRO, "aiAlt", 100)).toBe(0);
  });

  it("plan desconocido → quota=0 → remaining=0", () => {
    expect(remainingFromUsed("bogus_plan", "aiAlt", 0)).toBe(0);
  });

  it("key desconocida → quota=0 → remaining=0", () => {
    expect(remainingFromUsed(PLAN.PRO, "unknownKey", 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// estimatedCostUsd
// ---------------------------------------------------------------------------
describe("estimatedCostUsd", () => {
  it("0 generaciones → $0", () => {
    expect(estimatedCostUsd(0)).toBe(0);
  });

  it("1 generación → AI_ALT_COST_USD", () => {
    expect(estimatedCostUsd(1)).toBe(AI_ALT_COST_USD);
  });

  it("2500 generaciones cruzaría COST_ALERT_USD=$5 con precio $0.002", () => {
    // 2500 * 0.002 = 5.0
    expect(estimatedCostUsd(2500)).toBe(COST_ALERT_USD);
  });

  it("usa la constante correctamente (regresión)", () => {
    expect(estimatedCostUsd(100)).toBeCloseTo(0.2, 5);
  });
});

// ---------------------------------------------------------------------------
// getUsage (con prisma mockeado)
// ---------------------------------------------------------------------------
describe("getUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve la fila de DB cuando existe", async () => {
    const fila = { id: "abc", shop: "tienda.myshopify.com", period: "2026-05", aiAlt: 42 };
    prisma.aiUsage.findUnique.mockResolvedValue(fila);

    const result = await getUsage("tienda.myshopify.com");
    expect(result).toEqual(fila);
  });

  it("devuelve objeto default {aiAlt:0} cuando prisma retorna null (no crea fila)", async () => {
    prisma.aiUsage.findUnique.mockResolvedValue(null);

    const result = await getUsage("nueva-tienda.myshopify.com");

    expect(result.aiAlt).toBe(0);
    expect(result.shop).toBe("nueva-tienda.myshopify.com");
    expect(result.period).toMatch(/^\d{4}-\d{2}$/);
    // Confirmamos que no llamó upsert (no creó fila)
    expect(prisma.aiUsage.upsert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// remaining (con prisma mockeado)
// ---------------------------------------------------------------------------
describe("remaining", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("descuenta el uso existente de la quota del plan", async () => {
    prisma.aiUsage.findUnique.mockResolvedValue({
      shop: "tienda.myshopify.com",
      period: "2026-05",
      aiAlt: 60,
    });

    const result = await remaining("tienda.myshopify.com", PLAN.PRO, "aiAlt");
    // pro aiAlt quota = 100, used = 60 → remaining = 40
    expect(result).toBe(40);
  });

  it("devuelve 0 cuando no hay fila en DB (used=0) y el plan es free", async () => {
    prisma.aiUsage.findUnique.mockResolvedValue(null);

    const result = await remaining("tienda.myshopify.com", PLAN.FREE, "aiAlt");
    expect(result).toBe(0);
  });

  it("devuelve la quota completa cuando used=0 y plan es pro", async () => {
    prisma.aiUsage.findUnique.mockResolvedValue(null);

    const result = await remaining("tienda.myshopify.com", PLAN.PRO, "aiAlt");
    expect(result).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// increment (con prisma mockeado)
// ---------------------------------------------------------------------------
describe("increment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("llama upsert con la forma de incremento correcta", async () => {
    const filaActualizada = { id: "x", shop: "s.myshopify.com", period: "2026-05", aiAlt: 5 };
    prisma.aiUsage.upsert.mockResolvedValue(filaActualizada);

    await increment("s.myshopify.com", "aiAlt", 5);

    const call = prisma.aiUsage.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ shop_period: { shop: "s.myshopify.com", period: expect.stringMatching(/^\d{4}-\d{2}$/) } });
    expect(call.create).toMatchObject({ shop: "s.myshopify.com", aiAlt: 5 });
    expect(call.update).toEqual({ aiAlt: { increment: 5 } });
  });

  it("n por defecto es 1", async () => {
    prisma.aiUsage.upsert.mockResolvedValue({ id: "y", shop: "s.myshopify.com", period: "2026-05", aiAlt: 1 });

    await increment("s.myshopify.com", "aiAlt");

    const call = prisma.aiUsage.upsert.mock.calls[0][0];
    expect(call.create.aiAlt).toBe(1);
    expect(call.update).toEqual({ aiAlt: { increment: 1 } });
  });

  it("emite console.warn cuando el costo cruza COST_ALERT_USD", async () => {
    // 2500 * 0.002 = $5 → debe alertar
    prisma.aiUsage.upsert.mockResolvedValue({
      id: "z",
      shop: "s.myshopify.com",
      period: "2026-05",
      aiAlt: 2500,
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await increment("s.myshopify.com", "aiAlt", 1);

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("COST ALERT");
    expect(warnSpy.mock.calls[0][0]).toContain("s.myshopify.com");
  });

  it("NO emite console.warn cuando el costo está por debajo del umbral", async () => {
    prisma.aiUsage.upsert.mockResolvedValue({
      id: "w",
      shop: "s.myshopify.com",
      period: "2026-05",
      aiAlt: 10,
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await increment("s.myshopify.com", "aiAlt", 10);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("retorna la fila actualizada", async () => {
    const filaActualizada = { id: "r", shop: "s.myshopify.com", period: "2026-05", aiAlt: 3 };
    prisma.aiUsage.upsert.mockResolvedValue(filaActualizada);

    const result = await increment("s.myshopify.com", "aiAlt", 3);
    expect(result).toEqual(filaActualizada);
  });
});
