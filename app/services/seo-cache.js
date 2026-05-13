import prisma from "../db.server";
import { analyzeProduct, FREE_PLAN_PRODUCT_LIMIT } from "./seo-analyzer";

// Edad a partir de la cual consideramos el cache "stale" (servimos igual,
// pero el loader dispara revalidación en background). Antes este TTL era
// "todo o nada" y forzaba al loader a esperar al refetch; ahora siempre
// servimos data si existe.
export const CACHE_STALE_AFTER_MS = 60 * 60 * 1000; // 1 hora

// Devuelve siempre los items cacheados si existen y corresponden al plan
// actual, junto con `isStale` para que el loader decida si dispara una
// revalidación en background. Pasar `currentPlan` ("free" | "pro") evita
// servir cache stale tras un upgrade/downgrade.
export async function getCachedItems(shop, currentPlan) {
  const row = await prisma.seoCache.findUnique({ where: { shop } });
  if (!row) return null;

  const parsed = JSON.parse(row.data);
  if (parsed.plan !== currentPlan) return null;

  const age = Date.now() - row.updatedAt.getTime();
  return {
    items: parsed.items,
    analyzedAt: row.updatedAt,
    isStale: age > CACHE_STALE_AFTER_MS,
  };
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

// Actualización granular: aplica `mutator(item)` solo a los items cuyo
// productId está en `productIds`, reescribe el cache y deja el resto intacto.
// Útil tras un fix individual o bulk: ya no hace falta invalidar todo el
// catálogo y forzar un re-fetch completo en la próxima navegación.
export async function updateCachedItems(shop, productIds, mutator) {
  const row = await prisma.seoCache.findUnique({ where: { shop } });
  if (!row) return false;

  const parsed = JSON.parse(row.data);
  const ids = new Set(productIds);
  let changed = false;
  parsed.items = parsed.items.map((item) => {
    if (!ids.has(item.productId)) return item;
    const updated = mutator(item);
    changed = changed || updated !== item;
    return updated;
  });

  if (!changed) return false;

  await prisma.seoCache.update({
    where: { shop },
    data: { data: JSON.stringify(parsed) },
  });
  return true;
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
