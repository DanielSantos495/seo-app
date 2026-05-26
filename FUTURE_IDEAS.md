# Backlog post-V1 — Roadmap, costos y monetización

> Re-organizado el 2026-05-25 con research real del mercado de Shopify SEO apps y costos verificados de Claude API. Sustituye la versión anterior (que tenía estimados de costo ~3x altos y mezclaba ideas con tareas de mantenimiento sin priorizar).

Estructura:

1. [Estado del mercado y posicionamiento V2](#estado-del-mercado-y-posicionamiento-v2)
2. [Estrategia free vs paid — propuesta concreta](#estrategia-free-vs-paid--propuesta-concreta)
3. [Backlog ordenado por valor/esfuerzo](#backlog-ordenado-por-valoresfuerzo)
4. [Costos detallados de cada feature AI](#costos-detallados-de-cada-feature-ai)
5. [Tech debt e infraestructura](#tech-debt-e-infraestructura)
6. [Ideas descartadas / movidas / completadas](#ideas-descartadas--movidas--completadas)

---

## Estado del mercado y posicionamiento V2

**Mercado**: ~348 apps de SEO en el App Store (verificado 2026). Categoría saturada en lo básico (audit, sitemaps, redirects) y menos saturada en:
- AI alt text generation con buen UX
- Análisis estructural del HTML real (H1, schema.org, headings)
- Audit de páginas/colecciones (la mayoría solo cubre productos)

**Competidores relevantes y sus modelos**:

| App | Free tier | Paid (USD/mes) | Modelo de pricing |
|---|---|---|---|
| TinyIMG | 50 imágenes/mes | $14 / $23 / $49 | Quota de imágenes optimizadas |
| AltText.ai (ATAI) | 25 imágenes one-time | $5 (100) / $19 (500) / $59 (2000) | Quota AI puro |
| Booster SEO | Basic alt + SEO score | $39 / $69 | Feature-tiered |
| Sherpas Smart SEO | Sin free | $9.99 / $14.99 / $29.99 | Feature-tiered |
| SEO Manager (venntov) | Sin free | $20 flat | Flat fee |
| Plug in SEO | Audit con límites | $29.99–$79.99 | Feature-tiered |
| Avada SEO Suite | Free tier amplio | $14.99 / $49.99 | Feature + quota |

**Lectura**: el rango típico es $9–$30/mes para el plan inicial pago, con $50+ para plan top. La quota de AI imágenes en el plan más bajo es 100/mes. Las apps que cobran flat ($20–$30) tienden a ser feature-tiered.

**Nuestro posicionamiento V1** (ya live como free total): más generoso que la mayoría. Sirve como producto de entrada y constructor de reviews. **No sostenible como modelo final** — la V2 introduce monetización.

**Posicionamiento V2 propuesto**: producto de auditoría on-page **completo** (productos + páginas + colecciones + HTML structural) con **AI generation** (alt text + meta descriptions + meta titles) en planes pagos. Diferenciador vs competidores: claridad, no sobre-promesa de ranking, bulk-first UX.

---

## Estrategia free vs paid — propuesta concreta

### Free (mantener V1 + algunos extras estratégicos)

Lo que ya está en V1 free se queda free:

- Auditoría de los 5 checks on-page por producto (meta title/description, alt text, descripción, handle).
- Dashboard con completeness score, top peores productos, issues agrupados.
- Bulk fix de alt texts **deterministic** (título + variante, sin IA). Sin tope.
- CSV export del audit.
- Re-análisis on-demand.

**Justificación de mantener free todo esto**: es el hook que convierte instalación → review positiva → conversión a paid en features genuinamente más valiosas. Competidores cobran por menos (Booster SEO Pro $39 incluye apenas más).

### Pro $9–$14/mes (tier de entrada)

Features que justifican el precio sin requerir cómputo caro:

- Análisis de **páginas estáticas** y **colecciones** (extiende los 5 checks al resto del storefront, no solo productos).
- Análisis **estructural HTML** de home/product/collection (H1/H2/H3 hygiene, Open Graph tags, schema.org JSON-LD presence). Lectura del HTML rendered, no solo de los campos del Admin API.
- **AI alt text con Claude Vision** con quota de **100 imágenes/mes** (matchea AltText.ai tier $5 pero por menos plata).
- Edición **inline** del alt text en el preview antes de aplicar.

**Por qué $9–$14**: matchea SEO Manager ($20 flat) ofreciendo más; matchea Smart SEO ($9.99–$14.99); deja headroom para subir si las reviews validan valor.

### Pro+ $19–$29/mes (tier completo)

- AI alt text **quota de 500 imágenes/mes**.
- AI **meta description generator** (300 productos/mes).
- AI **meta title generator** (300 productos/mes).
- Schedule recurring audits (semanal automático con email summary).
- Priority support.

**Por qué $19–$29**: matchea AltText.ai Silver ($19/500) ofreciendo el doble de surface; matchea Plug in SEO ($29.99) ofreciendo más AI.

### Scale $49/mes (tier opcional, decidir según demanda)

- AI alt text **2000 imágenes/mes**.
- AI meta description/title **1000/mes**.
- Multi-store discount.

**Trigger para crear este tier**: ≥10 merchants en Pro+ pidiendo más quota.

### Lo que NO debería ser free según el research

- **AI alt text** sin quota → costos crecen lineal con catálogo, sin techo. Todos los competidores con AI cobran o limitan agresivamente.
- **HTML structural analysis** → más esfuerzo de desarrollo, menos commoditizado, justifica precio.
- **Análisis de páginas/colecciones** sin tope → expande surface 3x, justifica upgrade.

### Lo que SÍ debería seguir free aunque cueste algo

- **Bulk fix alt text deterministic** (sin AI) → es el hook diferenciador. Costo marginal cero, valor percibido alto. Booster SEO lo da free, TinyIMG también — no podemos cobrar por esto.
- **CSV export** → competidores lo dan free o lo gatean barato. No vale la pelea.

---

## Backlog ordenado por valor/esfuerzo

Las features están ordenadas por **(valor × probabilidad de pago) / esfuerzo**. Los rangos de esfuerzo son días-persona aproximados.

### 🥇 Prioridad 1 — Monetización principal (V2 launch)

#### 1.1 AI alt text con Claude Vision

- **Esfuerzo**: 3–5 días.
- **Valor**: Feature flagship de V2, validada por competidores rentables (AltText.ai).
- **Plan**: Pro $9 (100/mes), Pro+ $19 (500/mes), Scale $49 (2000/mes).
- **Diseño**:
  - Service `app/services/alt-text-ai.js` con `generateAltTextWithAI(imageUrl, productTitle, variantName, locale)`.
  - Toggle "Improve with AI" en el modal de bulk fix. Activarlo cambia el path de generación.
  - Quota tracker por shop con reset mensual. Tabla `AiUsage(shop, month, altImages, metaDescriptions, metaTitles)`.
  - Idiomas: detectar `shop.primaryDomain.url` locale y pedir respuesta en ese idioma.
  - Latencia: 3–5s por imagen → progress bar más informativo que el bulk fix actual.
- **Costo a Anthropic**: ~$0.0017/imagen Haiku 4.5 (ver §[Costos detallados](#costos-detallados-de-cada-feature-ai)).
- **Margen**: 96% al precio Pro+ ($19/500 = $0.038/imagen efectivo).
- **Requisitos**: `ANTHROPIC_API_KEY` en env, retries básicos, fallback a deterministic si AI falla.

#### 1.2 Migración a Managed App Pricing

- **Esfuerzo**: 1–2 días.
- **Valor**: Habilitador de toda la monetización V2. Elimina el bug single-fetch + billing.request del V1. Reduce código de billing custom a casi cero.
- **Plan**: precondición técnica para 1.1, 1.3, 1.4.
- **Por qué primero**: cualquier otro feature de pago va a chocar con el problema de billing si no se migra. Mejor hacerlo antes de implementar features pagas, no después.
- **Pasos**:
  1. Re-introducir `billing` config en `app/shopify.server.js` pero usando Managed App Pricing en Partner Dashboard.
  2. Definir tiers en Partner Dashboard UI (no en código).
  3. Reemplazar `checkIsPro` por lectura del subscription state del SDK.
  4. Re-introducir webhook `app_subscriptions/update` con la lógica actual.
  5. Actualizar Privacy/Terms con info de pricing y procesamiento de pagos via Shopify.

#### 1.3 AI meta description generator

- **Esfuerzo**: 2–3 días (mucho menos que alt text porque no requiere image processing).
- **Valor**: ALTO. Menos competencia que alt text, complementa la detección que ya hacemos free.
- **Plan**: Pro+ $19 (300/mes), Scale $49 (1000/mes).
- **Diseño**:
  - Botón "Generate with AI" en la sección de issues del detalle del producto cuando falte/sea muy corta la meta description.
  - Input: product title + descriptionHtml (stripped) + locale. Output: 140–160 chars.
  - Preview antes de aplicar, edición inline disponible.
  - Aplicación via `productUpdate` mutation (no `productUpdateMedia`).
- **Costo**: ~$0.0007/producto.
- **Margen**: 99% al precio Pro+.

#### 1.4 AI meta title generator

- **Esfuerzo**: 1–2 días (más simple aún).
- **Valor**: MEDIO. Menos diferenciador que description (los títulos son cortos, el merchant suele tener uno bueno ya).
- **Plan**: bundle con 1.3 (mismo quota).
- **Costo**: ~$0.00028/producto.
- **Estrategia**: implementar en el mismo PR que 1.3, costo marginal cero.

### 🥈 Prioridad 2 — Expansión de surface (V2 mid-cycle)

#### 2.1 Análisis estructural del HTML rendered

- **Esfuerzo**: 5–8 días.
- **Valor**: ALTO y diferenciador. Pocas apps lo hacen bien con UX limpia.
- **Plan**: Pro $9.
- **Diseño**:
  - Fetch del HTML rendered de home, product templates, collection templates (vía `fetch()` del storefront URL — no requiere scope extra).
  - Parser DOM con `parse5` o `cheerio` (server-side).
  - Checks: exactamente un `<h1>` por página, jerarquía h2/h3 sin saltos, presencia de Open Graph (`og:title`, `og:description`, `og:image`), schema.org JSON-LD válido en product/home/collection.
  - Reporte en tab nuevo "Storefront SEO" con scoring por template (no por producto).
- **Riesgo**: el HTML depende del theme; cambios de theme rompen checks. Mitigación: re-correr análisis on theme publish (webhook `themes/publish`).

#### 2.2 Análisis de páginas estáticas y colecciones

- **Esfuerzo**: 3–4 días (reusa `IssuesList`).
- **Valor**: MEDIO-ALTO. Extiende los 5 checks a `read_content` que ya pedimos en scopes.
- **Plan**: Pro $9.
- **Diseño**:
  - Nuevos servicios `fetchAllPages`, `fetchAllCollections` análogos a `fetchAllProducts`.
  - Nuevas rutas `/app/pages` y `/app/collections` con la misma UX del listado de productos.
  - El analyzer es reutilizable casi 1:1 (los 5 checks aplican).

#### 2.3 Edición inline del alt text en el preview

- **Esfuerzo**: 1–2 días.
- **Valor**: MEDIO. UX win, no monetiza per se pero reduce churn (merchants quieren control).
- **Plan**: Pro $9 (junto con AI alt text — el preview AI necesita esto sí o sí).

#### 2.4 Schedule recurring audits

- **Esfuerzo**: 2–3 días.
- **Valor**: MEDIO. Diferenciador de tier Pro+.
- **Plan**: Pro+ $19.
- **Diseño**:
  - Cron job (Railway scheduler o Postgres pg_cron) corre análisis semanal por shop.
  - Email summary con: nuevos issues, productos resueltos, top issues.
  - Email envío via Resend (free tier 3k emails/mes).

### 🥉 Prioridad 3 — Estratégico de largo plazo

#### 3.1 Multilenguaje (UI en otros idiomas)

- **Esfuerzo**: 4–6 días primera vuelta.
- **Valor**: BAJO en V2 (el mercado prime es US/UK/AU/CA en inglés). MEDIO en V3 cuando expandamos a LATAM/EU.
- **Plan**: Free.
- **Diseño**: i18n con `react-i18next` o equivalente. Locales iniciales: ES, FR, DE, IT, PT.

#### 3.2 Sidekick App Extension

- **Esfuerzo**: 5–10 días (requiere preview access de Shopify + reescribir queries como actions).
- **Valor**: ALTO si conseguimos tracción real y acceso. Bajo hasta entonces.
- **Plan**: Free (parte del producto base, no monetiza directamente — es discoverability).
- **Trigger**: 50+ instalaciones activas + acceso al preview de Sidekick.

#### 3.3 Bulk operations API (`bulkOperationRunMutation`)

- **Esfuerzo**: 3–5 días.
- **Valor**: BAJO en V2. Sirve solo cuando tengamos merchants con 5k+ productos.
- **Plan**: Pro+ $19 (escalabilidad enterprise).
- **Trigger**: 3+ merchants reportando timeouts o lentitud en bulk fix con catálogos grandes.

---

## Costos detallados de cada feature AI

Costos verificados contra docs.claude.com el 2026-05-25.

### Pricing Claude API

| Modelo | Input $/MTok | Output $/MTok |
|---|---|---|
| Haiku 4.5 | $1 | $5 |
| Sonnet 4.6 | $3 | $15 |
| Opus 4.7 | $5 | $25 |

Vision: las imágenes se encodean como input tokens. Una imagen ~1024×1024 = ~1,200 tokens aprox.

### 1) Alt text con Claude Vision (la AI feature más cara)

**Por imagen**:
- Input: ~1,200 tokens (imagen) + ~200 tokens (prompt + product context) = 1,400 tokens
- Output: ~50 tokens (alt text 50–100 chars)

| Modelo | Costo/imagen | Costo/100 imgs | Costo/500 imgs |
|---|---|---|---|
| **Haiku 4.5** (recomendado) | **$0.0017** | $0.17 | $0.85 |
| Sonnet 4.6 | $0.0050 | $0.50 | $2.50 |
| Opus 4.7 | $0.0083 | $0.83 | $4.17 |

**Recomendación**: Haiku 4.5. Calidad suficiente para descripciones cortas de imagen de producto. Si el merchant pide upgrade de calidad, Sonnet 4.6 como opción premium.

**Pricing al merchant** (Pro+ $19/500 = $0.038/imagen efectivo): **margen 96.7%**.

### 2) AI meta description generator

**Por producto**:
- Input: ~250 tokens (title + descriptionHtml stripped truncado a ~150 chars + prompt + locale)
- Output: ~100 tokens (meta description 140–160 chars)

| Modelo | Costo/producto | Costo/100 prods | Costo/1000 prods |
|---|---|---|---|
| **Haiku 4.5** | **$0.00075** | $0.075 | $0.75 |
| Sonnet 4.6 | $0.00225 | $0.23 | $2.25 |

**Recomendación**: Haiku 4.5. Calidad muy aceptable para meta descriptions formulaicas.

**Pricing al merchant** (Pro+ $19/300 = $0.063/desc efectivo): **margen 98.8%**.

### 3) AI meta title generator (la AI feature más barata)

**Por producto**:
- Input: ~150 tokens (title + prompt + locale)
- Output: ~25 tokens (title 50–60 chars)

| Modelo | Costo/producto | Costo/100 prods | Costo/1000 prods |
|---|---|---|---|
| **Haiku 4.5** | **$0.00028** | $0.028 | $0.28 |
| Sonnet 4.6 | $0.00083 | $0.083 | $0.83 |

**Pricing al merchant** (incluido en Pro+): **margen ~99%**.

### Ranking de AI features por oportunidad

| # | Feature | Costo/op | Diferenciación vs mercado | Margen al pricing propuesto | Recomendación |
|---|---|---|---|---|---|
| 1 | **AI alt text** | $0.0017 | Validado por competidores ($) | 96.7% | **Construir primera**. Es el hook AI obvio. |
| 2 | **AI meta description** | $0.00075 | Menos competencia, alta percepción de valor | 98.8% | **Construir segunda** (mismo PR que meta title, costo marginal cero). |
| 3 | **AI meta title** | $0.00028 | Bundlear con #2 | 99% | Bundle con #2. |

### Salvaguardas obligatorias antes de shipear cualquier AI

- **Rate limit por shop** (ej: max 50 calls/min) para evitar abuso.
- **Quota mensual** enforced server-side (no solo en UI).
- **Costo per-shop monitoring** con alerta a `support@curyapps.com` si algún shop excede $5 USD/mes en costos (señal de bug o abuso).
- **Fallback graceful** a deterministic si Anthropic API está caída o el shop excede quota.
- **Privacy update obligatorio**: agregar Anthropic como sub-procesador en `cury-apps-site/seo-analyzer/privacy.html` ANTES del primer release V2.

---

## Tech debt e infraestructura

Estas tareas no son features y no monetizan, pero hay que tenerlas en el radar.

### Test de carga con 1k+ productos (pre-V2)

- **Esfuerzo**: 1–2 días.
- **Trigger**: antes de anunciar V2 públicamente o cuando un merchant reporte issue.
- **Qué probar**:
  - Primer análisis: completa en tiempo razonable (<3 min para 1k productos).
  - Bulk fix de 500+ alt texts: progress bar avanza, no bloquea UI.
  - Stale-while-revalidate: banner "Refreshing" aparece y desaparece al terminar.
  - Rate limit Shopify: si pega 429, el wrapper `shopifyGraphql` respeta Retry-After.
  - Postgres connection pool en Railway bajo carga concurrente.
- Script de seed sintético pendiente: crear `scripts/seed-test-store.js` que genere N productos via Admin API con SEO states variados.

### Upgrade Prisma 6.19 → 7.x

- **Esfuerzo**: 0.5–1 día.
- **Cuándo**: después del primer release estable de V1 (2+ semanas en App Store sin issues).
- **Rama**: `chore/prisma-7-upgrade` dedicada.
- **Riesgo**: bajo (schema es simple, no usamos features avanzadas como `extendedWhereUnique`, `metrics`, `tracing`, `omit`).
- **Pasos**:
  1. Leer https://pris.ly/d/major-version-upgrade.
  2. `pnpm add -D prisma@latest && pnpm add @prisma/client@latest`.
  3. Regenerar cliente: `pnpm prisma generate`.
  4. Validar build + lint + smoke test del CRUD en `app/services/*` (Session, SeoCache, SeoJob).
  5. Si hay breaking changes en generated client → fix en `app/services/`.
  6. Probar bulk fix end-to-end en dev store.
  7. Merge a main, deploy en Railway, monitorear logs primeras 24h.

### Observability básica

- **Esfuerzo**: 1–2 días.
- **Por qué**: cuando V2 cobre, los bugs cuestan dinero a merchants. Hoy solo tenemos Railway logs.
- **Mínimo viable**: structured logging por shop + endpoint, alertas a Slack/Discord si error rate > 5% en 5 min, métricas básicas de uso AI por shop.
- **Tools**: Better Stack (free tier) o Logtail. Evitar Sentry para mantener costo cero hasta tener MRR.

---

## Ideas descartadas / movidas / completadas

### ✅ Completadas en V1 (ya no aplican como ideas futuras)

- **Bulk fix masivo escalable (sin cap)**: el FUTURE_IDEAS viejo mencionaba "cap de 50 productos por ejecución". Eso quedó eliminado en V1 — el bulk fix actual procesa todo el catálogo sin tope con job en background y heartbeat anti-zombie.
- **i18n de UI**: la migración a inglés se completó. La extensión a otros idiomas se reframea en §3.1 Multilenguaje.

### ⏬ Movidas al CLAUDE.md / a otros docs

- Estrategia general de monetización V1 free → CLAUDE.md §1 y §8.
- Plan de Privacy/Terms updates antes de AI → `cury-apps-site/README.md`.

### ❌ Descartadas

- **Generadores de schema.org "wizard"**: muchas apps lo hacen (StoreSEO, Plug in SEO). Replicarlo sin diferenciación es competir en commodity. Pasa solo si lo pide un merchant grande.
- **Redirect manager**: no es SEO en sentido estricto, y otras apps gratuitas ya lo cubren.
- **Image compression**: territorio de TinyIMG. No queremos pelear esa categoría con su free tier de 50 img/mes.

---

*Este documento se actualiza cada vez que se ship una feature de la lista o cuando aparezcan datos nuevos de mercado/costos.*
