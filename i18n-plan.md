# i18n Plan — Migración ES → EN

> Fase 2 del plan de migración. Glosario, tabla string-by-string con copy propuesto, principios aplicados y decisiones abiertas finales.
> Base: `i18n-audit.md`. Generado: 2026-05-19.
> Excluidos del scope (decisión del usuario): `app/routes/_index/route.jsx`, `shopify.app.toml`.

---

## 2.1. Glosario maestro

Todo el copy debe respetar estas traducciones canónicas. Si una string usa un sinónimo distinto sin justificación, está mal.

| ES | EN canónico | Notas |
|----|-------------|-------|
| Producto | Product | singular |
| Productos | Products | plural |
| Tienda | Store | nunca "shop" en UI consumer |
| Mi/Tu tienda | Your store | solo si el sustantivo no es CTA corto |
| Score SEO | SEO score | minúsculas en "score" |
| Score general | Overall score | |
| Análisis | Analysis | sustantivo |
| Analizar | Analyze | verbo |
| Analizando | Analyzing | gerundio |
| Re-analizar | Re-analyze | con guión |
| Issue | Issue | mantener anglicismo (es estándar Shopify) |
| Issues encontrados | Issues found | |
| Issues a corregir | Issues to fix | |
| Arreglar | Fix | verbo CTA |
| Bulk fix | Bulk fix | técnico |
| Mejorar a Pro | Upgrade to Pro | nunca "Improve to Pro" |
| Plan Pro | Pro plan | minúscula en "plan" |
| Plan Free / gratuito | Free plan | |
| Exportar CSV | Export CSV | |
| Meta title | Meta title | técnico SEO |
| Meta description | Meta description | técnico SEO |
| Alt text | Alt text | (no "alternative text") |
| Imágenes | Images | |
| Descripción del producto | Product description | |
| Handle / URL amigable | URL handle | aclara que es la slug |
| Recomendaciones | Recommendations | |
| Severidad alta/media/baja | High/Medium/Low | en badges sin la palabra "severity" — más limpio |
| 7 días de prueba/gratis | 7-day free trial | nunca "7 days trial" |
| Crítico (impact) | Critical | badge alto |
| Medio (impact) | Medium | badge medio |
| Bajo (impact) | Low | badge bajo |
| Bueno / Regular / Crítico (score state) | Good / Fair / Critical | tres tonos del score badge |
| Cancelar | Cancel | |
| Cerrar | Close | |
| Entendido | Got it | confirmación neutra Shopify-style |
| Aplicar | Apply | |
| Anterior / Siguiente | Previous / Next | paginación |
| Ver detalle | View details | |
| Ver menos / Ver N más | Show less / Show N more | sentence case |
| Reintentar | Retry | |
| Vacío | Empty | data display |
| Sin issues | No issues | |
| Bloqueado | Locked | en plan Free |
| Desbloquear | Unlock | CTA inversa |
| Buscar producto | Search products | imperativo neutro |
| Página X de Y | Page X of Y | |
| hace X min/h/d | X min/h/d ago | en-dash en rangos, "ago" sufijo |
| hace unos segundos | Just now | idioma natural |
| Editar en Shopify | Edit in Shopify | |
| Abrir en el admin | Open in admin | |
| Dashboard | Dashboard | EN actual, mantener |
| Issues (nav) | Issues | mantener |

---

## 2.2. Tabla de traducción string-by-string

> Las tablas siguen el orden del audit. Cada fila incluye una justificación corta cuando la elección de copy no es obvia.
> Strings idénticas que aparecen en múltiples lugares (ej. `"Mejorar a Pro · $9/mes (7 días gratis)"`, `"Cerrar"`, `"Cancelar"`) se traducen igual en todos los lugares — no hay variantes.

### `app/routes/app.jsx`

| Archivo:Línea | ES | EN propuesto | Justificación |
|---------------|----|--------------|---------------|
| app.jsx:52 | `"Productos"` | `"Products"` | nav link, sentence case |
| app.jsx:72 | `"Reinstalación requerida"` | `"Reinstall required"` | concise heading |
| app.jsx:74 | `"Sesión inválida"` | `"Session expired"` | "Session expired" más claro que "Invalid session" para merchants no técnicos |
| app.jsx:76–77 | `"Los permisos de la app cambiaron. Necesitamos que reinstales la app para seguir."` | `"This app's permissions changed. Reinstall to continue."` | activa, conciso |
| app.jsx:80–82 | `"Andá al admin de tu tienda → Settings → Apps → desinstalá esta app y volvé a abrirla desde el listado para aceptar los permisos nuevos."` | `"In your store admin, go to Settings → Apps, uninstall this app, then open it again from the listing to accept the new permissions."` | imperativo neutro, conserva las flechas de navegación |

### `app/routes/app._index.jsx`

