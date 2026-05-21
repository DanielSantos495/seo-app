# i18n Validation — Fase 4

> Validación final de la migración ES → EN.
> Rama: `feat/i18n-en-migration` (base: `feature/init-app`).
> Generado: 2026-05-20.

## Métricas

- **Strings traducidas:** 168 (estimado del audit)
- **Archivos modificados:** 15
- **Commits atómicos:** 8
- **Insertions / deletions:** +234 / −236 (líneas)

## 1. Lint

```bash
$ npm run lint
```

- **Resultado:** ✅ sin errores, sin warnings nuevos vs `feature/init-app`.
- Pasó tras escapar apóstrofes en JSX (`'` → `&apos;`) — los 15 errores iniciales se resolvieron en `a9624ce`.

## 2. Build

```bash
$ npm run build
```

- **Resultado:** ✅ build completo en ~1.07s (client) + 174ms (server).
- Warning preexistente sobre dynamic import de `alt-text-generator.js` — no introducido por esta migración.

## 3. Grep de regresión

### 3.1. Tildes y ñ en strings user-facing

```bash
$ rg -n "[áéíóúñÁÉÍÓÚÑ]" app/routes app/components app/services
```

- **Resultado:** ✅ todos los matches son comentarios del código (líneas `//`). Cero strings ES user-facing residuales.

### 3.2. Palabras comunes en ES

```bash
$ rg -n -i '\b(Producto|Productos|Tienda|Mejorar|Arreglar|Bloqueado|Sin issues|Cargar|Editar|Cancelar|Cerrar|Aplicar|Recargá|Entendido|Vacío|Buscar|Página|Siguiente|Anterior|Críticos?|Medios?|Bajos?|análisis|fall[oó])\b' app/
```

- **Resultado:** ✅ Cero matches dentro de strings — solo en comentarios (filtrado con `grep -v "://"` y `grep -v //`).

### 3.3. Keys técnicos intactos

```bash
$ rg -n 'field: "(seo\.title|seo\.description|images\.altText|descriptionHtml|handle)"' app/services/seo-analyzer.js
```

- **Resultado:** ✅ los 7 `field:` siguen idénticos a `main`:
  - `"seo.title"` (×2)
  - `"seo.description"` (×2)
  - `"images.altText"` (×1)
  - `"descriptionHtml"` (×1)
  - `"handle"` (×1)

```bash
$ rg -n 'impact: "(high|medium|low)"' app/services/seo-analyzer.js
```

- **Resultado:** ✅ los 6 `impact:` siguen idénticos: 2 high, 3 medium, 1 low.

```bash
$ rg -n 'mediaContentType' app/services/shopify-api.js
```

- **Resultado:** ✅ `mediaContentType === "IMAGE"` intacto en el normalize.

## 4. Smoke test manual

Pendiente para el dev — ejecutar tras hacer merge / antes de deploy:

- [ ] Dashboard (`/app`) carga con copy 100% en EN
- [ ] Lista de productos (`/app/products`) carga en EN — incluyendo sort menu, search field, table headers, pagination
- [ ] Detalle de producto (`/app/products/:id`) carga en EN — incluye sidebar "Current data", "Quick actions", IssuesList
- [ ] Issues view (`/app/issues`) carga en EN — agrupación, "Show N more", bulk fix
- [ ] Banner de upgrade en EN — desde dashboard, desde products list, desde issues
- [ ] Modal upgrade en EN — desde products (locked → "Unlock"), desde detail (Pro feature), desde issues
- [ ] Bulk fix end-to-end:
  - [ ] Modal de preview muestra "Pattern samples:" y la lista en EN
  - [ ] Botones "Apply to N product(s)" / "Cancel" / "Close (keeps running)" en EN
  - [ ] Toast post-fix en EN: "Done: N product(s) · M alt text(s) added"
  - [ ] `BulkFixSummaryBanner` en EN para los 4 estados (empty, already-ok, success, with errors) con "Got it" dismiss
