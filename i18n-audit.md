# i18n Audit — ES strings detectadas

> Fase 1 del plan de migración ES → EN.
> Generado: 2026-05-19. Solo strings **user-facing**. Comentarios, console.logs y queries GraphQL excluidos.

## Resumen

- **Total de strings detectadas:** 168
- **Total de archivos afectados:** 13
- **Áreas:**
  - `app/routes/` → 110 strings en 6 archivos
  - `app/components/` → 38 strings en 4 archivos
  - `app/services/` → 20 strings en 3 archivos
- **Excluidos del scope** (server-only, no llegan al usuario): todos los webhooks (`webhooks.*.jsx`), `entry.server.jsx`, `shopify-fetch.js`, `plan-cache.js`, `seo-job-runner.js`, `seo-cache.js`, `shopify.server.js`. Solo contienen comentarios en ES y `console.log` que el dev lee en logs.
- **Sin cambios** (ya están en inglés): `app/services/csv-export.js` headers, `app/routes/auth.login/error.server.jsx`, `app/routes/auth.login/route.jsx`.
- **Strings ambiguas / requieren decisión del usuario:** ver sección final.

---

## Inventario por archivo

### `app/routes/app.jsx`

| Línea | String original (ES) | Tipo | Notas |
|-------|----------------------|------|-------|
| 52 | `"Productos"` | nav link | label del nav lateral |
| 72 | `"Reinstalación requerida"` | page heading | error 403 — fallback ErrorBoundary |
| 74 | `"Sesión inválida"` | banner heading | |
| 76–77 | `"Los permisos de la app cambiaron. Necesitamos que reinstales la app para seguir."` | paragraph | |
| 80–82 | `"Andá al admin de tu tienda → Settings → Apps → desinstalá esta app y volvé a abrirla desde el listado para aceptar los permisos nuevos."` | paragraph | uso de "vos" — normalizar a inglés neutro |

> "Dashboard" e "Issues" del nav ya están en inglés.

---

### `app/routes/app._index.jsx`

| Línea | String original (ES) | Tipo | Notas |
|-------|----------------------|------|-------|
| 99 | `"hace unos segundos"` | relative time | helper `formatRelativeTime` |
| 100 | `` `hace ${min} min` `` | relative time | placeholder ${min} |
| 102 | `` `hace ${hours} h` `` | relative time | placeholder ${hours} |
| 104 | `` `hace ${days} d` `` | relative time | placeholder ${days} |
| 163 | `"El último análisis falló"` | banner heading | |
| 165–166 | `"Hubo un error inesperado. Probá de nuevo."` | paragraph fallback | "Probá" → tuteo |
| 170 | `"Reintentar análisis"` | button | |
| 175 | `"Analizando tu tienda"` | section heading | |
| 177–180 | `"Estamos analizando todos tus productos por primera vez. Esto puede tomar unos minutos para tiendas grandes — podés cerrar esta pestaña, el análisis sigue en background."` | paragraph | |
| 182 | `"Analizando productos"` | JobProgress label | |
| 192 | `"El último análisis falló"` | banner heading | duplicado contextual |
| 194–196 | `"Estamos mostrando datos del análisis anterior."` + ``"Hubo un error inesperado al refrescar."`` | paragraph | |
| 200 | `"Reintentar"` | button | |
| 206 | `"Actualizando datos"` | banner heading | |
| 207–209 | `"Mostramos el último análisis disponible mientras refrescamos en background."` | paragraph | |
| 211 | `"Re-analizando"` | JobProgress label | |
| 217 | `` `Plan Free · análisis limitado a ${planLimit} productos` `` | banner heading | placeholder |
| 219–222 | `"Mejora a Pro para analizar todos tus productos y desbloquear el bulk fix de alt texts."` | paragraph | |
| 229 | `"Mejorar a Pro · $9/mes (7 días gratis)"` | CTA button | aparece 3+ veces |
| 234 | `"Score general de tu tienda"` | section heading | |
| 239 | `"Bueno"` / `"Regular"` / `"Crítico"` | badge label | ternario inline |
| 242–247 | `` `Promedio sobre ${n} producto${plural}…` `` + `` `(límite del plan free: ${planLimit}).` `` | text con interpolación | maneja singular/plural inline |
| 251 | `` `Último análisis ${formatRelativeTime(...)}` `` | text | |
| 255 | `"Ver todos los productos"` | CTA button | |
| 259 | `"Re-analizar ahora"` | button | |
| 264 | `"Exportar CSV"` | button | |
| 272 | `"Pro: exportar CSV"` | button | |
| 279 | `"Issues encontrados"` | section heading | |
| 283 | `"Críticos"` | label issue tone | |
| 284 | `"Medios"` | label issue tone | |
| 285 | `"Bajos"` | label issue tone | |
| 301 | `"Ver issues agrupados por tipo"` | button | |
| 306 | `"Productos con peor SEO"` | section heading | |
| 321–322 | `` `${n} issue${plural}` `` | text | |
| 334 | `"Sin productos"` | section heading | empty state |
| 335–337 | `"Esta tienda aún no tiene productos. Crea algunos en el admin de Shopify y vuelve para ver el análisis."` | paragraph | |

