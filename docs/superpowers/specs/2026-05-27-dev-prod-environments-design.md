# Spec — Separación de entornos Dev / Prod de Cury SEO

> **Fecha:** 2026-05-27 · **Tipo:** infra / workflow de desarrollo
> **Estado:** diseño aprobado en brainstorming, pendiente review del usuario.
> **Idioma:** interno (español). Identificadores y comandos en inglés.

---

## 1. Contexto y problema

Hoy existe **un solo entorno**:

- **Un app** en Partner Dashboard ("Cury SEO", `client_id bbd179e9f5f501e3917e14dd5297389c`), apuntando a Railway.
- **Un solo `shopify.app.toml`** con la URL de prod.
- `pnpm dev` (`shopify app dev`) se conecta **a ese mismo app de prod**, por lo que el túnel de Cloudflare sobrescribía la `application_url` de producción cada vez (causa del incidente `*.trycloudflare.com` en el admin).
- El `.env` local apuntaba `DATABASE_URL` a la **DB de prod en Railway** (`kodama.proxy.rlwy.net`), es decir, el desarrollo leía/escribía datos de producción.

La app de prod está en/cerca de review del App Store, así que necesitamos desarrollar **sin tocar prod**.

**Objetivo:** aislamiento total entre dev y prod (app, tienda, base de datos y URLs), con un flujo de cambio de entorno simple y documentado.

## 2. Decisiones (aprobadas en brainstorming)

| Eje | Decisión |
|---|---|
| App en Partner Dashboard | **App dev separada** ("Cury SEO (Dev)") con su propio `client_id`/keys. |
| Tienda de pruebas | **Dev store nueva**, dedicada a desarrollo. La tienda de review (`cury-vdrxupzo.myshopify.com`) queda intacta. |
| Base de datos dev | **Postgres local con Docker** (`docker-compose.yml`). Mismo motor que prod. |
| Deploy de prod | **`main` = prod**; Railway auto-deploya desde `main`. Dev en ramas feature + local. |

## 3. Arquitectura

### 3.1 Apps (Partner Dashboard)
- **Prod** (existente): "Cury SEO". URLs → Railway. `automatically_update_urls_on_dev = false`. No se toca.
- **Dev** (nuevo): "Cury SEO (Dev)". URLs gestionadas por el túnel de `shopify app dev`. `automatically_update_urls_on_dev = true` (solo afecta al app dev).

### 3.2 Configs del CLI (multi-config)
- `shopify.app.toml` → **prod** (Railway). Ya existe.
- `shopify.app.dev.toml` → **dev**. Se crea con `shopify app config link --config dev --client-id <DEV_CLIENT_ID>`, que descarga la config del app dev del dashboard.
- Activar entorno: `shopify app config use dev` / `shopify app config use shopify.app.toml`.
- El config activo es el que usan `shopify app dev` y `shopify app deploy`.
- El config activo se trackea en `.shopify/` (gitignored). Ambos `.toml` **sí** se commitean (solo contienen `client_id`, público; los secrets nunca van al repo).

### 3.3 Base de datos
- **Dev**: `docker-compose.yml` con Postgres 16 en `localhost:5432`. El `.env` local apunta `DATABASE_URL` ahí. Migraciones con `prisma migrate dev`.
- **Prod**: Postgres managed de Railway (sin cambios). Su `DATABASE_URL` vive solo en las env vars de Railway.
- **Fix crítico**: reemplazar el `DATABASE_URL` del `.env` local (que apunta a prod) por el de localhost.

### 3.4 Variables de entorno
- **`.env` local (dev)**: `DATABASE_URL` → Postgres local. Las keys de Shopify (`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SCOPES`) las inyecta `shopify app dev` desde el config dev activo.
- **Prod**: env vars en Railway (ya configuradas). Nunca en el repo. `.env*` sigue gitignored (excepto `.env.example`).

### 3.5 Git + deploy
- Mergear `feature/deploy-prep` → `main`; apuntar el auto-deploy de Railway a `main`.
- **Dev**: ramas feature + `shopify app dev` (app dev + dev store + Postgres local).
- **Prod (código)**: merge a `main` → Railway auto-deploya.
- **Prod (config Shopify)**: `shopify app deploy` solo con el config de **prod** activo, cuando cambian URLs/scopes/webhooks.

### 3.6 Scripts de package.json (mínimos)
- `dev` → `shopify app config use dev && shopify app dev`
- `deploy:prod` → `shopify app config use shopify.app.toml && shopify app deploy`
- `db:up` → `docker compose up -d`
- `db:down` → `docker compose down`

## 4. Reparto de trabajo

### 4.1 Automatable (lo hace Claude en el repo)
- `docker-compose.yml` para Postgres local.
- Actualizar `DATABASE_URL` del `.env` local a localhost.
- Scripts en `package.json`.
- Manual de cambio de entorno en `README.md` y `CLAUDE.md`.
- Asegurar `.shopify/` en `.gitignore`.

### 4.2 Interactivo (lo hace el usuario; requiere browser/login)
1. Crear app **"Cury SEO (Dev)"** en Partner Dashboard → copiar su `client_id`.
2. Crear una **development store** nueva y asignar el app dev.
3. `shopify app config link --config dev --client-id <DEV_CLIENT_ID>` → genera `shopify.app.dev.toml`.
4. Mergear `feature/deploy-prep` → `main` y repuntar el auto-deploy de Railway a `main`; verificar que prod sigue arriba.

## 5. Guardarraíles
- Nunca correr `shopify app dev` con el config de **prod** activo (el script `dev` fuerza `config use dev` antes).
- El app de prod en review queda intacto durante todo el desarrollo.
- El `.env` local jamás vuelve a apuntar a la DB de prod.
- `automatically_update_urls_on_dev` queda `true` solo en `shopify.app.dev.toml`, `false` en `shopify.app.toml`.

## 6. Referencia rápida — cambiar de entorno (fuente del manual)

```bash
# --- Desarrollo (app dev + dev store + Postgres local) ---
pnpm db:up                 # levanta Postgres local
pnpm dev                   # activa config dev y corre shopify app dev

# --- Release de código a prod ---
git checkout main && git merge <rama> && git push   # Railway auto-deploya

# --- Release de config Shopify a prod (URLs/scopes/webhooks) ---
pnpm deploy:prod           # activa config prod y corre shopify app deploy

# --- Ver/forzar entorno activo ---
pnpm shopify app config use dev                  # dev
pnpm shopify app config use shopify.app.toml     # prod
```

> Requiere Node ≥22.13 para pnpm 11 (`nvm use 22`).

## 7. Fuera de alcance (YAGNI)
- Entorno de staging persistente en Railway (dev local basta para un solo dev).
- CI/CD con tests automáticos en el merge a `main` (se evaluará en V2).
- Seeds automáticos de la dev store (se siembran a mano cuando haga falta).
