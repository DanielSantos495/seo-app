# Deploy Walkthrough — bitácora del §4 del runbook

> Documento educativo. Por cada cambio explico **qué**, **por qué** y **cómo verificar**.
> Va creciendo conforme avanzamos. Acompaña al `deploy-plan.md` (que es el plan estático); aquí queda el rastro de la ejecución real.

---

## §4 — ¿Por qué hay que tocar código antes de deployar?

El MVP se desarrolló asumiendo el entorno local (Shopify CLI + túnel Cloudflare + SQLite). Para Railway production hay 3 brechas que el código actual NO cubre:

1. **Base de datos.** Prisma está configurado para SQLite (`provider = "sqlite"`, `url = "file:dev.sqlite"`). Railway tiene filesystem efímero — un archivo SQLite se perdería en cada redeploy. Hay que cambiar a **PostgreSQL** y leer la URL desde una env var (`DATABASE_URL`).

2. **Variables de entorno.** En dev la CLI inyecta `SHOPIFY_API_KEY`, `SHOPIFY_APP_URL` y demás automáticamente. En Railway tenemos que setearlas a mano. Necesitamos un `.env.example` que documente las requeridas para que sea trivial replicar el setup.

3. **Puerto.** Railway asigna el puerto vía env var `PORT` (dinámico, no siempre 3000). El Dockerfile actual expone `3000` fijo. Si `react-router-serve` no lo respeta solo, hay que pasarlo explícito.

Sin estos 3 cambios el container va a:
- Iniciar OK pero perder datos al primer redeploy (SQLite efímero)
- Fallar el OAuth porque `SHOPIFY_APP_URL` apunta a `localhost`
- Quedar inalcanzable si Railway intenta proxiar a un puerto distinto

---

## Task 4.1 — Cambiar Prisma a PostgreSQL

### ¿Qué cambia?

Dos cosas en `prisma/schema.prisma`:

```diff
 datasource db {
-  provider = "sqlite"
-  url      = "file:dev.sqlite"
+  provider = "postgresql"
+  url      = env("DATABASE_URL")
 }
```

- `provider = "postgresql"` → Prisma genera SQL compatible con Postgres (tipos `TEXT`, `TIMESTAMP`, `JSONB` opcional, etc.).
- `url = env("DATABASE_URL")` → en lugar de hardcodear, Prisma lee la URL en runtime. Railway nos da `${{Postgres.DATABASE_URL}}` que apunta al Postgres managed del mismo proyecto.

### ¿Y las migraciones existentes?

Acá viene el punto delicado. Tenemos 4 carpetas en `prisma/migrations/`:

- `20240530213853_create_session_table`
- `20260511172525_add_seo_cache`
- `20260513164900_add_seo_job`
- `20260513173631_add_session_shop_index`

Estas migraciones contienen SQL específico de SQLite. Por ejemplo: SQLite usa `INTEGER PRIMARY KEY AUTOINCREMENT`, Postgres usa `SERIAL` o `BIGSERIAL`. Si intentamos correr `prisma migrate deploy` contra Postgres con esos archivos, va a fallar con errores de sintaxis.

Hay dos estrategias razonables:

**Estrategia A — Migraciones consolidadas para Postgres (recomendada):**
1. Mover las migraciones SQLite a `prisma/migrations.sqlite.bak/` (backup local, no se sube).
2. Cambiar el provider a postgresql.
3. Cuando tengamos `DATABASE_URL` (de Railway), correr `npx prisma migrate dev --name init` apuntando a esa DB. Esto genera UNA migración inicial limpia con todo el schema actual ya como Postgres SQL.

   - Ventaja: schema limpio, una sola migración, fácil de leer.
   - Desventaja: pierdes la historia granular de cambios (pero los commits de git la conservan igual).

**Estrategia B — Mantener historia y regenerar cada migración:**
1. Por cada migración SQLite, regenerarla manualmente con `prisma migrate diff` para que use sintaxis Postgres.
2. Más trabajo y mayor riesgo de errores.

> **Recomendación:** Estrategia A. Para una app nueva sin DB en producción aún, no aporta nada conservar 4 migraciones SQLite huérfanas.

### ¿Cuándo se genera la migración inicial Postgres?

**Decisión tomada:** generamos la migración inicial **cuando Railway+Postgres estén provisionados** (§5 del runbook). No usamos Postgres local para evitar setup extra.

### Plan de ejecución de Task 4.1 (lo que voy a hacer AHORA)

