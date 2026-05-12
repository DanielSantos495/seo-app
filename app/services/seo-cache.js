import prisma from "../db.server";
import { analyzeProduct, FREE_PLAN_PRODUCT_LIMIT } from "./seo-analyzer";

// TTL del cache de análisis SEO. Pasado este tiempo, el loader vuelve
// a llamar a la Admin API. Ajustar si los merchants editan productos
// muy seguido.
export const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

// Devuelve los items cacheados si existen y están frescos. Si no, null.
export async function getCachedItems(shop) {
  const row = await prisma.seoCache.findUnique({ where: { shop } });
  if (!row) return null;

  const age = Date.now() - row.updatedAt.getTime();
  if (age > CACHE_TTL_MS) return null;

  const parsed = JSON.parse(row.data);
  return { items: parsed.items, analyzedAt: row.updatedAt };
}

export async function setCachedItems(shop, items) {
  const data = JSON.stringify({ items });
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
// del cache. Aplica el límite del plan free: solo los primeros N reciben
// análisis completo; los demás quedan como `locked: true`.
export function buildItemsFromProducts(products) {
  return products.map((product, index) => {
    const base = {
      productId: product.id,
      title: product.title,
      handle: product.handle,
      thumbnailUrl: product.images?.[0]?.url || null,
      thumbnailAlt: product.images?.[0]?.altText || product.title,
    };
    if (index < FREE_PLAN_PRODUCT_LIMIT) {
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
