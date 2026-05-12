# Notas para producción

Lista viva de cosas que hay que cambiar / configurar antes de salir a App Store o desplegar a Railway/Vercel/etc. Actualizar cada vez que aparezca un nuevo `// TODO prod` o decisión de "esto en dev está OK pero en prod hay que…".

---

## Variables de entorno requeridas

| Variable | Dev | Prod | Notas |
|---|---|---|---|
| `SHOPIFY_API_KEY` | (auto por CLI) | desde Partner Dashboard | |
| `SHOPIFY_API_SECRET` | (auto por CLI) | desde Partner Dashboard | |
| `SCOPES` | (auto por toml) | `read_products,read_content,write_products` | viene del toml |
| `SHOPIFY_APP_URL` | (auto por túnel) | URL pública del deploy (https) | usado por `returnUrl` del billing |
| `DATABASE_URL` | `file:dev.sqlite` | string de PostgreSQL | cambiar `provider` en `prisma/schema.prisma` a `"postgresql"` antes de migrar |
| `BILLING_TEST` | `true` (default) | **`false`** | en prod cobramos de verdad — sin esta var Shopify no cobra |
| `NODE_ENV` | (CLI lo setea) | `production` | |
| `SHOP_CUSTOM_DOMAIN` | — | opcional | solo si soportamos shops con dominio custom |

---

## Billing API

- **Plan único**: `Pro Plan` $9/mes con 7 días de trial. Configurado en `app/shopify.server.js`.
- En dev `BILLING_TEST` queda `true` por default → Shopify no cobra realmente la tarjeta.
- **Antes de release**: setear `BILLING_TEST=false` en las env vars del host. Sin esto, los cobros nunca se efectúan en prod.
- El `returnUrl` del flow de upgrade es `${SHOPIFY_APP_URL}/app?upgraded=1`. Si la URL pública del deploy no está bien seteada, el merchant queda colgado tras pagar.
- Cuando el merchant cancela su suscripción desde el admin de Shopify, el cache se invalida solo al detectar el cambio de plan en el siguiente loader (la key del cache incluye el plan). No hace falta webhook por ahora.
- **Pendiente** (post-MVP): suscribirse a `app_subscriptions/update` para invalidar cache inmediatamente al cancelar/cambiar de plan.

### Requisitos del Partner Dashboard

- La app debe estar en **Public Distribution** para que la Billing API funcione. Sin esto el SDK responde "Apps without a public distribution cannot use the Billing API".
- Activar en: Partners → Apps → tu app → Distribution → "Distribute through the Shopify App Store". No publica la app, solo habilita las APIs.

### Bug conocido: 401 con single-fetch + `<Form>` POST

- React Router 7 usa **single fetch** por default. Si invocás `billing.request()` desde un `action` disparado por `<Form method="post">`, el redirect 302 que el SDK emite se trunca a 401 en el cliente. Bug confirmado en [shopify-app-js#1976](https://github.com/Shopify/shopify-app-js/issues/1976).
- **Workaround aplicado**: `billing.request()` vive en el `loader` de `app/routes/app.upgrade.jsx` y los CTAs son `<s-button href={upgradeUrl} target="_top">`. `target="_top"` es **crítico** — fuerza full-page navigation y evita el transport single-fetch.
- **Si en el futuro algún CTA de upgrade vuelve a fallar 401**: revisar que sea GET con `target="_top"`, no POST.

### Alternativa a futuro: Managed App Pricing

Shopify lanzó **Managed App Pricing**: definís los planes en el Partner Dashboard y Shopify hostea la página de planes (`/charges/<app>/pricing_plans`). Maneja trials, proration, cobros y cancelación automáticamente. Es el default para apps nuevas.

Ventajas vs nuestra implementación actual:
- Eliminamos `billing` config, ruta `/app/upgrade`, CTAs custom.
- Evita el bug de single-fetch (ya no llamamos `billing.request` desde nuestro código).
- Trials de 180 días con tracking anti-abuso por parte de Shopify.

Limitación: solo soporta recurring fijo (no usage-based ni one-time). Para nuestra app es suficiente.

Decisión: lo dejamos para v2 si queremos simplificar. Hoy nuestra Billing API + workaround `target="_top"` funciona.

---

## Base de datos

- **Dev**: SQLite (`file:dev.sqlite`). Genera el archivo automáticamente al correr migraciones.
- **Prod**: cambiar `provider = "postgresql"` en `prisma/schema.prisma` y poblar `DATABASE_URL` con la URL del Postgres del host.
- El campo `SeoCache.data` está como `String` (JSON serializado) para ser compatible con SQLite. En Postgres podemos cambiarlo a `Json` para mejor performance/queries, pero no es bloqueante.
- Correr `prisma migrate deploy` (no `migrate dev`) en producción.

---

## Cache de análisis SEO

- TTL = 1 hora (`CACHE_TTL_MS` en `app/services/seo-cache.js`). Si los merchants se quejan de datos viejos, bajarlo.
- El cache key es `(shop, plan)` — al cambiar de plan se invalida automáticamente.
- Botón "Re-analizar ahora" en el dashboard fuerza un refresh manual.

---

## Webhooks

- 3 GDPR ya implementados: `customers/data_request`, `customers/redact`, `shop/redact`. Declarados en `shopify.app.toml`.
- Suben a Shopify en cada `shopify app deploy`.
- **Pendiente**: agregar `app_subscriptions/update` para invalidación inmediata del cache al cambiar plan.

---

## API version

- Hoy: `2026-04` (`ApiVersion.April26`). Es la última disponible en `@shopify/shopify-api` instalado.
- Sincronizado entre `app/shopify.server.js`, `shopify.app.toml` (`api_version`), y `CLAUDE.md`.
- Cuando salga 2026-07 o newer, actualizar SDK y bumpear los 3 lugares.

---

## Pre-publicación App Store (checklist abreviada)

Ver `CLAUDE.md` sección "Checklist pre-publicación" para la lista completa. Estado de hoy:

- [x] GDPR webhooks implementados
- [x] OAuth flow funcional (scaffold)
- [x] Billing API integrada (test mode hasta cambiar `BILLING_TEST=false`)
- [x] UI con Polaris Web Components
- [x] Scopes mínimos (`read_products,read_content,write_products`)
- [ ] App probada en development store con productos reales (manual, requiere QA)
- [ ] Lighthouse score (no aplica todavía — somos backend de admin)
- [ ] App desplegada en URL HTTPS estable
- [ ] Screenshots, video demo, copy del listing
- [ ] Privacy Policy y Terms of Service publicados y enlazados

---

## Eliminar antes de release

- `// eslint-disable-next-line no-undef` en `app/services/billing.js:5` y `app/routes/app.upgrade.jsx`. Son por `process.env` en módulos del lado servidor; idealmente migrar a un wrapper `env.js` con tipos. No bloquea release.
- `console.log`s en los webhooks (`webhooks.app.uninstalled.jsx`, etc.) — opcional, ayudan a debug pero ensucian logs en prod.
