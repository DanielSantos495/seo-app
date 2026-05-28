# Managed App Pricing (paso 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introducir Managed App Pricing desde cero: un módulo `plan.js` que lee el tier del merchant desde Shopify y un mapa de entitlements reutilizable, listo para que el paso 1 (AI alt text) enchufe el primer gate.

**Architecture:** La fuente de verdad del plan es Shopify (`billing.check`). Un módulo server-only `app/services/plan.js` traduce el nombre de la suscripción → tier interno (`free`/`pro`/`pro_plus`) y expone funciones puras `can()`/`quota()` sobre un mapa `ENTITLEMENTS` declarativo. El loader de `app/routes/app.jsx` resuelve el plan una vez por request. El upgrade es un redirect a la página de planes hosteada por Shopify (nunca `billing.request`).

**Tech Stack:** React Router v7, `@shopify/shopify-app-react-router` v1.1.0, vitest (nuevo, para la lógica pura), pnpm 11 (Node ≥22.13).

**Spec:** `docs/superpowers/specs/2026-05-27-managed-app-pricing-design.md`

---

## File Structure

- **Create** `app/services/plan.js` — toda la lógica de planes: `PLAN`, `ENTITLEMENTS`, `planFromSubscriptionName`, `can`, `quota`, `getPlan`, `pricingPageUrl`.
- **Create** `app/services/plan.test.js` — unit tests (vitest) de la lógica pura + `getPlan` con `billing` inyectado.
- **Create** `vitest.config.js` — config standalone (node environment).
- **Modify** `package.json` — dev dep `vitest` + scripts `test` / `test:watch`.
- **Modify** `app/routes/app.jsx:16-25` — loader: destructurar `billing`, resolver `plan`, devolverlo.
- **Modify** `.env.example` — agregar `APP_HANDLE`; `BILLING_TEST` ejemplo → `true` (template es de dev).
- **Local-only (no commit, gitignored)** `.env` — `BILLING_TEST="true"`, agregar `APP_HANDLE="cury-seo-dev"`.

---

## Task 1: Configurar vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`

- [ ] **Step 1: Instalar vitest**

Run (pnpm 11 requiere Node ≥22.13):
```bash
source ~/.nvm/nvm.sh && nvm use 22 && pnpm add -D vitest
```
Expected: vitest queda en `devDependencies` de `package.json`.

- [ ] **Step 2: Agregar scripts de test a `package.json`**

En el bloque `"scripts"`, después de `"typecheck": ...`, agregar:
```json
    "test": "vitest run",
    "test:watch": "vitest",
```
(Mantener la coma correcta respecto a la línea siguiente.)

- [ ] **Step 3: Crear `vitest.config.js`**

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["app/**/*.test.js"],
  },
});
```

- [ ] **Step 4: Verificar que el runner está disponible**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 && pnpm exec vitest --version
```
Expected: imprime una versión (ej. `vitest/3.x.x`). Sin errores.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.js
git commit -s -m "chore(test): add vitest for unit tests"
```

---

## Task 2: Módulo `plan.js` (TDD)

El módulo es chico y cohesivo → un solo ciclo TDD: se escribe el test file completo, falla porque `plan.js` no existe, se implementa, pasa.

**Files:**
- Create: `app/services/plan.test.js`
- Create: `app/services/plan.js`

- [ ] **Step 1: Escribir el test file completo**

`app/services/plan.test.js`:
```js
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  PLAN,
  planFromSubscriptionName,
  can,
  quota,
  getPlan,
  pricingPageUrl,
} from "./plan.js";

describe("planFromSubscriptionName", () => {
  it("maps known plan names to tiers (case-insensitive)", () => {
    expect(planFromSubscriptionName("Pro")).toBe(PLAN.PRO);
    expect(planFromSubscriptionName("pro")).toBe(PLAN.PRO);
    expect(planFromSubscriptionName("Pro+")).toBe(PLAN.PRO_PLUS);
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
    process.env.BILLING_TEST = "false";
    await getPlan(billing);
    expect(billing.check).toHaveBeenCalledWith({ isTest: false });

    process.env.BILLING_TEST = "true";
    await getPlan(billing);
    expect(billing.check).toHaveBeenCalledWith({ isTest: true });
  });
});