| Archivo:Línea | ES | EN propuesto | Justificación |
|---------------|----|--------------|---------------|
| app._index.jsx:99 | `"hace unos segundos"` | `"Just now"` | inglés idiomático para tiempo relativo reciente |
| app._index.jsx:100 | `` `hace ${min} min` `` | `` `${min} min ago` `` | sufijo `ago` natural |
| app._index.jsx:102 | `` `hace ${hours} h` `` | `` `${hours} h ago` `` | |
| app._index.jsx:104 | `` `hace ${days} d` `` | `` `${days} d ago` `` | |
| app._index.jsx:163 | `"El último análisis falló"` | `"Last analysis failed"` | conciso, factual |
| app._index.jsx:165–166 | `"Hubo un error inesperado. Probá de nuevo."` | `"An unexpected error occurred. Try again."` | activa, sin pasiva en EN |
| app._index.jsx:170 | `"Reintentar análisis"` | `"Retry analysis"` | imperativo CTA |
| app._index.jsx:175 | `"Analizando tu tienda"` | `"Analyzing your store"` | gerundio = state |
| app._index.jsx:177–180 | `"Estamos analizando todos tus productos por primera vez. Esto puede tomar unos minutos para tiendas grandes — podés cerrar esta pestaña, el análisis sigue en background."` | `"We're analyzing all your products for the first time. This can take a few minutes for large stores — you can close this tab and the analysis will keep running in the background."` | mantiene tono explicativo cálido + factual |
| app._index.jsx:182 | `"Analizando productos"` | `"Analyzing products"` | label corto del progress |
| app._index.jsx:192 | `"El último análisis falló"` | `"Last analysis failed"` | dup |
| app._index.jsx:194–196 | `"Estamos mostrando datos del análisis anterior."` + `"Hubo un error inesperado al refrescar."` | `"Showing data from the previous analysis."` + `"An unexpected error occurred while refreshing."` | factual + accionable |
| app._index.jsx:200 | `"Reintentar"` | `"Retry"` | |
| app._index.jsx:206 | `"Actualizando datos"` | `"Refreshing data"` | "Refreshing" es el verbo Shopify-estándar |
| app._index.jsx:207–209 | `"Mostramos el último análisis disponible mientras refrescamos en background."` | `"Showing the latest available analysis while we refresh in the background."` | |
| app._index.jsx:211 | `"Re-analizando"` | `"Re-analyzing"` | |
| app._index.jsx:217 | `` `Plan Free · análisis limitado a ${planLimit} productos` `` | `` `Free plan · analysis limited to ${planLimit} products` `` | |
| app._index.jsx:219–222 | `"Mejora a Pro para analizar todos tus productos y desbloquear el bulk fix de alt texts."` | `"Upgrade to Pro to analyze all your products and unlock bulk alt text fixes."` | "Upgrade" estándar Shopify, evita "alt texts" plural fea |
| app._index.jsx:229 | `"Mejorar a Pro · $9/mes (7 días gratis)"` | `"Upgrade to Pro · $9/month (7-day free trial)"` | full month, 7-day adjetivo compuesto |
| app._index.jsx:234 | `"Score general de tu tienda"` | `"Overall store score"` | "Overall" = el general; evita posesivo en heading |
| app._index.jsx:239 | `"Bueno"` / `"Regular"` / `"Crítico"` | `"Good"` / `"Fair"` / `"Critical"` | "Fair" es el equivalente neutro en EN para "regular" en un rating |
| app._index.jsx:242–247 | `` `Promedio sobre ${n} producto${pl} analizado${pl}${n >= limit ? ` (límite del plan free: ${limit}).` : "."}` `` | `` `Average across ${n} analyzed product${pl}${n >= limit ? ` (free plan limit: ${limit}).` : "."}` `` | "Average across X products" es la frase natural en EN |
| app._index.jsx:251 | `` `Último análisis ${rel}` `` | `` `Last analyzed ${rel}` `` | shorter |
| app._index.jsx:255 | `"Ver todos los productos"` | `"View all products"` | |
| app._index.jsx:259 | `"Re-analizar ahora"` | `"Re-analyze now"` | |
| app._index.jsx:264 | `"Exportar CSV"` | `"Export CSV"` | |
| app._index.jsx:272 | `"Pro: exportar CSV"` | `"Pro: export CSV"` | mantiene prefix `Pro:` como visual marker |
| app._index.jsx:279 | `"Issues encontrados"` | `"Issues found"` | |
| app._index.jsx:283 | `"Críticos"` | `"Critical"` | en EN no pluralizamos badges de severity en contadores; usamos forma neutra |
| app._index.jsx:284 | `"Medios"` | `"Medium"` | |
| app._index.jsx:285 | `"Bajos"` | `"Low"` | |
| app._index.jsx:301 | `"Ver issues agrupados por tipo"` | `"View issues grouped by type"` | |
| app._index.jsx:306 | `"Productos con peor SEO"` | `"Lowest-scoring products"` | "Lowest-scoring" más directo que "Worst SEO products"; "worst" tiene tono negativo |
| app._index.jsx:321–322 | `` `${n} issue${pl} · ${msg}` `` | `` `${n} issue${pl} · ${msg}` `` | plural en EN: "issue"/"issues" |
| app._index.jsx:334 | `"Sin productos"` | `"No products"` | empty state |
| app._index.jsx:335–337 | `"Esta tienda aún no tiene productos. Crea algunos en el admin de Shopify y vuelve para ver el análisis."` | `"This store doesn't have any products yet. Create some in your Shopify admin, then come back to see the analysis."` | accionable, voz activa |

### `app/routes/app.products.jsx`

