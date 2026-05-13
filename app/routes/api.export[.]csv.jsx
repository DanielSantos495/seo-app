import { authenticate } from "../shopify.server";
import { getCachedItems } from "../services/seo-cache";
import { checkIsPro } from "../services/billing";
import { buildCsv } from "../services/csv-export";

// Resource route: genera el CSV del reporte SEO desde el cache server-side y
// lo devuelve como descarga. Antes, el loader del dashboard serializaba el
// catálogo completo (puede ser MBs para tiendas Pro grandes) SOLO para que el
// botón "Exportar CSV" tuviera datos en el cliente. Ahora el catálogo nunca
// viaja al cliente — el botón abre esta URL y descarga directo.
//
// Acceso vía `fetch("/api/export.csv")` desde el cliente — App Bridge
// adjunta el session token automáticamente.
export const loader = async ({ request }) => {
  const { session, billing } = await authenticate.admin(request);

  const isPro = await checkIsPro(billing, session.shop);
  if (!isPro) {
    return new Response("Forbidden", { status: 403 });
  }

  const cached = await getCachedItems(session.shop, "pro");
  if (!cached) {
    return new Response("Cache no disponible. Recargá la app.", { status: 404 });
  }

  const exportItems = cached.items.filter((i) => !i.locked);
  const csv = buildCsv(exportItems);
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