- [ ] CSV export descarga con nombre `seo-report-<shop>-<date>.csv` (sin cambios en la lógica)
- [ ] Empty states en EN:
  - [ ] Dashboard sin productos: "No products" + paragraph
  - [ ] Products list filtrado sin matches: `No products match "<query>"`
  - [ ] Issues view sin issues: "No issues found" + "Your catalog meets the SEO criteria. Nice work."
- [ ] Loading / skeleton states en EN
- [ ] ErrorBoundary 403 (forzar) muestra "Reinstall required" + "Session expired" + paragraph
- [ ] ErrorBoundary producto inexistente muestra "Product not found" + "We couldn't load this product"
- [ ] JobProgress: label en EN, banner failed con "The process failed"
- [ ] Trial / upgrade button en EN: "Upgrade to Pro · $9/month (7-day free trial)"
- [ ] Relative time en EN: "Just now", "5 min ago", "2 h ago", "3 d ago"
- [ ] Issue messages en `IssuesList` en EN (todos los rules de `seo-analyzer.js`)
- [ ] Alt text generado por bulk fix usa "view N" (no "vista N") en imágenes huérfanas

> **Importante**: el smoke test requiere una dev store con productos reales. Reset del cache (Settings → reinstall app o `await invalidateCache(shop)`) recomendado para forzar nuevo análisis y ver mensajes EN frescos.

## 5. Diff resumen vs `feature/init-app`

```
 app/components/BulkFixSummaryBanner.jsx |  32 +++++-----
 app/components/IssuesList.jsx           |  12 ++--
 app/components/JobProgress.jsx          |   8 +--
 app/components/RouteSkeleton.jsx        |  12 ++--
 app/routes/api.export[.]csv.jsx         |   2 +-
 app/routes/app._index.jsx               |  83 ++++++++++++------------
 app/routes/app.issues.jsx               |  75 +++++++++++-----------
 app/routes/app.jsx                      |  15 ++---
 app/routes/app.products.jsx             | 110 ++++++++++++++++----------------
 app/routes/app.products_.$id.jsx        |  71 +++++++++++----------
 app/routes/app.upgrade.jsx              |  10 +--
 app/services/alt-text-generator.js      |   2 +-
 app/services/issue-labels.js            |   6 +-
 app/services/seo-analyzer.js            |  30 ++++-----
 app/services/seo-job.js                 |   2 +-
 15 files changed, 234 insertions(+), 236 deletions(-)
```

## 6. Commits en la rama

1. `06b2cdf` — i18n(services): translate seo-analyzer issue messages and fixes
2. `1c7fcd5` — i18n(services): translate issue labels, alt-text generator suffix, job error message
3. `ce9778c` — i18n(components): translate IssuesList, JobProgress, BulkFixSummaryBanner, RouteSkeleton
4. `4e31d11` — i18n(routes): translate dashboard (_index)
5. `36a094b` — i18n(routes): translate products list and product detail
6. `abd6852` — i18n(routes): translate issues view
7. `3c5ce81` — i18n(routes): translate upgrade flow, CSV export error, 403 ErrorBoundary
8. `a9624ce` — i18n(routes): escape apostrophes in JSX text for react/no-unescaped-entities

## 7. Excluidos del scope (confirmado por el usuario en Fase 1)

- `app/routes/_index/route.jsx` — landing pública boilerplate (decisión #1)
- `shopify.app.toml` `name = "seo-app"` — config de deployment (decisión #2)

## 8. Decisiones aplicadas (Fase 2)

- **A**: severidad como adjetivo fijo en sumarios (`1 critical` / `2 critical`) — aplicado en `app.products.jsx` `IssuesSummary`. Simplifica el ternario de plural.
- **B**: empty state issues = "Your catalog meets the SEO criteria. Nice work."
- **C**: `Pro:` como prefix textual conservado
- **D**: error fallback = "An unexpected error occurred. Try again."
- **E**: "pasarela de pagos" → "Shopify payment page"

## 9. Status

✅ **Migración completa. Listo para revisión / merge a `feature/init-app`.**
