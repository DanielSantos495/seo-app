# Paso 2 — AI Text Generator (meta + descripción) + Capa de Contexto + Settings

> **Fecha:** 2026-05-29 · **Roadmap:** paso 2 de V2. **Spec tiering:** `docs/superpowers/specs/2026-05-26-v2-monetization-tiering-design.md` §3/§5.
> **Estado:** aprobado. Se ejecuta en la rama `dev`.

## Contexto

Paso 1 (AI alt text) está completo en `dev`. Paso 2 amplía el AI Text Generator a los demás campos SEO del producto y crea la **infraestructura de contexto** que mejora TODAS las generaciones (alt text incluido) y habilita features futuras (blogs, colecciones).

1. **Capa de contexto base ("skill"):** antes de generar, el LLM recibe un bloque conciso (token-eficiente) armado de (a) datos de Shopify — tienda + producto — y (b) un **input de texto libre del merchant** (voz de marca, industria, audiencia, diferenciadores). Reutilizable por alt text, meta y descripción.
2. **Nuevas generaciones (per-producto, preview editable + apply):** meta title, meta description, descripción del producto. Nunca sobrescriben en silencio.
3. **Sección Settings:** formulario del contexto del merchant + ejemplos + qué features lo usan.

**Decisiones (brainstorm 2026-05-29):**
- Generación **solo per-producto**: Generate → **preview editable** → Apply. Bulk de meta/desc → futuro.
- Quota: meta title + meta desc + descripción → cada generación = **1 `aiMeta`** (`ENTITLEMENTS`: 50 Pro / 300 Pro+; `ai-usage` parametrizado). Alt text sigue `aiAlt`. **Generar** consume quota; **editar/aplicar** gratis.
- Contexto del merchant = **un campo de texto libre** persistido por shop, con ejemplos guía.
- Reusar paso 1: `anthropic-fetch.js`, `ai-usage.js`, `plan.js`, patrón `alt-text-ai.js`. Sin deps nuevas. Mismas salvaguardas.
- Sin key Anthropic aún → e2e diferida; todo se construye + unit-testea. Privacy/prod = mismo gate pre-launch de paso 1.

## Archivos

**Nuevos:**
- `app/services/ai-context.js` — `buildContext({ shop, product, merchantContext })` → bloque **conciso** (solo campos no vacíos; trunca descripción ~300 chars + cap al merchantContext). Pura, testeable. El "skill" reusable.
- `app/services/shop-settings.js` — `getSettings(shop)` / `saveSettings(shop, { brandContext })` sobre `ShopSettings`.
- `app/services/text-gen-ai.js` — `generateMetaTitle/MetaDescription/Description({ product, context, locale })` → string validado (largos del analyzer: title 50–60, desc 120–160, descripción >100). Usa `anthropic-fetch` + contexto. Lanza en error. Espeja `alt-text-ai.js`.
- `app/routes/app.settings.jsx` — form `brandContext` (textarea + ejemplos + nota de features afectadas). Loader lee `ShopSettings`; action guarda.
- `app/routes/api.generate-text.jsx` — resource route: `{ productId, field }` → gatea plan/quota (`aiMeta`), arma contexto, llama `text-gen-ai`, **incrementa `aiMeta`**, devuelve el texto (preview). Errores claros.
- Tests: `ai-context.test.js`, `text-gen-ai.test.js` (fetch/anthropic-fetch mockeado).

**Modificados:**
- `prisma/schema.prisma` — `ShopSettings { id, shop @unique, brandContext String @default(""), updatedAt }` + migración.
- `app/services/shopify-api.js` — (a) ampliar query producto: `productType`, `vendor`, `tags`, precio; (b) `getShopContext(admin)` → `shop { name, currencyCode, ... }` (**verificar campos en 2026-04**); (c) `PRODUCT_UPDATE_MUTATION` + `updateProductSeoAndDescription(admin, gid, { seoTitle, seoDescription, descriptionHtml })` vía `productUpdate` (**verificar arg `product:` vs `input:` en 2026-04**).
- `app/services/alt-text-ai.js` — anteponer el bloque de contexto del merchant (mejora también el alt text).
- `app/services/shopify-api.js` (`bulkFixAltTextsForProducts`) — pasar `merchantContext` al `aiFn` (cargado 1 vez por job vía `shop-settings`).
- `app/routes/app.products_.$id.jsx` — por campo (meta title / meta desc / descripción): **Generate** (→ `api.generate-text`) → **preview editable** → **Apply** (action extendida con `field`/`intent` → `updateProductSeoAndDescription` + cache). Free → CTA upgrade. Mostrar `aiMeta` restante.
- `app/routes/app.jsx` — nav `Settings`; loader expone `aiMetaRemaining` (análogo a `aiAltRemaining`).

**Reutilizar:** `anthropic-fetch.js`, `ai-usage.js` (key `aiMeta`), `plan.js` (`getPlanInfo`/`quota`/`pricingPageUrl`), `seo-analyzer.js` (largos), `seo-cache.js` (`updateCachedItems`), `Session.locale`.

## Fases

- **A — Contexto:** `ShopSettings` + migración; `shop-settings.js`; `getShopContext` + ampliar query; `ai-context.js` + tests.
- **B — Generación:** `text-gen-ai.js` + `productUpdate` mutation/helper + tests.
- **C — UI per-producto + gating:** `api.generate-text` (gatea/incrementa `aiMeta`) + preview editable + Apply; threading de contexto al alt text; `aiMetaRemaining` en layout.
- **D — Settings:** `app.settings.jsx` + nav item.
- **E — Docs + final review.**

**Ejemplo de contexto del merchant** (placeholder/ayuda en Settings):
> "Specialty coffee brand. Warm, expert tone, no jargon. Audience: home-baristas 25–45. Differentiator: small-batch artisan roasting, direct trade. English (US). Avoid health claims."

**Salvaguardas (= paso 1):** quota `aiMeta` server-side en `api.generate-text`; fallback/errores claros si Anthropic cae (no rompe la página); gating por plan (free → 0 → CTA upgrade); preview editable evita overwrite accidental.

## Fuera de alcance (YAGNI / futuro)

- Bulk de meta/descripción · blogs/colecciones · créditos unificados / quota separada para descripción · auto-derivar "industria" de Shopify (viene del input del merchant).

## Verificación

**Ahora (sin key):** `pnpm test` verde (buildContext conciso/truncado; prompts con fetch mockeado; largos; quota); `pnpm build` + `pnpm lint`; migración `ShopSettings` aplica en DB dev local.

**Diferido (con key):** Settings guarda brandContext; producto → Generate meta/desc/descripción → preview editable refleja el contexto → Apply → visible en admin + baja `aiMeta`; alt text usa el contexto; free → CTA upgrade; key inválida → error claro sin romper.
