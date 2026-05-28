# Paso 1 — AI Alt Text (Claude Vision) · Plan de implementación

> **Fecha:** 2026-05-28 · **Roadmap:** paso 1 de V2 (primer feature pago).
> **Spec de tiering:** `docs/superpowers/specs/2026-05-26-v2-monetization-tiering-design.md` §5/§6.
> **Estado:** aprobado. Se ejecuta en la rama `dev`.

## Contexto

Hoy el bulk fix de alt texts usa un generador determinista naive (`${title} - ${variante}`).
Este paso agrega un modo **"Generate with AI"** que usa **Claude Haiku (visión)** para describir
cada imagen y producir alt texts ricos, gateado a **Pro/Pro+** con quota mensual (100 / 500),
apoyándose en el plumbing de Managed Pricing de paso 0 (`app/services/plan.js`).

**Decisiones (brainstorm 2026-05-28):**
- Modelo **Claude Haiku visión**, configurable vía env `ANTHROPIC_MODEL` (default Haiku). **No hay
  API key todavía** → verificación e2e diferida; el resto se construye y testea.
- Quota: **contador mensual por tipo** (`aiAlt`), modelo Prisma nuevo, enforced server-side.
- Bulk con quota agotada → **fallback al generador naive** (nadie queda sin alt + upsell).
- Sin dependencia nueva: wrapper `fetch` propio a Anthropic (CLAUDE.md §14), espejo de `shopify-fetch.js`.
- Privacy update + release a prod = **gate pre-launch documentado**, NO se ejecuta ahora (review/freeze).

Alcance: solo **AI alt text** (AI meta es paso 2).

## Archivos

**Nuevos:**
- `app/services/anthropic-fetch.js` — wrapper sobre la Messages API (POST `fetch`, timeout, backoff 429/5xx). Lee `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`. Espeja `shopify-fetch.js`.
- `app/services/alt-text-ai.js` — `generateAltTextWithAI({ imageUrl, productTitle, locale })` → string. Prompt (alt ≤125 chars, en el `locale` de la tienda), llama anthropic-fetch, valida/trunca (reusar `MAX_LENGTH` 125). Lanza en error.
- `app/services/ai-usage.js` — `getUsage(shop)`, `remaining(shop, plan, key)`, `increment(shop, key, n)`, `estimatedMonthlyCostUsd(shop)`. Sobre `AiUsage`.
- Tests vitest: `alt-text-ai.test.js`, `ai-usage.test.js`, y la asignación AI-vs-naive del bulk.

**Modificados:**
- `prisma/schema.prisma` — modelo `AiUsage { id, shop, period "YYYY-MM", aiAlt Int @default(0), updatedAt, @@unique([shop, period]) }` + migración.
- `app/services/shopify-api.js` — `bulkFixAltTextsForProducts(admin, gids, opts)` y `updateProductAltTexts`: `opts.useAI/shop/plan`; con `useAI`, por imagen sin alt → IA si hay quota (descuenta + cost tracking) si no, naive. Exponer `url` en el flatten de `images` (`MEDIA_FIELDS` ya trae `image{url}`); `resizeCdnUrl(url, ~512)` antes de Vision.
- `app/services/seo-job-runner.js` — `startBulkAltJob`/`runBulkAltJob` propagan `useAI` (en `payload`); `resultSummary` con `{ aiCount, naiveCount, errors }`.
- `app/routes/app.products.jsx` — action: leer `useAI`, resolver plan y **enforce server-side**. Modal `bulk-alt-modal`: toggle "Generate with AI" + quota restante; free → deshabilitado + CTA "Upgrade to Pro" (`upgradeUrl`, `target="_top"`).
- `app/routes/app.products_.$id.jsx` — toggle IA per-producto (secundario).
- `app/routes/app.jsx` — loader expone `aiAltRemaining` y `upgradeUrl` (= `pricingPageUrl(shopHandle)`).
- `.env.example` — `ANTHROPIC_API_KEY=` y `ANTHROPIC_MODEL=`.

**Reutilizar:** `plan.js` (`can`/`quota`/`getPlanInfo`/`PLAN`/`pricingPageUrl`), `alt-text-generator.js` (`generateAltTexts` = fallback), `shopify-fetch.js` (patrón), `image-url.js` (`resizeCdnUrl`), `seo-job.js`, `Session.locale`.

## Fases

- **A — Quota (backend):** `AiUsage` + migración; `ai-usage.js`; tests de quota math; enforce server-side.
- **B — Generación AI:** `anthropic-fetch.js` + `alt-text-ai.js`; tests con `fetch` mockeado (OK / 429→retry / error→throw); fallback graceful.
- **C — Integración bulk + gating:** `bulkFixAltTextsForProducts` con `useAI` (IA si quota, si no naive); job propaga `useAI`; action enforce plan/quota server-side.
- **D — UI:** toggle IA en `bulk-alt-modal` (Pro/Pro+ habilitado + quota; free deshabilitado + CTA upgrade); toast IA-vs-naive; toggle per-producto. Preview sigue naive (no gasta quota).
- **E — Env:** `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` en `.env.example`.

**Salvaguardas (spec §6):** quota server-side ✓ · fallback determinista si Anthropic cae ✓ · rate-limit por shop (1 solo `bulk_alt` job por shop vía `findActiveJob` + backoff de anthropic-fetch) ✓ · alerta de costo > ~$5/mes (`ai-usage.js` loguea/flagea) ✓.

## Pre-launch gate (documentado — NO en este plan)

1. **Privacy update** en `cury-apps-site` (`privacy.html`): Anthropic como sub-procesador. **Gate legal.**
2. `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` en Railway (prod).
3. Plan **Pro** público en Managed Pricing (no solo el $0 test plan).
4. Merge `dev` → `main`.

## Fuera de alcance (YAGNI / futuro)

- AI meta description/title (paso 2).
- Comprar cuota extra de IA (usage-based billing, revenue V2+).
- Créditos unificados, extender quota al próximo mes, selección múltiple de productos para IA.
- Preview del modal con IA (gasta quota).

## Verificación

**Ahora (sin key):** `pnpm test` verde (quota math, prompt builder con fetch mockeado, asignación AI-vs-naive, fallback); `pnpm build` + `pnpm lint` verdes; migración Prisma aplica en DB dev local.

**Diferido (con `ANTHROPIC_API_KEY` en dev):** dev store en Pro Test → toggle IA → Apply → alts por IA + `AiUsage.aiAlt` incrementa; quota baja → fallback naive + toast; tier free → CTA upgrade abre pricing page; key inválida → fallback graceful.
