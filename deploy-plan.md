# SEO Analyzer — Plan de Deploy (Día D)

> **Objetivo:** pasar el MVP de `localhost` + dev store a **URL HTTPS pública en Railway** con Postgres, app Shopify configurada como Public Distribution y lista para QA pre-submission.
> **Fecha:** 2026-05-21
> **Ámbito:** SOLO deploy (Fase 1.1 de `launch-strategy.md`). Legal, landing, screenshots, video y submission al App Store van en planes posteriores.
> **Tiempo estimado:** 3–5 horas (con pasos del usuario en paralelo a los míos).
> **Rol Claude (CC):** ejecuta cambios de código, migración Prisma, Dockerfile, smoke commits, comandos de CLI.
> **Rol Usuario (U):** crea cuentas, paga dominio/hosting, configura Partner Dashboard, copia/pega credenciales, hace QA en dev store.

---

## 0. Resumen del flujo

```
[U] Cuentas (Partner, Railway, Cloudflare, Resend, dominio)
        ↓
[CC] git init + repo en GitHub
        ↓
[CC] Cambios pre-deploy (schema postgresql, Dockerfile fixes, env wrapper)
        ↓
[U] Provisionar Postgres en Railway + obtener DATABASE_URL
        ↓
[U] Subir env vars a Railway (incluye SHOPIFY_API_KEY/SECRET del Partner)
        ↓
[CC + U] Deploy a Railway → URL HTTPS estable
        ↓
[CC] Actualizar shopify.app.toml con URL prod + shopify app deploy
        ↓
[U] Partner Dashboard: activar Public Distribution + verificar billing
        ↓
[U + CC] QA end-to-end en dev store fresca
        ↓
[U] Dominio custom .app apuntando a Railway (opcional pero recomendado)
        ↓
✅ App desplegada lista para próxima fase (landing/legal/listing)
```

---

## 1. Pre-requisitos del usuario (HACER ANTES DE EMPEZAR)

> Estos pasos son del usuario. Hasta que no estén listos no puedo continuar más allá del §3.

### 1.1. Cuentas que debes crear/verificar

| # | Cuenta | URL | Costo | Necesario para |
|---|---|---|---|---|
| 1 | Shopify Partners | https://partners.shopify.com | Free | App ya existe (`client_id` en toml). Solo verificar acceso |
| 2 | GitHub | https://github.com | Free | Repo del código (Railway despliega desde GitHub) |
| 3 | Railway | https://railway.com | $5/mes Hobby | Hosting app + Postgres managed |
| 4 | Cloudflare | https://cloudflare.com | Free | DNS + email routing (luego landing) |
| 5 | Resend | https://resend.com | Free 3000 emails/mes | Email transaccional + soporte |
| 6 | Registrador dominio | Namecheap / Porkbun / Cloudflare Registrar | ~$18–22/año | Dominio `.app` (HTTPS forzado) |

### 1.2. Decisiones a tomar antes de comprar

**Dominio (verificar disponibilidad AHORA):**

Candidatos sugeridos por `launch-strategy.md` §1.1:
- `seoanalyzer.app`
- `shopifyseo.app`
- `seoaudit.app`
- `seo-pilot.app`

Comprar **2** (uno principal + uno alterno por si Shopify rechaza el nombre). Verificar en:
- https://porkbun.com/checkout/search
- https://www.namecheap.com/domains/registration/results/

> **Nota:** el dominio NO es estrictamente bloqueante para el deploy de hoy. Railway da un subdominio `*.up.railway.app` con HTTPS gratis que sirve para empezar. El dominio custom se conecta después en §8.

### 1.3. Credenciales que vas a necesitar tener a mano

Pídeme el momento en que las necesite — no las pegues ahora todas. Yo te diré exactamente cuándo y dónde.

