import { useEffect, useRef, useState } from "react";
import {
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteLoaderData,
  useSubmit,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  fetchProductById,
  bulkFixAltTextsForProducts,
  updateProductSeoAndDescription,
} from "../services/shopify-api";
import { analyzeProduct } from "../services/seo-analyzer";
import { generateAltTexts } from "../services/alt-text-generator";
import { getPlanInfo } from "../services/plan";
import { productAdminUrl } from "../services/admin-links";
import { resizeCdnUrl } from "../services/image-url";
import { updateCachedItems } from "../services/seo-cache";
import IssuesList from "../components/IssuesList";
import AiTextField from "../components/AiTextField";

// Escapa caracteres HTML especiales en texto plano.
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Convierte texto plano con párrafos (\n\n) a HTML con etiquetas <p>.
function textToHtml(text) {
  return text
    .split(/\n\n+/)
    .map((para) => `<p>${escapeHtml(para.trim())}</p>`)
    .join("");
}

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
  const { admin, session, billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const gid = `gid://shopify/Product/${params.id}`;

  // -------------------------------------------------------------------------
  // intent = "applyText": aplica un campo SEO generado por IA al producto.
  // -------------------------------------------------------------------------
  if (intent === "applyText") {
    const field = formData.get("field");
    const value = formData.get("value") ?? "";

    // Mapear field → argumento de updateProductSeoAndDescription.
    let updateArg;
    if (field === "metaTitle") {
      updateArg = { seoTitle: value };
    } else if (field === "metaDescription") {
      updateArg = { seoDescription: value };
    } else if (field === "description") {
      updateArg = { descriptionHtml: textToHtml(value) };
    } else {
      return { ok: false, error: "Unknown field." };
    }

    const { ok, userErrors } = await updateProductSeoAndDescription(
      admin,
      gid,
      updateArg,
    );
    if (!ok) {
      return { ok: false, error: userErrors.map((e) => e.message).join("; ") };
    }

    // Re-analizar y actualizar cache (mismo patrón que el path de alt fix).
    const refreshed = await fetchProductById(admin, gid);
    if (refreshed) {
      const newAnalysis = analyzeProduct(refreshed);
      await updateCachedItems(session.shop, [gid], (item) => ({
        ...item,
        score: newAnalysis.score,
        issues: newAnalysis.issues,
        thumbnailUrl: refreshed.images?.[0]?.url || item.thumbnailUrl,
        thumbnailAlt: refreshed.images?.[0]?.altText || item.thumbnailAlt,
      }));
    }

    return { ok: true, appliedField: field };
  }

  // -------------------------------------------------------------------------
  // Path por defecto: alt fix (comportamiento existente).
  // -------------------------------------------------------------------------
  // `useAI` es preferencia del cliente; el plan se resuelve server-side y la
  // quota gatea el uso real (free → budget 0 → sin IA). Reusamos el mismo
  // motor que el bulk (IA + quota + fallback determinista por imagen).
  const useAI = formData.get("useAI") === "true";
  const { tier } = await getPlanInfo(billing);

  const result = await bulkFixAltTextsForProducts(admin, [gid], {
    useAI,
    shop: session.shop,
    plan: tier,
    locale: session.locale ?? null,
  });

  if (result.errors.length > 0) {
    return { ok: false, error: result.errors.map((e) => e.message).join("; ") };
  }
  if (result.totalImages === 0) {
    return { ok: true, count: 0 };
  }

  // Update granular: solo actualizamos este producto en el cache. Re-analizamos
  // con la data fresca de Shopify (evita re-fetch completo del catálogo).
  const refreshed = await fetchProductById(admin, gid);
  if (refreshed) {
    const newAnalysis = analyzeProduct(refreshed);
    await updateCachedItems(session.shop, [gid], (item) => ({
      ...item,
      score: newAnalysis.score,
      issues: newAnalysis.issues,
      thumbnailUrl: refreshed.images?.[0]?.url || item.thumbnailUrl,
      thumbnailAlt: refreshed.images?.[0]?.altText || item.thumbnailAlt,
    }));
  }

  return {
    ok: true,
    count: result.totalImages,
    aiCount: result.aiCount,
    naiveCount: result.naiveCount,
  };
};

const SCORE_TONE = (score) => {
  if (score >= 80) return "success";
  if (score >= 50) return "caution";
  return "critical";
};

