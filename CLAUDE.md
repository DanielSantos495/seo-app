# CLAUDE.md — SEO Analyzer (Shopify App)

> Contexto completo y fuente de verdad del proyecto.
> **Audiencia:** Dev / Claude / otro LLM (contexto técnico) **y** Marketing / Producto (qué hace la app de verdad, qué se puede prometer sin sobre-vender).
> **Última actualización:** 2026-05-25 · **Fase:** preparando publicación al Shopify App Store como **V1 100% gratis**.

---

## 1. TL;DR (léeme primero)

- **Qué es:** app pública embebida del Shopify App Store que **revisa la completitud técnica del SEO de cada producto** (meta tags, alt text en imágenes, descripción, handle/URL) y permite **completar los alt texts faltantes en bulk**.
- **Qué NO es:** no es una herramienta que estime ranking en Google, ni tráfico orgánico, ni que prometa "subir las ventas". Es una auditoría de campos faltantes/cortos sobre los productos del catálogo.
- **Modelo de monetización V1:** **100% gratis, sin límites de productos, sin tarjeta, sin trial**. La V1 no monetiza porque las funcionalidades actuales no justifican cobrar por sí mismas — sirven como producto de entrada y para construir reviews.
- **Roadmap de monetización:** **V2** introducirá funcionalidades pagas nuevas (generación de alt text con IA / Claude Vision, generación de meta descriptions con IA, análisis ampliado de páginas y colecciones, etc.). El precio y los planes se definen al diseñar V2 — **no prometer nada de V2 en el listing actual.**
- **Revenue share Shopify:** 0% en los primeros $1M USD vitalicios (aplicable cuando exista plan pago en V2).
- **Mercado:** global, **inglés primero** (US/UK/AU/CA). Listing y UI **100% en inglés**.
- **Estado del código:** MVP cerrado, gates de plan eliminados, todo el catálogo se analiza siempre, bulk fix abierto a todos. Build y lint en verde. Deploy en Railway con PostgreSQL.
- **Stack:** React Router v7 + Polaris Web Components + Prisma 6.19 / PostgreSQL + GraphQL Admin API 2026-04. Gestor: **pnpm 11**, Node 22.
- **URL producción:** `https://seo-app-production-b4fa.up.railway.app`

---

## 2. Para Marketing / Producto / soporte

Esta sección describe **lo que la app hace de verdad, hoy**, para construir listing, copy, ads, soporte y onboarding **sin sobre-prometer**.

### 2.0 Reglas de comunicación (obligatorias)

- ❌ **No usar** "best", "the only", "boost sales X%", "rank #1 on Google", "guaranteed", "improve your SEO score" como si fuera una métrica externa.
- ❌ **No prometer** mejora de ranking en buscadores. La app no toca el algoritmo de Google.
- ❌ **No generalizar** ("SEO Score" suena a métrica universal y oficial — usamos "completeness check" o "audit checklist" en su lugar).
- ✅ **Sí decir**: lo que la app revisa, lo que la app llena, y dejar claro que el resto del SEO (contenido, backlinks, autoridad, performance, etc.) depende del merchant.
- Regla Shopify oficial: prohibido claims no verificables. Si no podés probarlo con un dato, no lo digas.

### 2.1 Qué hace la app (funcionalidad real, hoy — V1 free)

Todas las funcionalidades de esta tabla están **disponibles para todos los merchants, sin pago, sin tope de productos, sin trial**.

