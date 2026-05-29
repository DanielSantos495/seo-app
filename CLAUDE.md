# CLAUDE.md — Cury SEO (Shopify App)

> Contexto completo y fuente de verdad del proyecto.
> **Audiencia:** Dev / Claude / otro LLM (contexto técnico) **y** Marketing / Producto (qué hace la app de verdad, qué se puede prometer sin sobre-vender).
> **Última actualización:** 2026-05-26 · **Fase:** **submit-ready** — todo el contenido del listing decidido, assets visuales completos, video subido a Vimeo. Pendiente: pre-submit QA + apretar el botón "Submit for review".
> **Marca paraguas:** Cury Apps (`curyapps.com`).
> **Slug interno (repo + URL path):** `seo-app` / `/seo-analyzer/`.
> **Display name (public-facing):** **Cury SEO**.

---

## 1. TL;DR (léeme primero)

- **Qué es:** app pública embebida del Shopify App Store, marca **Cury SEO**, que **audita los campos on-page SEO de cada producto** (meta title, meta description, alt text, descripción, handle) y permite **completar alt texts faltantes en bulk**.
- **Qué NO es:** no estima ranking de Google, no estima tráfico orgánico, no promete "mejorar el SEO". Es auditoría de campos editables del catálogo, no un servicio SEO completo.
- **Modelo V1**: 100% gratis, sin tope de productos, sin trial, sin tarjeta. Decisión deliberada — las features actuales sirven como producto de entrada para construir reviews antes de monetizar V2.
- **Revenue share Shopify**: 0% en primeros $1M USD vitalicios (aplicable cuando V2 introduzca pago).
- **Mercado**: global, **inglés primero** (US/UK/AU/CA). UI 100% en inglés.
- **Estado del código**: V1 cerrado. Gates de Pro removidos, billing eliminado, cache schema bumpeado a v2-free. Build y lint en verde. Modal de "Generate missing alt texts" recientemente rediseñado (commit `76dca6a`). App renombrada de "SEO Analyzer" → **Cury SEO** tras feedback de Shopify (commit `f519b70`).
- **Estado V2 (rama `dev`, NO mergeado a `main`)**: pasos 0/1/2 construidos y testeados — Managed App Pricing + AI alt text (Claude Vision) + AI meta title/description + descripción + **capa de contexto reutilizable** + sección **Settings**. La IA no llama de verdad hasta configurar `ANTHROPIC_API_KEY`. Arquitectura completa: `docs/AI_ARCHITECTURE.md`. Planes: `docs/superpowers/plans/2026-05-2{7,8,9}-*.md`. Spec de tiering: `docs/superpowers/specs/2026-05-26-v2-monetization-tiering-design.md`. Mientras prod sigue en review, las §§ 8 "Monetización" y 10 "Pricing" más abajo describen el estado V1; el modelo V2 vive en esos docs.
- **Stack**: React Router v7 + Polaris Web Components + Prisma 6.19 / PostgreSQL + GraphQL Admin API 2026-04. Gestor: **pnpm 11.2.2**, Node 22.
- **URL producción (Railway)**: `https://seo-app-production-b4fa.up.railway.app`
- **Marca + legales**: landing Cury SEO en `https://curyapps.com/seo-analyzer/`. Privacy en `/seo-analyzer/privacy.html`, Terms en `/seo-analyzer/terms.html`. Sitio Cloudflare Pages, repo `cury-apps-site` en GitHub.
- **Test store del review**: `cury-vdrxupzo.myshopify.com` con seed + staff `reviewer@curyapps.com`.
- **Video demo**: `https://vimeo.com/1195725714` (público).

---

## 2. Para Marketing / Producto / soporte

Esta sección describe **lo que la app hace de verdad, hoy**, para construir listing, copy, ads, soporte y onboarding **sin sobre-prometer**.

### 2.0 Reglas de comunicación (obligatorias)

- ❌ **No usar** "best", "the only", "boost sales X%", "rank #1 on Google", "guaranteed", "improve your SEO score" como métrica externa.
- ❌ **No prometer** mejora de ranking en buscadores. La app no toca el algoritmo de Google.
- ❌ **No generalizar** ("SEO Score" suena a métrica universal — usamos "completeness check" o "audit checklist" en su lugar).
- ❌ **Regla 4.2.1 Shopify**: la palabra "free" y cualquier referencia a pricing **solo** en la sección Pricing del listing. Fuera de ahí, ni "free", ni "no credit card", ni "$", ni "unlimited" (suena a feature de plan pago).
- ✅ **Sí decir**: lo que la app revisa, lo que la app llena, y dejar claro que el resto del SEO (contenido, backlinks, autoridad, performance) depende del merchant.

### 2.1 Qué hace la app (funcionalidad real, hoy — V1 free)