---

### `app/routes/app.products.jsx`

| Línea | String original (ES) | Tipo | Notas |
|-------|----------------------|------|-------|
| 90 | `"Esta acción es solo para plan Pro"` | error JSON | mensaje API, llega al cliente vía toast |
| 98 | `"Cache no disponible. Recargá la página."` | error JSON | "Recargá" → tuteo |
| 110 | `"Peor score primero"` | sort option | |
| 111 | `"Mejor score primero"` | sort option | |
| 112 | `"Nombre A-Z"` | sort option | |
| 113 | `"Nombre Z-A"` | sort option | |
| 172 | `"No había alt texts para agregar"` | toast | |
| 174 | `"Productos ya tenían alt — listado actualizado"` | toast | |
| 177 | `` `Listo: ${ok} producto${pl} · ${totalImages} alt text${pl}${err ? ` · ${err} error${pl}` : ""}` `` | toast | múltiples placeholders + plural inline |
| 192 | `` `Error: ${bulkActionData.error}` `` | toast | prefix "Error:" |
| 263 | `"Productos"` | page heading | |
| 266 | `"Dashboard"` | breadcrumb link | ya está en EN — solo verificar |
| 267 | `"Analizando tu tienda"` | section heading | duplicado |
| 268 | `"Analizando productos"` | JobProgress label | |
| 275 | `"Productos"` | page heading | duplicado |
| 278 | `"Dashboard"` | breadcrumb button | EN |
| 290 | `"Actualizando datos"` | banner heading | dup |
| 291–293 | `"Mostramos el último análisis…"` | paragraph | dup |
| 295 | `"Re-analizando"` | JobProgress label | dup |
| 300 | `"Estás en el plan Free"` | banner heading | |
| 301–305 | `"Analizamos los primeros ${n} productos. Tienes ${m} producto(s) más esperando análisis. Mejora a Pro para desbloquear todos."` | paragraph | placeholders |
| 313 | `"Buscar producto"` | search field label | |
| 314 | `"Nombre o handle…"` | placeholder | |
| 363 | `` `Arreglar alt texts (${n})` `` | bulk fix button | |
| 364 | `` `Pro: arreglar alt texts (${n})` `` | bulk fix button | |
| 373 | `"Esta tienda aún no tiene productos."` | empty state | |
| 374 | `` `Ningún producto coincide con "${query}".` `` | empty state | |
| 381 | `"Producto"` | table header | |
| 382 | `"Score"` | table header | ya EN |
| 383 | `"Issues"` | table header | ya EN |
| 384 | `"Acción"` | table header | |
| 418 | `"Desbloquear"` | button | |
| 425 | `"Ver detalle"` | button | aparece 2 veces (products + issues) |
| 441 | `"Anterior"` | pagination | |
| 444–445 | `` `Página ${n} de ${total} · ${count} producto(s)` `` | pagination text | |
| 452 | `"Siguiente"` | pagination | |
| 464 | `"Arreglar alt texts en lote"` | modal heading | |
| 468–472 | `"Vamos a procesar ${n} producto(s) y agregar alt text a sus imágenes faltantes."` | paragraph | |
| 474 | `"Aplicando alt texts"` | JobProgress label | |
| 479 | `"Generando ejemplos…"` | spinner text | |
| 484 | `"Ejemplos del patrón:"` | text | |
| 496 | `"Cerrar (sigue en background)"` | button | |
| 496 | `"Cancelar"` | button | |
| 507 | `"En curso…"` | button label | |
| 508 | `` `Aplicar a ${n} producto${pl}` `` | button | |
| 516 | `"Mejora a Pro para desbloquear más productos"` | modal heading | |
| 518–522 | `"El plan Free analiza los primeros ${planLimit} productos de tu tienda. Con el plan Pro analizamos todos sin límite y desbloqueas el bulk fix de alt texts."` | paragraph | |
| 529 | `"Mejorar a Pro · $9/mes (7 días gratis)"` | CTA | dup |
| 536 | `"Cerrar"` | button | |
| 545 | `"Bloqueado"` | badge | |
| 554 | `"Sin issues"` | text | |
| 558 | `` `${n} crítico(s)` `` | issue summary | |
| 559 | `` `${n} medio(s)` `` | issue summary | |
| 560 | `` `${n} bajo(s)` `` | issue summary | |

