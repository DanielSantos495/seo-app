// Cache en memoria del flag `isPro` por shop, con TTL corto.
//
// Antes, cada loader llamaba `billing.check()` (HTTP round-trip a Shopify) y
// eso costaba ~150–400 ms en cada cambio de tab. Como el plan rara vez cambia,
// memoizamos durante PLAN_CACHE_TTL_MS y dejamos que el webhook
// `app_subscriptions/update` invalide la entrada cuando hay un cambio real.
//
// Trade-off conocido: este cache vive en el proceso. Si Railway escala a
// múltiples instancias, cada una tiene su propio Map. El TTL de 10 min limita
// la divergencia y el webhook (broadcast) invalida en todas las instancias
// dentro de pocos segundos. Aceptable para v1.

const PLAN_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

const store = new Map(); // shop -> { isPro: boolean, expiresAt: number }

export function getCachedPlan(shop) {
  const entry = store.get(shop);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(shop);
    return null;
  }
  return entry.isPro;
}

export function setCachedPlan(shop, isPro) {
  store.set(shop, {
    isPro,
    expiresAt: Date.now() + PLAN_CACHE_TTL_MS,
  });
}

export function invalidatePlanCache(shop) {
  store.delete(shop);
}
