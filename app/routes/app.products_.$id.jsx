import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { fetchProductById } from "../services/shopify-api";
import { analyzeProduct } from "../services/seo-analyzer";
import { productAdminUrl } from "../services/admin-links";
import IssuesList from "../components/IssuesList";

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);

  const gid = `gid://shopify/Product/${params.id}`;
  const product = await fetchProductById(admin, gid);
  if (!product) {
    throw new Response("Producto no encontrado", { status: 404 });
  }

  const analysis = analyzeProduct(product);
  return { product, analysis };
};

const SCORE_TONE = (score) => {
  if (score >= 80) return "success";
  if (score >= 50) return "caution";
  return "critical";
};

export default function ProductDetail() {
  const { product, analysis } = useLoaderData();
  const editUrl = productAdminUrl(product.id);
  const featured = product.images?.[0];

  return (
    <s-page heading={product.title}>
      <s-link slot="breadcrumbActions" href="/app/products">
        Productos
      </s-link>
      <s-button
        slot="primaryAction"
        variant="primary"
        href={editUrl}
      >
        Editar en Shopify
      </s-button>

      <s-section heading="Resumen SEO">
        <s-stack direction="inline" gap="large" alignment="center">
          {featured && (
            <s-thumbnail
              src={featured.url}
              alt={featured.altText || product.title}
              size="large"
            />
          )}
          <s-stack direction="block" gap="tight">
            <s-stack direction="inline" gap="base" alignment="center">
              <s-heading size="large">{analysis.score}/100</s-heading>
              <s-badge tone={SCORE_TONE(analysis.score)}>
                {analysis.issues.length === 0
                  ? "Sin issues"
                  : `${analysis.issues.length} issue${analysis.issues.length === 1 ? "" : "s"}`}
              </s-badge>
            </s-stack>
            <s-text tone="subdued">/{product.handle}</s-text>
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Issues a corregir">
        <IssuesList issues={analysis.issues} editUrl={editUrl} />
      </s-section>

      <s-section slot="aside" heading="Acciones rápidas">
        <s-stack direction="block" gap="base">
          <s-button href={editUrl}>Abrir en el admin</s-button>
          <s-text tone="subdued">
            Próximamente: bulk fix de alt texts (plan Pro).
          </s-text>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Datos actuales">
        <s-stack direction="block" gap="base">
          <s-stack direction="block" gap="tight">
            <s-text tone="subdued">Meta title</s-text>
            {product.seo.title ? (
              <s-text>{product.seo.title}</s-text>
            ) : (
              <s-text tone="critical">Vacío</s-text>
            )}
          </s-stack>
          <s-stack direction="block" gap="tight">
            <s-text tone="subdued">Meta description</s-text>
            {product.seo.description ? (
              <s-text>
                {product.seo.description.slice(0, 80)}
                {product.seo.description.length > 80 ? "…" : ""}
              </s-text>
            ) : (
              <s-text tone="critical">Vacío</s-text>
            )}
          </s-stack>
          <s-stack direction="block" gap="tight">
            <s-text tone="subdued">Imágenes</s-text>
            <s-text>
              {product.images.length} ·{" "}
              {product.images.filter((i) => i.altText).length} con alt text
            </s-text>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return (
    <s-page heading="Producto no encontrado">
      <s-link slot="breadcrumbActions" href="/app/products">
        Productos
      </s-link>
      <s-section>
        <s-banner tone="critical" heading="No pudimos cargar este producto">
          <s-paragraph>
            Es posible que haya sido eliminado o que no tengas permiso para
            verlo. Vuelve al listado e intenta con otro.
          </s-paragraph>
        </s-banner>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