| Capacidad | Detalle real (literal) |
|---|---|
| **Auditoría de meta title por producto** | Detecta si el meta title (`product.seo.title`) está **vacío** o si su longitud queda **fuera del rango 50–60 caracteres** (rango habitual antes de que Google trunque en SERP). Reporta el problema y sugiere un fix. |
| **Auditoría de meta description por producto** | Detecta si la meta description (`product.seo.description`) está **vacía** o si su longitud queda **fuera del rango 120–160 caracteres**. Reporta y sugiere fix. |
| **Auditoría de descripción del producto** | Detecta productos con `descriptionHtml` **vacío** o **menor a 100 caracteres de texto plano** (sin contar HTML). Reporta y sugiere fix. |
| **Auditoría de alt text en imágenes** | Por producto, cuenta cuántas imágenes tienen `altText` vacío vs. el total. Reporta los IDs de imágenes sin alt. |
| **Auditoría del handle/URL** | Marca handles que no cumplen `^[a-z0-9]+(-[a-z0-9]+)*$` o que terminan en sufijos numéricos largos (heurística para detectar handles auto-generados por Shopify). |
| **Reporte agregado (dashboard)** | Promedio de la puntuación de completitud del catálogo (ver §6 para qué significa exactamente esa puntuación), conteo de issues por severidad (critical / medium / low), top 5 productos peor puntuados. |
| **Vista de issues agrupados por tipo** | Reúne los issues de todos los productos por tipo (meta title, meta description, alt text, etc.) con deep links al admin de Shopify para arreglar a mano. |
| **Bulk fix de alt texts faltantes** | Para imágenes sin alt, genera un alt **derivado del título del producto y el nombre de la variante** y lo escribe via Admin GraphQL (`productUpdateMedia`). Se ejecuta en background con barra de progreso y sin tope de productos. **No usa IA**: es una concatenación determinística. La versión con IA queda para V2 y **no se promete aún**. |
| **Bulk fix por producto individual** | Misma generación de alt, aplicada solo al producto abierto en el detalle. Útil cuando el merchant quiere previsualizar antes de aplicar al catálogo entero. |
| **Export CSV del reporte** | Descarga un CSV (RFC 4180, BOM UTF-8 para Excel) con: Product ID, Title, Handle, Score interno, total de issues y desglose por severidad (critical / medium / low) y los campos con problema. |
| **Re-análisis on demand** | Botón "Re-analyze now" que invalida el cache y dispara un análisis fresco en background. Stale-while-revalidate: el dashboard sigue mostrando los datos previos mientras corre el nuevo análisis. |

### 2.2 Lo que la app NO hace (importante para soporte y copy)

Anti-features que vienen mucho como pregunta. Documentar para no inventar respuestas:

- ❌ **No** estima ranking en Google ni tráfico orgánico.
- ❌ **No** mejora ni promete mejorar el posicionamiento — solo deja los campos completados.
- ❌ **No** analiza páginas, colecciones, posts del blog ni la home (solo productos en V1; ampliación está en backlog).
- ❌ **No** revisa la estructura HTML (H1/H2/H3, sitemaps, robots.txt, schema.org, Open Graph) — V1 se enfoca en los campos editables de producto.
- ❌ **No** genera meta descriptions ni titles (V1 solo detecta los faltantes; la generación con IA queda para V2).
- ❌ **No** usa IA para los alt texts en V1 — la generación con Claude Vision se planifica para V2.
- ❌ **No** mide Core Web Vitals, velocidad de página ni mobile-friendliness.
- ❌ **No** tiene integración con Google Search Console ni con Google Analytics.

### 2.3 Contenido del listing (estado)

Fuente viva: `/marketing/seo-app/listing-content.md`.

