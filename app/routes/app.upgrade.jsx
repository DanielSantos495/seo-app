import { useEffect } from "react";
import { useLoaderData } from "react-router";
import { authenticate, PRO_PLAN } from "../shopify.server";
import { BILLING_IS_TEST } from "../services/billing";

// El loader intercepta el redirect que lanza `billing.request` y captura la
// URL de confirmación, devolviéndola al componente en lugar de redirigir
// inmediatamente. Esto nos deja renderizar una pantalla intermedia con
// spinner antes de mandar al merchant a la pasarela de Shopify — en vez de
// pantalla blanca durante 1-2 s.
//
// Nota sobre target="_top": como el botón fuerza navegación top-level, la
// página que servimos acá ocupa toda la ventana (no iframe). El redirect
// client-side ocurre desde esa misma ventana.
export const loader = async ({ request }) => {
  const { billing } = await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  const returnUrl = `${process.env.SHOPIFY_APP_URL}/app?upgraded=1`;

  try {
    await billing.request({
      plan: PRO_PLAN,
      isTest: BILLING_IS_TEST,
      returnUrl,
    });
  } catch (response) {
    // El SDK lanza un Response 302 con Location apuntando a la pasarela.
    if (response instanceof Response && response.status >= 300 && response.status < 400) {
      const confirmationUrl = response.headers.get("Location");
      if (confirmationUrl) {
        return { confirmationUrl };
      }
    }
    throw response;
  }

  // Si billing.request no lanzó (caso raro: ya hay subscripción activa),
  // volvemos al dashboard.
  return { confirmationUrl: "/app?upgraded=1" };
};

export default function Upgrade() {
  const { confirmationUrl } = useLoaderData();

  useEffect(() => {
    if (!confirmationUrl) return;
    // Pequeño delay para que el usuario alcance a ver el mensaje antes del
    // redirect. La pasarela de Shopify suele tardar 1-2s en cargar — sin
    // esto, el merchant solo ve pantalla blanca.
    const timer = setTimeout(() => {
      window.location.href = confirmationUrl;
    }, 250);
    return () => clearTimeout(timer);
  }, [confirmationUrl]);

  return (
    <s-page heading="Redirecting to Shopify">
      <s-section>
        <s-stack direction="block" gap="base" alignment="center">
          <s-spinner />
          <s-heading>Taking you to the Shopify payment page…</s-heading>
          <s-paragraph tone="subdued">
            You'll approve the charge on Shopify's official page. If you're
            not redirected in a few seconds,{" "}
            <s-link href={confirmationUrl}>click here</s-link>.
          </s-paragraph>
        </s-stack>
      </s-section>
    </s-page>
  );
}