Todas estas funcionalidades están **disponibles para todos los merchants, sin pago, sin tope de productos, sin trial**.

| Capacidad | Detalle real (literal) |
|---|---|
| **Auditoría de meta title por producto** | Detecta si `product.seo.title` está **vacío** o si su longitud queda **fuera del rango 50–60 caracteres** (rango habitual antes de que Google trunque en SERP). |
| **Auditoría de meta description por producto** | Detecta si `product.seo.description` está **vacía** o si su longitud queda **fuera del rango 120–160 caracteres**. |
| **Auditoría de descripción del producto** | Detecta productos con `descriptionHtml` **vacío** o **menor a 100 caracteres de texto plano** (sin contar HTML). |
| **Auditoría de alt text en imágenes** | Por producto, cuenta imágenes con `altText` vacío vs. total. Reporta IDs de imágenes sin alt. |
| **Auditoría del handle/URL** | Marca handles que no cumplen `^[a-z0-9]+(-[a-z0-9]+)*$` o que terminan en sufijos numéricos largos (heurística para detectar handles auto-generados por Shopify). |
| **Reporte agregado (dashboard)** | Promedio del *completeness score* del catálogo (ver §6 para qué significa), conteo de issues por severidad (critical / medium / low), top 5 productos peor puntuados. |
| **Vista de issues agrupados por tipo** | Reúne issues de todos los productos por tipo (meta title, meta description, alt text, etc.) con deep links al admin de Shopify para arreglar a mano. |
| **Bulk fix de alt texts faltantes** | Para imágenes sin alt, genera alt **derivado del título del producto y el nombre de la variante** (deterministic, sin IA) y lo escribe via `productUpdateMedia`. Background job con barra de progreso, sin tope de productos. |
| **Bulk fix por producto individual** | Misma generación de alt aplicada al producto abierto en el detalle. Modal rediseñado (commit `76dca6a`) — preview de alts sin thumbnails, botones inline al pie. |
| **Export CSV del reporte** | Descarga CSV (RFC 4180, BOM UTF-8 para Excel) con Product ID, Title, Handle, Score, total de issues y desglose por severidad. |
| **Re-análisis on demand** | Botón "Re-analyze now" que invalida cache y dispara análisis fresco en background. Stale-while-revalidate. |

### 2.2 Lo que la app NO hace (importante para soporte y copy)

Anti-features que vienen mucho como pregunta:

- ❌ **No** estima ranking en Google ni tráfico orgánico.
- ❌ **No** mejora ni promete mejorar el posicionamiento — solo deja los campos completados.
- ❌ **No** analiza páginas, colecciones, posts del blog ni la home (solo productos en V1; ampliación en V2 paid).
- ❌ **No** revisa estructura HTML (H1/H2/H3, sitemaps, robots.txt, schema.org, Open Graph) — V1 se enfoca en campos editables del Admin API. Análisis estructural está en V2 paid (ver `FUTURE_IDEAS.md`).
- ❌ **No** genera meta descriptions ni titles (V1 solo detecta faltantes; la generación con IA queda para V2).
- ❌ **No** usa IA para los alt texts en V1 — generación con Claude Vision en V2.
- ❌ **No** mide Core Web Vitals, velocidad de página ni mobile-friendliness.
- ❌ **No** tiene integración con Google Search Console ni Google Analytics.

### 2.3 Contenido del listing (estado submit-ready)

Fuente viva: `/marketing/seo-app/listing-content.md`. Resumen del estado al 2026-05-26:

| § | Campo | Estado | Valor |
|---|---|---|---|
| 1 | App introduction (≤100 char) | ✅ | "Audit every product's meta tags, descriptions, and alt texts. Fix alt texts in bulk." |
| 1.5 | App card subtitle (≤62 char) | ✅ | "Audit on-page SEO and bulk-fix missing image alt texts." |
| 2 | Listing title (≤30 char) | ✅ | **`Cury SEO`** (renombrado tras feedback Shopify; antes "SEO Analyzer: Audit & Fix"). |
| 3 | App details (≤500 char) | ✅ | Texto sin pricing words, sin claims de ranking. Empieza "Cury SEO reviews the on-page SEO fields…". |
| 4 | Features (3–5 líneas) | ✅ | 5 bullets, sin (Pro), cubre detección + bulk fix + agrupación + CSV. |
| 5 | Long description | ⏭️ | **Decisión: no publicar en V1**. Texto redactado por si se decide pegar después. |
| 6 | Search terms | ✅ | `alt text checker`, `bulk alt text`, `seo audit`, `missing meta tags`. |
| 7 | Categorías | ✅ | Primaria `Store design > Site optimization > SEO`. Secundaria `Store management > Operations` (tags `Bulk editor`, `Workflow automation`, `Analytics`). |
| 8 | Pricing | ✅ | Free. Sin tope, sin trial, sin tarjeta. |
| 9 | Support | ✅ | `support@curyapps.com` (público) + `dsantos0495@gmail.com` (emergency dev contact). |
| 10 | Privacy + ToS URLs | ✅ | `https://curyapps.com/seo-analyzer/privacy.html` + `/terms.html`. Live en Cloudflare Pages. |
| 11 | Languages | ✅ | English únicamente. |
| 12.1 | Test account | ✅ | Store `cury-vdrxupzo.myshopify.com`, staff `reviewer@curyapps.com` (password en Partner Dashboard, NO en repo). |
| 12.2 | Testing instructions | ✅ | 11 pasos numerados, copy/paste ready. |
| 13 | Visual assets | ✅ | App icon listo, 4 screenshots 1600×900 en `assets/seo-app-assets/`, video Vimeo `https://vimeo.com/1195725714` (público). |

