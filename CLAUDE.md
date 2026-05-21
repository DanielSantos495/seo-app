# CLAUDE.md — Shopify SEO Analyzer
> Contexto completo del proyecto para Claude Code.
> Última actualización: 2026-05-19 (MVP funcional cerrado; pendiente deploy + listing; estrategia de marketing y lanzamiento definida).

---

## 🧭 Quick context (TL;DR para Claude Code)

- **Qué es:** app pública del Shopify App Store que audita el SEO de los productos de una tienda y permite arreglar issues comunes en bulk.
- **Negocio:** freemium con plan Pro $9/mes (7 días trial). Revenue share 0% en los primeros $1M USD vitalicios.
- **Mercado objetivo:** **global, inglés primero** (US/UK/AU/CA = ~70% del mercado Shopify). Ver `/marketing/seo-app/launch-strategy.md`.
- **Idioma del listing y UI: inglés.** La UI actual aún tiene strings en español; la migración a EN se hará con el prompt `/marketing/seo-app/prompts/i18n-es-to-en.md` antes del envío a review.
- **Estado:** MVP funcional cerrado (todo el flujo install → análisis → upgrade → bulk fix → export funciona). Falta deploy a Railway + listing en App Store.
- **Stack:** React Router v7 (no Remix) + Polaris Web Components + Prisma + GraphQL Admin API 2026-04 + Shopify Billing API.

---

## 🎯 Visión general del proyecto

Estamos construyendo una **app pública en el Shopify App Store** llamada **SEO Analyzer**.
Es un negocio lateral (side project) con el objetivo de generar ingresos recurrentes (MRR).

El plan es en tres fases:
1. **V1 MVP** — SEO Analyzer funcional, publicado en el App Store
2. **V2** — Agregar AI Description Generator como feature premium
3. **V3** — Integrar Sidekick App Extension (el objetivo a largo plazo)

---

## 📊 Estado actual (Mayo 2026)

**MVP funcional completo**. El código cubre el flow end-to-end (install → análisis → upgrade Pro → bulk fix → export). Quedan tareas operativas para llegar al App Store (deploy, listing, legal).

### Implementado
- [x] OAuth + sesión con React Router v7 + Prisma session storage
- [x] Schema Prisma: `Session`, `SeoCache` (cache con TTL 1h + plan-key)
- [x] Servicios: `seo-analyzer`, `shopify-api`, `seo-cache`, `billing`, `alt-text-generator`, `csv-export`, `admin-links`, `issue-labels`
- [x] Dashboard (`/app`) con score general, top 5 peores productos, CTA re-analizar, export CSV
- [x] Listado de productos (`/app/products`) con search, sort, bulk fix masivo (cap 50)
- [x] Detalle de producto (`/app/products/:id`) con `IssuesList`, bulk fix por producto
- [x] Vista global de issues agrupados por tipo (`/app/issues`) con expand
- [x] Billing API: plan Pro $9/mes + 7 días trial + flow de upgrade (con workaround del bug single-fetch documentado en `PRODUCTION_NOTES.md`)
- [x] 3 webhooks GDPR + `app_subscriptions/update` (invalida cache al cambiar plan)
- [x] `ErrorBoundary` con mensaje accionable para 403 (sesión con scopes obsoletos)
- [x] Export CSV client-side (Pro) con BOM UTF-8 para Excel

### Pendiente para release al App Store
- [ ] Deploy a Railway/Vercel con Postgres + `BILLING_TEST=false`
- [ ] Privacy Policy + Terms of Service publicados
- [ ] Screenshots (1280×800, mín 3) + video demo (30–60s)
- [ ] Email de soporte visible en app y listing
- [ ] QA end-to-end en dev store fresca (install/uninstall/reinstall)

> Notas operativas y troubleshooting de producción: ver `PRODUCTION_NOTES.md`.
> Backlog de mejoras post-MVP: ver `FUTURE_IDEAS.md`.

---

