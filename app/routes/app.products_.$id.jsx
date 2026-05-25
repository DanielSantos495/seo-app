import { useEffect, useRef } from "react";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  fetchProductById,
  updateProductAltTexts,
} from "../services/shopify-api";
import { analyzeProduct } from "../services/seo-analyzer";
import { generateAltTexts } from "../services/alt-text-generator";
import { productAdminUrl } from "../services/admin-links";
import { resizeCdnUrl } from "../services/image-url";
import { updateCachedItems } from "../services/seo-cache";
import IssuesList from "../components/IssuesList";

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);

  const gid = `gid://shopify/Product/${params.id}`;
  const product = await fetchProductById(admin, gid);
  if (!product) {
    throw new Response("Product not found", { status: 404 });
  }

  const analysis = analyzeProduct(product);

  // Pre-calculamos los alt texts propuestos para mostrar el preview en el modal
  // sin necesidad de re-calcular en el cliente.
  const proposedAltsMap = generateAltTexts(product);
  const proposedAlts = Array.from(proposedAltsMap.entries()).map(
    ([imageId, altText]) => {
      const image = product.images.find((i) => i.id === imageId);
      return { imageId, altText, thumbnailUrl: image?.url || null };
    },
  );

  return { product, analysis, proposedAlts };
};

export const action = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);

  const gid = `gid://shopify/Product/${params.id}`;
  const product = await fetchProductById(admin, gid);
  if (!product) {
    throw new Response("Product not found", { status: 404 });
  }

  const altTexts = generateAltTexts(product);
  if (altTexts.size === 0) {
    return { ok: true, count: 0 };
  }

  const result = await updateProductAltTexts(admin, gid, altTexts);
  if (!result.ok) {
    return {
      ok: false,
      error: result.userErrors.map((e) => e.message).join("; "),
    };
  }

  // Update granular: solo actualizamos este producto en el cache. Antes
  // invalidábamos todo, lo que forzaba un re-fetch completo del catálogo en
  // la siguiente navegación. Re-analizamos con la data fresca de Shopify.
  const refreshed = await fetchProductById(admin, gid);
  if (refreshed) {
    const newAnalysis = analyzeProduct(refreshed);
    await updateCachedItems(session.shop, [gid], (item) => ({
      ...item,
      score: newAnalysis.score,
      issues: newAnalysis.issues,
      thumbnailUrl: refreshed.images?.[0]?.url || item.thumbnailUrl,
      thumbnailAlt:
        refreshed.images?.[0]?.altText || item.thumbnailAlt,
    }));
  }

  return { ok: true, count: altTexts.size };
};

const SCORE_TONE = (score) => {
  if (score >= 80) return "success";
  if (score >= 50) return "caution";
  return "critical";
};