### 2.4 Estado de la publicación (al 2026-05-26)

**Bloqueantes restantes para submit: ninguno operativo, solo QA final.**

Pasos antes de apretar "Submit for review":

1. ~~Renombrar el video en Vimeo~~ ✅ hecho 2026-05-26. El contenido visual del video puede mencionar "SEO Analyzer" si se grabó antes del rename — decisión pragmática: dejarlo, no es bloqueante.
2. **Login en incógnita** a `cury-vdrxupzo.myshopify.com/admin` como `reviewer@curyapps.com` y correr los 11 pasos del §12.2 del listing-content. Verificar que cada step funciona.
3. **Vista previa del listing** en Partner Dashboard → confirmar visualmente que todo dice "Cury SEO", sin "free"/"$" fuera de pricing, sin URLs en App details.
4. **Verificar Public Distribution** activo en Partner Dashboard (requisito del App Store aunque no usemos Billing API en V1).
5. **Submit for review.** Tiempo estimado: 5–10 días hábiles.

### 2.5 Feedbacks recibidos de Shopify y cómo se resolvieron

| Feedback | Causa | Resolución |
|---|---|---|
| "Remove the word 'free' if it's a reference to pricing." | §3 App details cerraba con "All features are free, no caps, no credit card." | Reescribir cierre a "Works for any catalog size." y mover "free" exclusivamente a §8 Pricing. Regla aplicada también a §12.2 Testing instructions y a las reglas internas del doc. |
| "App names can't be generic or only describe the app's functionality. Make sure your app has a unique brand name." | Title viejo "SEO Analyzer: Audit & Fix" sin brand identifier — ambas partes describían función. | Rename a **"Cury SEO"** (patrón validado: "Yoast SEO", "Booster SEO", "AvadaSEO"). "Cury" es brand identifier único; "SEO" mantiene categoría para discoverability. |
| "Listing name doesn't match app configuration name (\"seo-app\" vs listing title)." | `shopify.app.toml` tenía `name = "seo-app"` (slug del scaffold). | Cambiar `name = "Cury SEO"` en `shopify.app.toml` + correr `pnpm shopify app deploy --force` para sincronizar al Partner Dashboard. |

### 2.6 Marketing & lanzamiento (resumen)

Plan completo: `/marketing/seo-app/launch-strategy.md` (atención: puede contener supuestos del modelo freemium anterior; si diverge de este CLAUDE.md, gana este archivo).

- **Presupuesto ads (primeros 3 meses)**: $0–$50/mes → estrategia ~95% orgánica.
- **Estrategia en 3 fases**: Pre-launch (deploy + landing + Privacy/ToS + assets) ✅ → Launch (ASO + Product Hunt + outreach 1-a-1 + primeras reviews) ← acá vamos → Growth (blog SEO honesto, YouTube quincenal, comunidades).
- **Palancas asimétricas**: ASO con keywords long-tail honestas, comunidades (r/shopify, Indie Hackers), contenido educativo, outreach con auditoría free como gancho (ahora literal), Product Hunt.
- **Hipótesis del modelo V1 free**: maximizar instalaciones y reviews positivas con cero fricción para construir distribución antes de monetizar con V2.

---

## 3. Estado actual del código (Mayo 2026)

**V1 cerrado, gates de plan eliminados, app renombrada a Cury SEO, submit-ready.**

### Branch / commits relevantes (en `feature/deploy-prep`)

```
f519b70 chore(brand): rename app from "seo-app" to "Cury SEO"
76dca6a fix(product-detail): polish "Generate missing alt texts" modal and clarify empty states
b44e00f feat(plan): release V1 as 100% free and remove all Pro gates
9b3b569 docs(skill): add shopify-apps-expert SKILL.md (project-scoped)
ea44b56 feat(deploy): point app to Railway production URL
0152ef8 chore(tooling): migrate from npm to pnpm v11 on Node 22
4513e3a feat(db): switch prisma provider to postgresql for production
```

