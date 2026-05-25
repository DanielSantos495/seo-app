import { authenticate } from "../shopify.server";
import { getCachedItems } from "../services/seo-cache";
import { buildCsv } from "../services/csv-export";

// Resource route: genera el CSV del reporte SEO desde el cache server-side y
// lo devuelve como descarga. El catálogo nunca viaja al cliente — el botón
// abre esta URL y descarga directo.
//
// Acceso vía `fetch("/api/export.csv")` desde el cliente — App Bridge
// adjunta el session token automáticamente.
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const cached = await getCachedItems(session.shop);
  if (!cached) {
    return new Response("Cache unavailable. Reload the app.", { status: 404 });
  }

  const csv = buildCsv(cached.items);
  const shopHandle = session.shop.replace(/\.myshopify\.com$/, "");
  const filename = `seo-report-${shopHandle}-${new Date().toISOString().slice(0, 10)}.csv`;

  // BOM U+FEFF para que Excel detecte UTF-8 (acentos, ñ).
  const body = "﻿" + csv;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
};