describe("pricingPageUrl", () => {
  afterEach(() => {
    delete process.env.APP_HANDLE;
  });

  it("builds the hosted Managed Pricing URL from shop handle and APP_HANDLE", () => {
    process.env.APP_HANDLE = "cury-seo-dev";
    expect(pricingPageUrl("artesamir")).toBe(
      "https://admin.shopify.com/store/artesamir/charges/cury-seo-dev/pricing_plans",
    );
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que FALLAN**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 && pnpm test
```
Expected: FALLA — no puede resolver el import `./plan.js` (módulo no existe).

- [ ] **Step 3: Implementar `app/services/plan.js`**

```js
// Lógica de planes (Managed App Pricing). Server-only.
// Fuente de verdad del plan: Shopify (billing.check). Este módulo solo
// traduce tier → qué puede hacer el merchant (mapa de entitlements).

// Nombres de tier internos. Free = ausencia de suscripción.
export const PLAN = {
  FREE: "free",
  PRO: "pro",
  PRO_PLUS: "pro_plus",
};

// Mapea el NOMBRE de la suscripción de Shopify (tal cual está en el Partner
// Dashboard, Managed Pricing) → tier interno. Las claves van en minúscula
// para tolerar diferencias de capitalización.
const SUBSCRIPTION_NAME_TO_TIER = {
  pro: PLAN.PRO,
  "pro+": PLAN.PRO_PLUS,
};

// Mapa declarativo tier → capabilities (boolean) y quotas (number).
// Agregar una feature o un tier = editar solo este objeto.
export const ENTITLEMENTS = {
  [PLAN.FREE]: {
    pagesAnalysis: false,
    htmlAnalysis: false,
    inlineAltEdit: false,
    recurringAudits: false,
    aiAlt: 0,
    aiMeta: 0,
  },
  [PLAN.PRO]: {
    pagesAnalysis: true,
    htmlAnalysis: true,
    inlineAltEdit: true,
    recurringAudits: false,
    aiAlt: 100,
    aiMeta: 50,
  },
  [PLAN.PRO_PLUS]: {
    pagesAnalysis: true,
    htmlAnalysis: true,
    inlineAltEdit: true,
    recurringAudits: true,
    aiAlt: 500,
    aiMeta: 300,
  },
};

// Pura: nombre de suscripción → tier. Vacío/desconocido → FREE.
export function planFromSubscriptionName(name) {
  if (!name) return PLAN.FREE;
  const tier = SUBSCRIPTION_NAME_TO_TIER[name.trim().toLowerCase()];
  if (!tier) {
    console.warn(`[plan] Unknown subscription name "${name}" → treating as free`);
    return PLAN.FREE;
  }
  return tier;
}

// Pura: ¿este tier tiene esta capability boolean?
export function can(plan, capability) {
  return ENTITLEMENTS[plan]?.[capability] === true;
}

// Pura: quota numérica del tier para esta key. 0 = sin acceso. Desconocido → 0.
export function quota(plan, key) {
  const value = ENTITLEMENTS[plan]?.[key];
  return typeof value === "number" ? value : 0;
}

// isTest se deriva de env: BILLING_TEST distinto de "false" → test.
function isTestBilling() {
  // eslint-disable-next-line no-undef
  return process.env.BILLING_TEST !== "false";
}

// Lee el plan activo del merchant vía billing.check. NUNCA lanza:
// cualquier error o nombre desconocido → FREE (fail-closed).
export async function getPlan(billing) {
  try {
    const { appSubscriptions } = await billing.check({ isTest: isTestBilling() });
    return planFromSubscriptionName(appSubscriptions?.[0]?.name);
  } catch (error) {
    console.warn(
      "[plan] billing.check failed → treating as free:",
      error?.message || error,
    );
    return PLAN.FREE;
  }
}

// URL de la página de planes hosteada por Shopify (Managed Pricing).
// shopHandle = subdominio de la store (ej. "artesamir").
// APP_HANDLE es específico del entorno (dev/prod) → viene de env.
export function pricingPageUrl(shopHandle) {
  // eslint-disable-next-line no-undef
  const appHandle = process.env.APP_HANDLE || "";
  return `https://admin.shopify.com/store/${shopHandle}/charges/${appHandle}/pricing_plans`;
}
```

> **Nota (verificación del paso 1 / open item §9 del spec):** `getPlan` llama `billing.check({ isTest })` **sin** `plans`, leyendo todas las suscripciones y mapeando por nombre (escalable). Si en la verificación manual de la Task 3 la dev store está suscrita pero `appSubscriptions` viene vacío, esta versión del SDK puede requerir `plans`. Fallback: cambiar la llamada a `billing.check({ isTest: isTestBilling(), plans: ["Pro", "Pro+"] })` (nombres EXACTOS del Partner Dashboard). No cambia el resto del módulo.

- [ ] **Step 4: Correr los tests y verificar que PASAN**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 && pnpm test
```
Expected: PASS — todos los tests en verde.

- [ ] **Step 5: Lint del módulo nuevo**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 && pnpm lint
```
Expected: sin errores. (Si `no-console` se queja en `plan.js`, agregar `// eslint-disable-next-line no-console` sobre cada `console.warn`, siguiendo el patrón de `no-undef` ya usado en el repo.)

- [ ] **Step 6: Commit**

```bash
git add app/services/plan.js app/services/plan.test.js
git commit -s -m "feat(billing): add plan entitlements module (Managed Pricing)"
```

---

## Task 3: Integrar el plan en el loader + env (verificación manual)

**Files:**
- Modify: `app/routes/app.jsx:1-25`
- Modify: `.env.example`
- Local-only: `.env` (gitignored)

- [ ] **Step 1: Importar `getPlan` en `app/routes/app.jsx`**

Después de la línea `import { authenticate } from "../shopify.server";`, agregar:
```js
import { getPlan } from "../services/plan";
```

- [ ] **Step 2: Resolver el plan en el loader**

Reemplazar el loader (líneas 16-25) por:
```js
export const loader = async ({ request }) => {
  const { session, billing } = await authenticate.admin(request);
  const plan = await getPlan(billing);

  return {
    // eslint-disable-next-line no-undef
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop,
    shopHandle: session.shop.replace(/\.myshopify\.com$/, ""),
    plan,
  };
};
```

- [ ] **Step 3: Agregar `APP_HANDLE` a `.env.example`**

En la sección `# --- Billing ---`, cambiar `BILLING_TEST=false` por `BILLING_TEST=true` (el template es de dev) y agregar debajo:
```
# Handle del app en el Partner Dashboard, para la URL de la pricing page
# hosteada (Managed Pricing). Específico del entorno:
#   dev  = cury-seo-dev
#   prod = seo-app-78
APP_HANDLE=
```

- [ ] **Step 4: Configurar el `.env` local (no se commitea)**

En `.env` (gitignored): cambiar `BILLING_TEST="false"` por `BILLING_TEST="true"` y agregar:
```
APP_HANDLE="cury-seo-dev"
```
> Crítico: sin `BILLING_TEST="true"` en dev, `getPlan` busca suscripciones reales y devuelve `'free'` aunque la dev store esté suscrita en modo test.

- [ ] **Step 5: Verificación manual en la dev store (con suscripción Pro)**

Prerequisitos (spec §6.1): dev store (no `artesamir`, que es live), app dev con distribución "Shopify App Store", suscrita a Pro en test.

1. Agregar temporalmente, justo después de `const plan = await getPlan(billing);`:
   ```js
   console.log("[plan] resolved:", plan);
   ```
2. Correr la app: `source ~/.nvm/nvm.sh && nvm use 22 && pnpm dev`, abrir la app en la dev store.
3. En los logs del CLI: `Expected: [plan] resolved: pro`.
4. Cancelar la suscripción desde el admin de la dev store → recargar la app → `Expected: [plan] resolved: free`.
5. Volver a suscribir a Pro si se quiere dejar lista para el paso 1.
6. **Quitar** el `console.log` temporal.

- [ ] **Step 6: Build + lint en verde**

Run:
```bash
source ~/.nvm/nvm.sh && nvm use 22 && pnpm build && pnpm lint
```
Expected: build exitoso, lint sin errores.

- [ ] **Step 7: Commit**

```bash
git add app/routes/app.jsx .env.example
git commit -s -m "feat(billing): resolve merchant plan in app loader"
```

> **Open item (spec §9) — RESUELTO 2026-05-28:** `APP_HANDLE="seo-app-78"` ya quedó seteado en las env vars de Railway (handle del app de prod). Dev usa `cury-seo-dev`.

---

## Self-Review

- **Spec coverage:** §3 arquitectura → Tasks 2-3; §4 flujo de datos + `pricingPageUrl` sin `billing.request` → Tasks 2-3; §5 errores (fail-closed, warn, sin sub, trial) → tests de Task 2; §6 config (sin bloque `billing`, handles) + §6.1 prerequisitos → Task 3 (env + verificación); §7 alcance (sin UI/gates) → respetado (no hay tareas de UI); §8 verificación → Task 3 step 5-6; §9 open items → notas en Task 2 (fallback `plans`) y Task 3 (APP_HANDLE prod). Sin gaps.
- **Placeholder scan:** sin TBD/TODO; todo el código está completo.
- **Type consistency:** `PLAN`, `ENTITLEMENTS`, `planFromSubscriptionName`, `can`, `quota`, `getPlan(billing)`, `pricingPageUrl(shopHandle)` usados consistentemente entre `plan.js`, `plan.test.js` y `app.jsx`.