### Implementado ✅

- OAuth + sesión con React Router v7 + Prisma session storage.
- Schema Prisma con 3 modelos: `Session`, `SeoCache`, `SeoJob`.
- **Análisis en background (jobs)**: `SeoJob` + `seo-job` + `seo-job-runner`. Tipos `analysis` y `bulk_alt`, heartbeat, detección de jobs zombies (>5 min sin heartbeat → `failed`), polling desde el cliente (`api.job-status`).
- **Stale-while-revalidate**: el loader responde con cache (aunque stale) y dispara re-análisis en background sin bloquear la respuesta.
- **Cache versionado**: el JSON del cache lleva `schema: "v2-free"`. Filas viejas plan-aware (`plan: "free"|"pro"`) se invalidan automáticamente.
- Dashboard (`/app`) con completeness score, top peores productos, CTA re-analizar, export CSV, banner de job activo/fallido.
- Listado de productos (`/app/products`) con search, sort, paginación cliente (50/página), bulk fix masivo sin tope, preview de bulk (`api.bulk-preview`).
- Detalle de producto (`/app/products/:id`) con `IssuesList`, bulk fix por producto con modal pulido (matchea estilo del modal de Issues — footer inline, sin thumbnails, label "Preview:").
- Vista global de issues agrupados por tipo (`/app/issues`).
- 3 webhooks GDPR (`customers/data_request`, `customers/redact`, `shop/redact`) + `app/uninstalled` + `app/scopes_update`.
- `ErrorBoundary` con mensaje accionable para 403 (sesión con scopes obsoletos).
- Export CSV server-side con BOM UTF-8 para Excel.
- **i18n a inglés completada**.
- **Deploy a producción**: Railway con Docker + PostgreSQL managed. URL y redirect de auth ya apuntan a Railway.
- **Rename a Cury SEO**: `shopify.app.toml`, listing-content, legales/landing en `cury-apps-site`, todo alineado.

### Eliminado en V1 free (release b44e00f) 🧹

- **Billing API**: bloque `billing` removido de `app/shopify.server.js`. Sin `PRO_PLAN`, sin trial.
- **Servicios**: `app/services/billing.js` y `app/services/plan-cache.js` borrados.
- **Ruta**: `app/routes/app.upgrade.jsx` borrada.
- **Webhook**: `app/routes/webhooks.app.subscriptions_update.jsx` borrado y entrada removida de `shopify.app.toml`.
- **Gates Pro/Free**: todas las rutas ya no hacen `checkIsPro`, no muestran banners de upgrade, no marcan items como `locked`.
- **Límite Free**: `FREE_PLAN_PRODUCT_LIMIT` retirado.

### Pendiente para estar live en el App Store ⏳

- [x] Renombrar título del video en Vimeo a "Walkthrough of Cury SEO..." (hecho 2026-05-26).
- [ ] **QA end-to-end** en `cury-vdrxupzo.myshopify.com` como `reviewer@curyapps.com` siguiendo los 11 pasos del §12.2 del listing-content.
- [ ] **Verificar Public Distribution** activo en Partner Dashboard.
- [ ] **Submit for review** (5–10 días hábiles).

> **Docs complementarios** (cuando divergen de este CLAUDE.md, este gana):
> `deploy-plan.md` / `deploy-walkthrough.md` (bitácora del deploy), `PRODUCTION_NOTES.md` (troubleshooting; puede mencionar el bug billing.request, irrelevante en V1), `FUTURE_IDEAS.md` (backlog V2+ con costos AI verificados y comparación de competidores), `i18n-*.md` (migración a inglés, completada).

---

