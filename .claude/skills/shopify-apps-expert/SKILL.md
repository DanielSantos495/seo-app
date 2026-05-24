---
name: shopify-apps-expert
description: Experto en desarrollo de Shopify Apps PÚBLICAS (App Store) — stack del proyecto React Router v7 + Polaris Web Components + Prisma/Postgres + GraphQL Admin 2026-04 + Billing API. USA esta skill SIEMPRE que el trabajo toque código de `seo-app/` o cualquier futura app del repo, mencione Polaris embedded, billing/subscriptions, webhooks GDPR/scopes, deploy a Railway, listing del App Store, o decisiones de arquitectura para una app pública. También al evaluar APIs Shopify, antes de proponer features o refactors, y para validar que el patrón propuesto respeta las convenciones del proyecto. No usar para themes Shopify (existe `shopify-theme-guardian`) ni para storefronts Hydrogen (usar `shopify-plugin:shopify-hydrogen`).
---

# Shopify Apps Expert

Skill de orientación para construir y mantener **Shopify Apps públicas** (apps que se distribuyen por el Shopify App Store) dentro de este repo. Internaliza el stack, las convenciones y las trampas reales descubiertas al construir `seo-app` (el MVP del proyecto).

> Source-of-truth viva: `seo-app/CLAUDE.md`, `seo-app/PRODUCTION_NOTES.md`, `seo-app/deploy-plan.md`, `seo-app/deploy-walkthrough.md`, `marketing/seo-app/launch-strategy.md`. Cuando esos documentos digan algo distinto a esta skill, ganan ellos — esta skill se actualiza después.

---

## 1. Cuándo activarse / cuándo NO

**Activa** cuando:
- Trabajo en cualquier subcarpeta de app del repo (hoy `seo-app/`, mañana otras).
- Decisiones arquitectónicas sobre una app pública: schema Prisma, jobs background, cache, escalabilidad de Admin API.
- Cambios en billing, scopes, webhooks (GDPR o de negocio).
- Bugs de OAuth, embedding, `[object Object]`, 401, redirect URI mismatch.
- Deploy a Railway, Partner Dashboard, Public Distribution, `shopify app deploy`.
- Listing del App Store, screenshots, copy, categoría.
- Cualquier referencia explícita a "Shopify App", "App Store", "merchant app", "embedded admin".

**NO activa** cuando:
- Trabajo de **themes** Shopify (liquid, sections, snippets, assets) → `shopify-theme-guardian`.
- **Hydrogen storefronts** → `shopify-plugin:shopify-hydrogen`.
- **Extensions independientes** (checkout, customer account, POS) → la skill del plugin correspondiente.
- Onboarding de merchants (no devs) → `shopify-plugin:shopify-onboarding-merchant`.

---

## 2. Contexto del proyecto

- **Empresa**: "Shopify Apps - Creadores". Modelo: portafolio de apps freemium públicas en el App Store. Revenue share Shopify 0% en primeros $1M USD.
- **App actual**: `seo-app` (SEO Analyzer) — audita SEO de productos y bulk-fixea alt texts. Plan Free + Pro $9/mes (7 días trial).
- **Mercado**: global, inglés primero (US/UK/AU/CA ≈ 70% del mercado Shopify).
- **Idioma del proyecto**:
  - Chat con el usuario, briefs, estrategia: **español**.
  - Producto (UI, error messages, copy, mensajes de fix, listing): **inglés** sin excepciones.
  - Código: identificadores en inglés; comentarios pueden ser español o inglés, **no mezclar** ambos en el mismo módulo.

---

## 3. Stack canónico

| Capa | Versión / Tecnología | Nota crítica |
|---|---|---|
| Framework | **React Router v7** | NO es Remix. Scaffold actual del Shopify CLI. |
| UI | **Polaris Web Components** (`<s-*>`) | NO usar `@shopify/polaris` (React lib). `@shopify/polaris-types` solo aporta tipado. |
| DB ORM | Prisma `^6.16.3` (v7 pospuesto, ver `FUTURE_IDEAS.md`) | `provider = "postgresql"` en prod, `env("DATABASE_URL")`. |
| DB managed | PostgreSQL en Railway | Migraciones via `pnpm prisma migrate deploy` en `docker-start`. |
| Package manager | **pnpm v11.2.2** (pinned en `packageManager` field) | NUNCA usar npm. Node ≥22.13 requerido. Ver regla global #14. |
| Runtime | Node 22 LTS | Alpine en Dockerfile. |
| API Shopify | **GraphQL Admin API `2026-04`** | REST deprecada. No usar. Sincronizar versión entre `shopify.app.toml`, `shopify.server.js`, CLAUDE.md. |
| Auth/Embedding | App Bridge + Shopify session storage Prisma | OAuth maneja el scaffold. |
| Billing | **Shopify Billing API** custom (RecurringApplicationCharge) | Public Distribution obligatoria. |
| Hosting app | **Railway** (Dockerfile detectado) | Branch auto-deploy. |
| Webhooks | 3 GDPR + `app_subscriptions/update` | Declarados en `shopify.app.toml`, sube en cada `shopify app deploy`. |

