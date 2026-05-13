/* eslint-disable react/prop-types */
import { useFetcher } from "react-router";

// Hook que devuelve handlers de mouse/focus para prefetch del loader destino.
// `<x onMouseEnter={...} onFocus={...} />`. Idempotente: si ya cargamos la
// ruta, no la volvemos a pedir.
//
// Al hacer click, react-router ya tiene la data en memoria y la navegación
// se siente instantánea (<150 ms vs 800–1500 ms sin prefetch).
export function usePrefetchHandlers(to) {
  const fetcher = useFetcher();
  const prefetch = () => {
    if (fetcher.state === "idle" && !fetcher.data) {
      fetcher.load(to);
    }
  };
  return { onMouseEnter: prefetch, onFocus: prefetch };
}

// Link envuelto en `<s-link>` (estilo Polaris dentro de `<s-app-nav>`) con
// prefetch on hover/focus.
export function NavLink({ to, children, ...rest }) {
  const handlers = usePrefetchHandlers(to);
  return (
    <s-link href={to} {...handlers} {...rest}>
      {children}
    </s-link>
  );
}

// Variante `<s-clickable>` con prefetch. Útil para cards de navegación.
export function PrefetchClickable({ to, children, ...rest }) {
  const handlers = usePrefetchHandlers(to);
  return (
    <s-clickable href={to} {...handlers} {...rest}>
      {children}
    </s-clickable>
  );
}

// Variante `<s-button>` con href y prefetch. Útil para CTAs principales tipo
// "Ver todos los productos".
export function PrefetchButton({ to, children, ...rest }) {
  const handlers = usePrefetchHandlers(to);
  return (
    <s-button href={to} {...handlers} {...rest}>
      {children}
    </s-button>
  );
}
