import {
  Outlet,
  useLoaderData,
  useLocation,
  useNavigation,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { checkIsPro } from "../services/billing";
import { FREE_PLAN_PRODUCT_LIMIT } from "../services/seo-analyzer";
import { NavLink } from "../components/NavLink";
import { RouteSkeleton } from "../components/RouteSkeleton";

// El layout autentica una sola vez y resuelve `isPro` (memoizado en
// plan-cache). Los hijos consumen estos valores con `useRouteLoaderData
// ("routes/app")` y NO vuelven a llamar a `checkIsPro` ni a `authenticate`.
// Resultado: cada cambio de tab evita 1-2 round-trips a Shopify.
export const loader = async ({ request }) => {
  const { session, billing } = await authenticate.admin(request);
  const isPro = await checkIsPro(billing, session.shop);

  return {
    // eslint-disable-next-line no-undef
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop,
    shopHandle: session.shop.replace(/\.myshopify\.com$/, ""),
    isPro,
    planLimit: FREE_PLAN_PRODUCT_LIMIT,
  };
};

export default function App() {
  const { apiKey } = useLoaderData();
  const navigation = useNavigation();
  const location = useLocation();

  // Si estamos navegando a OTRA ruta, pintamos el skeleton del destino en
  // lugar del contenido viejo. Esto convierte "pantalla congelada" en
  // "navegación percibida instantánea". `navigation.location` solo está
  // poblado mientras hay una transición en curso.
  const isNavigatingAway =
    navigation.state === "loading" &&
    navigation.location &&
    navigation.location.pathname !== location.pathname;

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <NavLink to="/app">Dashboard</NavLink>
        <NavLink to="/app/products">Productos</NavLink>
        <NavLink to="/app/issues">Issues</NavLink>
      </s-app-nav>
      {isNavigatingAway ? (
        <RouteSkeleton path={navigation.location.pathname} />
      ) : (
        <Outlet />
      )}
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