## 🏗️ Stack técnico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Framework | **React Router v7** | Scaffold actual de `shopify app init` (ya no es Remix) |
| Runtime | Node.js 20+ | `>=20.19 <22 \|\| >=22.12` |
| UI | **Polaris Web Components** + App Bridge React | Custom elements `<s-page>`, `<s-button>`, etc. — sin necesidad de instalar `@shopify/polaris` |
| Base de datos | **Prisma + SQLite** (dev) / **PostgreSQL** (prod) | |
| Deploy | **Railway** | ~$10/mes, auto-deploy desde GitHub |
| API Shopify | **GraphQL Admin API 2026-04** | REST está deprecada — NO usar (es la última versión expuesta por el SDK instalado) |
| Pagos | **Shopify Billing API** | RecurringApplicationCharge |
| Autenticación | OAuth 2.0 via App Bridge | Ya incluido en el scaffold |

### Dependencias clave (instaladas por el scaffold)
```json
{
  "@shopify/shopify-app-react-router": "^1.1.0",
  "@shopify/shopify-app-session-storage-prisma": "^9.0.0",
  "@shopify/app-bridge-react": "^4.2.4",
  "@shopify/polaris-types": "1.0.1",
  "@react-router/dev": "^7.12.0",
  "@react-router/serve": "^7.12.0",
  "@prisma/client": "^6.16.3",
  "prisma": "^6.16.3"
}
```

> Nota: la UI usa **Polaris Web Components** (custom elements del navegador), no la lib React `@shopify/polaris`. `@shopify/polaris-types` solo aporta tipado para los `s-*` elements.

---

## 📁 Estructura del proyecto

```
seo-app/
├── app/
│   ├── routes/
│   │   ├── app.jsx                            ← Layout embebido + nav (Dashboard / Productos / Issues)
│   │   ├── app._index.jsx                     ← Dashboard: score general + top 5 + CSV export
│   │   ├── app.products.jsx                   ← Listado con search/sort + bulk fix masivo cap 50
│   │   ├── app.products_.$id.jsx              ← Detalle + bulk fix por producto (`_` opt-out de nesting)
│   │   ├── app.issues.jsx                     ← Vista global de issues agrupados por tipo
│   │   ├── app.upgrade.jsx                    ← Loader que dispara billing.request (workaround single-fetch)
│   │   ├── webhooks.customers.data_request.jsx
│   │   ├── webhooks.customers.redact.jsx
│   │   ├── webhooks.shop.redact.jsx           ← Borra session + seoCache del shop
│   │   ├── webhooks.app.uninstalled.jsx
│   │   ├── webhooks.app.scopes_update.jsx
│   │   └── webhooks.app.subscriptions_update.jsx ← Invalida cache al cambiar plan
│   ├── services/
│   │   ├── seo-analyzer.js                    ← Scoring puro + `aggregateAnalyses` + `FREE_PLAN_PRODUCT_LIMIT`
│   │   ├── shopify-api.js                     ← Queries/mutations GraphQL + helpers
│   │   ├── seo-cache.js                       ← Cache TTL 1h con plan-key + `buildItemsFromProducts`
│   │   ├── billing.js                         ← `checkIsPro`, `BILLING_IS_TEST`
│   │   ├── alt-text-generator.js              ← Naive con variantes (sin IA)
│   │   ├── csv-export.js                      ← `buildCsv`, `escapeCell` (RFC 4180)
│   │   ├── admin-links.js                     ← Deep links `shopify://admin/products/{id}`
│   │   └── issue-labels.js                    ← Mapeo `field` → label humano + `mostSevere`
│   ├── components/
│   │   └── IssuesList.jsx                     ← Lista reutilizable de issues con CTA al admin
│   ├── shopify.server.js                      ← Config auth + billing (Pro Plan $9/mes)
│   └── db.server.js                           ← Prisma singleton
├── prisma/
│   ├── schema.prisma                          ← Session + SeoCache models
│   └── migrations/                            ← `add_seo_cache` aplicado
├── shopify.app.toml                           ← Config app + 4 webhooks declarados
├── CLAUDE.md                                  ← Este archivo
├── PRODUCTION_NOTES.md                        ← Checklist + troubleshooting para release
└── FUTURE_IDEAS.md                            ← Backlog post-MVP
```

---

## 🗄️ Schema de Prisma

```prisma
// prisma/schema.prisma — schema real

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"           // Cambiar a "postgresql" en prod
  url      = "file:dev.sqlite"
}