## 4. Stack técnico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Framework | **React Router v7** | NO es Remix. Scaffold actual del Shopify CLI. |
| Runtime | **Node.js 22** | Engines: `>=20.19 <22 \|\| >=22.12`. Prod corre en 22. |
| Gestor de paquetes | **pnpm 11.2.2** | `pnpm-workspace.yaml` declara `allowBuilds` y `overrides`. Migrado desde npm por seguridad del registry. |
| UI | **Polaris Web Components** + App Bridge React | Custom elements `<s-page>`, `<s-button>`, etc. No usar `@shopify/polaris` (React lib); `@shopify/polaris-types` solo aporta tipado. |
| Base de datos | **PostgreSQL** (prod, Railway) | `provider = "postgresql"`, `url = env("DATABASE_URL")`. |
| ORM | **Prisma 6.19.3** | Upgrade a Prisma 7 pospuesto (ver `FUTURE_IDEAS.md`). |
| Deploy | **Railway** (Docker) | Auto-deploy desde GitHub. Postgres managed. |
| API Shopify | **GraphQL Admin API 2026-04** | REST deprecada — NO usar. |
| Pagos | **No aplica en V1.** | Se reintroducirá con Managed App Pricing cuando V2 tenga features pagas. |
| Auth | OAuth 2.0 via App Bridge | Incluido en el scaffold. |
| Sitio marca + legales | **Cloudflare Pages** | Repo `cury-apps-site` en GitHub, deploy auto en push a `main`. Custom domain `curyapps.com` con SSL Cloudflare. |
| Email soporte | **Cloudflare Email Routing** | `support@curyapps.com` → forward al Gmail del dev. Free tier. |

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
shopify-app/                            ← Monorepo root (no es git repo)
├── CLAUDE.md                            ← Brief de la empresa Cury Apps
├── seo-app/                             ← App principal (Cury SEO) — repo git propio
│   ├── app/
│   │   ├── routes/
│   │   │   ├── app.jsx                  ← Layout embebido + nav + ErrorBoundary (403)
│   │   │   ├── app._index.jsx           ← Dashboard: score + top peores + CSV + job/banner
│   │   │   ├── app.products.jsx         ← Listado: search/sort + bulk fix masivo
│   │   │   ├── app.products_.$id.jsx    ← Detalle + bulk fix por producto (modal pulido 76dca6a)
│   │   │   ├── app.issues.jsx           ← Issues agrupados por tipo
│   │   │   ├── api.job-status.jsx       ← Polling del estado de un job
│   │   │   ├── api.bulk-preview.jsx     ← Preview de productos elegibles para bulk fix
│   │   │   ├── api.export[.]csv.jsx     ← Descarga del reporte CSV
│   │   │   ├── auth.$.jsx · auth.login/ ← OAuth
│   │   │   └── webhooks.*.jsx           ← GDPR (3) + app.uninstalled + app.scopes_update
│   │   ├── services/
│   │   │   ├── seo-analyzer.js          ← Scoring puro (5 checks) + aggregate
│   │   │   ├── shopify-api.js           ← Queries/mutations GraphQL
│   │   │   ├── shopify-fetch.js         ← Wrapper de admin.graphql (rate-limit + retries)
│   │   │   ├── seo-cache.js             ← Cache versionado (schema v2-free) + derivados pre-computados
│   │   │   ├── seo-job.js               ← CRUD de jobs + detección de zombies
│   │   │   ├── seo-job-runner.js        ← Orquestador fire-and-forget (analysis / bulk_alt)
│   │   │   ├── alt-text-generator.js    ← Generación determinística de alt (sin IA en V1)
│   │   │   ├── csv-export.js            ← buildCsv / escapeCell (RFC 4180)
│   │   │   ├── admin-links.js           ← Deep links shopify://admin/...
│   │   │   ├── image-url.js             ← resizeCdnUrl (thumbnails CDN Shopify)
│   │   │   └── issue-labels.js          ← field → label humano + mostSevere
│   │   ├── components/
│   │   │   ├── IssuesList.jsx
│   │   │   ├── JobProgress.jsx          ← UI de progreso + hook useJobPolling
│   │   │   ├── BulkFixSummaryBanner.jsx
│   │   │   ├── NavLink.jsx              ← PrefetchButton / PrefetchClickable
│   │   │   └── RouteSkeleton.jsx
│   │   ├── shopify.server.js            ← Config auth (SIN billing en V1)
│   │   └── db.server.js                 ← Prisma singleton
│   ├── prisma/
│   │   ├── schema.prisma                ← Session + SeoCache + SeoJob (postgresql)
│   │   └── migrations/                  ← Migración Postgres consolidada
│   ├── scripts/clear-alt-texts.js       ← Vaciar alts en dev store para probar bulk fix
│   ├── Dockerfile                       ← Node 22 + corepack/pnpm + prisma migrate deploy
│   ├── shopify.app.toml                 ← name = "Cury SEO" + scopes + 3 webhooks GDPR + URL Railway
│   ├── CLAUDE.md                        ← Este archivo
│   ├── FUTURE_IDEAS.md                  ← Backlog V2+ con costos AI verificados
│   └── (docs)                           ← deploy-plan, deploy-walkthrough, PRODUCTION_NOTES, i18n-*
├── cury-apps-site/                      ← Marca paraguas + legales (Cloudflare Pages) — repo git propio
│   ├── index.html                       ← Landing Cury Apps en curyapps.com
│   ├── seo-analyzer/
│   │   ├── index.html                   ← Landing Cury SEO en curyapps.com/seo-analyzer/
│   │   ├── privacy.html                 ← Privacy Policy
│   │   └── terms.html                   ← Terms of Service
│   ├── assets/styles.css                ← Tokens, tipografía Inter, dark mode
│   └── README.md                        ← Deploy steps Cloudflare Pages
├── marketing/seo-app/
│   ├── listing-content.md               ← TODA la copy del listing + checklist pre-submit
│   ├── launch-strategy.md               ← Marketing plan (puede contener data del modelo viejo)
│   └── prompts/                         ← Briefs para generar app icon, screenshots
└── assets/seo-app-assets/               ← 4 screenshots 1600×900 PNG para el listing
```

### Repos Git separados

| Path local | Repo GitHub | Branch primario |
|---|---|---|
| `seo-app/` | `git@github.com:DanielSantos495/seo-app.git` | `main` (prod · Railway auto-deploy) · `dev` (desarrollo) |
| `cury-apps-site/` | `git@github.com:DanielSantos495/curyapp-website.git` | `main` |
| `marketing/`, `assets/`, root | (no es repo) | local only |

**Modelo de ramas (`seo-app/`)**: `main` = producción (Railway despliega desde aquí). `dev` = rama de desarrollo; el día a día sale de ramas feature → merge a `dev` → merge a `main` para release. Dev corre 100% aislado contra el app **"Cury SEO (dev)"** (`client_id d4aec87c…`) + dev store + Postgres local (ver §9 "Entornos Dev / Prod"). La rama histórica `feature/deploy-prep` ya quedó mergeada a `main`.

---

## 6. Lógica de scoring SEO

Cada producto recibe un score **0–100** (función pura en `app/services/seo-analyzer.js`, fácil de testear).

| Check | Puntos | Condición |
|-------|--------|-----------|
| Meta title presente | +25 (−10 si longitud fuera de 50–60) | `seo.title` no vacío |
| Meta description presente | +25 (−10 si longitud fuera de 120–160) | `seo.description` no vacío |
| Alt texts en imágenes | +20 | Todas las imágenes con alt (si no hay imágenes, otorga los 20) |
| Descripción del producto | +20 | `descriptionHtml` > 100 chars de texto plano |
| Handle / URL amigable | +10 | Solo `a-z0-9-`, sin sufijos numéricos auto-generados |

**Severidad**: `high` = campo crítico ausente · `medium` = presente pero subóptimo · `low` = mejoras menores.

### Cómo comunicarlo (y cómo NO)

- ✅ "**Completeness score**: cuántos de los 5 checks técnicos están pasando en cada producto."
- ✅ "Un puntaje alto significa que tus campos SEO editables están completos, **no que tu producto vaya a rankear primero en Google**."
- ❌ "Tu SEO Score es 87/100" — suena a métrica oficial/universal. No lo es.
- ❌ "Sube tu SEO con la app" — el SEO real depende de muchos factores que esta app no toca.
- ❌ "Conseguí 100/100 y mejorá tu ranking" — sacar 100/100 solo significa que llenaste los 5 campos. Necesario pero no suficiente.

---

## 7. Datos y APIs

### 7.1 Schema Prisma

- **`Session`** — sesiones de Shopify (gestionado por el SDK). Índice por `shop`.
- **`SeoCache`** — último análisis SEO por tienda (`shop` único). `data` = JSON `{ schema: "v2-free", items, summary, worstProducts, eligibleAltGids }`. TTL stale 1h.
- **`SeoJob`** — estado de jobs en background. `type` ∈ {`analysis`, `bulk_alt`}, `status` ∈ {`pending`, `running`, `done`, `failed`}, con `processed`/`total`, `payload`, `resultSummary`, `errorMessage`, `lastHeartbeatAt`.

### 7.2 Scopes (`shopify.app.toml`)

```
scopes = "read_products,write_products"
```
- `read_products` → core del análisis (activo en V1).
- `write_products` → bulk fix de alt texts vía `productUpdateMedia` (activo en V1).
- `read_content` → **removido en V1** (no se ejercitaba ningún flujo con él). Evita el flag de "scopes no usados" en el review. Se re-pedirá en V2 cuando se shippee el análisis de páginas/colecciones (Priority 2 en `FUTURE_IDEAS.md`); con managed install eso es un prompt de re-consentimiento para merchants existentes, no una reinstalación.

### 7.3 GraphQL (API 2026-04)

> ⚠️ En 2026-04 las imágenes viven bajo `media`. `normalizeProduct` filtra `mediaContentType === "IMAGE"` y expone `images: [{ id, altText, url }]`. El campo legacy `images` ya **no funciona** en `ProductInput` para mutaciones.

- **Lectura**: query de producto con `seo { title description }`, `descriptionHtml`, `media(first:50)`, `variants`. Paginación en `fetchAllProducts` con callback `onPage` para heartbeat.
- **Mutación (bulk fix)**: `productUpdateMedia(productId, media: [{ id, alt }])` donde `id` es un **MediaImage GID** (no Image GID).

### 7.4 Webhooks (`shopify.app.toml`)

- GDPR (obligatorios): `customers/data_request`, `customers/redact`, `shop/redact`.
- `app/uninstalled` y `app/scopes_update`.
- **Removido en V1**: `app_subscriptions/update`. Se reintroducirá cuando V2 use Billing API.

---

## 8. Monetización (V1 = ninguna)

**V1 no monetiza.** No hay Billing API configurada. No hay flujo de upgrade. Los servicios `billing.js` y `plan-cache.js` se eliminaron del repo (commit `b44e00f`).

**V2 (cuando se diseñe):** introducirá funcionalidades pagas nuevas. Detalle en `FUTURE_IDEAS.md` con costos AI verificados (Claude Haiku 4.5 a $0.0017/imagen, no los $0.005 que decía el doc viejo) y comparación de competidores reales (TinyIMG, AltText.ai, Booster SEO, SEO Manager, Plug in SEO, etc.).

**Pricing tentativo V2** (ver `FUTURE_IDEAS.md` para racional completo):
- Free: V1 actual (lo que está hoy).
- Pro $9–$14/mo: páginas + colecciones, HTML structural, AI alt text 100/mes, inline edit.
- Pro+ $19–$29/mo: AI alt text 500/mes, AI meta description/title 300/mes, recurring audits.
- Scale $49/mo opcional.

**Migración preferida**: Managed App Pricing (elimina el bug single-fetch + billing.request y simplifica config).

---

## 9. Configuración y entorno

### Entornos Dev / Prod (cómo cambiar)

Dos entornos **totalmente aislados**. **Nunca** correr `shopify app dev` con el config de prod activo: el túnel sobrescribe la `application_url` de producción y tumba la app en review.

| | Dev | Prod |
|---|---|---|
| App (Partner Dashboard) | "Cury SEO (Dev)" | "Cury SEO" |
| Config CLI | `shopify.app.dev.toml` | `shopify.app.toml` |
| Tienda | dev store dedicada | review/live store |
| Base de datos | Postgres local (Docker) | Railway managed Postgres |
| Hosting | local (túnel de `shopify app dev`) | Railway (auto-deploy desde `main`) |
| `automatically_update_urls_on_dev` | `true` | `false` |

```bash
nvm use 22        # pnpm 11 requiere Node >= 22.13

