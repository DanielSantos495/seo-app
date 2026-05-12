import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Dashboard</s-link>
        <s-link href="/app/products">Productos</s-link>
        <s-link href="/app/issues">Issues</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError();

  // Fallback legible cuando el `boundary.error` del SDK no logra renderizar
  // el error (típico cuando la sesión tiene scopes viejos → 403 al validar).
  if (error?.status === 403) {
    return (
      <s-page heading="Reinstalación requerida">
        <s-section>
          <s-banner tone="critical" heading="Sesión inválida">
            <s-paragraph>
              Los permisos de la app cambiaron. Necesitamos que reinstales
              la app para seguir.
            </s-paragraph>
            <s-paragraph>
              Andá al admin de tu tienda → Settings → Apps → desinstalá esta
              app y volvé a abrirla desde el listado para aceptar los
              permisos nuevos.
            </s-paragraph>
          </s-banner>
        </s-section>
      </s-page>
    );
  }

  return boundary.error(error);
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