---

### `app/routes/app.products_.$id.jsx`

| Línea | String original (ES) | Tipo | Notas |
|-------|----------------------|------|-------|
| 31 | `"Producto no encontrado"` | throw Response | aparece en ErrorBoundary |
| 55 | `"Esta acción es solo para plan Pro"` | error JSON | |
| 63 | `"Producto no encontrado"` | throw Response | dup |
| 127 | `"No había alt texts para agregar"` | toast | dup |
| 128 | `` `Listo: ${n} alt text${pl} agregado${pl}` `` | toast | |
| 131 | `` `Error: ${error}` `` | toast | |
| 138 | `"Productos"` | breadcrumb button | |
| 145 | `"Editar en Shopify"` | primary action | |
| 148 | `"Resumen SEO"` | section heading | |
| 163 | `"Sin issues"` | badge text | |
| 164 | `` `${n} issue${pl}` `` | badge text | |
| 172 | `"Issues a corregir"` | section heading | |
| 176 | `"Acciones rápidas"` | section heading | |
| 178 | `"Abrir en el admin"` | button | |
| 186 | `` `Generar alt texts faltantes (${n})` `` | button | |
| 187 | `` `Pro: arreglar ${n} alt text${pl}` `` | button | |
| 192–193 | `"Todas las imágenes ya tienen alt text."` | text | |
| 201 | `` `Vista previa: ${n} alt text${pl}` `` | modal heading | |
| 203–205 | `"Vamos a agregar alt text a las imágenes que no lo tienen. No sobreescribimos las que ya tienen alt."` | paragraph | |
| 233 | `` `Aplicar ${n} cambio${pl}` `` | button | |
| 242 | `"Cancelar"` | button | |
| 250 | `"Mejora a Pro para arreglar alt texts"` | modal heading | |
| 252–255 | `"El bulk fix de alt texts es exclusivo del plan Pro. Activalo y generamos alt text descriptivo para todas tus imágenes en un click."` | paragraph | |
| 262 | `"Mejorar a Pro · $9/mes (7 días gratis)"` | CTA | dup |
| 269 | `"Cerrar"` | button | |
| 274 | `"Datos actuales"` | section heading | |
| 277 | `"Meta title"` | label | técnico SEO, mantener |
| 281 | `"Vacío"` | empty value | aparece 2 veces |
| 285 | `"Meta description"` | label | mantener |
| 292 | `"Vacío"` | empty value | |
| 296 | `"Imágenes"` | label | |
| 299 | `"con alt text"` | text fragment | |
| 310 | `"Producto no encontrado"` | ErrorBoundary heading | |
| 313 | `"Productos"` | breadcrumb | |
| 315 | `"No pudimos cargar este producto"` | banner heading | |
| 316–319 | `"Es posible que haya sido eliminado o que no tengas permiso para verlo. Vuelve al listado e intenta con otro."` | paragraph | |

---

### `app/routes/app.issues.jsx`