| Campo | Estado | Valor / nota |
|---|---|---|
| App introduction (≤100 char) | ⏳ Por reescribir | Borrador antiguo prometía cosas que no debemos. Nuevo enfoque: "Find missing meta tags and alt texts across your products. Fix alt texts in bulk." |
| Listing title (≤30 char) | ⏳ Por reescribir | Candidato: "SEO Audit: Find & Fix" — evitar "Analyzer" si insinúa análisis externo de buscadores. |
| Features (3–5 líneas) | ⏳ Por reescribir | Centrarse en: detección de meta tags faltantes/cortos, conteo de alt texts faltantes, bulk fix de alt texts (sin IA), top peores productos, export CSV. |
| Long description | ⏳ Pendiente | Debe explicar qué hace y qué no hace (ver §2.1 y §2.2). No prometer ranking ni tráfico. |
| Search terms / keywords (ASO) | ⏳ Pendiente | Candidatos honestos: shopify seo audit, missing meta description, alt text checker, seo checklist shopify, bulk alt text, image alt text shopify. Evitar: "seo score", "google ranking". |
| Categorías | ⏳ Pendiente | Primaria: Store design > Site optimization > SEO. |
| Pricing copy | ✅ Decidido | **Free** — sin límites, sin tarjeta, sin trial. (V2 introducirá planes pagos con features nuevas; no anunciar todavía). |
| Email de soporte | ⏳ Pendiente | `support@<dominio>.app` — **dominio aún sin definir**. |
| App icon | ⏳ Pendiente | Brief en `/marketing/seo-app/prompts/app-icon-brief.md`. |
| Screenshots (≥3, 1280×800) | ⏳ Pendiente | Mostrar: dashboard con score y top peores, vista de issues agrupados, bulk fix modal con preview de alts. |
| Video demo (30–60s) | ⏳ Pendiente | |
| Privacy Policy + ToS | ⏳ Pendiente | Deben estar publicados y enlazados. |

### 2.4 Marketing & lanzamiento (resumen)

Plan completo: `/marketing/seo-app/launch-strategy.md`. Prompts operativos: `/marketing/seo-app/prompts/`.

> ⚠️ El `launch-strategy.md` puede contener supuestos del modelo freemium anterior (Free 25 productos + Pro $9/mes). Está pendiente de actualizar a la realidad V1 free total + V2 con monetización por definir. Cuando el doc diverja de este CLAUDE.md, **gana este archivo**.

- **Presupuesto ads (primeros 3 meses):** $0–$50/mes → estrategia ~95% orgánica.
- **Estrategia en 3 fases:** Pre-launch (deploy + landing + Privacy/ToS + assets + cuentas en redes) → Launch (ASO + Product Hunt + outreach manual 1-a-1 + primeras reviews) → Growth (blog SEO honesto, YouTube quincenal, comunidades).
- **Palancas asimétricas:** (1) ASO con keywords long-tail honestas; (2) comunidades (r/shopify, Indie Hackers, Shopify Community); (3) contenido educativo sobre auditoría SEO; (4) outreach con auditoría gratis como gancho (ahora literal: V1 es 100% free); (5) Product Hunt.
- **Hipótesis del modelo V1 free:** maximizar instalaciones y reviews positivas con cero fricción para construir distribución antes de monetizar con V2.

---

## 3. Estado actual del código (Mayo 2026)

**MVP cerrado, gates de plan eliminados, todo gratis y funcional.** El flujo end-to-end funciona: install → análisis en background del catálogo completo → dashboard → bulk fix → export CSV. Lo que queda es operativo (publicación), no de funcionalidad core.

### Implementado ✅

- OAuth + sesión con React Router v7 + Prisma session storage.
- Schema Prisma con 3 modelos: `Session`, `SeoCache`, `SeoJob`.
- **Análisis en background (jobs):** `SeoJob` + `seo-job` + `seo-job-runner`. Tipos `analysis` y `bulk_alt`, con heartbeat, detección de jobs zombies (>5 min sin heartbeat → `failed`), y polling desde el cliente (`api.job-status`).
- **Stale-while-revalidate:** el loader responde con cache (aunque esté stale) y dispara el re-análisis en background sin bloquear la respuesta.
- **Cache versionado:** el JSON del cache lleva `schema: "v2-free"`. Las filas viejas plan-aware (`plan: "free"|"pro"`) se invalidan automáticamente al desplegar V1 free; no hace falta migración manual.
- Dashboard (`/app`) con score de completitud, top peores productos, CTA re-analizar, export CSV, banner de job activo/fallido.
- Listado de productos (`/app/products`) con search, sort, paginación cliente (50 por página), bulk fix masivo sin tope (background job), preview de bulk (`api.bulk-preview`).
- Detalle de producto (`/app/products/:id`) con `IssuesList` + bulk fix por producto.
- Vista global de issues agrupados por tipo (`/app/issues`).
- 3 webhooks GDPR (`customers/data_request`, `customers/redact`, `shop/redact`) + `app/uninstalled` + `app/scopes_update`.
- `ErrorBoundary` con mensaje accionable para 403 (sesión con scopes obsoletos).
- Export CSV server-side con BOM UTF-8 para Excel.
- **i18n a inglés: completada** (UI, mensajes de issues/fixes, errores, copy de botones).
- **Deploy a producción:** Railway con Docker + PostgreSQL managed. URL y redirect de auth ya apuntan a Railway.
- **Tooling:** pnpm 11.2.2 sobre Node 22.