| Archivo:Línea | ES | EN propuesto | Justificación |
|---------------|----|--------------|---------------|
| app.products.jsx:90 | `"Esta acción es solo para plan Pro"` | `"This action is only available on the Pro plan"` | natural EN |
| app.products.jsx:98 | `"Cache no disponible. Recargá la página."` | `"Cache unavailable. Reload the page."` | imperativo neutro |
| app.products.jsx:110–113 | `"Peor score primero"`, `"Mejor score primero"`, `"Nombre A-Z"`, `"Nombre Z-A"` | `"Lowest score first"`, `"Highest score first"`, `"Name A–Z"`, `"Name Z–A"` | en-dash en rangos |
| app.products.jsx:172 | `"No había alt texts para agregar"` | `"No alt texts to add"` | factual + corto |
| app.products.jsx:174 | `"Productos ya tenían alt — listado actualizado"` | `"Products already had alt text — list updated"` | en EN "alt text" se trata como masa, no plural típico |
| app.products.jsx:177 | toast resumen `Listo: …` | `` `Done: ${ok} product${pl} · ${img} alt text${pl} added${err ? ` · ${err} error${pl}` : ""}` `` | "Done:" es estándar en confirmaciones de bulk ops Shopify |
| app.products.jsx:192 | `` `Error: ${err}` `` | `` `Error: ${err}` `` | prefix idéntico — universal |
| app.products.jsx:263, 275 | `"Productos"` (page heading) | `"Products"` | |
| app.products.jsx:267 | `"Analizando tu tienda"` | `"Analyzing your store"` | dup |
| app.products.jsx:268 | `"Analizando productos"` | `"Analyzing products"` | dup |
| app.products.jsx:290 | `"Actualizando datos"` | `"Refreshing data"` | dup |
| app.products.jsx:291–293 | `"Mostramos el último…"` | `"Showing the latest available analysis while we refresh in the background."` | dup |
| app.products.jsx:295 | `"Re-analizando"` | `"Re-analyzing"` | dup |
| app.products.jsx:300 | `"Estás en el plan Free"` | `"You're on the Free plan"` | natural EN |
| app.products.jsx:301–305 | `"Analizamos los primeros ${planLimit} productos. Tienes ${lockedCount} producto${pl} más esperando análisis. Mejora a Pro para desbloquear todos."` | `"We analyzed the first ${planLimit} products. You have ${lockedCount} more product${pl} waiting. Upgrade to Pro to unlock them all."` | concise + accionable |
| app.products.jsx:313 | `"Buscar producto"` | `"Search products"` | plural en EN para search fields (más natural) |
| app.products.jsx:314 | `"Nombre o handle…"` | `"Name or handle…"` | |
| app.products.jsx:363 | `` `Arreglar alt texts (${n})` `` | `` `Fix alt texts (${n})` `` | |
| app.products.jsx:364 | `` `Pro: arreglar alt texts (${n})` `` | `` `Pro: fix alt texts (${n})` `` | |
| app.products.jsx:373 | `"Esta tienda aún no tiene productos."` | `"This store doesn't have any products yet."` | dup |
| app.products.jsx:374 | `` `Ningún producto coincide con "${query}".` `` | `` `No products match "${query}".` `` | |
| app.products.jsx:381–384 | `"Producto"`, `"Score"`, `"Issues"`, `"Acción"` | `"Product"`, `"Score"`, `"Issues"`, `"Action"` | table headers, sentence case |
| app.products.jsx:418 | `"Desbloquear"` | `"Unlock"` | CTA |
| app.products.jsx:425 | `"Ver detalle"` | `"View details"` | plural natural en EN |
| app.products.jsx:441 | `"Anterior"` | `"Previous"` | |
| app.products.jsx:444–445 | `` `Página ${cur} de ${total} · ${count} producto${pl}` `` | `` `Page ${cur} of ${total} · ${count} product${pl}` `` | |
| app.products.jsx:452 | `"Siguiente"` | `"Next"` | |
| app.products.jsx:464 | `"Arreglar alt texts en lote"` | `"Fix alt texts in bulk"` | "in bulk" es el modismo natural |
| app.products.jsx:468–472 | `"Vamos a procesar ${n} producto${pl} y agregar alt text a sus imágenes faltantes."` | `"We'll process ${n} product${pl} and add alt text to images that don't have it."` | |
| app.products.jsx:474 | `"Aplicando alt texts"` | `"Applying alt texts"` | |
| app.products.jsx:479 | `"Generando ejemplos…"` | `"Generating samples…"` | "samples" mejor que "examples" para previews |
| app.products.jsx:484 | `"Ejemplos del patrón:"` | `"Pattern samples:"` | |
| app.products.jsx:496 | `"Cerrar (sigue en background)"` / `"Cancelar"` | `"Close (keeps running)"` / `"Cancel"` | "(keeps running)" más natural que "still in background" |
| app.products.jsx:507 | `"En curso…"` | `"Running…"` | |
| app.products.jsx:508 | `` `Aplicar a ${n} producto${pl}` `` | `` `Apply to ${n} product${pl}` `` | |
| app.products.jsx:516 | `"Mejora a Pro para desbloquear más productos"` | `"Upgrade to Pro to unlock more products"` | |
| app.products.jsx:518–522 | `"El plan Free analiza los primeros ${planLimit} productos…"` | `"The Free plan analyzes the first ${planLimit} products in your store. With the Pro plan, we analyze all of them with no limit and you unlock bulk alt text fixes."` | activa + paralela |
| app.products.jsx:529 | `"Mejorar a Pro · $9/mes (7 días gratis)"` | `"Upgrade to Pro · $9/month (7-day free trial)"` | dup canónica |
| app.products.jsx:536 | `"Cerrar"` | `"Close"` | |
| app.products.jsx:545 | `"Bloqueado"` | `"Locked"` | badge |
| app.products.jsx:554 | `"Sin issues"` | `"No issues"` | |
| app.products.jsx:558 | `` `${n} crítico${pl}` `` | `` `${n} critical` `` | en EN no pluralizamos "critical" como sustantivo en este contexto; usamos forma fija — más limpio que "criticals" |
| app.products.jsx:559 | `` `${n} medio${pl}` `` | `` `${n} medium` `` | igual: forma fija |
| app.products.jsx:560 | `` `${n} bajo${pl}` `` | `` `${n} low` `` | igual |