export default function ProductDetail() {
  const { product, analysis, proposedAlts } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const editUrl = productAdminUrl(product.id);
  const featured = product.images?.[0];
  const missingAltCount = product.images.filter((i) => !i.altText).length;
  const isApplying = navigation.state === "submitting";

  // Toast cuando la acción termina. Usamos ref para asegurar que cada
  // actionData solo dispara UN toast (si el componente remonta o el loader
  // revalida, el efecto podría correr de nuevo con el mismo data).
  const shownToastRef = useRef(null);
  useEffect(() => {
    if (!actionData || shownToastRef.current === actionData) return;
    shownToastRef.current = actionData;
    if (actionData.ok) {
      shopify.toast.show(
        actionData.count === 0
          ? "No alt texts to add"
          : `Done: ${actionData.count} alt text${actionData.count === 1 ? "" : "s"} added`,
      );
    } else if (actionData.error) {
      shopify.toast.show(`Error: ${actionData.error}`, { isError: true });
    }
  }, [actionData, shopify]);

  return (
    <s-page heading={product.title}>
      <s-stack slot="breadcrumbActions" paddingBlockEnd="base">
        <s-button icon="arrow-left" variant="tertiary" href="/app/products">
          Products
        </s-button>
      </s-stack>

      <s-section heading="SEO summary">
        <s-stack direction="inline" gap="large" alignment="center">
          {featured && (
            <s-thumbnail
              src={resizeCdnUrl(featured.url, 300)}
              alt={featured.altText || product.title}
              size="large"
              loading="lazy"
            />
          )}
          <s-stack direction="block" gap="small-300">
            <s-stack direction="inline" gap="base" alignment="center">
              <s-heading size="large">{analysis.score}/100</s-heading>
              <s-badge tone={SCORE_TONE(analysis.score)}>
                {analysis.issues.length === 0
                  ? "No issues"
                  : `${analysis.issues.length} issue${analysis.issues.length === 1 ? "" : "s"}`}
              </s-badge>
            </s-stack>
            <s-text tone="subdued">/{product.handle}</s-text>
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Issues to fix">
        <IssuesList issues={analysis.issues} editUrl={editUrl} />
      </s-section>

      <s-section slot="aside" heading="Quick actions">
        <s-stack direction="block" gap="base">
          <s-button href={editUrl}>Open in admin</s-button>
          {missingAltCount > 0 && (
            <s-button
              variant="primary"
              command="--show"
              commandFor="alt-fix-modal"
            >
              Generate missing alt texts ({missingAltCount})
            </s-button>
          )}
          {missingAltCount === 0 && (
            <s-text tone="subdued">
              All images already have alt text.
            </s-text>
          )}
        </s-stack>
      </s-section>

      {proposedAlts.length > 0 && (
        <s-modal
          id="alt-fix-modal"
          heading={`Preview: ${proposedAlts.length} alt text${proposedAlts.length === 1 ? "" : "s"}`}
        >
          <s-paragraph>
            We&apos;ll add alt text to images that don&apos;t have it. Images
            with existing alt text won&apos;t be changed.
          </s-paragraph>
          <s-stack direction="block" gap="small-300">
            {proposedAlts.map((p) => (
              <s-stack
                key={p.imageId}
                direction="inline"
                gap="base"
                alignment="center"
              >
                {p.thumbnailUrl && (
                  <s-thumbnail
                    src={resizeCdnUrl(p.thumbnailUrl, 80)}
                    alt={p.altText}
                    size="small"
                    loading="lazy"
                  />
                )}
                <s-text>{p.altText}</s-text>
              </s-stack>
            ))}
          </s-stack>
          <Form method="post" slot="primaryAction">
            <s-button
              type="submit"
              variant="primary"
              {...(isApplying ? { loading: true } : {})}
            >
              Apply {proposedAlts.length} change
              {proposedAlts.length === 1 ? "" : "s"}
            </s-button>
          </Form>
          <s-button
            slot="secondaryActions"
            command="--hide"
            commandFor="alt-fix-modal"
          >
            Cancel
          </s-button>
        </s-modal>
      )}

      <s-section slot="aside" heading="Current data">
        <s-stack direction="block" gap="base">
          <s-stack direction="block" gap="small-300">
            <s-text tone="subdued">Meta title</s-text>
            {product.seo.title ? (
              <s-text>{product.seo.title}</s-text>
            ) : (
              <s-text tone="critical">Empty</s-text>
            )}
          </s-stack>
          <s-stack direction="block" gap="small-300">
            <s-text tone="subdued">Meta description</s-text>
            {product.seo.description ? (
              <s-text>
                {product.seo.description.slice(0, 80)}
                {product.seo.description.length > 80 ? "…" : ""}
              </s-text>
            ) : (
              <s-text tone="critical">Empty</s-text>
            )}
          </s-stack>
          <s-stack direction="block" gap="small-300">
            <s-text tone="subdued">Images</s-text>
            <s-text>
              {product.images.length} ·{" "}
              {product.images.filter((i) => i.altText).length} with alt text
            </s-text>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return (
    <s-page heading="Product not found">
      <s-stack slot="breadcrumbActions" paddingBlockEnd="base">
        <s-button icon="arrow-left" variant="tertiary" href="/app/products">
          Products
        </s-button>
      </s-stack>
      <s-section>
        <s-banner tone="critical" heading="We couldn't load this product">
          <s-paragraph>
            It may have been deleted, or you may not have permission to view
            it. Go back to the list and try a different one.
          </s-paragraph>
        </s-banner>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