# Desarrollo
pnpm db:up        # levanta Postgres local
pnpm dev          # activa config dev + shopify app dev

# Cambiar config a mano
pnpm shopify app config use dev               # dev
pnpm shopify app config use shopify.app.toml  # prod

# Release de código a prod  → merge a main, Railway auto-deploya
# Release de config Shopify  → pnpm deploy:prod (solo con config prod activo)
```

Setup inicial del dev (una vez): crear app "Cury SEO (Dev)" + dev store en Partner Dashboard, luego `pnpm shopify app config link --config dev --client-id <DEV_CLIENT_ID>`, `pnpm db:up` y `pnpm prisma migrate dev`. Detalle completo en `README.md` y en `docs/superpowers/specs/2026-05-27-dev-prod-environments-design.md`.

### Variables de entorno (`.env.example`)

| Variable | Origen | Prod |
|---|---|---|
| `SHOPIFY_API_KEY` | Partner Dashboard | `bbd179e9f5f501e3917e14dd5297389c` |
| `SHOPIFY_API_SECRET` | Partner Dashboard | (secreto) |
| `SCOPES` | `shopify.app.toml` | `read_products,write_products` |
| `SHOPIFY_APP_URL` | URL pública Railway | `https://seo-app-production-b4fa.up.railway.app` |
| `DATABASE_URL` | Railway Postgres | `${{Postgres.DATABASE_URL}}` |
| `NODE_ENV` | Manual | `production` |
| `PORT` | Railway auto-inject | (no setear manual) |

