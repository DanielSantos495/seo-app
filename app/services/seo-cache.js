import prisma from "../db.server";
import {
  aggregateAnalyses,
  analyzeProduct,
  FREE_PLAN_PRODUCT_LIMIT,
} from "./seo-analyzer";

// Edad a partir de la cual consideramos el cache "stale" (servimos igual,
// pero el loader dispara revalidación en background).
export const CACHE_STALE_AFTER_MS = 60 * 60 * 1000; // 1 hora

const TOP_WORST = 5;

// Computa los derivados que los loaders necesitan una sola vez al guardar.
// Antes, cada navegación re-computaba aggregate + worstProducts + eligibleGids
// sobre el catálogo completo (10k items → 50-200 ms síncronos por request).
// Ahora los guardamos pre-procesados.
function computeDerivatives(items) {
  const unlocked = items.filter((i) => !i.locked);

  // Summary: overallScore + totalProducts + issuesByImpact.
  const summary = (() => {
    const agg = aggregateAnalyses(unlocked);
    return {
      overallScore: agg.overallScore,
      totalProducts: agg.totalProducts,
      issuesByImpact: agg.issuesByImpact,
    };
  })();

  // Top N peores productos (score < 100), shape liviano para el dashboard.
  const worstProducts = [...unlocked]
    .filter((p) => (p.score ?? 100) < 100)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, TOP_WORST)
    .map((p) => ({
      productId: p.productId,
      title: p.title,
      score: p.score,
      issues: p.issues.map((i) => ({ message: i.message })),
    }));

  // GIDs con alt text faltante — para el botón de bulk fix.
  const eligibleAltGids = unlocked
    .filter((i) =>
      i.issues?.some((iss) => iss.field === "images.altText"),
    )
    .map((i) => i.productId);

  return { summary, worstProducts, eligibleAltGids };
}

// Lee la fila cruda. Si no hay derivados (cache viejo), los computa al vuelo
// para mantener retro-compatibilidad. Si están, los devuelve directo.
function parseCacheRow(row) {
  const parsed = JSON.parse(row.data);
  if (!parsed.summary || !parsed.worstProducts || !parsed.eligibleAltGids) {
    const derived = computeDerivatives(parsed.items || []);
    return { ...parsed, ...derived };
  }
  return parsed;
}

// Devuelve siempre los items cacheados si existen y corresponden al plan
// actual, junto con `isStale` y derivados pre-computados.
export async function getCachedItems(shop, currentPlan) {
  const row = await prisma.seoCache.findUnique({ where: { shop } });
  if (!row) return null;

  const parsed = parseCacheRow(row);
  if (parsed.plan !== currentPlan) return null;

  const age = Date.now() - row.updatedAt.getTime();
  return {
    items: parsed.items,
    summary: parsed.summary,
    worstProducts: parsed.worstProducts,
    eligibleAltGids: parsed.eligibleAltGids,
    analyzedAt: row.updatedAt,
    isStale: age > CACHE_STALE_AFTER_MS,
  };
}

export async function setCachedItems(shop, items, plan) {
  const derived = computeDerivatives(items);
  const data = JSON.stringify({ plan, items, ...derived });
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
// productId está en `productIds`, recomputa derivados y persiste. Útil tras
// un fix individual o bulk: no invalida todo el catálogo.
export async function updateCachedItems(shop, productIds, mutator) {
  const row = await prisma.seoCache.findUnique({ where: { shop } });
  if (!row) return false;

  const parsed = parseCacheRow(row);
  const ids = new Set(productIds);
  let changed = false;
  parsed.items = parsed.items.map((item) => {
    if (!ids.has(item.productId)) return item;
    const updated = mutator(item);
    changed = changed || updated !== item;
    return updated;
  });

  if (!changed) return false;

  // Recompute derivados con los items mutados.
  const derived = computeDerivatives(parsed.items);
  parsed.summary = derived.summary;
  parsed.worstProducts = derived.worstProducts;
  parsed.eligibleAltGids = derived.eligibleAltGids;

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
