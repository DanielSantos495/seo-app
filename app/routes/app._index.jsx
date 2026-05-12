import { Form, redirect, useLoaderData, useLocation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { fetchAllProducts } from "../services/shopify-api";
import {
  aggregateAnalyses,
  FREE_PLAN_PRODUCT_LIMIT,
} from "../services/seo-analyzer";
import {
  buildItemsFromProducts,
  getCachedItems,
  invalidateCache,
  setCachedItems,
} from "../services/seo-cache";
import { checkIsPro } from "../services/billing";
import { gidToNumericId } from "../services/admin-links";
import { buildCsv } from "../services/csv-export";

export const loader = async ({ request }) => {
  const { admin, session, billing } = await authenticate.admin(request);

  // Si el merchant acaba de aprobar el upgrade, invalidamos el cache para que
  // el siguiente análisis se haga ya como Pro (sin límite).
  const url = new URL(request.url);
  if (url.searchParams.get("upgraded") === "1") {
    await invalidateCache(session.shop);
  }

  const isPro = await checkIsPro(billing);
  const currentPlan = isPro ? "pro" : "free";

  let cached = await getCachedItems(session.shop, currentPlan);
  if (!cached) {
    const products = await fetchAllProducts(admin);
    const items = buildItemsFromProducts(products, {
      limit: isPro ? null : FREE_PLAN_PRODUCT_LIMIT,
    });
    await setCachedItems(session.shop, items, currentPlan);
    cached = { items, analyzedAt: new Date() };
  }

  // Solo los items no-locked tienen scoring. El report del dashboard se calcula
  // sobre ellos.
  const unlocked = cached.items.filter((i) => !i.locked);
  const report = aggregateAnalyses(unlocked);

  const worstProducts = [...report.products]
    .filter((p) => p.score < 100)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  return {
    report,
    worstProducts,
    planLimit: FREE_PLAN_PRODUCT_LIMIT,
    analyzedAt: cached.analyzedAt.toISOString(),
    isPro,
    // Items completos (no-locked) para el export CSV client-side.
    exportItems: cached.items.filter((i) => !i.locked),
    shopHandle: session.shop.replace(/\.myshopify\.com$/, ""),
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  await invalidateCache(session.shop);
  return redirect("/app");
};

function formatRelativeTime(isoDate) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "hace unos segundos";
  if (min < 60) return `hace ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

function downloadCsv(items, shopHandle) {
  const csv = buildCsv(items);
  // BOM U+FEFF para que Excel detecte UTF-8 (acentos, ñ).
  const blob = new Blob(["﻿", csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `seo-report-${shopHandle}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Index() {
  const {
    report,
    worstProducts,
    planLimit,
    analyzedAt,
    isPro,
    exportItems,
    shopHandle,
  } = useLoaderData();
  // Preservar los query params de Shopify (host, embedded, id_token...) en el
  // link al upgrade. Importante: el upgrade va por GET con full-page reload
  // (`target="_top"`) para evitar el bug de single-fetch + billing.request.
  const location = useLocation();
  const upgradeUrl = `/app/upgrade${location.search}`;

  return (
    <s-page heading="SEO Analyzer">
      {isPro ? (
        <s-banner tone="success" heading="Plan Pro activo">
          <s-paragraph>Analizamos todos los productos de tu tienda.</s-paragraph>
        </s-banner>
      ) : (
        <s-banner
          tone="info"
          heading={`Plan Free · análisis limitado a ${planLimit} productos`}
        >
          <s-paragraph>
            Mejora a Pro para analizar todos tus productos y desbloquear el bulk
            fix de alt texts.
          </s-paragraph>
          <s-button
            slot="secondaryActions"
            variant="primary"
            href={upgradeUrl}
            target="_top"
          >
            Mejorar a Pro · $9/mes (7 días gratis)
          </s-button>
        </s-banner>
      )}

      <s-section heading="Score general de tu tienda">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="large" alignment="center">
            <s-heading size="large">{report.overallScore}/100</s-heading>
            <s-text>
              Promedio sobre {report.totalProducts} producto
              {report.totalProducts === 1 ? "" : "s"} analizado
              {report.totalProducts === 1 ? "" : "s"}
              {report.totalProducts >= planLimit
                ? ` (límite del plan free: ${planLimit}).`
                : "."}
            </s-text>
          </s-stack>
          <s-text tone="subdued">
            Último análisis {formatRelativeTime(analyzedAt)}
          </s-text>
          <s-stack direction="inline" gap="base">
            <s-button href="/app/products" variant="primary">
              Ver todos los productos
            </s-button>
            <Form method="post">
              <s-button type="submit" variant="secondary">
                Re-analizar ahora
              </s-button>
            </Form>
            {isPro ? (
              <s-button
                variant="secondary"
                onClick={() => downloadCsv(exportItems, shopHandle)}
              >
                Exportar CSV
              </s-button>
            ) : (
              <s-button
                href={upgradeUrl}
                target="_top"
                variant="secondary"
              >
                Pro: exportar CSV
              </s-button>
            )}
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Issues encontrados">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="large">
            {[
              { label: "Críticos", count: report.issuesByImpact.high, tone: "critical" },
              { label: "Medios", count: report.issuesByImpact.medium, tone: "caution" },
              { label: "Bajos", count: report.issuesByImpact.low, tone: "info" },
            ].map(({ label, count, tone }) => (
              <s-box
                key={label}
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <s-stack direction="block" gap="tight" alignment="center">
                  <s-heading>{count}</s-heading>
                  <s-text tone={tone}>{label}</s-text>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
          <s-button href="/app/issues">Ver issues agrupados por tipo</s-button>
        </s-stack>
      </s-section>

      {worstProducts.length > 0 && (
        <s-section heading="Productos con peor SEO">
          <s-stack direction="block" gap="base">
            {worstProducts.map((product) => (
              <s-clickable
                key={product.productId}
                href={`/app/products/${gidToNumericId(product.productId)}`}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="inline" gap="base" alignment="center">
                  <s-heading>{product.score}</s-heading>
                  <s-stack direction="block" gap="tight">
                    <s-text>{product.title}</s-text>
                    <s-text tone="subdued">
                      {product.issues.length} issue
                      {product.issues.length === 1 ? "" : "s"} ·{" "}
                      {product.issues[0]?.message}
                    </s-text>
                  </s-stack>
                </s-stack>
              </s-clickable>
            ))}
          </s-stack>
        </s-section>
      )}

      {report.totalProducts === 0 && (
        <s-section heading="Sin productos">
          <s-paragraph>
            Esta tienda aún no tiene productos. Crea algunos en el admin de
            Shopify y vuelve para ver el análisis.
          </s-paragraph>
        </s-section>
      )}
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