### Eliminado en este release (V1 free) 🧹

- **Billing API**: bloque `billing` removido de `app/shopify.server.js`. Sin `PRO_PLAN`, sin trial.
- **Servicios:** `app/services/billing.js` y `app/services/plan-cache.js` borrados.
- **Ruta:** `app/routes/app.upgrade.jsx` borrada (no hay flujo de upgrade en V1).
- **Webhook:** `app/routes/webhooks.app.subscriptions_update.jsx` borrado y entrada `app_subscriptions/update` retirada de `shopify.app.toml`.
- **Gates Pro/Free**: todas las rutas (`app._index`, `app.products`, `app.products_.$id`, `app.issues`, `api.bulk-preview`, `api.export.csv`) ya no hacen `checkIsPro`, no muestran banners de upgrade, no tienen modales de upgrade y no marcan items como `locked`.
- **Límite Free:** `FREE_PLAN_PRODUCT_LIMIT` retirado de `seo-analyzer.js` y de la firma de `buildItemsFromProducts`. El análisis siempre cubre el catálogo completo.

### Pendiente para estar live en el App Store ⏳

- [ ] Re-deploy a Railway con los cambios de V1 free.
- [ ] `pnpm shopify app deploy --force` para sincronizar el nuevo `shopify.app.toml` (sin webhook de subscriptions) con Partner Dashboard.
- [ ] Activar **Public Distribution** en el Partner Dashboard (sigue siendo requisito del App Store aunque ya no usemos Billing API).
- [ ] QA end-to-end en dev store fresca: install / uninstall / reinstall, análisis completo del catálogo, bulk fix, export CSV.
- [ ] Test de carga con catálogo grande (1k+ productos) — ver `FUTURE_IDEAS.md`.
- [ ] Re-escribir listing alineado a §2.1, §2.2, §2.3 (sin promesas de ranking, sin "score 0-100" como métrica SEO oficial).
- [ ] **Privacy Policy + Terms of Service** publicados y enlazados.
- [ ] Enviar a review de Shopify (5–10 días hábiles).

> **Docs complementarios** (algunos quedaron desfasados; cuando divergan, este CLAUDE.md es la fuente de verdad):
> - `deploy-plan.md` / `deploy-walkthrough.md` (bitácora del deploy; pueden mencionar Billing API y plan Pro).
> - `PRODUCTION_NOTES.md` (puede mencionar el bug single-fetch + billing.request, ya irrelevante en V1).
> - `FUTURE_IDEAS.md` (backlog; los items de IA / Claude Vision se reubican como **funcionalidad pensada para V2**).
> - `i18n-*.md` (migración a inglés, completada).
> - `/marketing/seo-app/launch-strategy.md` y `/marketing/seo-app/listing-content.md` (deben revisarse para alinear copy y precios a V1 free).

---

