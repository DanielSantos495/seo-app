import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { fetchAllProducts } from "../services/shopify-api";
import {
  analyzeProducts,
  FREE_PLAN_PRODUCT_LIMIT,
} from "../services/seo-analyzer";
import { gidToNumericId } from "../services/admin-links";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const products = await fetchAllProducts(admin, {
    limit: FREE_PLAN_PRODUCT_LIMIT,
  });
  const report = analyzeProducts(products);

  // Top 5 productos con peor score (excluye 100/100 para no llenar la UI).
  const worstProducts = [...report.products]
    .filter((p) => p.score < 100)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  return { report, worstProducts, planLimit: FREE_PLAN_PRODUCT_LIMIT };
};

export default function Index() {
  const { report, worstProducts, planLimit } = useLoaderData();

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
          <s-button href="/app/products" variant="primary">
            Ver todos los productos
          </s-button>
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
