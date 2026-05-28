import { describe, it, expect, vi, afterEach } from "vitest";
import {
  PLAN,
  planFromSubscriptionName,
  can,
  quota,
  getPlan,
  getPlanInfo,
  pricingPageUrl,
} from "./plan.js";

describe("planFromSubscriptionName", () => {
  it("maps known plan names to tiers (case-insensitive)", () => {
    expect(planFromSubscriptionName("Pro")).toBe(PLAN.PRO);
    expect(planFromSubscriptionName("pro")).toBe(PLAN.PRO);
    expect(planFromSubscriptionName("Pro+")).toBe(PLAN.PRO_PLUS);
    expect(planFromSubscriptionName("Pro Test")).toBe(PLAN.PRO);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(planFromSubscriptionName("  Pro  ")).toBe(PLAN.PRO);
  });

  it("returns FREE for empty or unknown names", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(planFromSubscriptionName(undefined)).toBe(PLAN.FREE);
    expect(planFromSubscriptionName("")).toBe(PLAN.FREE);
    expect(planFromSubscriptionName("Enterprise")).toBe(PLAN.FREE);
    vi.restoreAllMocks();
  });
});

describe("can", () => {
  it("returns true only when the tier has the capability", () => {
    expect(can(PLAN.PRO, "htmlAnalysis")).toBe(true);
    expect(can(PLAN.FREE, "htmlAnalysis")).toBe(false);
    expect(can(PLAN.PRO, "recurringAudits")).toBe(false);
    expect(can(PLAN.PRO_PLUS, "recurringAudits")).toBe(true);
  });

  it("returns false for unknown tier or capability", () => {
    expect(can("bogus", "htmlAnalysis")).toBe(false);
    expect(can(PLAN.PRO, "bogusCap")).toBe(false);
  });
});

describe("quota", () => {
  it("returns the numeric quota for the tier/key", () => {
    expect(quota(PLAN.PRO, "aiAlt")).toBe(100);
    expect(quota(PLAN.PRO_PLUS, "aiMeta")).toBe(300);
    expect(quota(PLAN.FREE, "aiAlt")).toBe(0);
  });

  it("returns 0 for unknown tier or key", () => {
    expect(quota("bogus", "aiAlt")).toBe(0);
    expect(quota(PLAN.PRO, "bogusKey")).toBe(0);
  });
});

describe("getPlan", () => {
  afterEach(() => {
    // eslint-disable-next-line no-undef
    delete process.env.BILLING_TEST;
    vi.restoreAllMocks();
  });

  it("maps the first active subscription name to a tier", async () => {
    const billing = {
      check: vi.fn().mockResolvedValue({ appSubscriptions: [{ name: "Pro" }] }),
    };
    await expect(getPlan(billing)).resolves.toBe(PLAN.PRO);
  });

  it("returns FREE when there are no active subscriptions", async () => {
    const billing = {
      check: vi.fn().mockResolvedValue({ appSubscriptions: [] }),
    };
    await expect(getPlan(billing)).resolves.toBe(PLAN.FREE);
  });

  it("fails closed to FREE when billing.check throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const billing = { check: vi.fn().mockRejectedValue(new Error("network")) };
    await expect(getPlan(billing)).resolves.toBe(PLAN.FREE);
  });

  it("passes isTest=false only when BILLING_TEST is exactly 'false'", async () => {
    const billing = {
      check: vi.fn().mockResolvedValue({ appSubscriptions: [] }),
    };
    // eslint-disable-next-line no-undef
    process.env.BILLING_TEST = "false";
    await getPlan(billing);
    expect(billing.check).toHaveBeenNthCalledWith(1, { isTest: false });

    // eslint-disable-next-line no-undef
    process.env.BILLING_TEST = "true";
    await getPlan(billing);
    expect(billing.check).toHaveBeenNthCalledWith(2, { isTest: true });
  });
});

describe("getPlanInfo", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the raw subscription name and resolved tier", async () => {
    const billing = {
      check: vi
        .fn()
        .mockResolvedValue({ appSubscriptions: [{ name: "Pro Test" }] }),
    };
    await expect(getPlanInfo(billing)).resolves.toEqual({
      name: "Pro Test",
      tier: PLAN.PRO,
    });
  });

  it("returns null name and FREE when there is no active subscription", async () => {
    const billing = {
      check: vi.fn().mockResolvedValue({ appSubscriptions: [] }),
    };
    await expect(getPlanInfo(billing)).resolves.toEqual({
      name: null,
      tier: PLAN.FREE,
    });
  });

  it("fails closed to null/FREE when billing.check throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const billing = { check: vi.fn().mockRejectedValue(new Error("network")) };
    await expect(getPlanInfo(billing)).resolves.toEqual({
      name: null,
      tier: PLAN.FREE,
    });
  });
});

describe("pricingPageUrl", () => {
  afterEach(() => {
    // eslint-disable-next-line no-undef
    delete process.env.APP_HANDLE;
  });

  it("builds the hosted Managed Pricing URL from shop handle and APP_HANDLE", () => {
    // eslint-disable-next-line no-undef
    process.env.APP_HANDLE = "cury-seo-dev";
    expect(pricingPageUrl("artesamir")).toBe(
      "https://admin.shopify.com/store/artesamir/charges/cury-seo-dev/pricing_plans",
    );
  });
});
