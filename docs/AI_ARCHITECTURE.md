# Cury SEO — Arquitectura de las features de IA (V2)

> **Audiencia:** cualquier dev o LLM (incluido Claude) que retome este código.
> **Estado:** construido y testeado en la rama **`dev`** (no en `main`/prod). La IA **no llama de verdad** hasta configurar `ANTHROPIC_API_KEY` (ver §9). Prod (`main`) sigue en V1 free / review.
> **Specs/planes fuente:** `docs/superpowers/specs/2026-05-26-v2-monetization-tiering-design.md` (tiering), `docs/superpowers/plans/2026-05-28-managed-app-pricing.md` (paso 0), `2026-05-28-ai-alt-text.md` (paso 1), `2026-05-29-ai-text-generator.md` (paso 2).

---

## 1. Visión general

V2 monetiza Cury SEO con features de IA, gateadas por plan (**Free / Pro / Pro+**) vía **Managed App Pricing** de Shopify. Se construyó en 3 pasos:

- **Paso 0 — Managed Pricing (plumbing):** leer el plan del merchant + mapa de entitlements. Sin features pagas todavía.
- **Paso 1 — AI alt text:** modo "Generate with AI" en el bulk fix de alt texts (Claude Vision), quota `aiAlt`.
- **Paso 2 — AI text + contexto + Settings:** generación per-producto de meta title / meta description / descripción (quota `aiMeta`), una **capa de contexto** reutilizable (datos de Shopify + input del merchant), y una sección **Settings**.

**Principios transversales:**
- **Gating server-side:** el plan se resuelve en el servidor (`getPlanInfo(billing)`), nunca se confía en el cliente. Free → quota 0 → la IA nunca se llama.
- **Quota mensual enforced server-side** (tabla `AiUsage`), se cobra **solo en éxito**.
- **Fallback / no destructivo:** alt text cae al generador determinista si la IA falla o se agota quota; el texto (meta/desc) usa **preview editable + apply explícito** (nunca pisa en silencio).
- **Sin dependencias nuevas:** la API de Anthropic se llama con un wrapper `fetch` propio (política de supply-chain, CLAUDE.md raíz §14).

---

## 2. Mapa de componentes

### 2.1 Capa de plan / billing
| Archivo | Responsabilidad |
|---|---|
| `app/services/plan.js` | Fuente de verdad de tiers. `PLAN` (free/pro/pro_plus), `PLAN_LABEL`, `ENTITLEMENTS` (capabilities boolean + quotas `aiAlt` 0/100/500, `aiMeta` 0/50/300), `SUBSCRIPTION_NAME_TO_TIER` (incluye el test plan `"pro test"`), `planFromSubscriptionName`, `can(plan,cap)`, `quota(plan,key)`, `getPlanInfo(billing)`→`{name,tier}` (lee `billing.check`), `getPlan(billing)`→tier, `pricingPageUrl(shopHandle)`. |
| `app/services/ai-usage.js` | Quota mensual sobre la tabla `AiUsage`. `currentPeriod()` ("YYYY-MM" UTC), `remaining(shop,plan,key)`, `increment(shop,key,n)` (upsert atómico + alerta de costo > $5/mes), `remainingFromUsed`/`estimatedCostUsd` (puras). |