- `SHOPIFY_API_KEY` y `SHOPIFY_API_SECRET` (Partner Dashboard → tu app → API credentials)
- `DATABASE_URL` (lo da Railway al provisionar Postgres)
- URL pública del deploy Railway (lo da Railway al primer build, formato `https://seo-app-production-xxxx.up.railway.app`)

---

## 2. Pre-vuelo: estado del repo y branch

### Task 2.1 — Confirmar que estamos en el branch correcto

**Responsable:** CC
**Por qué:** la migración i18n EN está en `feat/i18n-en-migration`. Para deploy production necesitamos ese branch mergeado o ser el branch deployado.

**Archivos involucrados:** ninguno (solo inspección).

- [ ] **Paso 1:** verificar estado git actual

```bash
cd /Users/apple/Documents/shopify-app/seo-app
git status 2>&1 || echo "NO ES REPO GIT"
git branch -a 2>&1 || true
```

Esperado:
- Si "NO ES REPO GIT" → ir a Task 3.1 (init repo).
- Si es repo, ver branch actual y confirmar con el usuario qué branch deployar.

- [ ] **Paso 2:** decisión con el usuario

**Pregunta al usuario:**
- ¿Mergeamos `feat/i18n-en-migration` a `main` antes de deploy? (recomendado)
- ¿O deployamos directamente esa rama?

---

## 3. Inicializar repo Git y subir a GitHub

> Solo aplica si el repo NO está inicializado todavía (es el caso actual: el entorno reporta `Is a git repository: false`).

### Task 3.1 — Crear `.gitignore` apropiado

**Responsable:** CC
**Archivos:** crear `/Users/apple/Documents/shopify-app/seo-app/.gitignore` si no existe.

- [ ] **Paso 1:** comprobar existencia

```bash
ls -la /Users/apple/Documents/shopify-app/seo-app/.gitignore 2>&1
```

- [ ] **Paso 2:** si no existe, crear con contenido seguro

```
node_modules/
.env
.env.*
!.env.example
build/
dist/
*.log
.DS_Store
prisma/dev.sqlite
prisma/dev.sqlite-journal
.shopify/
.cache/
.vite/
```

> **Crítico:** `.env` JAMÁS al repo (contiene `SHOPIFY_API_SECRET`).

### Task 3.2 — `git init` + primer commit

**Responsable:** CC + U (U crea repo en GitHub, CC pushea).

- [ ] **Paso 1:** init y primer commit (CC)

```bash
cd /Users/apple/Documents/shopify-app/seo-app
git init -b main
git add .gitignore
git add .
git status   # revisar que no se cuele dev.sqlite ni .env
git commit -m "chore: initial commit (MVP SEO Analyzer)"
```

- [ ] **Paso 2:** crear repo vacío en GitHub (U)

**Usuario:** crear un repo PRIVADO en https://github.com/new
- Nombre sugerido: `shopify-seo-analyzer`
- Privado (importante: contiene config y código pre-listing)
- SIN `README`, SIN `.gitignore`, SIN licencia (los añadimos nosotros)
- Copiar la URL SSH o HTTPS

**Pega aquí la URL del repo cuando esté lista.**

- [ ] **Paso 3:** conectar remote y push (CC)

```bash
cd /Users/apple/Documents/shopify-app/seo-app
git remote add origin <URL_DEL_REPO_GITHUB>
git push -u origin main
```

Esperado: branch `main` visible en GitHub con todo el código.

---

## 4. Cambios de código pre-deploy (CC)

> Bloque de cambios necesarios ANTES de levantar la app en prod. Todos pequeños, todos commiteables aparte.

### Task 4.1 — Cambiar provider Prisma a postgresql

**Responsable:** CC
**Archivos:** `prisma/schema.prisma`

**Por qué:** SQLite no es viable en Railway (filesystem efímero). Postgres managed obligatorio para persistencia.

