import { Form, redirect, useLoaderData } from "react-router";
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
import { gidToNumericId } from "../services/admin-links";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  let cached = await getCachedItems(session.shop);
  if (!cached) {
    const products = await fetchAllProducts(admin);
    const items = buildItemsFromProducts(products);
    await setCachedItems(session.shop, items);
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

export default function Index() {
  const { report, worstProducts, planLimit, analyzedAt } = useLoaderData();

  return (
    <s-page heading="SEO Analyzer">
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
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Issues encontrados">
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
