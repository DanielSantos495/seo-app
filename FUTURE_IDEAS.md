# Ideas para versiones futuras

Backlog de mejoras que descartamos o pospusimos durante el MVP. Anotar acá cualquier idea que no entre en el alcance actual pero valga la pena recordar para v2/v3.

---

## Alt text con IA (Claude Vision)

**Hoy**: el bulk fix usa el patrón naive `${title} - ${variante}` (sin IA, gratis, instantáneo).

**Idea**: agregar un toggle "Mejorar con IA" que use **Claude Haiku Vision** para describir cada imagen y generar un alt text rico tipo *"Camiseta azul de cuello redondo con logo bordado de pez en el pecho"*.

**Diseño tentativo**:
- Service `app/services/alt-text-ai.js` con `generateAltTextWithAI(imageUrl, productTitle, language)`.
- En el modal de preview, switch "Generar con IA (mejor calidad)" — al activarlo se llama a Claude por cada imagen.
- Costo: ~$0.005/imagen con Haiku 4.5 vision. Para 50 imágenes ~$0.25.
- Latencia: 3–5s por imagen → mostrar progress bar.
- Requiere env `ANTHROPIC_API_KEY` y reglar el costo (margen del plan Pro lo cubre).
- Idiomas: detectar el `locale` de la tienda y pedirle a Claude que responda en ese idioma.

**Por qué tiene sentido**: Pro+ tier ($19/mes) con AI features es el plan natural V2 según `CLAUDE.md`.

---

## Bulk fix masivo escalable (>50 productos)

Hoy hay bulk masivo desde el listado pero con **cap de 50 productos por ejecución** (Fase A). Para tiendas grandes que tengan >500 productos con issues:

- **Fase B**: background job con tabla `AltFixJob (shop, total, processed, status, errors[])`, cliente hace polling cada 2s. Sin cap. Mucho código nuevo (estado, retries, race conditions).
- **Fase C**: usar `bulkOperationRunMutation` de Shopify. Subimos un JSONL con todas las mutations, Shopify procesa en su lado sin rate limits nuestros, webhook `bulk_operations/finish` notifica al terminar. Sin preview antes de aplicar.

Trigger para implementar: cuando 5+ merchants pidan procesar tiendas grandes en una sola ejecución.

---

## AI Description Generator (V2 del CLAUDE.md)

Generar meta descriptions con Claude desde el detalle del producto. Mismo patrón que el AI alt text: botón "Generar con IA" en la sección de issues SEO. Plan Pro+ ($19/mes).

---

## Migración a Managed App Pricing

Eliminar Billing API custom y usar la página de planes hosteada por Shopify. Más simple, evita el bug de single-fetch + billing.request, default para apps nuevas. Detalle en `PRODUCTION_NOTES.md`.

---

## Análisis de páginas y colecciones

Mismo flujo que productos: fetch + analyzer + IssuesList. Reusar el componente `IssuesList` (ya está pensado para esto). Plan Pro.

---

## Análisis del HTML de las páginas: product, home, collections

La App tiene que leer en HTML y analizar el uso correcto de headings comparando con el contenido. Ejemplo:
- Home: La primera sección debería tener el H1, no haber ningún otro h1 en esa página y ver que las demás secciones tengan correctamente un h2, h3, etc. Plan Pro.
- Product page: El H1 debe ser correspondiente al tíulo del producto y/o similar, debe estar en la primera sección de la página.
- Elementos HTML: Headings OK, button OK, a (anchor) OK, ul, ol, etc. Cada elemento con sus correspondientes atributos.
- Etc.

---


## Sidekick App Extension (V3)

Exponer acciones tipo "¿Cuál es mi producto con peor SEO?" desde el chat nativo de Shopify. Requiere publicar la app, conseguir tracción real, y solicitar acceso al preview. Detallado en `CLAUDE.md` sección "Objetivo a largo plazo".

---

## Multilenguaje

La app está en español hardcodeado. Para escalar al App Store global, internacionalizar con `react-i18next` o equivalente. Mensajes de issues, fixes y UI.

---

## Edición inline del alt text en el preview

En el modal de bulk fix, permitir al merchant editar cada alt propuesto antes de aplicar. UX más rica pero implica controlled inputs y un PATCH selectivo.
