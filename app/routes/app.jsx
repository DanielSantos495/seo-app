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
import { getPlan } from "../services/plan";
import { NavLink } from "../components/NavLink";
import { RouteSkeleton } from "../components/RouteSkeleton";

// El layout autentica una sola vez, resuelve el plan del merchant (Managed
// Pricing) y expone esos datos al árbol de rutas vía loader data.
export const loader = async ({ request }) => {
  const { session, billing } = await authenticate.admin(request);
  const plan = await getPlan(billing);

  return {
    // eslint-disable-next-line no-undef
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop,
    shopHandle: session.shop.replace(/\.myshopify\.com$/, ""),
    plan,
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
        <NavLink to="/app/products">Products</NavLink>
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

// Detecta un fallo de red (no un error HTTP del servidor). App Bridge no pudo
// completar el fetch del loader: típico tras suspender el equipo o perder la
// conexión y volver. No trae `status` (no es una Response 4xx/5xx). El mensaje
// varía por navegador (Chrome "Failed to fetch", Firefox "NetworkError…",
// Safari "Load failed"), por eso cubrimos el tipo y varios patrones.
function isNetworkError(error) {
  if (!error || typeof error.status === "number") return false;
  if (error instanceof TypeError) return true;
  return /failed to fetch|networkerror|load failed|network request failed/i.test(
    String(error.message || ""),
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError();

  // Conexión caída: mensaje accionable en vez del fallback crudo del SDK.
  if (isNetworkError(error)) {
    return (
      <s-page heading="Connection lost">
        <s-section>
          <s-banner tone="warning" heading="Couldn't reach the app">
            <s-paragraph>
              Your connection dropped — this can happen after your computer
              went to sleep or the network briefly disconnected. Reload the
              page to continue.
            </s-paragraph>
            <s-button
              slot="primaryAction"
              onClick={() => window.location.reload()}
            >
              Reload
            </s-button>
          </s-banner>
        </s-section>
      </s-page>
    );
  }

  // Fallback legible cuando el `boundary.error` del SDK no logra renderizar
  // el error (típico cuando la sesión tiene scopes viejos → 403 al validar).
  if (error?.status === 403) {
    return (
      <s-page heading="Reinstall required">
        <s-section>
          <s-banner tone="critical" heading="Session expired">
            <s-paragraph>
              This app&apos;s permissions changed. Reinstall to continue.
            </s-paragraph>
            <s-paragraph>
              In your store admin, go to Settings → Apps, uninstall this app,
              then open it again from the listing to accept the new
              permissions.
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
