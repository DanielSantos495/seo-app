# Plan de Optimización — Performance & UX

> Análisis técnico profundo de la SEO App (React Router 7 + Shopify App Bridge + Prisma) con foco 100% en **rapidez percibida**, **uso eficiente de la Admin API** y **UX fluida** entre secciones. Cada hallazgo lleva un fix concreto y priorizado.

---

## 0. Resumen ejecutivo

La app funciona pero **toda la experiencia se siente lenta** porque los loaders hacen trabajo pesado y sincrónico en cada navegación. Hay 3 bloques de problemas a resolver en este orden:

1. **Trabajo redundante por loader** → cada tab repite `authenticate + checkIsPro + getCached + previewAltTextsForProducts`. Eliminar duplicación y mover trabajo fuera del path crítico baja la latencia 60–80 % sin tocar lógica de negocio.
2. **El primer fetch sigue siendo bloqueante** → cuando la caché vence, el loader queda esperando `fetchAllProducts` (puede ser >30 s con 1k productos). Hay que servir respuesta inmediata con datos stale + revalidar en background.
3. **Sin feedback durante navegación ni operaciones largas** → click en una tab y el usuario mira la pantalla vieja sin pista de progreso. Necesitamos prefetch, skeletons y barra de progreso para el bulk fix.

Quick wins (1–2 días, sin cambios de arquitectura): puntos **1.1, 1.2, 1.3, 2.1, 3.1, 5.1**.

---

## 1. Eliminar peticiones inútiles en los loaders

### 1.1 [P0] `previewAltTextsForProducts` se ejecuta en CADA carga del loader

**Dónde:** `app/routes/app.products.jsx:57-63` y `app/routes/app.issues.jsx:111-118`.

**Problema:** Cada vez que el usuario entra a Productos o a Issues, el loader hace 3 llamadas `fetchProductById` **secuenciales** solo para mostrar 3 muestras de alt text dentro de un modal que el usuario probablemente nunca abra. Son ~3 round-trips a la Admin API en serie (≈600–1500 ms extra) por cada navegación.

**Fix:**
- Mover el preview a un **resource route** (`app/routes/api.bulk-preview.jsx`) que se llame con `useFetcher().load()` solo cuando el usuario abre el modal.
- Mientras carga, mostrar un `s-spinner` dentro del modal. Tres ejemplos no justifican esperar para todas las cargas.

### 1.2 [P0] `checkIsPro(billing)` se ejecuta en cada loader

**Dónde:** todos los loaders (`app._index`, `app.products`, `app.issues`, `app.products_.$id`).

**Problema:** `billing.check()` es una llamada HTTP a Shopify (Admin API REST/GraphQL). Cada cambio de tab cuesta 1 round-trip extra solo para volver a confirmar el plan.

**Fix:**
- Cachear el plan en una columna del modelo `Session` (`isPro: Boolean`, `planCheckedAt: DateTime`) o en una tabla `ShopPlan { shop, isPro, expiresAt }` con TTL de 5–10 min.
- Mantener `webhooks.app.subscriptions_update.jsx` ya existente como fuente de verdad para **invalidar la caché del plan en cuanto Shopify confirma cambios** (ya está la ruta, falta el escritor).
- Helper: `await getCachedPlan(shop)` con fallback a `billing.check()` si stale.

### 1.3 [P0] El layout `app.jsx` autentica pero no comparte datos

**Dónde:** `app/routes/app.jsx:6-11`.

**Problema:** El layout solo devuelve `{ apiKey }`. Cada ruta hija vuelve a llamar `authenticate.admin(request)` y `checkIsPro`. React Router 7 permite consumir el loader del padre con `useRouteLoaderData("routes/app")`.

**Fix:**
- En el loader de `app.jsx`, devolver además `{ shop, isPro, planLimit, lastAnalyzedAt }` (todo barato si combinamos con 1.2).
- En cada hijo, leer `useRouteLoaderData("routes/app")` y **eliminar** `checkIsPro` local.
- Resultado: 1 sola llamada de billing por navegación inicial; las tabs siguientes son instantáneas.