> **Nota sobre pluralización de severidades**: en ES "1 crítico / 2 críticos" es natural. En EN, "1 critical / 2 criticals" suena raro (criticals no es palabra estándar). La forma idiomática es `"1 critical"` / `"2 critical"` (count + adjective). Aplico esto a critical/medium/low en este contexto de summary y simplifico el ternario eliminando el plural. **Esto implica una mini-simplificación de código**, no pura traducción — la marco aquí para tu aprobación explícita.

### `app/routes/app.products_.$id.jsx`

| Archivo:Línea | ES | EN propuesto | Justificación |
|---------------|----|--------------|---------------|
| app.products_.$id.jsx:31 | `"Producto no encontrado"` | `"Product not found"` | |
| app.products_.$id.jsx:55 | `"Esta acción es solo para plan Pro"` | `"This action is only available on the Pro plan"` | dup |
| app.products_.$id.jsx:63 | `"Producto no encontrado"` | `"Product not found"` | dup |
| app.products_.$id.jsx:127 | `"No había alt texts para agregar"` | `"No alt texts to add"` | dup |
| app.products_.$id.jsx:128 | `` `Listo: ${n} alt text${pl} agregado${pl}` `` | `` `Done: ${n} alt text${pl} added` `` | en EN "added" no pluraliza con el sustantivo |
| app.products_.$id.jsx:131 | `` `Error: ${err}` `` | `` `Error: ${err}` `` | dup |
| app.products_.$id.jsx:138 | `"Productos"` (breadcrumb) | `"Products"` | |
| app.products_.$id.jsx:145 | `"Editar en Shopify"` | `"Edit in Shopify"` | |
| app.products_.$id.jsx:148 | `"Resumen SEO"` | `"SEO summary"` | sentence case |
| app.products_.$id.jsx:163 | `"Sin issues"` | `"No issues"` | dup |
| app.products_.$id.jsx:164 | `` `${n} issue${pl}` `` | `` `${n} issue${pl}` `` | plural natural EN |
| app.products_.$id.jsx:172 | `"Issues a corregir"` | `"Issues to fix"` | |
| app.products_.$id.jsx:176 | `"Acciones rápidas"` | `"Quick actions"` | sentence case |
| app.products_.$id.jsx:178 | `"Abrir en el admin"` | `"Open in admin"` | |
| app.products_.$id.jsx:186 | `` `Generar alt texts faltantes (${n})` `` | `` `Generate missing alt texts (${n})` `` | |
| app.products_.$id.jsx:187 | `` `Pro: arreglar ${n} alt text${pl}` `` | `` `Pro: fix ${n} alt text${pl}` `` | |
| app.products_.$id.jsx:192–193 | `"Todas las imágenes ya tienen alt text."` | `"All images already have alt text."` | |
| app.products_.$id.jsx:201 | `` `Vista previa: ${n} alt text${pl}` `` | `` `Preview: ${n} alt text${pl}` `` | "Preview" estándar |
| app.products_.$id.jsx:203–205 | `"Vamos a agregar alt text a las imágenes que no lo tienen. No sobreescribimos las que ya tienen alt."` | `"We'll add alt text to images that don't have it. Images with existing alt text won't be changed."` | accionable + reassuring |
| app.products_.$id.jsx:233 | `` `Aplicar ${n} cambio${pl}` `` | `` `Apply ${n} change${pl}` `` | |
| app.products_.$id.jsx:242 | `"Cancelar"` | `"Cancel"` | |
| app.products_.$id.jsx:250 | `"Mejora a Pro para arreglar alt texts"` | `"Upgrade to Pro to fix alt texts"` | |
| app.products_.$id.jsx:252–255 | `"El bulk fix de alt texts es exclusivo del plan Pro. Activalo y generamos alt text descriptivo para todas tus imágenes en un click."` | `"Bulk alt text fixes are a Pro plan feature. Turn it on and we'll generate descriptive alt text for all your images in one click."` | "one click" mejor que "1 click" |
| app.products_.$id.jsx:262 | `"Mejorar a Pro · $9/mes (7 días gratis)"` | `"Upgrade to Pro · $9/month (7-day free trial)"` | dup |
| app.products_.$id.jsx:269 | `"Cerrar"` | `"Close"` | |
| app.products_.$id.jsx:274 | `"Datos actuales"` | `"Current data"` | |
| app.products_.$id.jsx:277, 285 | `"Meta title"`, `"Meta description"` | `"Meta title"`, `"Meta description"` | técnico, sin cambio |
| app.products_.$id.jsx:281, 292 | `"Vacío"` | `"Empty"` | |
| app.products_.$id.jsx:296 | `"Imágenes"` | `"Images"` | |
| app.products_.$id.jsx:299 | `` `${n} · ${m} con alt text` `` | `` `${n} · ${m} with alt text` `` | |
| app.products_.$id.jsx:310 | `"Producto no encontrado"` | `"Product not found"` | ErrorBoundary heading |
| app.products_.$id.jsx:313 | `"Productos"` (breadcrumb) | `"Products"` | dup |
| app.products_.$id.jsx:315 | `"No pudimos cargar este producto"` | `"We couldn't load this product"` | activa, conserva el tono cálido |
| app.products_.$id.jsx:316–319 | `"Es posible que haya sido eliminado o que no tengas permiso para verlo. Vuelve al listado e intenta con otro."` | `"It may have been deleted, or you may not have permission to view it. Go back to the list and try a different one."` | accionable, gentle |