- [ ] **Paso 1:** editar `prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- [ ] **Paso 2:** generar migración inicial para Postgres

Las migraciones SQLite actuales (`20240530213853_create_session_table`, `20260511172525_add_seo_cache`, `20260513164900_add_seo_job`, `20260513173631_add_session_shop_index`) usan sintaxis SQLite y no se pueden replay en Postgres tal cual.

**Estrategia recomendada (limpia):**
1. Mover migraciones SQLite a backup: `mv prisma/migrations prisma/migrations.sqlite.bak`
2. Crear nueva carpeta `prisma/migrations` con migración Postgres consolidada generada por `prisma migrate dev --name init` apuntando a un Postgres local o usando `prisma migrate deploy` directo contra Postgres de Railway.

> **Decisión a tomar con el usuario:** ¿generamos la migración Postgres local (necesita docker postgres) o conectamos directo a la DB de Railway con `DATABASE_URL` desde la terminal?

**Recomendación:** generar contra Railway directo, más simple, una sola DB.

- [ ] **Paso 3:** validar que `seo-cache.js` sigue serializando JSON manualmente

Verificar `app/services/seo-cache.js` — `data` sigue siendo `String` en el schema (decisión documentada en `PRODUCTION_NOTES.md`). NO cambiar a `Json` ahora para no abrir frente extra.

- [ ] **Paso 4:** commit

```bash
git add prisma/schema.prisma prisma/migrations*
git commit -m "feat(db): switch prisma provider to postgresql for production"
```

### Task 4.2 — Reemplazar `BILLING_TEST` default a `false` en prod (con override claro)

**Responsable:** CC
**Archivos:** `app/services/billing.js`, `app/routes/app.upgrade.jsx`, `PRODUCTION_NOTES.md`

**Estado actual:** `BILLING_TEST` se lee de `process.env`. Si no se define, Shopify SDK toma `false` por default (cobra real). En dev la CLI inyecta `true`. **No hace falta cambio de código**, solo asegurarnos de que la var en Railway NO se setee, o se setee explícitamente a `false`.

- [ ] **Paso 1:** revisar `app/services/billing.js` para confirmar lectura

```bash
grep -n "BILLING_TEST" /Users/apple/Documents/shopify-app/seo-app/app/services/billing.js /Users/apple/Documents/shopify-app/seo-app/app/routes/app.upgrade.jsx
```

- [ ] **Paso 2:** documentar en `.env.example`

Crear `/Users/apple/Documents/shopify-app/seo-app/.env.example`:

```
# Shopify (Partner Dashboard → tu app → API credentials)
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SCOPES=read_products,read_content,write_products

# URL pública del deploy (la asigna Railway)
SHOPIFY_APP_URL=

# Database (Railway managed Postgres)
DATABASE_URL=

# Billing: false en prod (cobra de verdad). True en dev (no cobra).
BILLING_TEST=false