### 1.4 [P1] El loader del dashboard envía `exportItems` (catálogo entero) al cliente

**Dónde:** `app/routes/app._index.jsx:59` y `csv-export.js`.

**Problema:** Cada render del dashboard serializa el catálogo completo de la tienda (Pro = potencialmente 10k items × score + issues) **solo para que el botón "Exportar CSV" tenga datos en el cliente**. Esto:
- Multiplica el payload del loader por 10–100×.
- Bloquea JSON.parse en clientes lentos.
- Se descarga aunque el usuario nunca exporte.

**Fix:**
- Crear `app/routes/api.export.csv.jsx` que en su loader genere el CSV desde el cache y devuelva `Content-Type: text/csv` + `Content-Disposition: attachment`.
- El botón "Exportar CSV" se vuelve un `<a href="/app/api/export.csv?host=...">` y descarga sin tocar el cliente.
- Bonus: streamear filas con `ReadableStream` para no cargar todo en memoria del servidor.

### 1.5 [P2] `app.products_.$id.jsx` siempre hace `fetchProductById`

**Dónde:** `app/routes/app.products_.$id.jsx:23-46`.

**Problema:** Aun cuando hay cache de la tienda, el detalle re-fetcha al producto desde la Admin API. Para un merchant navegando varios productos seguidos = N round-trips innecesarios.

**Fix:**
- Intentar leer del cache (`getCachedItems`) primero por GID; si está → renderizar inmediatamente con datos del cache + un fetch en background para validar imágenes/variantes (que el cache no guarda).
- Si no está → comportamiento actual.
- Alternativa simple: cache local en memoria con TTL corto (LRU 100 productos × 1 min) para reducir hits repetidos durante una sesión.

---

## 2. Quitar el "primer fetch bloqueante"

### 2.1 [P0] Servir stale-while-revalidate al expirar la caché

**Dónde:** `app/services/seo-cache.js:12-23` (TTL = 1 h, todo-o-nada).

**Problema:** Hoy, cuando `updatedAt + 1h < now`, el loader devuelve `null` y dispara `fetchAllProducts` en línea. Para una tienda con 1000 productos eso son 20 páginas de 50 productos × ~250 ms ≈ **5–8 s mínimos** antes de pintar nada.

**Fix:**
1. Cambiar `getCachedItems` para devolver siempre `{ items, analyzedAt, isStale }` mientras exista la fila (sin TTL hard).
2. Si `isStale === true`, el loader devuelve datos viejos **y** dispara `revalidateInBackground(shop)` (fire-and-forget) que actualizará la caché para la próxima navegación.
3. Mostrar en la UI un chip `s-badge`: "Datos de hace 2 h · actualizando…".
4. Endpoint de polling `api.cache-status.jsx` consultable con `useFetcher` cada 5 s mientras hay revalidación activa (señal: row con `revalidating: true`).

**Impacto:** primer paint <300 ms incluso con catálogos grandes. El primer análisis (cuando no hay cache) sigue siendo lento — ver 2.2.

### 2.2 [P0] Primer análisis en background con feedback

**Dónde:** Mismo path crítico, pero ahora cuando `getCachedItems` devuelve `null` real (primera vez tras instalación o cache borrada).

**Fix:**
- Crear tabla `SeoJob { id, shop, status, progress, totalProducts, processed, startedAt, finishedAt, error }` en Prisma.
- Helper `startAnalysisJob(shop, admin)`:
  - Crea fila `status="running"`.
  - Lanza `fetchAllProductsStreaming(admin, onPage)` donde cada página actualiza `processed += 50`.
  - Al terminar: `setCachedItems` + `status="done"`.
- Loader del dashboard: si no hay cache **y** hay job running → render "Analizando tu tienda (X / Y)…" con polling cada 2 s.
- Si no hay cache **y** no hay job → llamar `startAnalysisJob` (fire-and-forget) y pasar directo al estado "Analizando…".

