import prisma from "../db.server";
import { analyzeProduct, FREE_PLAN_PRODUCT_LIMIT } from "./seo-analyzer";

// TTL del cache de análisis SEO. Pasado este tiempo, el loader vuelve
// a llamar a la Admin API. Ajustar si los merchants editan productos
// muy seguido.
export const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

// Devuelve los items cacheados si existen, están frescos y corresponden al
// plan actual. Si no, null. Pasar `currentPlan` ("free" | "pro") evita servir
// cache stale tras un upgrade/downgrade.
export async function getCachedItems(shop, currentPlan) {
  const row = await prisma.seoCache.findUnique({ where: { shop } });
  if (!row) return null;

  const age = Date.now() - row.updatedAt.getTime();
  if (age > CACHE_TTL_MS) return null;

  const parsed = JSON.parse(row.data);
  if (parsed.plan !== currentPlan) return null;

  return { items: parsed.items, analyzedAt: row.updatedAt };
}

export async function setCachedItems(shop, items, plan) {
  const data = JSON.stringify({ plan, items });
  await prisma.seoCache.upsert({
    where: { shop },
    update: { data },
    create: { shop, data },
  });
}

export async function invalidateCache(shop) {
  await prisma.seoCache.deleteMany({ where: { shop } });
}

// Convierte productos crudos (de fetchAllProducts) en items canónicos
// del cache. Aplica un límite: los primeros N reciben análisis completo;
// los demás quedan como `locked: true`. Pasar `limit: null` (o Infinity) para
// analizar todos — caso plan Pro.
export function buildItemsFromProducts(
  products,
  { limit = FREE_PLAN_PRODUCT_LIMIT } = {},
) {
  const effectiveLimit = limit ?? Infinity;
  return products.map((product, index) => {
    const base = {
      productId: product.id,
      title: product.title,
      handle: product.handle,
      thumbnailUrl: product.images?.[0]?.url || null,
      thumbnailAlt: product.images?.[0]?.altText || product.title,
    };
    if (index < effectiveLimit) {
      const analysis = analyzeProduct(product);
      return {
        ...base,
        score: analysis.score,
        issues: analysis.issues,
        locked: false,
      };
    }
    return { ...base, score: null, issues: [], locked: true };
  });
}
