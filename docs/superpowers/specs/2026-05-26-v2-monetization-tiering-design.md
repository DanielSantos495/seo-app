# Spec — Monetización y tiering de Cury SEO V2

> **Fecha:** 2026-05-26 · **Tipo:** estrategia de producto / roadmap (no es spec de implementación de una feature)
> **Estado:** diseño aprobado en brainstorming, pendiente review del usuario.
> **Idioma:** interno (español). Toda copy user-facing derivada de este doc va en **inglés** (regla §Lenguaje del CLAUDE.md raíz).

---

## 1. Contexto y objetivo

V1 de Cury SEO es **100% gratis** y está en review del App Store. Es inversión deliberada en distribución y reviews, no producto final. V2 introduce la **monetización** vía features nuevas (principalmente AI), usando **Managed App Pricing** de Shopify.

Objetivo de este spec: fijar (a) la **estructura de tiers**, (b) **qué feature del backlog va en qué tier y por qué**, y (c) el **orden de construcción**. No diseña la implementación de cada feature — cada una tendrá su propio ciclo brainstorm → spec → plan.

Fuente del backlog: `FUTURE_IDEAS.md`. Este doc lo reorganiza en función de monetización y reemplaza el pricing tentativo informal de `CLAUDE.md` §8/§10.

---

## 2. Estructura de tiers

**Free + Pro + Pro+** (dos tiers pagos). Decisión: 2 pagos equilibra upsell claro contra superficie de mantenimiento razonable para un dev solo (~10-15 hrs/sem). Se descartó 1 solo pago (wedge único, menos granularidad de revenue) y 3 pagos (4x superficie de quotas/gates/soporte, injustificable con base chica).

### Filosofía de gating

- **Free** = lo ya prometido gratis. Intocable: es el gancho de adquisición y la base de reviews. Mover algo de Free a pago rompe la promesa del listing.
- **Pro** = *"vé y arreglá TODO tu on-page SEO"*. Amplía **cobertura** (más allá de productos) + da una **probada de AI** (quota chica). Las features de cobertura no tienen costo por uso → no necesitan quota.
- **Pro+** = *"AI a escala + automatización"*. Diferencia por **volumen de AI** (que tiene costo variable real) + **recurring audits** (automatización = stickiness + carga de infra). El salto de precio se justifica con costo real, no con bloquear acceso.

**Principio clave:** el AI vive en *ambos* tiers pagos, diferenciado por **quota**, no por acceso. Esto resuelve la inconsistencia previa entre `FUTURE_IDEAS.md` (AI = "Pro+ exclusivo") y `CLAUDE.md` §8 (AI repartido por quota).

---

## 3. Mapeo feature → tier (con rationale)

| Feature (origen en FUTURE_IDEAS) | Tier | Por qué ahí y no en otro |
|---|---|---|
| Audit de productos + bulk alt determinista + CSV (V1) | **Free** | Ya prometido gratis. Moverlo rompe el listing y las reviews. Gancho de adquisición. |
| Páginas y colecciones | **Pro** | Reusa `IssuesList` → build barato. "Más cobertura del mismo valor" = el upsell más natural desde Free. Sin costo por uso → sin quota. |
| Análisis HTML estructural (headings H1/H2/H3, elementos) | **Pro** | Diferenciador técnico fuerte y **sin costo por uso**. Hace que Pro valga el precio aunque el merchant no toque el AI. En Pro+ debilitaría Pro y desincentivaría pagar. |
| Edición inline del alt en el preview | **Pro** | Mejora de UX de una feature que ya existe gratis. Calidad de vida, no vale tier propio; suma al valor percibido de Pro. |
| AI alt text (Claude Vision) | **Pro: 100/mo · Pro+: 500/mo** | Flagship V2. Costo real ~$0.0017/img (Haiku 4.5). Quota chica en Pro = probar sin comer margen; quota grande en Pro+ = donde está el costo variable → justifica el precio. La palanca es el **volumen**, no el acceso. |
| AI meta description + meta title | **Pro: 50/mo · Pro+: 300/mo** | Mismo PR/infra que AI alt (costo marginal de build ~0). Mismo racional de quota. Empaquetar todo el AI evita micro-gates confusos. |
| Recurring audits (auto semanal/programado) | **Pro+** | Automatización = stickiness + carga de infra (jobs programados). Segundo pilar del salto a Pro+ junto al volumen de AI. En Pro el audit es on-demand (como hoy). |