| Línea | String original (ES) | Tipo | Notas |
|-------|----------------------|------|-------|
| 27 | `IMPACT_LABEL = { high: "Crítico", medium: "Medio", low: "Bajo" }` | badge labels | objeto, 3 strings |
| 137 | `"Esta acción es solo para plan Pro"` | error JSON | dup |
| 144 | `"Cache no disponible. Recargá la página."` | error JSON | dup |
| 208 | `"No había alt texts para agregar"` | toast | dup |
| 210 | `"Productos ya tenían alt — listado actualizado"` | toast | dup |
| 213 | toast resumen complejo | toast | dup pattern |
| 228 | `` `Error: ${error}` `` | toast | |
| 235 | `"Issues"` | page heading | EN |
| 238 | `"Dashboard"` | breadcrumb | EN |
| 241 | `"Analizando tu tienda"` | section heading | dup |
| 242 | `"Analizando productos"` | JobProgress | dup |
| 264 | `"Actualizando datos"` | banner heading | dup |
| 265–267 | `"Mostramos el último análisis…"` | paragraph | dup |
| 269 | `"Re-analizando"` | JobProgress | dup |
| 275 | `"Sin issues detectados"` | banner heading | empty state OK |
| 277 | `"Tu catálogo cumple los criterios SEO. Buen trabajo."` | paragraph | |
| 280 | `"Volver al dashboard"` | button | |
| 296–298 | `` `${n} producto(s) · ${m} issue(s)` `` | text | |
| 305 | `"Producto"` | table header | dup |
| 306 | `"Acción"` | table header | dup |
| 332 | `"Ver detalle"` | button | dup |
| 346 | `"Ver menos"` | toggle button | |
| 347 | `` `Ver ${n} más` `` | toggle button | |
| 363 | `` `Arreglar todos (${n})` `` | bulk button | |
| 364 | `` `Pro: arreglar todos (${n})` `` | bulk button | |
| 373 | `"Arreglar alt texts en lote"` | modal heading | dup |
| 376–380 | preview paragraph | paragraph | dup |
| 382 | `"Aplicando alt texts"` | JobProgress | dup |
| 387 | `"Generando ejemplos…"` | spinner | dup |
| 392 | `"Ejemplos del patrón:"` | text | dup |
| 404 | `"Cerrar (sigue en background)"` / `"Cancelar"` | buttons | dup |
| 415 | `"En curso…"` | button label | dup |
| 416 | `` `Aplicar a ${n} producto${pl}` `` | button | dup |
| 423 | `"Mejora a Pro para usar bulk fix"` | modal heading | |
| 424–427 | `"El bulk fix de alt texts es exclusivo del plan Pro. Activalo y generamos alt text descriptivo para todas las imágenes en un click."` | paragraph | dup con variación |
| 434 | `"Mejorar a Pro · $9/mes (7 días gratis)"` | CTA | dup |
| 441 | `"Cerrar"` | button | dup |

---

### `app/routes/app.upgrade.jsx`

| Línea | String original (ES) | Tipo | Notas |
|-------|----------------------|------|-------|
| 58 | `"Redirigiendo a Shopify"` | page heading | |
| 61 | `"Te estamos llevando a la pasarela de pagos…"` | heading | |
| 63–66 | `"Vas a aprobar el cobro en la página oficial de Shopify. Si no te redirige en unos segundos, "` + `"haz click acá"` | paragraph + link text | |

---

### `app/routes/api.export[.]csv.jsx`

| Línea | String original (ES) | Tipo | Notas |
|-------|----------------------|------|-------|
| 24 | `"Cache no disponible. Recargá la app."` | response body 404 | si el merchant abre el endpoint directo lo verá; raro pero posible |

> El BOM `﻿` (línea 33) NO es una string user-facing — es un byte de marker UTF-8 para Excel. No tocar.

---

### `app/components/IssuesList.jsx`

| Línea | String original (ES) | Tipo | Notas |
|-------|----------------------|------|-------|
| 14–17 | `IMPACT_LABEL = { high: "Crítico", medium: "Medio", low: "Bajo" }` | badge labels | dup objeto vs app.issues.jsx |
| 24 | `"Sin issues detectados"` | banner heading | dup |
| 25 | `"Excelente trabajo — este contenido cumple con los criterios SEO."` | paragraph | empty state |
| 58 | `"Arreglar en Shopify →"` | link text | flecha unicode debe preservarse |

---

### `app/components/JobProgress.jsx`

| Línea | String original (ES) | Tipo | Notas |
|-------|----------------------|------|-------|
| 71 (default) | `label = "Procesando"` | default arg | aparece si caller no pasa label |
| 79 | `"El proceso falló"` | banner heading | |
| 81 | `"Ocurrió un error inesperado. Intenta de nuevo."` | paragraph | fallback errorMessage |
| 93 | `` ` · ${processed} procesados` `` | progress text | "procesados" → "processed" |