# Runtime
NODE_ENV=production
PORT=3000
```

- [ ] **Paso 3:** commit

```bash
git add .env.example
git commit -m "docs(env): add .env.example with production var checklist"
```

### Task 4.3 — Confirmar Dockerfile listo para Railway

**Responsable:** CC
**Archivos:** `Dockerfile`

**Estado actual:** ya existe, hace `npm ci --omit=dev && npm run build`, expone `EXPOSE 3000`, comando `docker-start` (`prisma generate && prisma migrate deploy && react-router-serve`).

- [ ] **Paso 1:** revisar Dockerfile

Punto a verificar: con `--omit=dev` se instalan SOLO deps de prod. `@react-router/dev` y `vite` están en `dependencies` (no en devDependencies) — sí están. Build sale OK.

> **Posible bug:** `prisma` está en `dependencies` pero `@prisma/client` también. Bien. `npm run setup` corre `prisma generate && prisma migrate deploy` antes de `start`. OK.

- [ ] **Paso 2:** añadir `PORT` dinámico (Railway lo inyecta)

Railway expone la app via `PORT` env var. React Router serve lo respeta. Confirmar con:

```bash
grep -rn "PORT\|port" /Users/apple/Documents/shopify-app/seo-app/node_modules/@react-router/serve/dist/cli.js 2>/dev/null | head -5
```

Si `react-router-serve` no respeta `PORT`, pasarlo explícito en el `CMD`:

```dockerfile
CMD ["sh", "-c", "npm run setup && react-router-serve ./build/server/index.js --port ${PORT:-3000}"]
```

- [ ] **Paso 3:** commit si hay cambio

```bash
git add Dockerfile
git commit -m "fix(docker): respect Railway PORT env var"
```

### Task 4.4 — Smoke test del build local

**Responsable:** CC
**Archivos:** ninguno

- [ ] **Paso 1:** verificar build OK

```bash
cd /Users/apple/Documents/shopify-app/seo-app
npm run build 2>&1 | tail -30
```

Esperado: build sale sin errors, output en `build/`.

- [ ] **Paso 2:** verificar lint

```bash
npm run lint 2>&1 | tail -20
```

Esperado: 0 errors (el `i18n-validation.md` confirma que pasa).

> **Si falla:** detener y reportar al usuario el error exacto. NO continuar al deploy.

---

## 5. Provisionar Railway: app + Postgres

### Task 5.1 — Crear proyecto Railway

**Responsable:** U

- [ ] **Paso 1:** ir a https://railway.com/new
- [ ] **Paso 2:** "Deploy from GitHub repo" → seleccionar `shopify-seo-analyzer`
- [ ] **Paso 3:** autorizar Railway a leer el repo
- [ ] **Paso 4:** Railway detecta el `Dockerfile` y arma el primer build (va a fallar — sin env vars todavía, lo arreglamos en 5.3)

### Task 5.2 — Añadir Postgres managed

- [ ] **Paso 1:** en el proyecto Railway, click "+ New" → "Database" → "Add PostgreSQL"
- [ ] **Paso 2:** Railway crea el servicio Postgres y expone `DATABASE_URL` como var automática del proyecto
- [ ] **Paso 3:** abrir el servicio Postgres → tab "Variables" → copiar `DATABASE_URL` (formato `postgresql://postgres:xxx@xxx.proxy.rlwy.net:xxxx/railway`)

**Pega el DATABASE_URL aquí cuando esté listo (lo necesitamos en 5.3 y 5.4).**

### Task 5.3 — Configurar env vars del servicio app en Railway

**Responsable:** U (pega) + CC (te dicto valores)

En Railway → servicio `seo-app` (el de la app, no Postgres) → tab "Variables" → "Raw Editor":

```
SHOPIFY_API_KEY=<de Partner Dashboard → SEO Analyzer → Client credentials>
SHOPIFY_API_SECRET=<de Partner Dashboard → SEO Analyzer → Client credentials>
SCOPES=read_products,read_content,write_products
SHOPIFY_APP_URL=<temporal, lo actualizamos en §6 con la URL Railway>
DATABASE_URL=${{Postgres.DATABASE_URL}}
BILLING_TEST=false
NODE_ENV=production
```

> **Nota:** `${{Postgres.DATABASE_URL}}` es referencia Railway nativa — auto-resuelve a la URL del Postgres del mismo proyecto. NO pegues la URL plana.

> **`SHOPIFY_APP_URL`:** déjalo en blanco o pon `https://placeholder.up.railway.app` por ahora. Lo actualizamos en §6 con la URL real que Railway asigne.

- [ ] **Paso 1:** copiar credenciales del Partner Dashboard
- [ ] **Paso 2:** pegar todo el bloque en Railway Raw Editor
- [ ] **Paso 3:** "Save" → Railway redeploya automáticamente

### Task 5.4 — Correr migraciones Prisma contra Postgres por primera vez

**Responsable:** CC

Hay dos formas:

**Opción A (recomendada):** el `Dockerfile` ya corre `prisma migrate deploy` en cada start (via `setup` en `docker-start`). El primer deploy lo hará solo si las migraciones existen en el repo.