### `app/routes/app.issues.jsx`

| Archivo:Línea | ES | EN propuesto | Justificación |
|---------------|----|--------------|---------------|
| app.issues.jsx:27 | `IMPACT_LABEL = { high: "Crítico", medium: "Medio", low: "Bajo" }` | `{ high: "Critical", medium: "Medium", low: "Low" }` | badges severity |
| app.issues.jsx:137 | `"Esta acción es solo para plan Pro"` | `"This action is only available on the Pro plan"` | dup |
| app.issues.jsx:144 | `"Cache no disponible. Recargá la página."` | `"Cache unavailable. Reload the page."` | dup |
| app.issues.jsx:208 | `"No había alt texts para agregar"` | `"No alt texts to add"` | dup |
| app.issues.jsx:210 | `"Productos ya tenían alt — listado actualizado"` | `"Products already had alt text — list updated"` | dup |
| app.issues.jsx:213 | toast resumen | dup mismo patrón que app.products.jsx:177 | |
| app.issues.jsx:228 | `` `Error: ${err}` `` | dup | |
| app.issues.jsx:241 | `"Analizando tu tienda"` | `"Analyzing your store"` | dup |
| app.issues.jsx:242, 269 | `"Analizando productos"`, `"Re-analizando"` | `"Analyzing products"`, `"Re-analyzing"` | dup |
| app.issues.jsx:264–267 | banner "Actualizando datos" | dup |
| app.issues.jsx:275 | `"Sin issues detectados"` | `"No issues found"` | |
| app.issues.jsx:277 | `"Tu catálogo cumple los criterios SEO. Buen trabajo."` | `"Your catalog meets the SEO criteria. Nice work."` | "Nice work" es más Shopify-friendly que "Good job" (no condescendiente) |
| app.issues.jsx:280 | `"Volver al dashboard"` | `"Back to dashboard"` | |
| app.issues.jsx:296–298 | `` `${m} producto${pl} · ${i} issue${pl}` `` | `` `${m} product${pl} · ${i} issue${pl}` `` | |
| app.issues.jsx:305, 306 | `"Producto"`, `"Acción"` | `"Product"`, `"Action"` | table headers |
| app.issues.jsx:332 | `"Ver detalle"` | `"View details"` | dup |
| app.issues.jsx:346 | `"Ver menos"` | `"Show less"` | |
| app.issues.jsx:347 | `` `Ver ${n} más` `` | `` `Show ${n} more` `` | |
| app.issues.jsx:363 | `` `Arreglar todos (${n})` `` | `` `Fix all (${n})` `` | |
| app.issues.jsx:364 | `` `Pro: arreglar todos (${n})` `` | `` `Pro: fix all (${n})` `` | |
| app.issues.jsx:373 | `"Arreglar alt texts en lote"` | `"Fix alt texts in bulk"` | dup |
| app.issues.jsx:376–380 | modal paragraph | dup texto bulk preview |
| app.issues.jsx:382 | `"Aplicando alt texts"` | `"Applying alt texts"` | dup |
| app.issues.jsx:387, 392 | `"Generando ejemplos…"`, `"Ejemplos del patrón:"` | `"Generating samples…"`, `"Pattern samples:"` | dup |
| app.issues.jsx:404 | `"Cerrar (sigue en background)"` / `"Cancelar"` | `"Close (keeps running)"` / `"Cancel"` | dup |
| app.issues.jsx:415 | `"En curso…"` | `"Running…"` | dup |
| app.issues.jsx:416 | `` `Aplicar a ${n} producto${pl}` `` | `` `Apply to ${n} product${pl}` `` | dup |
| app.issues.jsx:423 | `"Mejora a Pro para usar bulk fix"` | `"Upgrade to Pro to use bulk fix"` | |
| app.issues.jsx:424–427 | paragraph upgrade modal | `"Bulk alt text fixes are a Pro plan feature. Turn it on and we'll generate descriptive alt text for all images in one click."` | mantiene paralelismo con el otro upgrade modal |
| app.issues.jsx:434 | `"Mejorar a Pro · $9/mes (7 días gratis)"` | `"Upgrade to Pro · $9/month (7-day free trial)"` | dup |
| app.issues.jsx:441 | `"Cerrar"` | `"Close"` | dup |

### `app/routes/app.upgrade.jsx`

