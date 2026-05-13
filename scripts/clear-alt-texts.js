/* eslint-env node */
// Script de testing: vacía el alt text de todas las imágenes de los productos
// de una tienda dev para poder probar el bulk fix de la app rápido.
//
// Uso (desde la raíz seo-app/):
//   npm run clear-alts -- <shop>.myshopify.com [opciones]
//
// Opciones:
//   --limit N      procesar solo los primeros N productos
//   --dry-run      no hacer cambios, solo loggear qué haría
//   --only-with-alt   procesar solo productos que ya tienen al menos 1 alt
//
// Requisitos:
//   - La app debe estar instalada en la tienda (necesitamos un access token
//     guardado en la tabla Session de Prisma).
//   - El access token debe tener scope `write_products` (Pro merchants y dev).
//
// Ejemplos:
//   npm run clear-alts -- my-dev-store.myshopify.com
//   npm run clear-alts -- my-dev-store.myshopify.com --limit 20
//   npm run clear-alts -- my-dev-store.myshopify.com --dry-run

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API_VERSION = "2026-04";

// Pequeño delay entre mutations para no quemar el rate limit con tiendas
// grandes. Para dev stores con <500 productos no debería ser un problema.
const THROTTLE_MS = 250;

function parseArgs(argv) {
  const args = argv.slice(2);
  const shop = args.find((a) => !a.startsWith("--"));
  const limitIdx = args.indexOf("--limit");
  const limit =
    limitIdx >= 0 ? Number.parseInt(args[limitIdx + 1], 10) : null;
  const dryRun = args.includes("--dry-run");
  const onlyWithAlt = args.includes("--only-with-alt");
  return { shop, limit: Number.isFinite(limit) ? limit : null, dryRun, onlyWithAlt };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function gql(endpoint, accessToken, query, variables) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get("Retry-After")) || 2;
    console.warn(`  ⚠️  429 — sleeping ${retry}s`);
    await sleep(retry * 1000);
    return gql(endpoint, accessToken, query, variables);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL: ${JSON.stringify(json.errors)}`);
  }
  return json;
}

const GET_PRODUCTS = `#graphql
  query GetProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          media(first: 50) {
            edges {
              node {
                id
                alt
                mediaContentType
              }
            }
          }
        }
      }
    }
  }
`;

const UPDATE_MEDIA = `#graphql
  mutation ProductUpdateMedia($productId: ID!, $media: [UpdateMediaInput!]!) {
    productUpdateMedia(productId: $productId, media: $media) {
      mediaUserErrors { field message }
    }
  }
`;

async function main() {
  const { shop, limit, dryRun, onlyWithAlt } = parseArgs(process.argv);

  if (!shop) {
    console.error(
      "Usage: npm run clear-alts -- <shop>.myshopify.com [--limit N] [--dry-run] [--only-with-alt]",
    );
    process.exit(1);
  }

  const session = await prisma.session.findFirst({
    where: { shop },
    orderBy: { expires: "desc" },
  });
  if (!session) {
    console.error(`No hay sesión guardada para ${shop}. ¿Está instalada la app?`);
    process.exit(1);
  }

  const endpoint = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;
  console.log(
    `${dryRun ? "🔍 DRY RUN — " : ""}Vaciando alt texts en ${shop}` +
      (limit ? ` (max ${limit} productos)` : "") +
      (onlyWithAlt ? " (solo productos con alts)" : "") +
      "\n",
  );

  let cursor = null;
  let hasNext = true;
  let processedProducts = 0;
  let clearedAlts = 0;
  let skippedProducts = 0;

  outer: while (hasNext) {
    const res = await gql(endpoint, session.accessToken, GET_PRODUCTS, { cursor });
    const page = res.data.products;

    for (const edge of page.edges) {
      if (limit && processedProducts >= limit) {
        hasNext = false;
        break outer;
      }
      const product = edge.node;
      processedProducts++;

      const imagesWithAlt = product.media.edges
        .map((e) => e.node)
        .filter(
          (m) =>
            m.mediaContentType === "IMAGE" &&
            typeof m.alt === "string" &&
            m.alt.trim() !== "",
        );

      if (imagesWithAlt.length === 0) {
        if (onlyWithAlt) {
          skippedProducts++;
          continue;
        }
        console.log(`  [skip] ${product.title} — sin alts`);
        skippedProducts++;
        continue;
      }

      console.log(
        `  [${dryRun ? "dry" : "fix"}] ${product.title} — vaciando ${imagesWithAlt.length} alt(s)`,
      );

      if (!dryRun) {
        const result = await gql(endpoint, session.accessToken, UPDATE_MEDIA, {
          productId: product.id,
          media: imagesWithAlt.map((m) => ({ id: m.id, alt: "" })),
        });
        const errors = result.data?.productUpdateMedia?.mediaUserErrors || [];
        if (errors.length > 0) {
          console.error(`    ❌ errores:`, errors);
        } else {
          clearedAlts += imagesWithAlt.length;
        }
        await sleep(THROTTLE_MS);
      } else {
        clearedAlts += imagesWithAlt.length;
      }
    }

    hasNext = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  console.log(
    `\n✅ Listo. ${processedProducts} producto(s) procesado(s), ${skippedProducts} skipeado(s), ${clearedAlts} alt(s) ${dryRun ? "se vaciarían" : "vaciados"}.`,
  );

  if (!dryRun) {
    console.log(
      `\nℹ️  El cache de la app sigue mostrando los alts viejos. Para verlos vaciados:` +
        `\n   1. Abrí la app y dale "Re-analizar ahora", o` +
        `\n   2. Esperá 1h (TTL stale) y entrá a la app — auto-revalida.`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("❌ Error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