---

## 4. Convenciones obligatorias del proyecto

- **Loaders/actions de React Router v7**: `export const loader = async ({ request }) => {...}` / `export const action`. Equivalentes a los de Remix pero NO importarlos de `@remix-run/*`.
- **Organización por responsabilidad**:
  - `app/routes/` — rutas (incluyendo webhooks).
  - `app/services/` — lógica de negocio pura (scoring, normalize, cache, jobs). Idealmente testeable sin mock de Shopify API.
  - `app/services/shopify-api.js` — TODAS las queries/mutations GraphQL. No esparcir.
  - `app/components/` — componentes UI reutilizables (clientes y server-safe).
  - `prisma/schema.prisma` — schema único.
- **Strings user-facing en inglés**. Validación: `i18n-validation.md` checklist.
- **Comentarios bilingües no mezclados**: si el módulo abrió en ES, mantener ES. Si abrió en EN, mantener EN.
- **`shopify.app.toml` → `pnpm shopify app deploy`** tras cada cambio. Si no, el Partner Dashboard queda desincronizado.
- **Schema Prisma → migración consolidada** generada via `pnpm prisma migrate dev --name <nombre>` apuntando a la DB destino (Railway en este proyecto).
- **No commitear** `.env`, `prisma/dev.sqlite`, `prisma/migrations.sqlite.bak/` ni nada bajo `.shopify/`. El `.gitignore` ya cubre esto.

---

## 5. Patrones críticos (gotchas internalizados)

Estas son las trampas reales encontradas durante el desarrollo de `seo-app`. Antes de tocar uno de estos temas, leer el detalle en `seo-app/PRODUCTION_NOTES.md`.

- **Billing — `billing.request()` SOLO desde loader GET con `target="_top"`**. POST via `<Form>` da 401 por single-fetch de React Router 7 (bug `shopify-app-js#1976`). El CTA tiene que ser `<s-button href={upgradeUrl} target="_top">`, nunca un form submit.
- **Public Distribution obligatoria** en Partner Dashboard (`Distribution → Distribute through the Shopify App Store`) aunque la app no esté publicada, sino Billing API responde *"Apps without a public distribution cannot use the Billing API"*.
- **Media API `2026-04`**: imágenes viven bajo `media` (modelo unificado con videos/3D). Filtrar `mediaContentType === "IMAGE"` para normalizar. El campo legacy `images` aún lee, pero **NO funciona en `ProductInput` para mutaciones**.
- **`productUpdateMedia`**: `UpdateMediaInput { id, alt }` donde `id` es un **MediaImage GID**, no Image GID. Confundirlos da `mediaUserErrors` silencioso.
- **Cache plan-aware**: la key del cache incluye el plan (`{shop, plan}`). Cambio de plan invalida automáticamente. Reforzado por webhook `app_subscriptions/update` para invalidación inmediata. Sin webhook, el merchant ve plan viejo hasta 1h después (TTL).
- **Jobs en background**: tabla `SeoJob` con `lastHeartbeatAt` para resiliencia (si el proceso reinicia, jobs viejos sin heartbeat se marcan `failed`). Cliente hace polling cada 2s.
- **GDPR webhooks**: 3 obligatorios (`customers/data_request`, `customers/redact`, `shop/redact`) más cualquiera de negocio. Declarados en `[[webhooks.subscriptions]]` con `compliance_topics`. Sin estos, listing es rechazado.
- **Scopes mínimos**: pedir solo lo necesario. `write_*` solo cuando una feature concreta lo justifique. Cambiar scopes requiere reinstalación.
- **`[object Object]` en la app tras cambiar scopes**: sesión vieja con access token de scopes obsoletos. `authenticate.admin` recibe 403 de Shopify y `boundary.error` no lo renderiza bien. Fix: borrar sesión (`DELETE FROM "Session";` en Postgres) y reinstalar. El `ErrorBoundary` del proyecto detecta 403 y muestra "Reinstall required" en lugar del crudo.

---