| Archivo:Línea | ES | EN propuesto | Justificación |
|---------------|----|--------------|---------------|
| app.upgrade.jsx:58 | `"Redirigiendo a Shopify"` | `"Redirecting to Shopify"` | factual |
| app.upgrade.jsx:61 | `"Te estamos llevando a la pasarela de pagos…"` | `"Taking you to the Shopify payment page…"` | natural EN, evita "payment gateway" que es jargon técnico |
| app.upgrade.jsx:63–66 | `"Vas a aprobar el cobro en la página oficial de Shopify. Si no te redirige en unos segundos, "` + `"haz click acá"` | `"You'll approve the charge on Shopify's official page. If you're not redirected in a few seconds, "` + `"click here"` | "click here" es aceptable en este caso específico (mid-sentence inline link), no es CTA aislado |

### `app/routes/api.export[.]csv.jsx`

| Archivo:Línea | ES | EN propuesto | Justificación |
|---------------|----|--------------|---------------|
| api.export[.]csv.jsx:24 | `"Cache no disponible. Recargá la app."` | `"Cache unavailable. Reload the app."` | dup pattern |

### `app/components/IssuesList.jsx`

| Archivo:Línea | ES | EN propuesto | Justificación |
|---------------|----|--------------|---------------|
| IssuesList.jsx:14–17 | `IMPACT_LABEL = { ... }` | `{ high: "Critical", medium: "Medium", low: "Low" }` | dup canónica |
| IssuesList.jsx:24 | `"Sin issues detectados"` | `"No issues found"` | dup |
| IssuesList.jsx:25 | `"Excelente trabajo — este contenido cumple con los criterios SEO."` | `"Nice work — this content meets the SEO criteria."` | "Nice work" consistente con app.issues.jsx empty state |
| IssuesList.jsx:58 | `"Arreglar en Shopify →"` | `"Fix in Shopify →"` | mantiene flecha unicode |

### `app/components/JobProgress.jsx`

| Archivo:Línea | ES | EN propuesto | Justificación |
|---------------|----|--------------|---------------|
| JobProgress.jsx:71 (default arg) | `"Procesando"` | `"Processing"` | gerundio default |
| JobProgress.jsx:79 | `"El proceso falló"` | `"The process failed"` | natural EN |
| JobProgress.jsx:81 | `"Ocurrió un error inesperado. Intenta de nuevo."` | `"An unexpected error occurred. Try again."` | dup-canónica con app._index error fallback |
| JobProgress.jsx:93 | `` ` · ${processed} procesados` `` | `` ` · ${processed} processed` `` | "processed" como participio |

### `app/components/BulkFixSummaryBanner.jsx`

| Archivo:Línea | ES | EN propuesto | Justificación |
|---------------|----|--------------|---------------|
| BulkFixSummaryBanner.jsx:25 | `"Sin cambios"` | `"No changes"` | |
| BulkFixSummaryBanner.jsx:26 | `"No había alt texts para agregar."` | `"No alt texts to add."` | dup con punto |
| BulkFixSummaryBanner.jsx:28, 43, 81 | `"Entendido"` | `"Got it"` | confirmación neutra; Shopify Polaris suele usar "Got it" para dismiss-confirmations |
| BulkFixSummaryBanner.jsx:36 | `"Listado actualizado"` | `"List updated"` | |
| BulkFixSummaryBanner.jsx:38–42 | `` `Esos ${n} producto${pl} ya tenía${pl} alt text en todas sus imágenes…` `` | `` `Those ${n} product${pl} already had alt text on all images (likely because they share images with products fixed in this same job). The list is now in sync.` `` | "in sync" es más natural que "synchronized" |
| BulkFixSummaryBanner.jsx:55 | `` `Listo con ${n} error${pl}` `` | `` `Completed with ${n} error${pl}` `` | "Completed" mejor que "Done" en este contexto compuesto |
| BulkFixSummaryBanner.jsx:57 | `"Bulk fix completado"` | `"Bulk fix completed"` | |
| BulkFixSummaryBanner.jsx:60–62 | `` `${ok} producto${pl} actualizado${pl} · ${img} alt text${pl} agregado${pl}.` `` | `` `${ok} product${pl} updated · ${img} alt text${pl} added.` `` | participio sin pluralización |
| BulkFixSummaryBanner.jsx:67 | `"Productos con error:"` | `"Products with errors:"` | plural natural en EN |
| BulkFixSummaryBanner.jsx:74–75 | `` `… y ${n} error${pl} más` `` | `` `…and ${n} more error${pl}` `` | "…and X more" estructura idiomática EN |

### `app/components/RouteSkeleton.jsx`

| Archivo:Línea | ES | EN propuesto | Justificación |
|---------------|----|--------------|---------------|
| RouteSkeleton.jsx:25 | `"SEO Analyzer"` | `"SEO Analyzer"` | nombre app, sin cambio |
| RouteSkeleton.jsx:26 | `"Score general de tu tienda"` | `"Overall store score"` | dup |
| RouteSkeleton.jsx:36 | `"Issues encontrados"` | `"Issues found"` | dup |
| RouteSkeleton.jsx:49 | `"Productos"` | `"Products"` | dup |
| RouteSkeleton.jsx:67 | `"Issues"` | `"Issues"` | no cambia |
| RouteSkeleton.jsx:83 | `"Producto"` | `"Product"` | |
| RouteSkeleton.jsx:84 | `"Resumen SEO"` | `"SEO summary"` | dup |
| RouteSkeleton.jsx:93 | `"Issues a corregir"` | `"Issues to fix"` | dup |

### `app/services/seo-analyzer.js`

