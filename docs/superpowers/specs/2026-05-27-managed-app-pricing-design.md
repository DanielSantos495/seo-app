# Spec — Managed App Pricing (paso 0 del roadmap V2)

> **Fecha:** 2026-05-27 · **Tipo:** infra / enabler de monetización
> **Estado:** diseño aprobado en brainstorming, pendiente review del usuario.
> **Idioma:** interno (español). Identificadores, constantes y copy user-facing en inglés.
> **Depende de:** `2026-05-26-v2-monetization-tiering-design.md` (fuente de verdad de los tiers).

---

## 1. Contexto y problema

Es el **paso 0** del roadmap V2 (flagship-first): el enabler que habilita cobrar cualquier
tier antes de construir las features pagas (paso 1 = AI alt text).

**Hallazgo que reencuadra el alcance:** V1 ya **eliminó todo el billing**. No existen
`app/services/billing.js` ni `app/routes/app.upgrade.jsx`, y `app/shopify.server.js` no
tiene bloque `billing`. Por lo tanto **esto no es una migración** desde el Billing API
custom: es **introducir Managed App Pricing desde cero** sobre código limpio.

Consecuencia: el bug `single-fetch + billing.request → 401` **no puede reaparecer**, porque
con Managed Pricing nunca llamamos `billing.request` desde nuestro código — solo redirigimos
a la página de planes hosteada por Shopify.

**Objetivo:** dejar el plumbing reutilizable (lectura de plan + entitlements) listo para que
el paso 1 enchufe el primer gate, sin construir UI muerta (no hay feature paga que gatear aún).

## 2. Decisiones aprobadas

| Eje | Decisión |
|---|---|
| Modelo de gating | **Mapa de entitlements declarativo** (un objeto central tier → capabilities/quotas). Descartados: chequeos de tier inline (lógica dispersa, no escala) y entitlements en DB (YAGNI; se enchufa después detrás de la misma interfaz). |
| Alcance paso 0 | **Plumbing reutilizable, sin UI.** Helper server-side + mapa + URL de upgrade lista. Sin CTA ni ruta de upgrade (nacen junto a la primera feature paga en paso 1). |
| Fuente de verdad del plan | **Shopify** vía `billing.check`. El mapa solo traduce tier → qué puede hacer el merchant. |
| Mecanismo de billing | **Managed App Pricing** (planes en Partner Dashboard, página de selección hosteada por Shopify). Sin bloque `billing` en código. |

## 3. Arquitectura

Un único módulo server-only nuevo: **`app/services/plan.js`**. Toda la lógica de planes vive
ahí; las features futuras solo lo consumen.

```
app/services/plan.js
├─ PLAN              constantes de nombres que coinciden EXACTO con los
│                    planes del Partner Dashboard ("Pro", "Pro+")
├─ ENTITLEMENTS      mapa declarativo tier → { capabilities, quotas }
├─ getPlan(billing)  lee billing.check() → 'free' | 'pro' | 'pro_plus'
│                    (free = sin suscripción activa)
├─ can(plan, cap)    pura: ¿este tier tiene esta capability?
├─ quota(plan, key)  pura: límite numérico del tier (0 = sin acceso)
└─ pricingPageUrl(shop)  URL de la página de planes hosteada por Shopify
```

Mapa de entitlements, alineado con §3 del spec de tiering (declarado completo aunque paso 0
no lo consuma todavía — agregar feature o tier es editar un solo lugar):

```js
const ENTITLEMENTS = {
  free:     { pagesAnalysis:false, htmlAnalysis:false, inlineAltEdit:false,
              recurringAudits:false, aiAlt:0,   aiMeta:0   },
  pro:      { pagesAnalysis:true,  htmlAnalysis:true,  inlineAltEdit:true,
              recurringAudits:false, aiAlt:100, aiMeta:50  },
  pro_plus: { pagesAnalysis:true,  htmlAnalysis:true,  inlineAltEdit:true,
              recurringAudits:true,  aiAlt:500, aiMeta:300 },
};
```

