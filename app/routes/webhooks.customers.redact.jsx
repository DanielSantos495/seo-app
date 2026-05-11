import { authenticate } from "../shopify.server";

// GDPR — borrado de datos de un cliente específico.
// Esta app NO almacena datos personales de clientes; nada que borrar.
export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop} — no customer data to redact`);

  return new Response();
};