> **CRÍTICO** — estos son los textos que el merchant lee en cada issue.

| Archivo:Línea | ES | EN propuesto | Justificación |
|---------------|----|--------------|---------------|
| seo-analyzer.js:47 | `` `Meta title tiene ${len} caracteres (ideal ${MIN}–${MAX}).` `` | `` `Meta title is ${len} characters (ideal: ${MIN}–${MAX}).` `` | factual, dos puntos antes del rango aclara que es una recomendación |
| seo-analyzer.js:48 | `` `Ajusta el título SEO entre ${MIN} y ${MAX} caracteres para que Google no lo recorte.` `` | `` `Keep the SEO title between ${MIN} and ${MAX} characters so Google doesn't truncate it.` `` | "Keep" es imperativo + sostenido; "truncate" es el verbo técnico estándar |
| seo-analyzer.js:55 | `"Falta el meta title."` | `"Meta title is missing."` | natural EN |
| seo-analyzer.js:56 | `` `Agrega un título SEO de ${MIN}–${MAX} caracteres.` `` | `` `Add an SEO title between ${MIN} and ${MAX} characters.` `` | imperativo |
| seo-analyzer.js:71 | `` `Meta description tiene ${len} caracteres (ideal ${MIN}–${MAX}).` `` | `` `Meta description is ${len} characters (ideal: ${MIN}–${MAX}).` `` | paralelo con line 47 |
| seo-analyzer.js:72 | `` `Reescribe la meta description entre ${MIN} y ${MAX} caracteres.` `` | `` `Rewrite the meta description between ${MIN} and ${MAX} characters.` `` | |
| seo-analyzer.js:79 | `"Falta la meta description."` | `"Meta description is missing."` | |
| seo-analyzer.js:80 | `` `Agrega una meta description de ${MIN}–${MAX} caracteres.` `` | `` `Add a meta description between ${MIN} and ${MAX} characters.` `` | |
| seo-analyzer.js:96 | `` `${missing} de ${total} imágenes sin alt text.` `` | `` `${missing} of ${total} images missing alt text.` `` | conciso |
| seo-analyzer.js:97 | `"Agrega alt text descriptivo a cada imagen — clave para SEO de imágenes y accesibilidad."` | `"Add descriptive alt text to each image — key for image SEO and accessibility."` | |
| seo-analyzer.js:112 | `"El producto no tiene descripción."` | `"This product has no description."` | sujeto explícito |
| seo-analyzer.js:113 | `` `Descripción muy corta (${len} caracteres).` `` | `` `Description is too short (${len} characters).` `` | natural EN |
| seo-analyzer.js:114 | `` `Escribe al menos ${MIN} caracteres de descripción real (sin contar HTML).` `` | `` `Write at least ${MIN} characters of real description (excluding HTML).` `` | |
| seo-analyzer.js:127 | `` `El handle "${handle}" no es óptimo para SEO.` `` | `` `The handle "${handle}" isn't optimal for SEO.` `` | natural EN |
| seo-analyzer.js:128 | `"Usa solo minúsculas, números y guiones; evita IDs o timestamps en la URL."` | `"Use only lowercase letters, numbers, and hyphens. Avoid IDs or timestamps in the URL."` | dos frases cortas en lugar de semicolon |

### `app/services/issue-labels.js`

| Archivo:Línea | ES | EN propuesto | Justificación |
|---------------|----|--------------|---------------|
| issue-labels.js:5 | `"Meta title"` | `"Meta title"` | técnico, sin cambio |
| issue-labels.js:6 | `"Meta description"` | `"Meta description"` | sin cambio |
| issue-labels.js:7 | `"Alt text en imágenes"` | `"Image alt text"` | invertido + sentence case |
| issue-labels.js:8 | `"Descripción del producto"` | `"Product description"` | |
| issue-labels.js:9 | `"URL / handle"` | `"URL handle"` | sin slash — más limpio y aclara qué tipo de URL es |

### `app/services/alt-text-generator.js`

| Archivo:Línea | ES | EN propuesto | Justificación |
|---------------|----|--------------|---------------|
| alt-text-generator.js:55 | `` `${title} - vista ${orphanCount}` `` | `` `${title} - view ${orphanCount}` `` | **Esto se escribe en los productos del merchant**. "view N" es el equivalente directo y se mantiene el formato del separador `-`. |

### `app/services/seo-job.js`

| Archivo:Línea | ES | EN propuesto | Justificación |
|---------------|----|--------------|---------------|
| seo-job.js:86 | `"Job sin heartbeat — proceso interrumpido"` | `"Job stopped responding — process interrupted"` | "stopped responding" más claro para el merchant que "heartbeat" (jerga técnica) |

---

## 2.3. Principios de copy aplicados

Estos rigen todas las decisiones de la tabla anterior.

