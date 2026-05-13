import { authenticate } from "../shopify.server";
import db from "../db.server";
import { invalidatePlanCache } from "../services/plan-cache";

// Webhook que dispara Shopify cuando cambia el estado de la suscripción
// (activación tras pago, cancelación, fin de trial, etc.). Invalidamos el cache
// inmediatamente para que el siguiente loader detecte el nuevo plan sin
// esperar al TTL de 1h.
export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  invalidatePlanCache(shop);
  await db.seoCache.deleteMany({ where: { shop } });

  return new Response();
};