**Importante:** en Node monolítico (React Router serve) los promises `unawaited` mueren si el proceso reinicia. Mitigación pragmática para v1:
- Persistir el progreso en `SeoJob` cada N páginas.
- Si reinicia, el siguiente loader detecta `running` con `startedAt > 10min` y lo reanuda.
- Para v2: BullMQ + Redis cuando se justifique con escala real.

### 2.3 [P1] Reducir el payload de la GraphQL query

**Dónde:** `app/services/shopify-api.js:21-43`.

**Problema:** `GET_PRODUCTS_SEO_QUERY` trae `descriptionHtml` completo (puede ser KBs por producto) **solo para hacer `stripHtml(...).length > 100`** en el scorer (`seo-analyzer.js:104`).

**Fix:**
- En el query de listado, traer `description` (texto plano) en vez de `descriptionHtml`; o aún mejor, no traerlo y agregar un campo derivado:
  - Shopify GraphQL no expone longitud de descripción nativa, pero podemos traer **solo los primeros 300 chars** con `descriptionHtml` y considerar > 100 → `description: { truncate: 300 }` no existe, así que mantener `description` (plain) que ya viene strip-eado del lado de Shopify.
- En el detalle (`GET_PRODUCT_SEO_QUERY`) sí mantener `descriptionHtml` (lo necesitamos para análisis fino).
- Estimado: -40–60 % del peso del response del listado.

### 2.4 [P2] Paginar `media(first: 50)` y `variants(first: 100)` correctamente

**Dónde:** `shopify-api.js:6-19, 57-69`.

**Problema:** Un producto con 51+ imágenes o 101+ variantes **se trunca silenciosamente**. El análisis de alt texts subestima los faltantes.

**Fix:** Re-fetchear páginas adicionales cuando `media.pageInfo.hasNextPage === true`. Implementación:
```js
async function fetchAllMedia(admin, productGid) { /* loop con cursor */ }
```
Solo se invoca si la primera página llegó al tope (50). Para 99 % de tiendas, no hay overhead.

---

## 3. Manejar el rate limit de Shopify correctamente

### 3.1 [P0] Wrapper único `shopifyGraphql(admin, query, vars)`

**Problema:** No hay retry, ni backoff, ni manejo de `THROTTLED` ni de 429. `fetchAllProducts` itera ciegamente. Una tienda mediana al primer análisis ya raspa el límite.

**Fix:**
- Crear `app/services/shopify-fetch.js` que envuelva `admin.graphql`:
  - Lee `extensions.cost.throttleStatus.currentlyAvailable` de la respuesta.
  - Si `< requestedQueryCost * 2` → `await sleep(restoreTime)` antes del próximo call.
  - Si recibe error `THROTTLED` → backoff exponencial (250ms, 500ms, 1s, 2s, max 3 retries).
  - Si recibe 429 → respeta `Retry-After`.
- Reemplazar **todas** las llamadas `admin.graphql(...)` por `shopifyGraphql(admin, ...)`.

### 3.2 [P1] Bulk fix con concurrencia controlada

**Dónde:** `shopify-api.js:178-208`.

**Problema:** Hoy es 100 % secuencial con `BULK_THROTTLE_MS = 800ms`. Para 50 productos: ~40 s **dentro del action** = el browser ve un POST colgado, sin progreso, y si el host (Railway) corta requests >30 s = todo se rompe.

**Fix:**
- Convertir bulk fix en un **job en background** (mismo sistema de `SeoJob` con `type: "bulk_alt"`).
- Concurrencia de 5 productos paralelos con `p-map` (ya está en `overrides`) + el wrapper de 3.1 — el rate limiter centralizado se encarga del throttling real.
- Action devuelve `{ jobId }` instantáneo; el modal cambia a `useFetcher` polling cada 1 s a `api.job.$id.jsx`.
- UI: `s-progress` con "30 / 200 productos · ETA 1 min".

### 3.3 [P1] Eliminar el cap arbitrario de 50 productos

**Dónde:** `app.products.jsx:27` y `app.issues.jsx:28`.