- **Claro antes que clever.** Sin metáforas, sin humor en error states, sin jerga interna. Ejemplo: "Job sin heartbeat" → "Job stopped responding".
- **Conciso.** Cada palabra justifica su lugar. "Esta tienda aún no tiene productos. Crea algunos en el admin de Shopify y vuelve para ver el análisis." → la frase EN equivalente mantiene la misma idea pero usa estructura más activa.
- **Accionable.** Mensajes de error y empty states siempre proponen el siguiente paso. "Reinstall required" + dirige al settings path.
- **Voz activa.** "Add a meta description" no "A meta description should be added". "We'll process X products" no "X products will be processed".
- **Sentence case en todo botón/label/heading** (Shopify standard). Solo `SEO`, `CSV`, `Shopify`, `Pro`, `Free` van con mayúscula porque son siglas o nombres propios.
- **Sin emojis en UI.**
- **Sin signos de exclamación** salvo confirmaciones de éxito muy puntuales (no usamos ninguna en este pase).
- **Pluralización inline con ternarios** (deuda técnica): heredamos el patrón `${n} product${n === 1 ? "" : "s"}`. **No introduzco `Intl.PluralRules` ni framework i18n** — eso es decisión futura. Marco en §2.4.
- **Severidad como adjetivo fijo** en sumarios de conteo: en EN `1 critical / 2 critical` (no "criticals"). Esto simplifica el código eliminando el ternario inline solo para esas tres líneas (app.products.jsx:558–560).
- **Números y unidades:** en-dash entre rangos (`50–60 characters`, `Name A–Z`). Verifico que el carácter sea `–` (U+2013), no `-`.
- **Verbos en imperativo para CTAs:** "Upgrade to Pro", "Export CSV", "Re-analyze now", "Fix in Shopify".
- **No "Click here" excepto inline links** mid-paragraph donde no son CTA principal (caso en `app.upgrade.jsx`).
- **Consistencia de "Showing X while we Y"** en banners de stale-while-revalidate — patrón repetido idéntico en 3 archivos.
- **Tono cálido pero profesional.** "Nice work" en lugar de "Good job" / "Excellent work" — no condescendiente, alineado con voice docs de Shopify Polaris.

---

## 2.4. Deuda técnica reconocida (NO se resuelve en esta migración)

1. **Pluralización con ternario inline.** El código tiene ~30 puntos con `${n === 1 ? "" : "s"}`. Funciona en ES y EN pero rompe en idiomas con plural complejo (ruso, árabe, polaco). Cuando se decida internacionalizar a un segundo idioma no-EN, hay que introducir `Intl.PluralRules` o un framework i18n. Por ahora se traduce string por string manteniendo el patrón actual.
2. **Mensajes inline de issue (seo-analyzer.js)** mezclan estructura de string con números (`50–60 characters`). Si los rangos cambian, hay que tocar el mensaje. Aceptable por simplicidad de MVP.
3. **`isStale` banner copy** está repetido en 3 archivos (_index, products, issues). Refactor a componente compartido es post-MVP — fuera de scope de i18n.

---

## 2.5. Decisiones abiertas finales

Estos son los únicos puntos donde necesito tu OK explícito antes de implementar. El resto de la tabla está cerrado.

### Decisión A — Severidad como sustantivo plural en sumarios

En `app.products.jsx:558–560` y donde aparezca el patrón, propongo cambiar:

```js
if (counts.high) parts.push(`${counts.high} crítico${counts.high === 1 ? "" : "s"}`);
```

a:

```js
if (counts.high) parts.push(`${counts.high} critical`);
```

(sin ternario, severidad como adjetivo fijo). Esto **modifica código además del string**. Si preferís solo traducir el string mantieniendo `criticals` plural en EN (suena raro), avísame.

**Recomendación:** aplicar el cambio. Es la forma idiomática EN y simplifica.

### Decisión B — `"Tu catálogo cumple los criterios SEO. Buen trabajo."`

Tres opciones para el empty state de issues:
1. **"Your catalog meets the SEO criteria. Nice work."** (literal + tono cálido)
2. `"Your catalog passes all SEO checks."` (más conciso, factual)
3. `"All clear — your catalog meets the SEO criteria."` (energético)

**Recomendación:** opción 1 (la que llevé a la tabla).

### Decisión C — "Pro:" como prefix visual

CTAs como `"Pro: arreglar alt texts (5)"` y `"Pro: exportar CSV"` usan el prefix `"Pro:"` para indicar que es una feature paywalled. Mantengo `"Pro: fix alt texts (5)"`. Alternativa más Shopify-style sería un badge `<s-badge>Pro</s-badge>` al lado del label — pero eso es **rediseño**, no traducción. Lo dejo fuera de scope.

**Recomendación:** mantener `Pro:` como prefix textual.

### Decisión D — Tono coloquial en JobProgress fallback

`"Hubo un error inesperado. Probá de nuevo."` → propongo `"An unexpected error occurred. Try again."`. Alternativa más cálida: `"Something went wrong. Try again."`. La primera es más profesional y consistente con el resto del app; la segunda es más Shopify-style.

**Recomendación:** opción 1 ("An unexpected error occurred. Try again.").

### Decisión E — "Pasarela de pagos"

En `app.upgrade.jsx`, traduje "pasarela de pagos" como "Shopify payment page". Alternativas:
- `"payment gateway"` (técnico, suena corporativo)
- `"checkout"` (ambiguo — confunde con Shopify Checkout del storefront)
- `"payment page"` (claro, neutro) ← elegido

**Recomendación:** mantener "Shopify payment page".

---

## Siguiente paso

Esperando tu **"approved"** sobre este plan (en general, o con feedback puntual sobre las decisiones A–E) para pasar a **Fase 3 — Implementación** en la rama `feat/i18n-en-migration` con commits atómicos por área.

Si querés ajustar el copy de alguna fila específica de la tabla, marcame la fila (`archivo:línea`) y la versión que preferís.