## 4. Stack técnico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Framework | **React Router v7** | Scaffold de `shopify app init` (ya no es Remix). Loaders/actions. |
| Runtime | **Node.js 22** | `engines`: `>=20.19 <22 \|\| >=22.12`. Prod corre en 22. |
| Gestor de paquetes | **pnpm 11.2.2** | `pnpm-workspace.yaml` declara `allowBuilds` y `overrides`. |
| UI | **Polaris Web Components** + App Bridge React | Custom elements `<s-page>`, `<s-button>`, etc. No se usa `@shopify/polaris`; `@shopify/polaris-types` solo aporta tipado. |
| Base de datos | **PostgreSQL** (prod, Railway) | `provider = "postgresql"`, `url = env("DATABASE_URL")`. |
| ORM | **Prisma 6.19.3** | Upgrade a Prisma 7 pospuesto (ver `FUTURE_IDEAS.md`). |
| Deploy | **Railway** (Docker) | Auto-deploy desde GitHub. Postgres managed en el mismo proyecto. |
| API Shopify | **GraphQL Admin API 2026-04** | REST deprecada — NO usar. |
| Pagos | **No aplica en V1.** | Se reintroducirá la Billing API (o Managed App Pricing) cuando V2 tenga features pagas. |
| Auth | OAuth 2.0 via App Bridge | Incluido en el scaffold. |

### Dependencias clave

```json
{
  "@shopify/shopify-app-react-router": "^1.1.0",
  "@shopify/shopify-app-session-storage-prisma": "^9.0.0",
  "@shopify/app-bridge-react": "^4.2.4",
  "@shopify/polaris-types": "1.0.1",
  "@react-router/dev": "^7.12.0",
  "@react-router/serve": "^7.12.0",
  "@prisma/client": "^6.16.3",
  "prisma": "^6.16.3",
  "react": "^18.3.1"
}
```

---

## 5. Estructura del proyecto

```
seo-app/
├── app/
│   ├── routes/
│   │   ├── app.jsx                        ← Layout embebido + nav + ErrorBoundary (403)
│   │   ├── app._index.jsx                 ← Dashboard: score + top peores + CSV + job/banner
│   │   ├── app.products.jsx               ← Listado: search/sort + bulk fix masivo (background)
│   │   ├── app.products_.$id.jsx          ← Detalle + bulk fix por producto
│   │   ├── app.issues.jsx                 ← Issues agrupados por tipo
│   │   ├── api.job-status.jsx             ← Endpoint de polling del estado de un job
│   │   ├── api.bulk-preview.jsx           ← Preview server-side de productos elegibles para bulk fix
│   │   ├── api.export[.]csv.jsx           ← Descarga del reporte CSV
│   │   ├── auth.$.jsx · auth.login/       ← OAuth
│   │   └── webhooks.*.jsx                 ← GDPR (3) + app.uninstalled + app.scopes_update
│   ├── services/
│   │   ├── seo-analyzer.js                ← Scoring puro (5 checks) + aggregate
│   │   ├── shopify-api.js                 ← Queries/mutations GraphQL
│   │   ├── shopify-fetch.js               ← Wrapper de admin.graphql (reintento THROTTLED + auto-throttle por cost)
│   │   ├── seo-cache.js                   ← Cache versionado (schema v2-free) + derivados pre-computados
│   │   ├── seo-job.js                     ← CRUD de jobs + detección de zombies + serialize
│   │   ├── seo-job-runner.js              ← Orquestador fire-and-forget (analysis / bulk_alt)
│   │   ├── alt-text-generator.js          ← Generación determinística de alt (sin IA)
│   │   ├── csv-export.js                  ← buildCsv / escapeCell (RFC 4180)
│   │   ├── admin-links.js                 ← Deep links shopify://admin/...
│   │   ├── image-url.js                   ← resizeCdnUrl (thumbnails CDN Shopify)
│   │   └── issue-labels.js                ← field → label humano + mostSevere
│   ├── components/
│   │   ├── IssuesList.jsx                 ← Lista reutilizable de issues con CTA al admin
│   │   ├── JobProgress.jsx                ← UI de progreso + hook useJobPolling
│   │   ├── BulkFixSummaryBanner.jsx       ← Resumen al terminar un bulk fix
│   │   ├── NavLink.jsx                    ← PrefetchButton / PrefetchClickable
│   │   └── RouteSkeleton.jsx              ← Skeleton de carga
│   ├── shopify.server.js                  ← Config auth (sin billing en V1)
│   └── db.server.js                       ← Prisma singleton
├── prisma/
│   ├── schema.prisma                      ← Session + SeoCache + SeoJob (postgresql)
│   └── migrations/20260521214901_init/    ← Migración Postgres consolidada
├── scripts/clear-alt-texts.js             ← Vaciar alts en dev store para probar bulk fix
├── Dockerfile                             ← Node 22 + corepack/pnpm + prisma migrate deploy
├── shopify.app.toml                       ← Config app + scopes + 3 webhooks GDPR + URL Railway
├── CLAUDE.md                              ← Este archivo (fuente de verdad)
├── deploy-plan.md / deploy-walkthrough.md ← Plan y bitácora del deploy
├── PRODUCTION_NOTES.md                    ← Troubleshooting de prod
├── FUTURE_IDEAS.md                        ← Backlog post-MVP (mayoría se mueve a V2)
└── i18n-audit.md / i18n-plan.md / i18n-validation.md ← Migración a inglés (completada)
```

