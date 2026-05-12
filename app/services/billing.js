import { PRO_PLAN } from "../shopify.server";

// En dev queremos que `billing.request`/`check` funcionen sin cobrar realmente.
// En producción se debe poner BILLING_TEST=false en las env vars del host.
// eslint-disable-next-line no-undef
export const BILLING_IS_TEST = process.env.BILLING_TEST !== "false";

// Devuelve true si la tienda tiene una suscripción activa al plan Pro.
// Si la API falla (ej. permisos), tratamos a la tienda como Free.
export async function checkIsPro(billing) {
  try {
    const result = await billing.check({
      plans: [PRO_PLAN],
      isTest: BILLING_IS_TEST,
    });
    return result.hasActivePayment;
  } catch {
    return false;
  }
}