### Fuera de cualquier tier (infra / enablers / deuda técnica)

No son features vendibles; habilitan o sostienen el producto:

- **Managed App Pricing** — enabler: requisito previo a cobrar cualquier tier.
- **Bulk fix escalable >50 (Bulk Operations API)** — backend; V1 free ya no tiene cap, así que no es un gate de plan.
- **Prisma 6→7 upgrade**, **multilenguaje (i18n)**, **test de carga 1k+**, **rename URL `/seo-analyzer/`→`/cury-seo/`** — deuda/infra, sin relación con tiers.

---

## 4. Pricing tentativo

| Tier | Precio tentativo | Headline |
|---|---|---|
| Free | $0 | Audit de productos + bulk alt determinista + CSV (V1 actual). |
| Pro | ~$12/mo | Cobertura completa (páginas, colecciones, HTML, inline edit) + AI alt 100/mo + AI meta 50/mo. |
| Pro+ | ~$25/mo | Todo Pro + AI alt 500/mo + AI meta 300/mo + recurring audits. |

> Rangos preliminares. **Validar contra competidores reales** (`FUTURE_IDEAS.md`: TinyIMG, AltText.ai, Booster SEO, SEO Manager, Plug in SEO) antes de fijar. La willingness-to-pay del AI alt text está probada por AltText.ai / TinyIMG, que cobran exactamente por eso.

---

## 5. Orden de construcción (flagship-first)

Decisión: **flagship-first**. El primer feature pago es el AI alt text porque es el wedge con willingness-to-pay probada y máximo "wow". Se acepta el trabajo upfront de salvaguardas + gate legal como costo de entrada a la monetización.

```
0. Managed App Pricing            (1-2 d)  — enabler, paso fijo. Elimina el bug single-fetch + billing.request.
1. AI alt text (Claude Vision)    (3-5 d)
   + salvaguardas AI obligatorias (2-3 d)
   + privacy update (Anthropic)   — GATE LEGAL, antes de shipear
   → LANZAR PRO (AI alt 100/mo)
2. AI meta description + title    (2-3 d, mismo PR/infra que AI alt)
   → ABRIR PRO+ (quotas 500/300 + recurring audits)
3. Páginas + colecciones          (3-4 d, reusa IssuesList)
4. Análisis HTML estructural      (5-8 d)
5. Edición inline del alt         (UX, menor)
```

Primer dólar estimado: ~2-3 semanas de trabajo efectivo. Riesgo: medio (costo AI + gate legal), mitigado por las salvaguardas de §6.

**Nota de secuencia:** la cobertura (páginas/colecciones, HTML) cierra el valor de Pro pero NO bloquea el primer release pago — Pro puede lanzar con el AI alt text como headline y completarse en incrementos 3-4. Pro+ se abre en el incremento 2, cuando ya hay segundo eje de AI + recurring.

---

## 6. Salvaguardas obligatorias antes de shipear AI

(De `CLAUDE.md` §10 / `FUTURE_IDEAS.md` — bloqueantes, no opcionales):

- Rate limit por shop, server-side.
- Quota mensual **enforced server-side** (no solo en UI).
- Alerta si un shop excede ~$5/mes en costo de AI.
- Fallback graceful a generación determinística si la API de Anthropic cae.
- **Privacy update con Anthropic como sub-procesador ANTES de shipear** cualquier AI (gate legal, toca `cury-apps-site/seo-analyzer/privacy.html`).

---

## 7. Decisiones abiertas (fuera del alcance de este spec)

- Precios exactos y nombres finales de los planes (validar con competencia).
- Modelo de quota: ¿créditos unificados (1 crédito = 1 llamada AI) o cuotas separadas por tipo (alt vs meta)? Se decide en el spec de implementación del AI.
- Qué pasa al downgrade / fin de mes con quota consumida.
- Trial: si Pro/Pro+ tienen trial gratis. (Shopify Managed Pricing lo soporta nativo.)
- Multi-store / agencias: no se contempla en V2.

---

## 8. Próximo paso

El primer incremento construible es **Managed App Pricing (paso 0)**. Tendrá su propio ciclo: brainstorm → spec → plan de implementación. Este doc es la fuente de verdad del tiering; al implementar, mantener sincronizados `CLAUDE.md` §8/§10 y `FUTURE_IDEAS.md`.