---

## 6. Puntuación de completitud (qué es y qué NO es)

> ⚠️ **Esto es lo que más solemos sobre-vender. Léelo antes de redactar copy.**

La app calcula un número **0–100 por producto** en `app/services/seo-analyzer.js`. Ese número es la suma de puntos de **5 checks técnicos** sobre los campos editables del producto:

| Check | Puntos | Condición |
|-------|--------|-----------|
| Meta title presente | +25 (−10 si longitud fuera de 50–60 chars) | `seo.title` no vacío |
| Meta description presente | +25 (−10 si longitud fuera de 120–160 chars) | `seo.description` no vacío |
| Todas las imágenes con alt | +20 | Sin imágenes también suma 20 (no hay nada que penalizar) |
| Descripción del producto > 100 chars de texto plano | +20 | `descriptionHtml` strippeado |
| Handle / URL amigable | +10 | Solo `a-z0-9-`, sin sufijos numéricos auto-generados |

**Severidad de issues:** `high` = campo crítico ausente (title/description) · `medium` = presente pero subóptimo (longitud, alt texts faltantes) · `low` = mejoras menores (handle).

`aggregateAnalyses` promedia los scores por producto y cuenta issues por severidad para el dashboard.

### Cómo comunicarlo (y cómo NO)

- ✅ "**Completeness score**: cuántos de los 5 checks técnicos están pasando en cada producto."
- ✅ "Un puntaje alto significa que tus campos SEO editables están completos, **no que tu producto vaya a rankear primero en Google**."
- ❌ "Tu SEO Score es 87/100" — suena a una métrica oficial/universal de SEO. No lo es.
- ❌ "Sube tu SEO con la app" — el SEO real depende de contenido, autoridad de dominio, backlinks, performance y muchos factores que esta app **no toca**.
- ❌ "Conseguí 100/100 y mejorá tu ranking" — falso, sacar 100/100 solo significa que llenaste los 5 campos. Es necesario pero ni de lejos suficiente para rankear.

> El score sirve como **señal interna** para priorizar qué productos arreglar primero, y como **gamificación honesta** del progreso del catálogo. No es una promesa de tráfico.

---

## 7. Datos y APIs

### 7.1 Schema Prisma (`prisma/schema.prisma`)

- **`Session`** — sesiones de Shopify (gestionado por el SDK). Índice por `shop`.
- **`SeoCache`** — último análisis SEO por tienda (`shop` único). `data` = JSON con `{ schema: "v2-free", items: [...], summary, worstProducts, eligibleAltGids }`. TTL stale 1h (`seo-cache.js`).
- **`SeoJob`** — estado de jobs en background. `type` ∈ {`analysis`, `bulk_alt`}, `status` ∈ {`pending`, `running`, `done`, `failed`}, con `processed`/`total`, `payload`, `resultSummary`, `errorMessage` y `lastHeartbeatAt`. Índices `(shop,status)` y `(shop,type,status)`.

