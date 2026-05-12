import { authenticate, PRO_PLAN } from "../shopify.server";
import { BILLING_IS_TEST } from "../services/billing";

// Disparamos `billing.request()` desde el loader (no action) para evitar el bug
// de single-fetch en React Router 7: cuando se invoca desde un POST, el redirect
// que billing.request emite se trunca a 401. Con full-page GET el 302 viaja
// normalmente. Ver issue Shopify/shopify-app-js#1976.
export const loader = async ({ request }) => {
  const { billing } = await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  const returnUrl = `${process.env.SHOPIFY_APP_URL}/app?upgraded=1`;

  await billing.request({
    plan: PRO_PLAN,
    isTest: BILLING_IS_TEST,
    returnUrl,
  });

  // billing.request lanza redirect; defensivo.
  return null;
};