## 6. UI/UX con Polaris Web Components

- Elementos usados en `seo-app` (extracto de CLAUDE.md): `<s-page>`, `<s-section>`, `<s-button>`, `<s-stack>`, `<s-text>`, `<s-link>`, `<s-box>`, `<s-unordered-list>`. Para algo nuevo, primero verificar si existe el WC equivalente.
- **No usar CSS custom** salvo casos muy específicos (layouts que Polaris no resuelve). La paleta y spacing los maneja el design system.
- `@shopify/polaris-types` aporta typings de los `s-*` elements para autocomplete; NO instalar `@shopify/polaris` (es la lib React, otra cosa).
- **Para props/slots/eventos específicos** de un Polaris WC, delegar a `shopify-plugin:shopify-polaris-app-home` o `shopify-plugin:shopify-dev`. Esta skill no duplica esa documentación.
- **App Bridge** (`@shopify/app-bridge-react`): usar para navigation, toasts, modals que necesiten escapar del iframe (`target="_top"`).

---

## 7. Documentación viva — anti-alucinación

Regla #7 del CLAUDE.md global aplica con fuerza aquí: **no adivinar APIs, versiones, banderas, schema GraphQL, hooks o packages**. Antes de afirmar:

1. **Context7 MCP** (`mcp__plugin_context7_context7__query-docs`) para librerías (Prisma, React Router, Polaris, etc.). Es lo más rápido.
2. **`shopify-plugin:shopify-dev`** para search general en `shopify.dev`.
3. **WebFetch** para páginas específicas conocidas de `shopify.dev`.
4. **WebSearch** para changelogs, blogs oficiales (Shopify Engineering), issues GitHub recientes, posts del team Polaris.
5. Si la doc oficial es ambigua o contradictoria con lo que ves en el SDK instalado, **leer el código del SDK** en `node_modules/@shopify/*` antes de proponer.

Cuando cites versiones (ej. "GraphQL 2026-04"), confirma primero contra `shopify.app.toml`, `app/shopify.server.js`, y el SDK instalado. No confiar en memoria.

---

## 8. Delegación a skills específicas

Esta skill orquesta. Para temas específicos, **delegar** en vez de duplicar:

| Tema | Skill a invocar |
|---|---|
| Admin GraphQL queries/mutations | `shopify-plugin:shopify-admin` |
| Polaris embedded admin UI (props/slots) | `shopify-plugin:shopify-polaris-app-home` |
| CLI (`shopify app dev/deploy`, `shopify store auth/execute`) | `shopify-plugin:shopify-use-shopify-cli` |
| Pre-submission compliance check | `shopify-plugin:shopify-app-store-review` |
| Metafields / Metaobjects (definitions, queries) | `shopify-plugin:shopify-custom-data` |
| Functions (discount, checkout val, delivery custom) | `shopify-plugin:shopify-functions` |
| Customer Account API | `shopify-plugin:shopify-customer` |
| Partner API | `shopify-plugin:shopify-partner` |
| Cualquier API Shopify no listada | `shopify-plugin:shopify-dev` (catch-all) |

La señal de "delego" es cuando el detalle pedido ya está documentado en la skill especializada y replicarlo aquí solo crearía drift.

---

## 9. Flujo de deploy del proyecto

Source-of-truth:
- `seo-app/deploy-plan.md` — runbook estático (qué hacer paso a paso).
- `seo-app/deploy-walkthrough.md` — bitácora de la ejecución real (qué se hizo, decisiones tomadas, incidentes encontrados, comandos exactos).

Resumen mental (sin reemplazar la lectura de los docs):

1. Branch dedicada `feature/<algo>` desde `main`.
2. Cambios pre-deploy si aplican (schema Prisma postgresql, `.env.example` completo, Dockerfile Node 22 + corepack + pnpm).
3. Smoke local: `pnpm run build` y `pnpm run lint` deben pasar.
4. Push branch → Railway detecta y rebuildea.
5. Si es la primera migración: `pnpm prisma migrate dev --name init` contra `DATABASE_URL` de Railway (la URL pública con `proxy.rlwy.net`). Commit + push de `prisma/migrations/`.
6. `pnpm shopify app deploy --force` para sincronizar `shopify.app.toml` + 4 webhooks con Partner Dashboard.
7. Actualizar `SHOPIFY_APP_URL` en Railway env vars con la URL real del dominio Railway.
8. Activar **Public Distribution** en Partner Dashboard (gate de Billing API).
9. QA en dev store fresca: install → dashboard → upgrade flow → bulk fix → webhooks → uninstall/reinstall.