export default function ProductDetail() {
  const { product, analysis, proposedAlts } = useLoaderData();
  const { plan, aiAltRemaining, aiMetaRemaining, upgradeUrl } =
    useRouteLoaderData("routes/app");
  const actionData = useActionData();
  const navigation = useNavigation();
  const submit = useSubmit();
  const shopify = useAppBridge();

  const [useAI, setUseAI] = useState(false);

  const editUrl = productAdminUrl(product.id);
  const featured = product.images?.[0];
  const missingAltCount = product.images.filter((i) => !i.altText).length;
  // isApplying solo para el path de alt fix (submit sin intent específico).
  const isApplying = navigation.state === "submitting";
  // isApplyingText: submit del intent applyText.
  const isApplyingText =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "applyText";

  // Callback compartido por los 3 AiTextField: envía intent=applyText.
  const handleApplyText = ({ field, value }) => {
    submit(
      { intent: "applyText", field, value },
      { method: "post" },
    );
  };

  // Numeric product id para el fetcher de api.generate-text.
  const productNumericId = product.id.replace(/^gid:\/\/shopify\/Product\//, "");

  // Toast cuando la acción termina. Usamos ref para asegurar que cada
  // actionData solo dispara UN toast (si el componente remonta o el loader
  // revalida, el efecto podría correr de nuevo con el mismo data).
  const shownToastRef = useRef(null);
  useEffect(() => {
    if (!actionData || shownToastRef.current === actionData) return;
    shownToastRef.current = actionData;
    if (actionData.ok) {
      if (actionData.appliedField) {
        shopify.toast.show("Field updated successfully");
      } else if (actionData.count === 0) {
        shopify.toast.show("No images on this product need alt text");
      } else {
        const aiCount = actionData.aiCount ?? 0;
        const naiveCount = actionData.naiveCount ?? 0;
        let msg = `Done: ${actionData.count} alt text${actionData.count === 1 ? "" : "s"} added`;
        if (aiCount > 0 && naiveCount > 0) {
          msg += ` (${aiCount} with AI · ${naiveCount} with pattern)`;
        } else if (aiCount > 0) {
          msg += ` (${aiCount} with AI)`;
        }
        shopify.toast.show(msg);
      }
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

      <s-section heading="AI Text Generator">
        <s-stack direction="block" gap="large">
          {plan !== "free" && (
            <s-text tone="subdued">
              {aiMetaRemaining} AI generation{aiMetaRemaining === 1 ? "" : "s"} left this month
            </s-text>
          )}
          <AiTextField
            field="metaTitle"
            label="Meta title"
            currentValue={product.seo.title}
            productId={productNumericId}
            plan={plan}
            aiMetaRemaining={aiMetaRemaining}
            upgradeUrl={upgradeUrl}
            onApply={handleApplyText}
            isApplying={isApplyingText}
          />
          <AiTextField
            field="metaDescription"
            label="Meta description"
            currentValue={product.seo.description}
            productId={productNumericId}
            plan={plan}
            aiMetaRemaining={aiMetaRemaining}
            upgradeUrl={upgradeUrl}
            onApply={handleApplyText}
            isApplying={isApplyingText}
          />
          <AiTextField
            field="description"
            label="Product description"
            currentValue={
              product.descriptionHtml
                ? product.descriptionHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)
                : ""
            }
            productId={productNumericId}
            plan={plan}
            aiMetaRemaining={aiMetaRemaining}
            upgradeUrl={upgradeUrl}
            onApply={handleApplyText}
            isApplying={isApplyingText}
          />
        </s-stack>
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
              All images on this product already have alt text.
            </s-text>
          )}
        </s-stack>
      </s-section>

      {proposedAlts.length > 0 && (
        <s-modal
          id="alt-fix-modal"
          heading="Generate missing alt texts"
        >
          <s-box paddingBlockEnd="base">
            <s-stack direction="block" gap="base">
              <s-paragraph>
                We&apos;ll add alt text to <s-text>{proposedAlts.length}</s-text> image
                {proposedAlts.length === 1 ? "" : "s"} on this product. Images
                that already have alt text won&apos;t be changed.
              </s-paragraph>
              {plan !== "free" ? (
                <s-stack direction="block" gap="small-300">
                  <s-checkbox
                    label="Generate with AI (better quality)"
                    checked={useAI}
                    {...(aiAltRemaining === 0 ? { disabled: true } : {})}
                    onChange={(e) => setUseAI(e.target.checked)}
                  />
                  {aiAltRemaining === 0 ? (
                    <s-text tone="subdued">
                      AI quota exhausted for this month — alt texts will use the pattern.
                    </s-text>
                  ) : (
                    <s-text tone="subdued">
                      {aiAltRemaining} AI generation{aiAltRemaining === 1 ? "" : "s"} left this month
                    </s-text>
                  )}
                </s-stack>
              ) : (
                <s-stack direction="block" gap="small-300">
                  <s-text tone="subdued">AI alt text is a Pro feature.</s-text>
                  <s-button href={upgradeUrl} target="_top">
                    Upgrade to Pro
                  </s-button>
                </s-stack>
              )}
              <s-stack direction="block" gap="small-300">
                <s-text tone="subdued">Preview:</s-text>
                {proposedAlts.map((p) => (
                  <s-text key={p.imageId}>&ldquo;{p.altText}&rdquo;</s-text>
                ))}
              </s-stack>
            </s-stack>
          </s-box>
          <s-stack direction="inline" gap="base" justifyContent="end">
            <s-button command="--hide" commandFor="alt-fix-modal">
              Cancel
            </s-button>
            <s-button
              variant="primary"
              {...(isApplying ? { loading: true } : {})}
              onClick={() => {
                if (!isApplying) submit({ useAI: String(useAI) }, { method: "post" });
              }}
            >
              Apply {proposedAlts.length} change
              {proposedAlts.length === 1 ? "" : "s"}
            </s-button>
          </s-stack>
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