**Opción B (si Opción A falla):** correr manualmente con CLI Railway:

```bash
# Instalar CLI si no la tienes
npm i -g @railway/cli
railway login
railway link  # selecciona el proyecto
railway run npx prisma migrate deploy
```

- [ ] **Paso 1:** confirmar que la migración Postgres consolidada existe en `prisma/migrations/` (de Task 4.1)
- [ ] **Paso 2:** trigger redeploy en Railway (push a `main` o "Redeploy" desde dashboard)
- [ ] **Paso 3:** ver logs del build/runtime:
  - "Generated Prisma Client"
  - "Applying migration `xxx`"
  - "react-router-serve listening on http://0.0.0.0:3000"

> **Si falla con `P1001` (no puede conectar a DB):** revisar que `DATABASE_URL` esté como referencia `${{Postgres.DATABASE_URL}}` y que el servicio Postgres esté en el mismo proyecto.

---

## 6. Conectar Shopify a la URL Railway

### Task 6.1 — Obtener URL pública del deploy

**Responsable:** U

- [ ] **Paso 1:** en Railway → servicio `seo-app` → tab "Settings" → "Networking" → "Generate Domain"
- [ ] **Paso 2:** Railway asigna `https://seo-app-production-XXXX.up.railway.app`
- [ ] **Paso 3:** abrir esa URL en el browser. Esperado: respuesta de la app (puede ser 404 en `/` que solo tiene `_index/`, pero al menos NO error 502).

**Copia la URL final y pásamela.**

### Task 6.2 — Actualizar `SHOPIFY_APP_URL` en Railway

**Responsable:** U

- [ ] **Paso 1:** Railway → seo-app → Variables → editar `SHOPIFY_APP_URL` = `https://seo-app-production-XXXX.up.railway.app`
- [ ] **Paso 2:** Railway redeploya

### Task 6.3 — Actualizar `shopify.app.toml` y deployar config a Shopify

**Responsable:** CC

**Archivos:** `shopify.app.toml`

- [ ] **Paso 1:** editar `shopify.app.toml`:

```toml
application_url = "https://seo-app-production-XXXX.up.railway.app"

[auth]
redirect_urls = [ "https://seo-app-production-XXXX.up.railway.app/api/auth" ]
```

(Reemplazar `seo-app-production-XXXX` con el real.)

- [ ] **Paso 2:** desplegar config + webhooks a Shopify

```bash
cd /Users/apple/Documents/shopify-app/seo-app
npx shopify app deploy
```

> Requiere estar autenticado con `shopify login`. Si no, U debe abrir el navegador y completar OAuth con su cuenta Partner.

Esperado: CLI sube `shopify.app.toml` + declara los 4 webhooks. Verifica que muestre "Released to Shopify".

- [ ] **Paso 3:** commit

```bash
git add shopify.app.toml
git commit -m "feat(deploy): point app URL to Railway production"
git push
```

---

## 7. Partner Dashboard: Public Distribution + billing

### Task 7.1 — Activar Public Distribution

**Responsable:** U
**Por qué:** sin esto, Billing API responde "Apps without a public distribution cannot use the Billing API". Documentado en `PRODUCTION_NOTES.md` y `CLAUDE.md`.

- [ ] **Paso 1:** ir a https://partners.shopify.com → Apps → SEO Analyzer → Distribution
- [ ] **Paso 2:** click "Distribute through the Shopify App Store"
- [ ] **Paso 3:** completar formulario mínimo (puedes dejar el listing en draft — solo necesitas activar el modo de distribución para liberar la Billing API). NO se publica hoy.

### Task 7.2 — Verificar configuración de App URLs en Partner Dashboard

**Responsable:** U