> **`BILLING_TEST`** ya no aplica en V1. Cuando V2 reintroduzca pagos, actualizar esta tabla.

### Parámetros de negocio
V1 no tiene parámetros configurables (no hay límites de plan ni precios).

### `shopify.app.toml` campos clave
```toml
name = "Cury SEO"
application_url = "https://seo-app-production-b4fa.up.railway.app"
embedded = true
```
> Cambiar `name` requiere `pnpm shopify app deploy --force` para sincronizar al Partner Dashboard.

---

## 10. Roadmap

```
✅ V1 (mayo 2026):
   - 5 checks on-page por producto + dashboard + bulk fix deterministic + CSV
   - i18n a inglés
   - Deploy Railway + Postgres + pnpm/Node 22
   - Marca Cury Apps + dominio curyapps.com + Privacy/Terms live
   - Rename a Cury SEO
   - V1 100% free, gates Pro removidos
🚧 Submit for review en el App Store ← ACÁ ESTAMOS
   Mes 3–6  → Iterar con feedback y reviews. Recolectar señales de qué pagarían los merchants.
   Mes 6+   → V2: features pagas (AI alt text con Claude Vision, AI meta description/title generators, HTML structural analysis, páginas y colecciones, recurring audits). Reintroducir monetización vía Managed App Pricing.
   Mes 12+  → V3 explorar: Sidekick App Extension, integración con Search Console (solo si la tracción lo justifica).
```

