import { PRO_PLAN } from "../shopify.server";
import { getCachedPlan, setCachedPlan } from "./plan-cache";

// En dev queremos que `billing.request`/`check` funcionen sin cobrar realmente.
// En producción se debe poner BILLING_TEST=false en las env vars del host.
// eslint-disable-next-line no-undef
export const BILLING_IS_TEST = process.env.BILLING_TEST !== "false";

// Devuelve true si la tienda tiene una suscripción activa al plan Pro.
// Memoiza en proceso (ver plan-cache.js) y deja que el webhook
// `app_subscriptions/update` invalide la entrada cuando cambia el plan.
// Si la API falla (ej. permisos), tratamos a la tienda como Free.
export async function checkIsPro(billing, shop) {
  if (shop) {
    const cached = getCachedPlan(shop);
    if (cached !== null) return cached;
  }
  try {
    const result = await billing.check({
      plans: [PRO_PLAN],
      isTest: BILLING_IS_TEST,
    });
    const isPro = result.hasActivePayment;
    if (shop) setCachedPlan(shop, isPro);
    return isPro;
  } catch {
    if (shop) setCachedPlan(shop, false);
    return false;
  }
}