**Antes de modificar el flujo de deploy**, leer ambos docs y actualizarlos en el mismo PR.

---

## 10. Marketing / listing

- **Estrategia comercial completa**: `marketing/seo-app/launch-strategy.md` (5 palancas asimétricas, fases, KPIs, presupuesto, cronograma 12 meses).
- **Categoría App Store**: Store design > Site optimization > **SEO** (validado con el equipo).
- **Listing icon (1200×1200 PNG)**: brief en `marketing/seo-app/prompts/app-icon-brief.md`.
- **Navigation icon (16×16 SVG)** del sidebar del Admin: drafts y final en `seo-app/public/navigation-icon/`. Convención: `stroke="currentColor"`, `stroke-linecap="butt"` para detalles geométricos, `round` para curvas suaves.
- **i18n del producto**: la UI ya está 100% en inglés (proceso documentado en `seo-app/i18n-*.md`). No revertir a español.
- **Presupuesto ads early-stage**: $0–$50/mes USD. Pull lever es ASO, no paid.

---

## 11. Anti-patterns concretos

| ❌ Evitar | ✅ Hacer |
|---|---|
| `npm install / npm ci / npm run` | `pnpm install / pnpm install --frozen-lockfile / pnpm run` |
| `@shopify/polaris` (React lib) | Polaris Web Components `<s-*>` |
| REST Admin API | GraphQL Admin API 2026-04 |
| `billing.request()` desde action POST | Desde loader GET con `<s-button href="..." target="_top">` |
| Reescribir archivos completos con Write | Edit parcial (regla global #3) |
| `application_url = "https://example.com"` en `shopify.app.toml` | URL real de Railway (o variable env si lo abstraemos) |
| Comentarios mezclando ES/EN en el mismo módulo | Consistente con lo ya existente en ese módulo |
| Migraciones SQLite intentando aplicarse en Postgres | Migraciones generadas con `provider="postgresql"` contra la DB destino |
| Webhooks declarados solo en código sin tocar `shopify.app.toml` | Declararlos en `[[webhooks.subscriptions]]` y `pnpm shopify app deploy` |
| Adivinar la versión de un SDK por memoria | Verificar contra `package.json`, `node_modules/`, doc oficial |
| Hardcodear `BILLING_TEST=true` en prod | Setear `BILLING_TEST=false` en Railway env vars (sin esto Shopify no cobra) |
| `prisma migrate dev` contra Postgres prod por reflejo | Solo la primera vez (init contra DB vacía). Después siempre `migrate deploy`. |

---

## 12. Antes de cerrar una tarea

Checklist mental (regla global #5):

- [ ] Compila: `pnpm run build` pasa sin errores nuevos.
- [ ] Lint: `pnpm run lint` 0 errors.
- [ ] Si tocaste `prisma/schema.prisma` → generar migración apuntando a la DB destino y commitearla.
- [ ] Si tocaste `shopify.app.toml` → `pnpm shopify app deploy` y confirmar release nuevo en Partner Dashboard.
- [ ] Si tocaste UI → avisar al usuario que el QA visual en dev store es responsabilidad humana (no puedo abrir browser ni hacer screenshots de iframes embedded).
- [ ] Si tocaste billing, scopes, webhooks o cualquier cosa "publica" → re-leer la sección 5 de esta skill antes de marcar hecho.
- [ ] Si la app está en producción (Railway active) → verificar que los logs no muestren errores nuevos tras el redeploy.
- [ ] Mencionar explícitamente cualquier cambio que requiera acción del usuario (env vars en Railway, activación de algo en Partner Dashboard, instalación en dev store, etc.).

---

## 13. Recursos canónicos (links externos)

- [Build apps for Shopify](https://shopify.dev/docs/apps/build) — root de la doc oficial.
- [Polaris Web Components (App Home)](https://shopify.dev/docs/api/app-home/web-components) — referencia de los `<s-*>` elements.
- [App Home APIs](https://shopify.dev/docs/api/app-home/apis) — APIs disponibles dentro de la app embebida.
- [Page patterns](https://shopify.dev/docs/api/app-home/patterns) — layouts canónicos de páginas en el Admin.
- [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements) — checklist oficial para review.
- [Billing API](https://shopify.dev/docs/apps/launch/billing) — referencia de la Billing API.
- [GraphQL Admin API reference](https://shopify.dev/docs/api/admin-graphql) — confirmar versión `2026-04`.

Cuando alguna de estas páginas dé 404 (Shopify reorganiza la doc cada release), buscar el equivalente actual y actualizar este archivo en el mismo PR.