- [ ] **Paso 1:** Partner Dashboard → SEO Analyzer → Configuration → App URL
- [ ] **Paso 2:** confirmar que reflejan la URL Railway (probablemente `shopify app deploy` ya las sincronizó). Si no:
  - App URL: `https://seo-app-production-XXXX.up.railway.app`
  - Allowed redirection URL(s): `https://seo-app-production-XXXX.up.railway.app/api/auth`

---

## 8. QA end-to-end en dev store fresca

### Task 8.1 — Crear dev store nueva para QA

**Responsable:** U

- [ ] **Paso 1:** Partner Dashboard → Stores → Add store → Development store
- [ ] **Paso 2:** plantilla "Don't add test data" o "Add demo products" (recomendado: con productos para tener datos al analizar)
- [ ] **Paso 3:** anotar el `*.myshopify.com` que asigne

### Task 8.2 — Instalar app en la dev store

**Responsable:** U

- [ ] **Paso 1:** desde Partner Dashboard → Apps → SEO Analyzer → "Test on development store" → seleccionar la dev store nueva
- [ ] **Paso 2:** completar OAuth → instalar app
- [ ] **Paso 3:** la app debe cargar embebida en Admin sin `[object Object]`, sin 500, sin warnings

### Task 8.3 — Checklist de smoke test funcional

**Responsable:** U (operando) + CC (interpretando errores si los hay)

Replicar la lista de `i18n-validation.md` §4 + `CLAUDE.md` checklist:

**Funcionalidad core:**
- [ ] Dashboard `/app` carga con score general + top 5
- [ ] Productos `/app/products` lista productos reales de la dev store
- [ ] Detalle `/app/products/:id` muestra issues correctamente
- [ ] Issues view `/app/issues` agrupa correctamente
- [ ] Re-analizar dispara job background, JobProgress se actualiza
- [ ] Bulk fix (sin upgrade): muestra modal upgrade

**Upgrade flow (BILLING REAL):**
- [ ] Click "Upgrade to Pro" → redirige a Shopify pricing → con dev store los charges son test automáticos
- [ ] Tras aprobar charge → `?upgraded=1` → dashboard actualizado, cache invalidado
- [ ] Bulk fix real funciona en plan Pro
- [ ] Export CSV descarga correctamente

**Webhooks:**
- [ ] Desinstalar app → revisar logs Railway: webhook `app/uninstalled` recibido
- [ ] Reinstalar app → flow OAuth sin errores
- [ ] Cancelar suscripción Pro → webhook `app_subscriptions/update` invalida cache

**i18n:**
- [ ] Todo copy en inglés (sin "Producto", "Mejorar", "Cargando", etc.)

> Si algún paso falla: CC investiga logs Railway (`railway logs` o dashboard) + ajusta. NO declarar deploy "hecho" hasta pasar este checklist.

---

## 9. Dominio custom (.app) — OPCIONAL para hoy

> Recomendado pero NO bloqueante. Puedes vivir con la URL `*.up.railway.app` el día 1 y mover a dominio custom mañana.

### Task 9.1 — Comprar dominio

**Responsable:** U

- [ ] Comprar `seoanalyzer.app` (o el verificado en §1.2) en Porkbun/Cloudflare Registrar (~$18–22/año)
- [ ] Recomendado: comprar 2 (principal + alterno)

### Task 9.2 — Apuntar a Railway

**Responsable:** U