---

### `app/components/BulkFixSummaryBanner.jsx`

| Línea | String original (ES) | Tipo | Notas |
|-------|----------------------|------|-------|
| 25 | `"Sin cambios"` | banner heading | |
| 26 | `"No había alt texts para agregar."` | paragraph | con punto final |
| 28 | `"Entendido"` | button | aparece 3 veces |
| 36 | `"Listado actualizado"` | banner heading | |
| 38–42 | `` `Esos ${n} producto${pl} ya tenía${pl} alt text en todas sus imágenes (probablemente imágenes compartidas con productos arreglados en este mismo job). Sincronizamos el listado.` `` | paragraph | plural inline complejo |
| 55 | `` `Listo con ${n} error${pl}` `` | banner heading | |
| 57 | `"Bulk fix completado"` | banner heading | |
| 60–62 | `` `${ok} producto${pl} actualizado${pl} · ${img} alt text${pl} agregado${pl}.` `` | paragraph | |
| 67 | `"Productos con error:"` | text | |
| 74–75 | `` `… y ${n} error${pl} más` `` | text | |

---

### `app/components/RouteSkeleton.jsx`

| Línea | String original (ES) | Tipo | Notas |
|-------|----------------------|------|-------|
| 25 | `"SEO Analyzer"` | page heading skeleton | ya está bien, es el nombre de la app |
| 26 | `"Score general de tu tienda"` | section heading | dup con _index |
| 36 | `"Issues encontrados"` | section heading | dup |
| 49 | `"Productos"` | page heading | dup |
| 67 | `"Issues"` | page heading | EN |
| 83 | `"Producto"` | page heading | dup |
| 84 | `"Resumen SEO"` | section heading | dup |
| 93 | `"Issues a corregir"` | section heading | dup |

---

### `app/services/seo-analyzer.js`

> **CRÍTICO** — estos son los mensajes que el merchant lee en `IssuesList`. UX writing aquí decide si la app suena profesional.

| Línea | String original (ES) | Tipo | Notas |
|-------|----------------------|------|-------|
| 47 | `` `Meta title tiene ${seoTitle.length} caracteres (ideal ${MIN}–${MAX}).` `` | issue.message | medium impact |
| 48 | `` `Ajusta el título SEO entre ${MIN} y ${MAX} caracteres para que Google no lo recorte.` `` | issue.fix | |
| 55 | `"Falta el meta title."` | issue.message | high impact |
| 56 | `` `Agrega un título SEO de ${MIN}–${MAX} caracteres.` `` | issue.fix | |
| 71 | `` `Meta description tiene ${len} caracteres (ideal ${MIN}–${MAX}).` `` | issue.message | medium |
| 72 | `` `Reescribe la meta description entre ${MIN} y ${MAX} caracteres.` `` | issue.fix | |
| 79 | `"Falta la meta description."` | issue.message | high |
| 80 | `` `Agrega una meta description de ${MIN}–${MAX} caracteres.` `` | issue.fix | |
| 96 | `` `${missing} de ${total} imágenes sin alt text.` `` | issue.message | medium |
| 97 | `"Agrega alt text descriptivo a cada imagen — clave para SEO de imágenes y accesibilidad."` | issue.fix | |
| 112 | `"El producto no tiene descripción."` | issue.message | high |
| 113 | `` `Descripción muy corta (${len} caracteres).` `` | issue.message | medium |
| 114 | `` `Escribe al menos ${MIN} caracteres de descripción real (sin contar HTML).` `` | issue.fix | |
| 127 | `` `El handle "${handle}" no es óptimo para SEO.` `` | issue.message | low |
| 128 | `"Usa solo minúsculas, números y guiones; evita IDs o timestamps en la URL."` | issue.fix | |

---

### `app/services/issue-labels.js`

| Línea | String original (ES) | Tipo | Notas |
|-------|----------------------|------|-------|
| 5 | `"Meta title"` | label | ya EN — mantener |
| 6 | `"Meta description"` | label | ya EN — mantener |
| 7 | `"Alt text en imágenes"` | label | |
| 8 | `"Descripción del producto"` | label | |
| 9 | `"URL / handle"` | label | parcialmente EN |