model Session {
  id            String    @id
  shop          String
  state         String
  isOnline      Boolean   @default(false)
  scope         String?
  expires       DateTime?
  accessToken   String
  userId        BigInt?
  firstName     String?
  lastName      String?
  email         String?
  accountOwner  Boolean   @default(false)
  locale        String?
  collaborator  Boolean?  @default(false)
  emailVerified Boolean?  @default(false)
  refreshToken        String?
  refreshTokenExpires DateTime?
}

// Cache del análisis completo por tienda. `data` es JSON serializado
// (SQLite no soporta el tipo Json nativo; al migrar a Postgres podemos
// cambiarlo a `Json`). El JSON guardado tiene la forma:
//   { plan: "free" | "pro", items: [{ productId, title, score, issues, ... }] }
// El cache se invalida si el plan cambia (key incluye el plan).
model SeoCache {
  id        String   @id @default(cuid())
  shop      String   @unique
  data      String
  updatedAt DateTime @updatedAt
}
```

---

## 🔍 Lógica de scoring SEO

Cada producto recibe un score de **0 a 100** basado en estos criterios:

| Check | Puntos | Condición |
|-------|--------|-----------|
| Meta title presente | 25 pts | `seo.title` no vacío |
| Meta title longitud ideal | -10 pts si falla | Entre 50–60 caracteres |
| Meta description presente | 25 pts | `seo.description` no vacío |
| Meta description longitud | -10 pts si falla | Entre 120–160 caracteres |
| Alt texts en imágenes | 20 pts | Todas las imágenes con alt text |
| Descripción del producto | 20 pts | `descriptionHtml` > 100 chars (sin HTML) |
| Handle/URL amigable | 10 pts | Sin caracteres raros, no auto-generado |

**Impacto de issues:**
- `high` = falta el campo completamente (title, meta description)
- `medium` = campo presente pero subóptimo (longitud, alt texts)
- `low` = mejoras menores (handle, estructura)

---

## 📊 Features por plan

### Plan Free (freemium — para instalaciones fáciles)
- Análisis de los primeros **N productos** (configurable en `FREE_PLAN_PRODUCT_LIMIT` de `app/services/seo-analyzer.js`; hoy `10` para testing, target final `25`)
- Dashboard con score general + top 5 peores
- Vista global de issues agrupados por tipo
- Lista de issues con descripción del fix
- Sin bulk actions ni export CSV

### Plan Pro — $9/mes
- Análisis de **todos los productos** (sin límite)
- **Bulk fix de alt texts** — naive con variantes (`${title} - ${variant}` o `${title} - vista N`)
  - Por producto en el detalle
  - Masivo desde el listado (cap 50 por ejecución; trigger para Fase B con job background en `FUTURE_IDEAS.md`)
- **Export CSV** del reporte completo (client-side, con BOM UTF-8 para Excel)

### V2 — Plan Pro+ (futuro, no en MVP)
- **AI Description Generator** — genera meta descriptions con Claude API
- **Alt text con Claude Vision** — toggle "Mejorar con IA" en el bulk fix
- Análisis de páginas y colecciones
- Sugerencias de keywords por producto
- Integración con Google Search Console (si es posible via API)

---

## 🔑 Scopes de la Admin API

```toml
# shopify.app.toml
[access_scopes]
scopes = "read_products,read_content,write_products"
# read_products   → leer productos, imágenes, SEO fields
# read_content    → leer páginas y colecciones
# write_products  → bulk fix de alt texts (solo plan Pro)
```

> ⚠️ Regla: pedir solo los scopes mínimos necesarios.
> `write_products` solo se activa cuando el merchant hace upgrade a Pro y usa el bulk fix.

---

## 📡 GraphQL Queries principales

> ⚠️ En API 2026-04 las imágenes viven bajo `media` (modelo unificado con videos/3D), **no** bajo el viejo `images` (que sigue funcionando en lectura pero **no en `ProductInput` para mutaciones**).

### Traer productos con campos SEO (lectura)
```graphql
query GetProductSeo($id: ID!) {
  product(id: $id) {
    id
    title
    handle
    descriptionHtml
    seo { title description }
    media(first: 50) {
      edges {
        node {
          id
          alt
          mediaContentType
          ... on MediaImage {
            image { url }
          }
        }
      }
    }
    variants(first: 100) {
      edges {
        node {
          id
          title
          media(first: 1) { edges { node { id } } }
        }
      }
    }
  }
}
```

`normalizeProduct` filtra `mediaContentType === "IMAGE"` y expone la shape como `images: [{ id, altText, url }]` para no romper el resto del código.

### Mutation para actualizar alt text (bulk fix)
```graphql
mutation ProductUpdateMedia($productId: ID!, $media: [UpdateMediaInput!]!) {
  productUpdateMedia(productId: $productId, media: $media) {
    media { id alt }
    mediaUserErrors { field message }
  }
}
```

Cada `UpdateMediaInput` lleva `{ id, alt }` donde `id` es un MediaImage GID (no Image GID).

---

## 🪝 Webhooks

### GDPR (obligatorios para el App Store)

Tres rutas separadas, una por topic:
- `webhooks.customers.data_request.jsx` → responde 200 vacío (no guardamos datos de clientes)
- `webhooks.customers.redact.jsx` → responde 200 vacío
- `webhooks.shop.redact.jsx` → borra `session` + `seoCache` del shop

### Subscription updates (cache invalidation)
- `webhooks.app.subscriptions_update.jsx` → borra `seoCache` cuando cambia el plan (activación, fin de trial, cancelación). Sin esto, el merchant ve "Plan Pro activo" hasta 1h después de cancelar (TTL del cache).

### Declaración en `shopify.app.toml`
```toml
[webhooks]
api_version = "2026-04"

  [[webhooks.subscriptions]]
  compliance_topics = [ "customers/data_request" ]
  uri = "/webhooks/customers/data_request"

  [[webhooks.subscriptions]]
  compliance_topics = [ "customers/redact" ]
  uri = "/webhooks/customers/redact"

  [[webhooks.subscriptions]]
  compliance_topics = [ "shop/redact" ]
  uri = "/webhooks/shop/redact"

  [[webhooks.subscriptions]]
  topics = [ "app_subscriptions/update" ]
  uri = "/webhooks/app/subscriptions_update"