**Problema:** Forzar al merchant a re-clickar "Arreglar" varias veces es UX rota — la queja #1 reportada.

**Fix:** Con 3.2 implementado, el cap deja de tener sentido. El job procesa los N elegibles. La modal anuncia "Vamos a procesar 1834 productos · estimado 6 min" y el merchant se va a tomar un café.

---

## 4. Cache invalidation inteligente

### 4.1 [P1] Update granular en vez de `invalidateCache(shop)`

**Dónde:** `app.products.jsx:101`, `app.issues.jsx:154`, `app.products_.$id.jsx:79`.

**Problema:** Cualquier corrección (incluso de 1 producto) **borra toda la caché** → siguiente navegación = re-fetch completo del catálogo. Esto reintroduce el problema bloqueante exactamente cuando el usuario está satisfecho por aplicar un fix.

**Fix:**
- Helper `updateCachedItems(shop, productIds, mutator)`:
  - Lee la fila, parsea, aplica `mutator(item)` a los productos afectados, re-analiza solo esos, guarda.
- En el fix individual: `updateCachedItems(shop, [gid], item => ({ ...item, score: newAnalysis.score, issues: newAnalysis.issues }))`.
- En el bulk job: mismo helper al final, alimentado con los GIDs procesados.
- Solo invalidar caché completa en:
  - Webhook `products/update` o `products/delete` masivo.
  - Cambio de plan (free → pro o viceversa).
  - Botón "Re-analizar ahora" (acción explícita del merchant).

### 4.2 [P2] Pre-computar derivados en el cache

**Dónde:** loaders actuales recalculan en cada request.

**Problema:** `aggregateAnalyses`, `groupIssuesByField`, `worstProducts`, `getEligibleGids` corren sobre todo el catálogo en cada loader. Para 10k items en JS son ~50–200 ms innecesarios por request.

**Fix:** Guardar en `SeoCache.data` no solo `items` sino también:
```json
{
  "items": [...],
  "report": { "overallScore": 72, "issuesByImpact": {...} },
  "groups": [...],
  "worstProducts": [...],
  "eligibleAltGids": [...]
}
```
Se computa una vez en `setCachedItems` y los loaders solo seleccionan lo que necesitan. Bonus: el dashboard ni siquiera necesita parsear `items` completos.

### 4.3 [P2] Webhook `products/update` para invalidación reactiva

**Problema:** No hay webhook de productos. Si el merchant edita en Shopify, la app sigue mostrando datos viejos hasta el TTL de 1h.

**Fix:**
- Subscribirse a `products/update` y `products/delete` en `shopify.app.toml`.
- Webhook handler: marca `SeoCache` como `staleAt = new Date()` (no borra). El loader la sirve stale y revalida en background.

---

## 5. Navegación instantánea entre tabs

### 5.1 [P0] Prefetch on hover/intent

**Dónde:** `app/routes/app.jsx:18-22` y todos los `<s-link>` / `<s-button href>`.

**Problema:** Los `<s-link>` de Polaris (web components) no hacen prefetch del loader. Cada click espera al loader desde cero.

**Fix:**
- Para los items de `<s-app-nav>`: usar `<Link to="/app/products" prefetch="intent" />` de `react-router` envolviendo el `<s-link>`, o equivalente. React Router 7 dispara el loader al hover/focus.
- Para los `<s-clickable>` que navegan a `/app/products/{id}` (dashboard, lista, issues), idem: envolver con `<Link prefetch="intent">`.
- Resultado: tabs cambian con sensación instantánea porque al hover ya se está cargando.

### 5.2 [P1] Skeletons consistentes durante navegación

**Problema:** `useNavigation().state === "loading"` no está consumido en las rutas principales. El usuario ve la pantalla anterior congelada hasta que el loader termina.

**Fix:**
- En `app.jsx` leer `useNavigation()`. Si `state === "loading"` **y** la URL destino es distinta de la actual → renderizar un `<RouteSkeleton path={navigation.location.pathname} />`.
- Skeletons mínimos por ruta:
  - `/app` → 1 card grande para el score + 3 mini-stats + tabla 5 filas.
  - `/app/products` → search field + tabla 10 filas grises.
  - `/app/issues` → 3 secciones colapsadas.