### 7.2 Scopes (`shopify.app.toml`)

```
scopes = "read_products,read_content,write_products"
```
- `read_products` → core del análisis (productos, imágenes, campos SEO).
- `read_content` → páginas y colecciones, reservado para análisis ampliado.
- `write_products` → bulk fix de alt texts (`productUpdateMedia`).

Regla: pedir solo lo mínimo. Cambiar scopes requiere reinstalación.

### 7.3 GraphQL (API 2026-04)

> ⚠️ En 2026-04 las imágenes viven bajo `media` (no `images`, que solo sirve para lectura y **no** en `ProductInput` para mutaciones). `normalizeProduct` filtra `mediaContentType === "IMAGE"` y expone `images: [{ id, altText, url }]`.

- **Lectura:** query de producto con `seo { title description }`, `descriptionHtml`, `media(first:50)`, `variants`. Paginación en `fetchAllProducts` con callback `onPage` para heartbeat del job.
- **Mutación (bulk fix):** `productUpdateMedia(productId, media: [{ id, alt }])` donde `id` es un MediaImage GID.

### 7.4 Webhooks (`shopify.app.toml`)

- GDPR (obligatorios): `customers/data_request` (200 vacío), `customers/redact` (200 vacío), `shop/redact` (borra `Session` + `SeoCache` del shop).
- `app/uninstalled` y `app/scopes_update` declarados por el scaffold.
- **Eliminado en V1:** `app_subscriptions/update` (ya no hay Billing API). Se reintroducirá en V2 si volvemos a usar Billing API.

---

## 8. Monetización (V1 = ninguna)

**V1 no monetiza.** No hay Billing API configurada en `app/shopify.server.js`. No hay flujo de upgrade. No hay banners de "Upgrade to Pro". Los servicios `billing.js` y `plan-cache.js` se eliminaron del repo.

**Por qué:** las funcionalidades actuales (detección de campos faltantes + bulk fix de alts sin IA) no justifican un precio por sí mismas. Cobrar por esto generaría reviews negativas y churn. La V1 sirve como producto de entrada gratuito para construir distribución y obtener señales reales de qué funcionalidades sí pagaría un merchant.

**V2 (cuando se diseñe):** introducirá funcionalidades pagas nuevas. Candidatos en el backlog (`FUTURE_IDEAS.md`, no prometer aún):

- Generación de alt text con **Claude Vision** (alt descriptivo basado en la imagen real, no en el título).
- Generación de **meta titles y meta descriptions** con Claude.
- Análisis ampliado de **páginas, colecciones, posts del blog**.
- Análisis de **estructura HTML real** (H1/H2/H3, Open Graph, schema.org).
- Bulk fix escalable con `bulkOperationRunMutation` para catálogos enormes.
- Edición inline del alt text propuesto antes de aplicar.

Al diseñar V2 se decidirá: Billing API custom vs **Managed App Pricing** (recomendado: Managed App Pricing porque elimina el bug single-fetch + billing.request y simplifica el código).

---

## 9. Configuración y entorno

### Variables de entorno (`.env.example`)

| Variable | Origen | Prod |
|---|---|---|
| `SHOPIFY_API_KEY` | Partner Dashboard (= `client_id`) | `bbd179e9f5f501e3917e14dd5297389c` |
| `SHOPIFY_API_SECRET` | Partner Dashboard | (secreto) |
| `SCOPES` | `shopify.app.toml` | `read_products,read_content,write_products` |
| `SHOPIFY_APP_URL` | URL pública Railway | `https://seo-app-production-b4fa.up.railway.app` |
| `DATABASE_URL` | Railway Postgres | `${{Postgres.DATABASE_URL}}` (referencia interna) |
| `NODE_ENV` | Manual | `production` |
| `PORT` | Railway auto-inject | (no setear manual; `react-router-serve` lo lee) |