```

---

## 💳 Billing API — Planes de suscripción

Config real en `app/shopify.server.js`:

```javascript
import {
  BillingInterval,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";

export const PRO_PLAN = "Pro Plan";

const shopify = shopifyApp({
  // ...config existente...
  billing: {
    [PRO_PLAN]: {
      lineItems: [
        {
          amount: 9,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
      trialDays: 7,
    },
  },
});
```

**Flujo:** merchant instala → usa plan free → click "Mejorar a Pro" → loader de `/app/upgrade` dispara `billing.request()` → Shopify maneja el cobro → vuelve a `/app?upgraded=1` → cache invalidado → loader detecta `isPro=true`.

> ⚠️ **Bug conocido**: `billing.request()` retorna 401 si se invoca desde un `action` (POST) por el transporte single-fetch de React Router 7 (issue [shopify-app-js#1976](https://github.com/Shopify/shopify-app-js/issues/1976)). Workaround: invocarlo desde un **loader** GET full-page con `target="_top"` en el botón. Aplicado en `app.upgrade.jsx`. Detalle en `PRODUCTION_NOTES.md`.

> ⚠️ **Public distribution requerida**: la app debe estar marcada como "Public" en el Partner Dashboard (Distribution → "Distribute through Shopify App Store") aunque no esté publicada, sino el SDK responde "Apps without a public distribution cannot use the Billing API".

**Revenue share**: 0% en los primeros $1M USD vitalicios.

---

## ✅ Checklist pre-publicación en App Store

### Técnico (causas más comunes de rechazo)
- [x] GDPR webhooks implementados y respondiendo 200 OK
- [x] Billing API implementada (no cobrar fuera del ecosistema Shopify)
- [x] UI construida 100% con Polaris Web Components
- [x] Scopes mínimos solicitados (`read_products,read_content,write_products`)
- [ ] OAuth flow: instalar, desinstalar, RE-instalar funciona correctamente (QA pendiente en dev store fresca)
- [ ] App funciona en una development store real con productos reales (QA pendiente)
- [ ] Lighthouse score de la tienda no baja más de 10 puntos tras instalar
- [ ] App desplegada en URL HTTPS (Railway o Vercel)

### Listing del App Store
- [ ] Screenshots: mínimo 3, resolución 1280x800px
- [ ] Video demo: 30–60 segundos mostrando el flujo principal
- [ ] Descripción sin claims no verificables ("best", "the only", "aumenta ventas X%")
- [ ] Email de soporte visible dentro de la app Y en el listing
- [ ] Privacy Policy y Terms of Service enlazados
- [ ] Precios transparentes — el plan free debe ser realmente funcional

**Timeline del review:** 5–10 días hábiles. Si rechazan, reenviar explicando cada fix punto por punto.

---

## 🚀 Roadmap del proyecto

```
✅ Semana 1   → Setup: shopify app init, explorar scaffold, dev store funcionando
✅ Semana 2   → GraphQL queries + scoring + cache SeoCache
✅ Semana 3-4 → UI con Polaris WC: dashboard + productos + detalle + issues
✅ Semana 5   → Billing API + planes free/pro + workaround single-fetch
✅ Semana 6   → GDPR webhooks + bulk fix alt texts (por producto + masivo) + CSV export
🚧 Semana 7   → Deploy Railway + listing + enviar a revisión Shopify ← acá estamos
   Mes 3-6   → Iterar con feedback, reviews, feature requests
   Mes 6+    → V2: AI Description Generator + Alt text con Claude Vision
   Mes 9-12  → V3: Sidekick App Extension
```

---

## 📣 Marketing & Lanzamiento

> Plan completo y vivo: [`/marketing/seo-app/launch-strategy.md`](../marketing/seo-app/launch-strategy.md)
> Prompts operativos del lanzamiento: [`/marketing/seo-app/prompts/`](../marketing/seo-app/prompts/)

### Contexto comercial
- **Mercado:** global, inglés primero. Listing 100% en inglés. UI también en inglés (migración pendiente).
- **Presupuesto ads primeros 3 meses:** $0–$50 USD/mes → estrategia 95% orgánica.
- **Presencia digital inicial:** cero — todas las cuentas (X, LinkedIn, YouTube, Reddit, IH, PH) se crean pre-launch.
- **Ventaja competitiva:** 0% revenue share Shopify en primeros $1M (margen para competir en precio o reinvertir en producto).

### Estrategia en 3 fases (resumen)
1. **Pre-launch (sem 1–3):** deploy Railway, dominio `.app`, landing en Cloudflare Pages, Privacy + ToS, screenshots + video demo, cuentas en redes (handle consistente). Construir karma en Reddit antes de promocionar.
2. **Launch (sem 4–6):** **ASO** agresivo (App Store search ≈ 70% de descubrimiento), Product Hunt coordinado con hunter externo, outreach manual 1-a-1 con auditoría SEO gratis como gancho, primeras 10 reviews ⭐⭐⭐⭐⭐.
3. **Growth (mes 2–4):** blog SEO sobre SEO (meta-juego), 1 video YouTube cada 2 semanas, comunidades sostenidas (r/shopify, Indie Hackers, Shopify Community), Google Ads $50/mes **solo** cuando la landing convierta ≥3%.

### Targets realistas (con bootstrap real)
- Mes 3 post-launch: 30–80 installs Free, $18–54 MRR
- Mes 6: 100–180 installs Free, 8–15 Pro, $72–135 MRR
- Mes 12: 250–350 installs Free, 25–45 Pro, $225–405 MRR

> Para acercarse al target original del proyecto ($2,850–$5,700 MRR año 1) sin aumentar presupuesto: (a) subir Pro a $14–19/mes tras validar PMF, o (b) adelantar V2 (AI) a $19–29/mes. Detalle en §0 del plan.

### Palancas asimétricas priorizadas
1. **ASO** — keywords long-tail tier 2/3 primero (`shopify alt text`, `shopify seo score`, `bulk seo`) antes de pelear por tier 1 (`shopify seo`).
2. **Comunidades** — r/shopify, Indie Hackers, Shopify Community Forum, Shopify Partners Slack.
3. **Contenido SEO sobre SEO** — la app vende SEO; el blog público es la prueba viva.
4. **Outreach manual** — auditorías personalizadas a stores con problemas SEO detectables, gancho con Pro free 3 meses.
5. **Product Hunt** — único día de tráfico masivo gratis; reservar con 60 días de anticipación.

### Decisión binaria de ads (mes 4)
- CAC < $25 y conversión Free→Pro > 5% → escalar a $100/mes.
- CAC > $30 → pausar Google Ads, volver 100% orgánico hasta resolver landing/listing.

---

## 🤖 Objetivo a largo plazo — Sidekick Extension

Shopify lanzó en Winter '26 el developer preview de **Sidekick App Extensions**.
Permiten que la app responda preguntas desde el chat nativo de Shopify:

> Merchant: "¿Cuál es mi producto con peor SEO?"
> Sidekick: [consulta nuestra app] → "El producto X tiene score 32/100, le falta meta description y 5 imágenes sin alt text. ¿Quieres que lo arregle ahora?"

**Para acceder al preview:** publicar la app, conseguir usuarios reales,
luego solicitar acceso en community.shopify.dev con el caso de uso descrito.

Documentación técnica:
- `shopify.dev/docs/apps/build/sidekick` — arquitectura general
- `shopify.dev/docs/apps/build/sidekick/build-app-actions` — exponer acciones

---

## 🌎 Contexto del desarrollador

- **Ubicación:** Cali, Colombia (LATAM)
- **Stack actual:** JavaScript, HTML, CSS, Node.js, Shopify (experiencia previa)
- **Disponibilidad:** tiempo libre (10–15 hrs/semana)
- **Objetivo:** ingresos recurrentes como side project
- **Meta a 12 meses:** $2,850–$5,700 MRR con 150–300 instalaciones activas

---

## 📝 Convenciones de código

- JavaScript (no TypeScript por ahora — simplificar el MVP)
- Componentes React funcionales con hooks
- **Polaris Web Components** (`<s-page>`, `<s-section>`, `<s-button>`, `<s-stack>`, `<s-text>`, `<s-link>`, `<s-box>`, `<s-unordered-list>`, etc.) para TODO lo visual dentro del admin — sin CSS custom salvo casos muy específicos
- Loaders/actions de **React Router v7** (`export const loader`, `export const action`) — equivalentes a los de Remix
- Lógica de negocio (scoring) en `app/services/` — funciones puras, fáciles de testear
- Queries GraphQL en `app/services/shopify-api.js` — separadas del UI
- Comentarios e identificadores internos en español — idioma del desarrollador
- **Strings user-facing (UI, mensajes de error, mensajes de fix, copy de botones) en inglés** — el mercado objetivo es global/EN. La UI inicial se desarrolló en español y se migrará a inglés antes del envío a review usando el prompt `/marketing/seo-app/prompts/i18n-es-to-en.md`. No mezclar: si una string termina renderizándose para el merchant, va en inglés sin excepciones.

---

*Este archivo debe mantenerse actualizado a medida que el proyecto evoluciona.*
*Claude Code lo lee automáticamente al iniciar en este directorio.*