- Usar `<s-skeleton>` (Polaris web components) o cajas `<s-box background="subdued">` con `aria-busy="true"`.

### 5.3 [P1] Streaming SSR con `defer` para datos secundarios

**Problema:** El dashboard espera a tener `worstProducts`, `report` y `exportItems` antes de pintar. Pintar el score en 100 ms y luego stream-ear el resto se siente mucho más rápido.

**Fix:** Usar el patrón `defer()` de React Router 7 / Remix:
```js
return {
  fastData: { isPro, overallScore: report.overallScore, totalProducts: report.totalProducts },
  slowData: defer(loadWorstProducts()), // Promise
};
```
Luego en el componente `<Await resolve={slowData}>...<\/Await>` con su propio `<Suspense fallback={<Skeleton/>}>`.

### 5.4 [P2] Usar `useFetcher` para acciones que no deberían navegar

**Dónde:** `<Form method="post">` en `app.products.jsx`, `app.issues.jsx`, `app.products_.$id.jsx`.

**Problema:** `<Form>` clásico dispara navegación al action → re-corre loader → re-render completo. Un bulk fix no debería remontar la página.

**Fix:**
- Reemplazar por `useFetcher()` + `<fetcher.Form>`. El action corre, el loader se re-revalida automáticamente, pero la página no remonta (mantiene scroll, modal abierto si querés mostrar resumen).
- Combinar con optimistic UI: al submit, marcar items como "actualizando" en el state local.

---

## 6. UX de operaciones largas

### 6.1 [P0] Progreso real para "Re-analizar ahora"

**Dónde:** `app.products._index.jsx:64-68` (action) y botón en línea 159-163.

**Problema:** El action solo invalida caché y redirect. El usuario hace click → todo gris → 10 s después aparece el dashboard con datos nuevos. Sin indicador. Sin manera de cancelar.

**Fix:**
- El action dispara `startAnalysisJob(shop)` y devuelve `{ jobId }`.
- El botón cambia a `loading` mostrando "Re-analizando · 234 / 850 productos" leyendo el endpoint de status.
- Al terminar: toast "Análisis listo · 850 productos analizados" y reload del loader (`revalidator.revalidate()`).

### 6.2 [P0] Modal de bulk fix con barra de progreso

**Ya cubierto en 3.2.** Stack visual del modal durante el job:
```
[ s-progress 0–100% ]
"234 / 850 productos · 45 segundos restantes"
[ Pausar ]   [ Cerrar (sigue en background) ]
```
El usuario puede cerrar el modal y el job sigue. Toast `s-toast` cuando termina.

### 6.3 [P1] Resumen visual post-fix (no solo toast)

**Dónde:** `app.products.jsx:135-151`.

**Problema:** Toast desaparece en 4 s. Si el merchant arregló 200 imágenes y vio 3 errores, no tiene cómo revisarlos.

**Fix:** Tras `ok=true`, mostrar dentro de la página un `<s-banner tone="success">` con CTA "Ver detalles" que abre un modal con la tabla de productos procesados + errores específicos. Dejar el banner hasta el próximo análisis o que el usuario lo cierre.

### 6.4 [P2] Mejorar el flujo de upgrade

**Dónde:** `app.upgrade.jsx` y `target="_top"` en muchos botones.

**Problema:** El `target="_top"` saca al merchant del iframe; durante 1–2 s ve una página en blanco. No hay UX de "estamos llevándote a la pasarela".

**Fix temporal:** una pantalla intermedia `/app/upgrade` que pinta `<s-banner>` "Redirigiendo a la pasarela de Shopify…" + `<s-spinner>` antes de disparar `billing.request`. Hoy el loader hace `await billing.request(...)` directo, así que no se llega a renderizar. Soluciones:
- Disparar el redirect del lado del cliente con `useEffect(() => window.top.location.href = ...)` mostrando el banner mientras tanto.
- Cuando el bug del SDK se resuelva, eliminar el workaround.