> **`BILLING_TEST` ya no aplica en V1.** Cuando V2 reintroduzca pagos, esta tabla debe actualizarse.

### Parámetros de negocio

V1 no tiene parámetros de negocio configurables (no hay límites de plan ni precios). Toda la app analiza todo el catálogo y permite todas las acciones.

---

## 10. Roadmap

```
✅ Setup + GraphQL + scoring + cache
✅ UI Polaris WC: dashboard + productos + detalle + issues
✅ GDPR webhooks + bulk fix alt texts (por producto + masivo, sin IA)
✅ Jobs en background + stale-while-revalidate + paginación + skeletons
✅ Export CSV
✅ i18n a inglés (UI + mensajes)
✅ Deploy Railway + PostgreSQL + pnpm/Node 22
✅ V1 free: gates Pro removidos, billing eliminado, todo abierto
🚧 Publicación V1 free: re-deploy, listing reescrito sin sobre-promesas, Privacy/ToS, QA, review  ← ACÁ ESTAMOS
   Mes 3–6  → Iterar con feedback y reviews. Recolectar señales de qué pagarían los merchants.
   Mes 6+   → V2: diseñar y construir features pagas nuevas (AI alt text con Claude Vision, AI meta description generator, etc.) + reintroducir monetización (preferible: Managed App Pricing).
   Mes 12+  → V3 explorar: Sidekick App Extension, integración con Search Console (solo si la tracción lo justifica).
```

### Funcionalidad futura (backlog — todo V2+, no prometer en V1)

Detalle vivo en `FUTURE_IDEAS.md`. Resumen:

- **Alt text con IA (Claude Vision):** alt descriptivo basado en la imagen real. Pago.
- **AI meta description generator:** generar meta descriptions con Claude desde la descripción del producto. Pago.
- **AI meta title suggestion:** sugerir títulos en el rango 50–60 chars. Pago.
- **Análisis de páginas y colecciones** (reusa `IssuesList`). Free o pago según decisión de producto.
- **Análisis del HTML real** (estructura de headings H1/H2/H3, Open Graph, schema.org) en home/product/collection.
- **Bulk escalable con `bulkOperationRunMutation`** de Shopify para catálogos enormes.
- **Edición inline del alt text propuesto** antes de aplicar.
- **Migración a Managed App Pricing** al reintroducir monetización.
- **Upgrade a Prisma 7** (en rama dedicada, tras 2+ semanas estables).
- **Sidekick App Extension (V3):** requiere publicación de la app, tracción real, y acceso al preview.

---

## 11. Convenciones de código

- **JavaScript** (no TypeScript por ahora — simplificar el MVP).
- Componentes React funcionales con hooks.
- **Polaris Web Components** (`<s-page>`, `<s-section>`, `<s-button>`, `<s-stack>`, `<s-text>`, `<s-link>`, `<s-box>`, etc.) para todo lo visual dentro del admin — sin CSS custom salvo casos puntuales.
- Loaders/actions de **React Router v7** (`export const loader/action`).
- Lógica de negocio (scoring, jobs) en `app/services/` — funciones puras o módulos aislados, fáciles de testear. Queries GraphQL separadas del UI en `shopify-api.js`.
- **Identificadores y comentarios internos en español** (idioma del dev).
- **Strings user-facing en inglés, sin excepciones** (UI, errores, mensajes de fix, copy de botones).
- Antes de declarar algo "hecho": `pnpm run build` y `pnpm run lint` en verde.

---

## 12. Contexto del desarrollador

- **Ubicación:** Colombia (LATAM). **Disponibilidad:** tiempo libre (~10–15 hrs/sem).
- **Objetivo final:** ingresos recurrentes (MRR) como side project, monetizando con V2. La V1 free es una inversión deliberada en distribución y reviews, no un fin en sí mismo. La meta de MRR se redefine cuando V2 esté en discovery.

---

*Mantener este archivo actualizado a medida que el proyecto evoluciona. Claude lo lee automáticamente al iniciar en este directorio.*