### Funcionalidad futura

Backlog completo con priorización, costos verificados y comparación de mercado en **`FUTURE_IDEAS.md`**.

Resumen del orden de construcción V2:
1. **Migración a Managed App Pricing** (1–2 días) — habilitador.
2. **AI alt text con Claude Vision** (3–5 días) — feature flagship.
3. **AI meta description + meta title** (2–3 días, mismo PR, costo marginal cero).
4. **HTML structural analysis** (5–8 días, diferenciado).
5. **Páginas + colecciones** (3–4 días, reusa código).
6. **Inline edit + Recurring audits**.

**Salvaguardas obligatorias antes de shipear AI** (todas en `FUTURE_IDEAS.md`):
- Rate limit por shop server-side.
- Quota mensual enforced (no solo UI).
- Alerta si shop excede $5/mes en costo.
- Fallback graceful a deterministic si Anthropic API cae.
- Privacy update con Anthropic como sub-procesador **antes** de shipear.

---

## 11. Convenciones de código

- **JavaScript** (no TypeScript por ahora — simplificar el MVP).
- Componentes React funcionales con hooks.
- **Polaris Web Components** (`<s-page>`, `<s-section>`, `<s-button>`, `<s-stack>`, `<s-text>`, `<s-link>`, `<s-box>`, etc.) — sin CSS custom salvo casos puntuales.
- Loaders/actions de **React Router v7** (`export const loader/action`).
- Para action submits desde botones dentro de stacks inline, usar `useSubmit()` programático en vez de `<Form>` (el form es block-level y rompe el alineado). Patrón usado en `app.products_.$id.jsx` tras commit `76dca6a`.
- Lógica de negocio (scoring, jobs) en `app/services/` — funciones puras o módulos aislados, fáciles de testear.
- Queries GraphQL separadas del UI en `shopify-api.js`.
- **Identificadores y comentarios internos en español** (idioma del dev).
- **Strings user-facing en inglés, sin excepciones**.
- Antes de declarar algo "hecho": `pnpm run build` y `pnpm run lint` en verde.
- Commits: Conventional Commits + `Signed-off-by: Daniel Santos <dsantos0495@gmail.com>`. **Nunca** `Co-Authored-By: Claude` ni mención al AI.

---

## 12. Contexto del desarrollador

- **Ubicación**: Colombia (LATAM). **Disponibilidad**: tiempo libre (~10–15 hrs/sem).
- **Objetivo final**: ingresos recurrentes (MRR) como side project, monetizando con V2. La V1 free es inversión deliberada en distribución y reviews, no producto final.
- **Email**: `dsantos0495@gmail.com` (emergency dev contact + endpoint Cloudflare Email Routing).
- **Git config**: `user.name = Daniel Santos`, `user.email = dsantos0495@gmail.com`.

---

## 13. Bug fixes y trampas conocidas (post-V1)

### Modal "Generate missing alt texts" rediseñado (commit `76dca6a`, 2026-05-26)

Antes: usaba `slot="primaryAction"` + thumbnails en la lista de samples → layout inconsistente con el modal de bulk fix de la página Issues.

Ahora: layout idéntico al de Issues — `<s-box>` + stack vertical con paragraph + samples sin thumbnails con label "Preview:", botones en `<s-stack direction="inline" justifyContent="end">` al pie. Submit programático con `useSubmit()` en vez de `<Form>` (block-level rompía el alineado).

### Sobre el bug "el cambio no se refleja en el detalle" (2026-05-26, no resuelto en código)

Reportado: cambiar meta description en admin → re-analyze → el detalle sigue mostrando 26 chars.

Diagnóstico: **el detalle NO usa el cache** — fetch fresco a Shopify en cada navegación. El bug real fue **user error**: edición en la "Description" rich text (descriptionHtml) en vez de "Search engine listing → Meta description" (seo.description). Confusión común merchant-side. Decisión: no agregar headers `no-store` ni mejorar UX del campo "Current data" en V1 (era defensa contra hipótesis no confirmadas). En V2, considerar mejorar la sección "Current data" con char count + label más explícito + path en Shopify admin para auto-diagnóstico.

---

*Mantener este archivo actualizado a medida que el proyecto evoluciona. Claude lo lee automáticamente al iniciar en este directorio.*