### 2.2 Capa de IA
| Archivo | Responsabilidad |
|---|---|
| `app/services/anthropic-fetch.js` | Cliente genérico de la Messages API de Anthropic (sin SDK). `callAnthropicMessages({system,messages,maxTokens})`; lee `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` (`DEFAULT_MODEL = "claude-haiku-4-5-20251001"`); timeout + backoff en 429/5xx; **lanza** si no hay key o ante error. |
| `app/services/ai-context.js` | El **"skill"/contexto base**. `buildContext({shop,product,merchantContext})` → bloque conciso (token-eficiente, solo campos no vacíos, trunca). Se antepone a TODAS las generaciones. |
| `app/services/alt-text-ai.js` | `generateAltTextWithAI({imageUrl,productTitle,locale,context})` → alt (Claude Vision, ≤125 chars). Lanza en error. |
| `app/services/text-gen-ai.js` | `generateMetaTitle` / `generateMetaDescription` / `generateDescription({context,locale})` → texto validado (caps 60 / 160 / 1500). Lanza en error. |
| `app/services/alt-text-generator.js` | Generador **determinista** (sin IA): `generateAltTexts(product)` (fallback del alt text), `truncate`, `MAX_LENGTH`. |
| `app/services/shop-settings.js` | Persistencia del contexto del merchant. `getSettings(shop)`→`{brandContext}`, `saveSettings(shop,{brandContext})` (tabla `ShopSettings`). |

### 2.3 Capa Shopify
| Archivo | Responsabilidad |
|---|---|
| `app/services/shopify-api.js` | Queries (`GET_PRODUCT_SEO_QUERY` — incluye `productType`/`vendor`/`tags`/`priceRangeV2`; `GET_SHOP_QUERY`; `MEDIA_FIELDS`), `normalizeProduct`, `fetchProductById`, `fetchAllProducts`, `getShopContext(admin)`. Mutaciones: `updateProductAltTexts` (`productUpdateMedia`), `updateProductSeoAndDescription` (`productUpdate`, solo campos provistos). Bulk: `chooseAlts` (asigna IA vs naive por imagen) + `bulkFixAltTextsForProducts` (presupuesto de quota, fallback, carga el contexto 1 vez por job). |
| `app/services/shopify-fetch.js` | `shopifyGraphql` — rate-limit + retries centralizados. |
| `app/services/seo-job-runner.js` | Jobs en background: `startBulkAltJob`/`runBulkAltJob` (propagan `useAI`/`plan`/`locale`; `resultSummary` con `aiCount`/`naiveCount`). |
| `app/services/seo-analyzer.js` | Scoring puro + issues por campo (`seo.title`, `seo.description`, `descriptionHtml`, `images.altText`, `handle`) y los largos ideales que usa la generación. |
| `app/services/seo-cache.js`, `seo-job.js`, `image-url.js`, `admin-links.js` | Cache stale-while-revalidate, estado de jobs, `resizeCdnUrl`, deep links al admin. |

### 2.4 Rutas / UI
| Archivo | Responsabilidad |
|---|---|
| `app/routes/app.jsx` | Layout autenticado. Loader resuelve **una vez por request** `{ plan, planLabel, aiAltRemaining, aiMetaRemaining, upgradeUrl, shopHandle }` y los expone a las rutas hijas vía `useRouteLoaderData("routes/app")`. Nav: Dashboard / Products / Issues / **Settings**. |
| `app/routes/app._index.jsx` | Dashboard. Badge `Plan: <nombre> (<tier>)`. |
| `app/routes/app.products.jsx` | Listado + **bulk fix de alt** (modal `bulk-alt-modal`): toggle "Generate with AI" (Pro/Pro+ con quota restante; Free → CTA "Upgrade to Pro"). Action gatea el plan server-side y dispara `startBulkAltJob`. |
| `app/routes/app.products_.$id.jsx` | Detalle del producto. Alt fix per-producto + **3 generadores de texto** (meta title/desc/descripción) vía `AiTextField`. Action: intent `applyText` → `updateProductSeoAndDescription` + update de cache. |
| `app/components/AiTextField.jsx` | Bloque reutilizable: **Generate** (→ `api.generate-text`) → **preview editable** (`s-text-area`) → **Apply**. Free → CTA upgrade. |
| `app/routes/app.settings.jsx` | Sección **Settings**: form del `brandContext` (textarea + ejemplos + nota de qué features lo usan). |
| `app/routes/api.generate-text.jsx` | Resource route (POST) que **genera** texto: gatea quota `aiMeta`, arma el contexto, llama `text-gen-ai`, incrementa `aiMeta` (best-effort), devuelve el texto. |
| `app/routes/api.bulk-preview.jsx` | Samples de alt (preview del modal bulk). |