**Punto de integración:** el loader de `app/routes/app.jsx` (hoy línea 15: *"V1 free: no hay
distinción de plan"*) lee el plan **una vez por request** con `getPlan` y lo expone vía loader
data al árbol de rutas hijas. Cualquier feature futura recibe el plan sin re-consultar a Shopify.

**`isTest`:** lo deriva el módulo de `process.env` (reusa la semántica del viejo `BILLING_TEST`:
distinto de `"false"` → test). Debe coincidir con el tipo de suscripción que existe: dev store →
suscripción test → `isTest: true`; prod (live store) → suscripción real → `isTest: false`.

## 4. Flujo de datos y flujo de upgrade

**Lectura del plan (cada request):**

```
app.jsx loader
  → authenticate.admin(request)  → { billing }
  → getPlan(billing)             → billing.check({ isTest }) → tier
  → return { plan: tier, ... }   (loader data)
        ↓
  rutas/loaders hijos leen `plan` y llaman can()/quota()
```

`getPlan` mapea `appSubscriptions[0].name` → tier vía las constantes `PLAN`. Sin suscripción
activa → `'free'`. Una sola llamada a Shopify por request; el resultado viaja por loader data.

**Upgrade (Managed Pricing):**

```
CTA futuro (paso 1) → redirect 302 → pricingPageUrl(shop)
   = https://admin.shopify.com/store/<store-handle>/charges/<app-handle>/pricing_plans
        ↓
   Shopify hostea selección de plan, trial, proration, cobro y cancelación
        ↓
   merchant vuelve a la app → próximo request → getPlan lee el nuevo tier
```

- `<store-handle>` se deriva del shop de la sesión (`artesamir.myshopify.com` → `artesamir`).
- `<app-handle>` es **específico del entorno** (dev = `cury-seo-dev`; prod = handle del app de
  prod, a confirmar). Por eso debe venir de una **env var** (`APP_HANDLE`), no hardcodeado.
- **Nunca** llamamos `billing.request` → el bug single-fetch no puede reaparecer.

`pricingPageUrl()` queda lista en paso 0, pero **no hay ruta ni CTA todavía** (alcance acordado).

**Cancelación / downgrade:** sin webhook por ahora. El siguiente request lee el plan nuevo.
(El cache plan-aware viejo ya no existe; cuando lleguen features que cacheen por plan se
re-evalúa la invalidación — fuera de alcance.)

## 5. Manejo de errores y edge cases

| Caso | Comportamiento |
|---|---|
| `billing.check` falla (red/API) | **Fail-closed**: tratar como `'free'` + log. Nunca conceder acceso pago ante error. |
| Nombre de plan no matchea ninguna constante | Tratar como `'free'` + `console.warn` (señal de desalineación dashboard↔código). |
| Trial activo | Managed Pricing lo reporta como suscripción activa → tratado como el tier pago. Sin lógica extra. |
| Sin suscripción | `'free'` (camino normal, no es error). |

`getPlan` nunca lanza: siempre devuelve un tier válido.

## 6. Config y Partner Dashboard (trabajo interactivo)

- Plan **"Pro"** en Managed Pricing: **ya creado** (precio definido por el usuario, editable
  mientras no haya suscriptores). **Pro+ se difiere a paso 2**; el mapa ya lo incluye.
- El nombre del plan en el dashboard debe coincidir **exacto** con la constante `PLAN.PRO`.
- **Sin bloque `billing` en `shopify.server.js`** — los planes viven en el dashboard.
  *A verificar al implementar:* si `billing.check({plans})` exige declarar los nombres, se
  declaran solo los **nombres** como constantes (nunca montos).
- Handles confirmados (dev): store `artesamir`, app `cury-seo-dev`.

### 6.1 Prerequisitos para poder suscribirse en modo test (bloqueante de verificación)

Managed Pricing **no tiene toggle "modo test" para el merchant**. El cargo es gratis/test
**automáticamente solo en development stores y stores del partner**; en una store real el cobro
es real y no hay opción test. Para poder verificar sin pagar:

1. **Usar una development store** (Partner Dashboard → Stores → Add store → *Development store*).
   Confirmado 2026-05-27: la store de prueba `artesamir` **es una store real/live** — la página
   de planes pidió método de pago (*"You don't have any payment methods on file"*), señal de
   cargo real. En una development store el cargo es test automático y no pide tarjeta.
2. **El app dev debe tener distribución "Shopify App Store"** (Partner Dashboard → app →
   Distribution). Managed Pricing la exige; sin ella los planes no son suscribibles.

## 7. Alcance

**Dentro:** módulo `plan.js` (`getPlan`, `ENTITLEMENTS`, `can`, `quota`, `pricingPageUrl`),
integración en `app.jsx`, flag `isTest`, env var `APP_HANDLE`, plan Pro en el dashboard (hecho).

**Fuera (YAGNI / pasos posteriores):** ninguna feature gateada (no hay qué gatear aún), sin
CTA/ruta de upgrade (paso 1), sin activar Pro+ (paso 2), sin webhooks de `app_subscriptions/update`,
sin entitlements en DB.

## 8. Verificación (evidencia de que funciona)

Resueltos los prerequisitos de §6.1:

1. Suscribir la dev store a Pro vía la página hosteada → cargar la app → `getPlan` devuelve `'pro'`.
2. Cancelar la suscripción → próximo request devuelve `'free'`.
3. `pnpm build` + `pnpm lint` en verde.

## 9. Decisiones abiertas (fuera del alcance de este spec)

- Handle exacto del app de **prod** (para `APP_HANDLE` en Railway).
- Si `billing.check` con Managed Pricing requiere o no declarar los nombres de plan en `plans`.
- Precio/nombre final del plan (validación vs competencia: tarea aparte del spec de tiering §4).
- Webhook `app_subscriptions/update` para invalidar cache al instante (se evalúa cuando haya
  features que cacheen por plan).