- [ ] Railway → seo-app → Settings → Networking → "Add Custom Domain" → `app.seoanalyzer.app`
- [ ] Copiar el target CNAME que Railway dé
- [ ] En tu DNS (Cloudflare): crear CNAME `app` → `<target Railway>`, proxy OFF (orange cloud gris)
- [ ] Esperar propagación (5–30 min)
- [ ] Railway emite SSL automático (Let's Encrypt)

### Task 9.3 — Re-update Shopify URLs al dominio custom

**Responsable:** CC + U

- [ ] Editar `shopify.app.toml` → cambiar `application_url` y `redirect_urls` al dominio custom
- [ ] `npx shopify app deploy`
- [ ] Actualizar `SHOPIFY_APP_URL` en Railway al dominio custom
- [ ] Re-QA OAuth flow en dev store (URL nueva implica nueva instalación)

---

## 10. Cosas que NO se hacen hoy (siguiente plan)

Para tener claridad:

| Item | Cuándo | Doc |
|---|---|---|
| Privacy Policy + ToS | Día 3 | `launch-strategy.md` §1.2 |
| Landing page Cloudflare Pages | Día 4 | `launch-strategy.md` §1.3 |
| App icon + 5 screenshots | Día 5 | `launch-strategy.md` §1.4 |
| Video demo 45s | Día 6 | `launch-strategy.md` §1.4 |
| Listing assets en Partner Dashboard | Día 7 | `launch-strategy.md` §1.4 |
| Cuentas redes sociales | Día 1 (paralelo) | `launch-strategy.md` §1.5 |
| Email `support@` con Resend + Cloudflare | Día 2 (paralelo) | `launch-strategy.md` §1.1 |
| Envío a Shopify Review | Día 9 | `launch-strategy.md` §8 |

---

## 11. Validación final del deploy (definition of done de HOY)

Marcamos esta fase como completa cuando:

- [ ] Repo `shopify-seo-analyzer` en GitHub con `main` actualizado
- [ ] Railway corriendo el servicio `seo-app` + Postgres, último deploy ✅ verde
- [ ] `https://<url-railway>/app` accesible (sin proxy Shopify → 404, esperado; via Shopify embed → renderiza)
- [ ] Migraciones Postgres aplicadas (`SELECT * FROM "Session";` retorna estructura, vacío OK)
- [ ] `shopify app deploy` ejecutado con éxito (config + webhooks publicados)
- [ ] Partner Dashboard: app en Public Distribution
- [ ] Smoke test §8.3 pasa en al menos: install, dashboard, productos, issues, upgrade flow, webhook uninstall
- [ ] `BILLING_TEST=false` confirmado en Railway env vars
- [ ] Logs sin errors críticos en últimos 30 min

---

## 12. Plan B (si algo falla)

| Síntoma | Probable causa | Fix rápido |
|---|---|---|
| Railway build falla en `npm ci` | Lockfile desync | `rm package-lock.json && npm install` local, commit y push |
| Build OK pero crash al start: `P1001 can't reach DB` | `DATABASE_URL` mal | Verificar var en Railway sea `${{Postgres.DATABASE_URL}}` no string |
| OAuth Shopify: redirect_uri mismatch | `shopify.app.toml` no sincronizado | `npx shopify app deploy` de nuevo |
| `[object Object]` al abrir app | Sesión vieja con scopes obsoletos | `DELETE FROM "Session";` en Postgres (Railway → Postgres → Query) |
| Billing API: "Apps without public distribution..." | Public Distribution no activada | Task 7.1 |
| Webhooks 401 | HMAC mismatch (secret cambió) | Confirmar `SHOPIFY_API_SECRET` en Railway igual al del Partner Dashboard |
| Container crashea con OOM | Free tier Railway low RAM | Subir a plan Hobby $5/mes (ya planeado) |
| `prisma migrate deploy` fails: no migrations folder | Olvidaste regenerar migraciones para Postgres (Task 4.1) | Generar migración consolidada antes de redeployar |

---

## 13. Comunicación durante la ejecución

Mientras trabajamos hoy:

1. **Yo (CC) anuncio cada tarea antes de ejecutarla** — tú confirmas o cambias.
2. **Tú me pegas credenciales/URLs cuando te las pida.** No las pegues antes — orden importa.
3. **No declaro "hecho" sin evidencia.** Cada §11 checkbox necesita output real (log, URL respondiendo, screenshot).
4. **Si algo se ve raro, paro y pregunto.** No improvisamos en deploy.

---

**Listo. Cuando confirmes el plan, arrancamos por §1 (tus pre-requisitos) y §2 (estado del repo) en paralelo.**