### 2.5 Persistencia (`prisma/schema.prisma`)
- `Session` (Shopify), `SeoCache` (último análisis), `SeoJob` (jobs bg: `analysis` / `bulk_alt`).
- `AiUsage { shop, period "YYYY-MM", aiAlt, aiMeta, @@unique([shop,period]) }` — contador mensual de IA.
- `ShopSettings { shop @unique, brandContext }` — contexto del merchant.

---

## 3. Flujos clave

### 3.1 Resolución de plan (cada request)
`app.jsx` loader → `getPlanInfo(billing)` → `billing.check({isTest})` → nombre de la suscripción → `planFromSubscriptionName` → tier → `ENTITLEMENTS`. Se expone a todas las rutas. **`billing.check` funciona sin bloque `billing` en `shopify.server.js`** porque el adapter `@shopify/shopify-app-react-router` hardcodea `unstable_managedPricingSupport: true`.

### 3.2 Bulk AI alt text (`aiAlt`)
`app.products.jsx` (toggle IA) → action (resuelve plan real) → `startBulkAltJob({useAI,plan,locale})` → `runBulkAltJob` → `bulkFixAltTextsForProducts`:
1. Si `useAI && shop`: lee `remaining(shop,plan,"aiAlt")` (presupuesto) + carga contexto (shop + brandContext) **una vez**.
2. Por imagen sin alt: si hay presupuesto → `generateAltTextWithAI` (con contexto); si falla o se agota → **fallback** a `generateAltTexts` (determinista).
3. Aplica vía `productUpdateMedia`; `increment(shop,"aiAlt",k)` por producto; update granular del cache.

### 3.3 Generación de texto per-producto (`aiMeta`)
`AiTextField` **Generate** → `POST /api/generate-text {productId, field}`:
1. Resuelve plan; `remaining(shop,tier,"aiMeta")`; si `<=0` → error (free → "Pro feature"; agotado → "limit"). **No llama al LLM.**
2. Arma contexto (`getShopContext` + `getSettings` + `buildContext`), llama el generador de `text-gen-ai`.
3. En éxito: `increment(shop,"aiMeta",1)` (best-effort) y devuelve el texto.
→ El merchant **edita** el preview → **Apply** → action `applyText` → `updateProductSeoAndDescription` (solo ese campo) → re-analiza + actualiza cache.

### 3.4 Capa de contexto (el "skill")
Settings guarda `brandContext` → en cada generación, `buildContext({shop,product,merchantContext})` arma un bloque conciso (Store, Currency, Brand context, Product, Type, Vendor, Tags, Price, Current description) que se antepone al prompt. **Lo usan alt text, meta title, meta description y descripción** — y queda listo para blogs/colecciones futuras.

---

## 4. Salvaguardas (obligatorias, spec §6)
- **Quota mensual server-side** (`AiUsage` + `ai-usage.js`), enforced en los endpoints, no solo en UI.
- **Cobro solo en éxito** (alt: `increment` tras aplicar; texto: tras generar OK). Best-effort: un error de DB al persistir uso no descarta el texto ya generado (dirección segura: undercharge).
- **Fallback graceful:** alt → determinista; texto → error claro, la página no se rompe.
- **Gating real por plan:** free → quota 0 → sin IA + CTA upgrade.
- **No destructivo:** texto siempre con preview editable; `applyText` toca **solo** el campo elegido.
- **Rate-limit por shop:** 1 solo job `bulk_alt` por shop (`findActiveJob`) + backoff en `anthropic-fetch`.
- **Alerta de costo** > ~$5/mes por shop (`ai-usage.js` loguea).

---

## 5. Tiers (Managed App Pricing)
| Tier | aiAlt/mes | aiMeta/mes | Cómo se reconoce |
|---|---|---|---|
| Free | 0 | 0 | sin suscripción |
| Pro | 100 | 50 | suscripción "Pro" |
| Pro+ | 500 | 300 | suscripción "Pro+" |