---

### `app/services/alt-text-generator.js`

| Línea | String original (ES) | Tipo | Notas |
|-------|----------------------|------|-------|
| 55 | `` `${title} - vista ${orphanCount}` `` | alt text generado | **Este texto se escribe en la tienda del merchant.** Debe pasar a EN porque la app target US/UK/AU/CA. "vista" → "view". |

> Nota: `"Default Title"` (línea 16) NO es user-facing — es un valor canónico de Shopify (constante del modelo), no se traduce.

---

### `app/services/seo-job.js`

| Línea | String original (ES) | Tipo | Notas |
|-------|----------------------|------|-------|
| 86 | `"Job sin heartbeat — proceso interrumpido"` | errorMessage en DB | termina renderizado por `JobProgress` cuando el job está failed (línea 81 de JobProgress.jsx — `job.errorMessage`) |

> `"unknown error"` línea 70 ya está en EN, no tocar.

---

## Strings ambiguas / requieren decisión del usuario

### 🟡 1. `_index/route.jsx` (landing pre-instalación)

El archivo es la página pública que se muestra al abrir el endpoint raíz fuera del admin. Texto actual (placeholder del scaffold):

```
"A short heading about [your app]"
"A tagline about [your app]..."
"Shop domain", "Log in", "e.g: my-shop-domain.myshopify.com"
"Product feature. Some detail..." (x3)
```

Ya está en inglés pero es placeholder boilerplate. **Decisión:** ¿(a) lo dejamos como está y lo migramos luego en una tarea de marketing? ¿(b) lo reemplazamos por copy real ahora con info de la app? Recomiendo **(a)** — no es scope de esta migración.

### 🟡 2. `shopify.app.toml` — `name = "seo-app"`

El campo `name` aparece en el listado del App Store. Es el nombre técnico actual de la app. Según CLAUDE.md el listing va a usar **"SEO Analyzer"** como nombre comercial. **Decisión:** ¿cambiar `name` a `"SEO Analyzer"` ahora, o lo manejas tú al configurar el listing? Recomiendo **dejarlo fuera de esta migración** — es config de deployment, no string user-facing dentro de la app.

### 🟡 3. Errores JSON de actions (`"Esta acción es solo para plan Pro"`, `"Cache no disponible..."`)

Estos vienen de actions y se serializan a JSON. Luego el cliente los muestra como toast (`Error: <message>`). Llegan al usuario, sí — pero solo en error states muy raros. Confirmo que se traducen. Lo marco solo por transparencia.

### 🟡 4. Mensaje de error genérico de Shopify userErrors

`updateProductAltTexts` propaga `result.userErrors[].message` (línea 73 de `app.products_.$id.jsx`, línea 244 de `shopify-api.js`). Esos mensajes vienen **de la Admin API de Shopify**, ya están en inglés. No los tocamos.

### 🟡 5. Tono — "tuteo argentino" vs neutro

El código usa formas voseo/tuteo argentino: "podés", "andá", "probá", "recargá", "activalo". El inglés neutro estándar resuelve esto trivialmente: imperativo plano. Lo marco solo para confirmar que en EN no hay equivalente a la decisión de "tuteo vs usted".

### 🟡 6. Plural inline vs intl

Hoy el código maneja plural inline con ternarios: `producto${n === 1 ? "" : "s"}`. En EN funciona igual (`product${n === 1 ? "" : "s"}`). **No introduzco `Intl.PluralRules` ni i18n framework** — el plan dice no instalar dependencias. Marco esto como **deuda técnica** documentada en el Plan, pero no la resuelvo hoy.

### 🟡 7. Flecha unicode en `"Arreglar en Shopify →"`

`IssuesList.jsx:58`. En EN sería `"Fix in Shopify →"`. Pregunta: ¿mantenemos la flecha unicode? Shopify Polaris admin es bastante neutro al respecto. Recomiendo **mantenerla** — es visual, no es texto.

---

## Siguiente paso

Esperando tu **"approved"** sobre este audit para pasar a **Fase 2 — Plan de migración** (glosario + tabla string-by-string con traducciones propuestas + principios + decisiones).

Si querés que cambie algo en el audit (ej. agregar/excluir archivos, formato distinto, etc.), decímelo antes.
