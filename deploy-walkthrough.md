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

*Las tasks 4.2, 4.3 y 4.4 se documentan a continuación a medida que las ejecutamos.*
