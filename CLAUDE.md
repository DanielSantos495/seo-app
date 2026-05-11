# CLAUDE.md — Shopify SEO Analyzer
> Contexto completo del proyecto para Claude Code.
> Última actualización: Mayo 2026

---

## 🎯 Visión general del proyecto

Estamos construyendo una **app pública en el Shopify App Store** llamada **SEO Analyzer**.
Es un negocio lateral (side project) con el objetivo de generar ingresos recurrentes (MRR).

El plan es en tres fases:
1. **V1 MVP** — SEO Analyzer funcional, publicado en el App Store
2. **V2** — Agregar AI Description Generator como feature premium
3. **V3** — Integrar Sidekick App Extension (el objetivo a largo plazo)

---

## 🏗️ Stack técnico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Framework | **Remix** | Scaffold generado con `shopify app init` |
| Runtime | Node.js 20+ | |
| UI | **Shopify Polaris** + App Bridge React | Obligatorio para pasar el review |
| Base de datos | **Prisma + SQLite** (dev) / **PostgreSQL** (prod) | |
| Deploy | **Railway** | ~$10/mes, auto-deploy desde GitHub |
| API Shopify | **GraphQL Admin API 2026-04** | REST está deprecada — NO usar |
| Pagos | **Shopify Billing API** | RecurringApplicationCharge |
| Autenticación | OAuth 2.0 via App Bridge | Ya incluido en el scaffold |

### Dependencias clave
```json
{
  "@shopify/shopify-app-remix": "latest",
  "@shopify/polaris": "latest",
  "@shopify/app-bridge-react": "latest",
  "@prisma/client": "latest",
  "prisma": "latest"
}
```

---

## 📁 Estructura del proyecto

```
seo-analyzer/
├── app/
│   ├── routes/
│   │   ├── app._index.jsx        ← Dashboard principal (score general)
│   │   ├── app.products.jsx      ← Tabla de todos los productos con scores
│   │   ├── app.issues.jsx        ← Lista de issues priorizados con fixes
│   │   └── webhooks.jsx          ← GDPR webhooks (obligatorios)
│   ├── services/
│   │   ├── seo-analyzer.js       ← Lógica de scoring (función pura)
│   │   └── shopify-api.js        ← Queries GraphQL a la Admin API
│   ├── components/
│   │   ├── ScoreCard.jsx         ← Componente de score circular
│   │   ├── IssuesBadge.jsx       ← Badge de impacto (high/medium/low)
│   │   └── ProductsTable.jsx     ← IndexTable de productos con scores
│   ├── shopify.server.js         ← Config auth + billing (generado por CLI)
│   └── db.server.js              ← Cliente Prisma singleton
├── prisma/
│   └── schema.prisma             ← Session + SeoCache models
├── public/
├── shopify.app.toml              ← Config de la app (scopes, webhooks)
└── CLAUDE.md                     ← Este archivo
```

---

## 🗄️ Schema de Prisma

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"           // Cambiar a "postgresql" en producción
  url      = env("DATABASE_URL")
}

model Session {
  id          String   @id
  shop        String
  state       String
  isOnline    Boolean  @default(false)
  scope       String?
  expires     DateTime?
  accessToken String
  userId      BigInt?
  createdAt   DateTime @default(now())
}

model SeoCache {
  id        String   @id @default(cuid())
  shop      String   @unique
  data      Json     // Resultado del último análisis completo
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
- Análisis de los primeros **25 productos**
- Dashboard con score general
- Lista de issues con descripción del fix
- Sin bulk actions

### Plan Pro — $9/mes
- Análisis de **todos los productos** (sin límite)
- **Bulk fix de alt texts** (genera alt text automáticamente con el nombre del producto)
- Export de reporte en CSV
- Análisis de colecciones y páginas

### V2 — Plan Pro+ (futuro, no en MVP)
- **AI Description Generator** — genera meta descriptions con Claude API
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

### Traer productos con campos SEO
```graphql
query GetProductsSeo($cursor: String) {
  products(first: 50, after: $cursor) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        title
        handle
        descriptionHtml
        seo {
          title
          description
        }
        images(first: 10) {
          edges {
            node {
              id
              altText
              url
            }
          }
        }
      }
    }
  }
}
```

### Mutation para actualizar alt text (bulk fix)
```graphql
mutation UpdateProductImages($input: ProductInput!) {
  productUpdate(input: $input) {
    product {
      id
      images(first: 10) {
        edges {
          node { id altText }
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

---

## 🪝 GDPR Webhooks (obligatorios para el App Store)

Shopify exige estos 3 webhooks o la app es rechazada:

```javascript
// app/routes/webhooks.jsx
switch (topic) {
  case 'CUSTOMERS_DATA_REQUEST':
    // Esta app no guarda datos de clientes — responder vacío
    return new Response();

  case 'CUSTOMERS_REDACT':
    // Igual — no hay datos de clientes que borrar
    return new Response();

  case 'SHOP_REDACT':
    // Tienda desinstala — borrar todos sus datos
    await db.seoCache.deleteMany({ where: { shop } });
    await db.session.deleteMany({ where: { shop } });
    return new Response();
}
```

Deben declararse en `shopify.app.toml`:
```toml
[[webhooks.subscriptions]]
topics = ["customers/data_request", "customers/redact", "shop/redact"]
uri = "/webhooks"
```

---

## 💳 Billing API — Planes de suscripción

```javascript
// En shopify.server.js, agregar la config de billing:
export const shopify = shopifyApp({
  // ...config existente...
  billing: {
    'Pro Plan': {
      amount: 9,
      currencyCode: 'USD',
      interval: BillingInterval.Every30Days,
      trialDays: 7,         // 7 días gratis para convertir
    },
  },
});
```

**Flujo:** merchant instala → usa plan free → al intentar analizar producto #26 → modal de upgrade → Shopify maneja el cobro → tú recibes el 100% (hasta $1M vitalicio).

---

## ✅ Checklist pre-publicación en App Store

### Técnico (causas más comunes de rechazo)
- [ ] ⚠️ GDPR webhooks implementados y respondiendo 200 OK
- [ ] ⚠️ OAuth flow: instalar, desinstalar, RE-instalar funciona correctamente
- [ ] ⚠️ Billing API implementada (no cobrar fuera del ecosistema Shopify)
- [ ] UI construida 100% con componentes de Polaris
- [ ] Scopes mínimos solicitados (no pedir más de lo necesario)
- [ ] App funciona en una development store real con productos reales
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
Semana 1   → Setup: shopify app init, explorar scaffold, dev store funcionando
Semana 2   → GraphQL queries + lógica de scoring (seo-analyzer.js)
Semana 3-4 → UI con Polaris: dashboard, tabla de productos, lista de issues
Semana 5   → Billing API + planes free/pro
Semana 6   → GDPR webhooks + support page + QA end-to-end
Semana 7   → Deploy Railway + listing + enviar a revisión Shopify
Mes 3-6    → Iterar con feedback, reviews, feature requests
Mes 6+     → V2: AI Description Generator (Claude API)
Mes 9-12   → V3: Sidekick App Extension
```

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
- Polaris para TODO lo visual dentro del admin — sin CSS custom salvo casos muy específicos
- Lógica de negocio (scoring) en `app/services/` — funciones puras, fáciles de testear
- Queries GraphQL en `app/services/shopify-api.js` — separadas del UI
- Comentarios en español — es el idioma del desarrollador

---

*Este archivo debe mantenerse actualizado a medida que el proyecto evoluciona.*
*Claude Code lo lee automáticamente al iniciar en este directorio.*
