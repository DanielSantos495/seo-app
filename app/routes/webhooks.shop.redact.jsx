import { authenticate } from "../shopify.server";
import db from "../db.server";

// GDPR — la tienda desinstaló la app y han pasado 48h.
// Debemos borrar TODO lo que guardamos asociado a esa tienda.
export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop} — wiping shop data`);

  await db.seoCache.deleteMany({ where: { shop } });
  await db.session.deleteMany({ where: { shop } });

  return new Response();
};