Para **testear billing en dev** sin cobro, Shopify (post-abril-2026) requiere un **$0 private test plan**; el de Cury SEO se llama **"Pro Test"** (mapeado a tier `pro` vía `SUBSCRIPTION_NAME_TO_TIER`). `billing.check` devuelve el **display name** del plan.

---

## 6. Cómo extender (futuro: blogs, colecciones, AI meta bulk)
1. Nuevo tipo de generación → agregar función en `text-gen-ai.js` (o un módulo nuevo) que reciba `{context, locale}` y use `anthropic-fetch`. Reutiliza `buildContext`.
2. Nueva quota → agregar la key numérica a `ENTITLEMENTS` **y** una columna `Int` a `AiUsage` (el test guard en `ai-usage.test.js` lo exige).
3. Gating → reusar `getPlanInfo` + `remaining`/`increment`. Endpoint propio tipo `api.generate-text`.
4. Contexto de tienda → si necesitás más datos de Shopify, ampliá `GET_SHOP_QUERY` / la query de producto y `buildContext` (manteniéndolo conciso).

---

## 7. Tests
vitest (`pnpm test`). Lógica pura testeada directo; las llamadas a Anthropic/Prisma se mockean. Cobertura clave: `plan.js`, `ai-usage.js` (+ test guard schema↔ENTITLEMENTS), `ai-context.js`, `alt-text-ai.js`, `anthropic-fetch.js`, `text-gen-ai.js`, `chooseAlts` (asignación AI-vs-naive). La verificación end-to-end real está **diferida** hasta tener `ANTHROPIC_API_KEY`.

---

## 8. Variables de entorno
| Var | Uso |
|---|---|
| `ANTHROPIC_API_KEY` | Key de Anthropic. Sin ella, la IA lanza y (alt) cae a determinista / (texto) muestra error. |
| `ANTHROPIC_MODEL` | Modelo. Default `claude-haiku-4-5-20251001`. |
| `BILLING_TEST` | `true` en dev (lee suscripciones test), **`false` en prod** (Railway). Default ausente = test. |
| `APP_HANDLE` | Handle del app para `pricingPageUrl`. dev `cury-seo-dev` · prod `seo-app-78`. |
| `DATABASE_URL`, `SHOPIFY_API_KEY/SECRET/SCOPES`, `SHOPIFY_APP_URL` | Estándar (ver `.env.example`). |

---

## 9. Obtener la `ANTHROPIC_API_KEY` (pasos)
1. Entrar a **https://console.anthropic.com** y crear cuenta / iniciar sesión.
2. **Billing → Add credits / payment method** (la API es de pago; sin créditos las llamadas fallan con 400/credit error). Cargar un monto chico para empezar.
3. **Settings → API Keys → Create Key** → copiar la key (`sk-ant-...`). Se muestra una sola vez.
4. (Opcional) Confirmar acceso al modelo Haiku visión; el default es `claude-haiku-4-5-20251001`.
5. **Dev:** poner `ANTHROPIC_API_KEY="sk-ant-..."` (y opcional `ANTHROPIC_MODEL=`) en el `.env` local → reiniciar `pnpm dev`.
6. **Prod (cuando se lance):** setear las mismas vars en Railway. **Gate legal:** antes de shipear a prod, actualizar la privacy policy declarando a Anthropic como sub-procesador (repo `cury-apps-site`, `privacy.html`).

---

## 10. Gate pre-launch (antes de prod)
1. Privacy update (Anthropic sub-procesador) en `cury-apps-site/privacy.html`.
2. `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` + `BILLING_TEST=false` en Railway.
3. Activar plan(es) **público(s)** en Managed Pricing (no solo el `$0 Pro Test`).
4. Merge `dev` → `main` (release) cuando la app pase el review del App Store.