---

## 7. Frontend: rendering y peso del cliente

### 7.1 [P1] Virtualizar la tabla de productos

**Dónde:** `app.products.jsx:259-311`.

**Problema:** Para una tienda Pro con 2k+ productos, renderizar 2k `<s-table-row>` (con thumbnails) congela el navegador 1–3 s y consume mucha RAM.

**Fix:**
- Paginar en el cliente: chunks de 50 con "Cargar más" o paginación por número (rápido y sin librería).
- Mejor: virtualización con `@tanstack/react-virtual` (5kb). Renderiza solo lo visible.
- Aún mejor: paginar en el **loader** con cursor + query param `?page=N` → loader devuelve 50 a la vez. Los datos completos viven en cache; el slicing es barato.

### 7.2 [P1] Lazy-load thumbnails

**Problema:** El primer paint de Productos descarga N thumbnails (puede ser 50–500 imágenes de Shopify CDN). Aunque están en CDN, son requests HTTP.

**Fix:**
- Asegurarse que `<s-thumbnail src=...>` o el `<img>` interno tiene `loading="lazy"`. Si el web component no lo expone, pasar al `<img>` plano para los thumbs de la tabla.
- Usar URLs transformadas: `?width=80` (Shopify CDN soporta resize) en vez de la imagen full-size — ahorra MBs.

### 7.3 [P2] Memoizar `displayed` correctamente

**Dónde:** `app.products.jsx:156-194`.

**Problema:** El `useMemo` ya está. Bien. Pero el filter/sort sobre `items` con 2k elementos en cada keystroke del search puede notarse.

**Fix:** Debounce del `query` con `useDeferredValue(query)` (React 18 nativo). Sin librerías.

---

## 8. Backend y datos

### 8.1 [P1] Migrar de SQLite a Postgres en producción

**Dónde:** `prisma/schema.prisma:11-14`.

**Problema:** SQLite con writes concurrentes desde múltiples instancias (Railway puede escalar) es propenso a `database is locked`. Y un `SeoCache.data` con 10k items en una columna `String` no escala.

**Fix:**
- Provider `postgresql` en prod (env-driven).
- Cambiar `data String` a `data Json`.
- Migración requiere `prisma migrate dev` en local con Postgres-shadow.

### 8.2 [P1] Índices

**Problema:** `SeoCache` solo tiene `shop @unique`. `Session` no tiene índice por `shop` (los webhooks van a buscar por shop).

**Fix:**
- `@@index([shop])` en `Session`.
- Para `SeoJob`: `@@index([shop, status])` para queries del polling.

### 8.3 [P2] Comprimir el JSON del cache

**Problema:** Para 10k items, `data` puede pesar 5–15 MB. Cada `findUnique` lee todo de disco/red, cada `JSON.parse` toma 100–300 ms.

**Fix opcional:**
- Split en dos columnas: `summary Json` (lo que renderiza el dashboard en <200ms) y `items Json` (lazy, solo cuando se va a `/app/products`).
- O dos tablas: `SeoCacheSummary` y `SeoCacheItem` (row per product). Mucho más limpio para invalidación granular del 4.1.

### 8.4 [P2] Centralizar feature flags y constantes

**Dónde:** `BULK_CAP = 50` duplicado en `app.products.jsx:27` y `app.issues.jsx:28`. `FREE_PLAN_PRODUCT_LIMIT` correctamente centralizado.

**Fix:** Mover `BULK_CAP` a `seo-analyzer.js` (o un `app/config.js`). Cuando 3.3 elimine el cap, queda un solo lugar a tocar.

---

## 9. Polish

### 9.1 [P2] Headers de cache para assets estáticos

Los thumbnails y JS de la app suelen quedar correctamente cacheados por React Router build. Verificar `Cache-Control: public, max-age=31536000, immutable` en `build/client/assets/*`. Si no, configurar en el servidor (Railway/`@react-router/serve`).

### 9.2 [P2] `streamTimeout` muy bajo

