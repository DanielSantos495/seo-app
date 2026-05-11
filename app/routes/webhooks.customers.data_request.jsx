import { authenticate } from "../shopify.server";

// GDPR — solicitud de datos de un cliente.
// Esta app NO almacena datos personales de clientes (solo cache SEO por tienda).
// Respondemos 200 vacío para cumplir con la política de Shopify.
export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop} — no customer data stored`);

  return new Response();
};
