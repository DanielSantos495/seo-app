import { authenticate } from "../shopify.server";
import { previewAltTextsForProducts } from "../services/shopify-api";
import { getCachedItems } from "../services/seo-cache";
import { checkIsPro } from "../services/billing";

// Resource route: devuelve 3 muestras de alt text generados para el modal
// de bulk fix. Se llama on-demand desde el cliente cuando el merchant abre
// el modal — no en cada loader como antes.
//
// Antes, cada navegación a /app/products o /app/issues ejecutaba este
// preview aunque el usuario nunca abriera el modal: 3 round-trips inútiles
// a la Admin API (≈600–1500 ms). Ahora corre solo cuando hace falta.
//
// Llamado vía `useFetcher().load("/api/bulk-preview")` desde el cliente.
export const loader = async ({ request }) => {
  const { admin, session, billing } = await authenticate.admin(request);

  const isPro = await checkIsPro(billing, session.shop);
  const currentPlan = isPro ? "pro" : "free";

  // Leemos los GIDs elegibles del cache (no re-analizamos).
  const cached = await getCachedItems(session.shop, currentPlan);
  if (!cached) {
    return { samples: [] };
  }

  const eligibleGids = cached.items
    .filter(
      (i) =>
        !i.locked &&
        i.issues?.some((iss) => iss.field === "images.altText"),
    )
    .map((i) => i.productId)
    .slice(0, 50);

  if (eligibleGids.length === 0) {
    return { samples: [] };
  }

  const samples = await previewAltTextsForProducts(admin, eligibleGids, {
    limit: 3,
  });

  return { samples };
};