**Dónde:** `entry.server.jsx:8` → `streamTimeout = 5000`.

**Problema:** 5 s + 1 s buffer = 6 s. Si un loader queda esperando un fetch a Shopify lento, React aborta. Con stale-while-revalidate (2.1), los loaders nunca deben acercarse a este número, pero conviene subirlo a 10 s como red de seguridad.

### 9.3 [P2] Toasts duplicados

**Dónde:** `useEffect(() => ..., [actionData, shopify])` en varias rutas.

**Problema:** Si el componente remonta o `actionData` persiste tras revalidate, el toast se dispara dos veces.

**Fix:** Guardar un `ref` con el `actionData` ya mostrado:
```js
const shownRef = useRef(null);
useEffect(() => {
  if (!actionData || shownRef.current === actionData) return;
  shownRef.current = actionData;
  // toast...
}, [actionData]);
```

### 9.4 [P2] Errores manejados con grace

**Problema:** Cada loader hace `await admin.graphql(...)` sin try/catch. Si Shopify devuelve 500, la ErrorBoundary se pinta entera. UX más amable: serve cache stale + banner "No pudimos refrescar; mostrando datos de hace 1 h".

---

## 10. Métricas de éxito (para validar tras cada fase)

| Métrica | Antes (estimado) | Meta |
|---|---|---|
| TTFB del dashboard (cache hit) | 600–1000 ms | < 200 ms |
| TTFB del dashboard (cache miss, 1k productos) | 5–8 s | < 300 ms (stale-while-revalidate) |
| Cambio de tab (Dashboard → Productos) | 800–1500 ms | < 150 ms con prefetch |
| Bulk fix de 200 productos | bloqueado, repetir 4× | 1 job, ~3–5 min en background, UI fluida |
| Payload del loader del dashboard | 200 KB – 5 MB | < 50 KB |
| LCP en `/app/products` con 1k productos | 3–5 s | < 1 s |

---

## 11. Roadmap sugerido (orden de implementación)

**Sprint 1 — Quick wins (2–3 días):**
- 1.1 Lazy preview con `useFetcher`
- 1.2 Cache de `isPro`
- 1.3 Layout comparte data
- 1.4 CSV como resource route
- 5.1 Prefetch on intent
- 3.1 Wrapper de rate limit

**Sprint 2 — Trabajo en background (4–5 días):**
- 2.1 Stale-while-revalidate
- 2.2 Job de análisis con polling
- 3.2 Bulk fix como job + progress UI
- 6.1, 6.2 Feedback durante operaciones
- 4.1 Cache update granular

**Sprint 3 — Escala y polish (3–4 días):**
- 8.1, 8.2 Postgres + índices
- 7.1, 7.2 Virtualización + lazy thumbnails
- 5.2, 5.3 Skeletons + defer
- 9.x Polish (toasts, error handling, headers)

**Total estimado: ~2 semanas de un desarrollador.**

---

## 12. Principios de Shopify App development aplicados

A lo largo del plan se siguen estos principios oficiales (App Store review + Built for Shopify):

1. **Time to first action**: Built for Shopify exige <3 s para pintar contenido útil. Stale-while-revalidate + prefetch + skeletons lo garantizan.
2. **Respeto al rate limit**: Wrapper centralizado con backoff exponencial — requisito de Built for Shopify.
3. **App Bridge events**: `shopify.toast`, `s-modal`, `<s-app-nav>` ya están. Mantener consistencia, no introducir Polaris React legacy.
4. **Embedded experience intacta**: `target="_top"` solo donde un bug del SDK lo justifica; documentar para futura limpieza.
5. **Operaciones largas siempre en background con feedback**: nunca un POST bloqueante de >5 s desde el iframe.
6. **Webhooks como fuente de verdad** para invalidación reactiva (plan, productos), no polling agresivo.

---

*Este plan complementa `PLAN_DE_OPTIMIZACION.md` (raíz del repo) profundizando en problemas concretos del código actual y entregando fixes accionables con archivos y líneas específicas.*