1. **Backup local de migraciones SQLite** → mover `prisma/migrations/` a `prisma/migrations.sqlite.bak/` (queda en disco pero fuera del repo).
2. **Añadir el backup al `.gitignore`** para que git lo ignore.
3. **`git rm -r prisma/migrations/`** → quitar el directorio del repo (la historia git las conserva, no se pierden).
4. **Editar `prisma/schema.prisma`** → `provider = "postgresql"` y `url = env("DATABASE_URL")`.
5. **Commit** con mensaje claro: el schema queda listo para Postgres, falta migración inicial (se genera en §5 contra Railway).

### Lo que NO hago ahora (queda para §5 con Railway)

- `npx prisma migrate dev --name init` (necesita DATABASE_URL real)
- `npx prisma generate` (Railway lo correrá en cada build via `npm run setup` en Dockerfile)
- Test de conexión a Postgres

### Verificación al final de la task

```bash
# 1. Schema actualizado
grep provider /Users/apple/Documents/shopify-app/seo-app/prisma/schema.prisma
# → provider = "postgresql"

# 2. Migración inicial generada
ls prisma/migrations/
# → solo una carpeta nueva tipo: 20260521xxxx_init/

# 3. Cliente regenerado
ls node_modules/@prisma/client/
# → debe existir y tener tipos actualizados
```

---

---

## Task 4.2 — Expandir `.env.example`

### ¿Qué cambia?

El `.env.example` actual solo tiene `BILLING_TEST = true`. Lo reemplazamos por el bloque completo de variables que la app necesita en Railway.

### ¿Por qué importa `.env.example`?

Tres razones:

1. **Documentación viva.** Cualquiera que clone el repo ve EXACTAMENTE qué variables hay que setear. Sin esto, leer el código fuente para descubrir cada `process.env.X` es tedioso.
2. **Auditoría.** En el deploy a Railway pegamos las variables; tener el listado evita olvidos (`BILLING_TEST` olvidado = no se cobra en prod).
3. **Onboarding futuro.** Si llega un colaborador o vuelves al proyecto en 6 meses, sirve como contrato.

### Variables que vamos a documentar

| Variable | Origen | Ejemplo prod | Crítica |
|---|---|---|---|
| `SHOPIFY_API_KEY` | Partner Dashboard → App → Client credentials | `bbd179e9...` | Sí (auth) |
| `SHOPIFY_API_SECRET` | Partner Dashboard → App → Client credentials | (secret) | Sí (auth + HMAC webhooks) |
| `SCOPES` | `shopify.app.toml` | `read_products,read_content,write_products` | Sí |
| `SHOPIFY_APP_URL` | URL pública Railway | `https://seo-app-production-xxx.up.railway.app` | Sí (OAuth + billing returnUrl) |
| `DATABASE_URL` | Railway → Postgres → Variables | `postgresql://postgres:xxx@xxx.proxy.rlwy.net:xxxx/railway` | Sí |
| `BILLING_TEST` | Manual | `false` en prod, `true` en dev | Sí (sin `false` no se cobra) |
| `NODE_ENV` | Manual | `production` | Sí |
| `PORT` | Railway auto-inject | `3000` (default) | Solo si custom |

### Convención del archivo

- Valores que el usuario DEBE rellenar → quedan vacíos (`SHOPIFY_API_KEY=`).
- Valores con default razonable → se ponen (`SCOPES=read_products,...`, `BILLING_TEST=false`).
- Comentarios `#` antes de bloques explican el origen.
- **JAMÁS** valores reales (secretos): solo placeholders.

### Verificación

```bash
cat .env.example
# debe mostrar todas las variables listadas arriba, sin valores reales
```

---

## Task 4.3 — Validar `Dockerfile` respeta el `PORT` de Railway

### ¿Qué problema podría haber?

Railway asigna el puerto a través de la env var `$PORT`. Si la app escucha en puerto fijo (3000) y Railway intenta proxiar al puerto que asignó (típicamente uno random alto), el health-check falla y el deploy se marca como crashed.

`react-router-serve` (de `@react-router/serve`) lee `PORT` por default si está definido. Lo verificamos antes de tocar nada.

### Verificación

Inspeccionar el CLI de `react-router-serve` para confirmar que respeta `process.env.PORT`. Si lo hace, el Dockerfile actual está bien. Si no, ajustar `CMD` para pasarlo explícito.

---

## Task 4.4 — Smoke test local

### ¿Por qué hacerlo antes del deploy?

Si `npm run build` o `npm run lint` rompen localmente, en Railway también van a romper. Vale más detectarlo aquí en 30 segundos que esperar 5 minutos al build remoto.

### Comandos

```bash
npm run build   # debe terminar sin errors
npm run lint    # debe terminar 0 errors
```

Si algo falla → paramos y arreglamos antes de pasar al §5.

---

*Bitácora viva. Se actualiza al ejecutar cada task.*
