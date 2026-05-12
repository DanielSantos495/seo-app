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

## Vista global de issues agrupados

Ruta `/app/issues` con todos los issues agregados por tipo (ej: "30 productos sin meta title", "12 productos con descripción corta"). Cada grupo lista los productos afectados con link al detalle. Ya está en el plan original — pendiente.

---

## Bulk fix masivo desde el listado

Hoy el bulk fix de alt texts opera sobre 1 producto. Versión masiva (todos los productos con issue de alt) requiere paginar mutaciones por rate limits de la GraphQL API. Patrón: cola con `setTimeout`/server action que procesa N por minuto.

---

## AI Description Generator (V2 del CLAUDE.md)

Generar meta descriptions con Claude desde el detalle del producto. Mismo patrón que el AI alt text: botón "Generar con IA" en la sección de issues SEO. Plan Pro+ ($19/mes).

---

## Webhook `app_subscriptions/update` para invalidar cache

Hoy confiamos en el TTL del cache (1h) + el cache key incluyendo el plan. Suscribirse a este webhook invalida instantáneamente al cambiar/cancelar plan.

---

## Migración a Managed App Pricing

Eliminar Billing API custom y usar la página de planes hosteada por Shopify. Más simple, evita el bug de single-fetch + billing.request, default para apps nuevas. Detalle en `PRODUCTION_NOTES.md`.

---

## Análisis de páginas y colecciones

Mismo flujo que productos: fetch + analyzer + IssuesList. Reusar el componente `IssuesList` (ya está pensado para esto). Plan Pro.

---

## Sidekick App Extension (V3)

Exponer acciones tipo "¿Cuál es mi producto con peor SEO?" desde el chat nativo de Shopify. Requiere publicar la app, conseguir tracción real, y solicitar acceso al preview. Detallado en `CLAUDE.md` sección "Objetivo a largo plazo".

---

## Export CSV del reporte

Plan Pro. Botón "Exportar reporte" que descarga un CSV con productId, título, score, lista de issues. Simple de implementar; útil para merchants que quieren compartir el análisis con su equipo.

---

## Multilenguaje

La app está en español hardcodeado. Para escalar al App Store global, internacionalizar con `react-i18next` o equivalente. Mensajes de issues, fixes y UI.

---

## Edición inline del alt text en el preview

En el modal de bulk fix, permitir al merchant editar cada alt propuesto antes de aplicar. UX más rica pero implica controlled inputs y un PATCH selectivo.
