import { useEffect, useState } from "react";
import {
  Form,
  useActionData,
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigation,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  bulkFixAltTextsForProducts,
  fetchAllProducts,
} from "../services/shopify-api";
import { FREE_PLAN_PRODUCT_LIMIT } from "../services/seo-analyzer";
import {
  buildItemsFromProducts,
  getCachedItems,
  invalidateCache,
  setCachedItems,
} from "../services/seo-cache";
import { checkIsPro } from "../services/billing";
import { gidToNumericId } from "../services/admin-links";
import { labelForField, mostSevere } from "../services/issue-labels";

const BULK_CAP = 50;
const MAX_VISIBLE_PRODUCTS = 5;

const IMPACT_TONE = { high: "critical", medium: "caution", low: "info" };
const IMPACT_LABEL = { high: "Crítico", medium: "Medio", low: "Bajo" };
const IMPACT_ORDER = { high: 0, medium: 1, low: 2 };

function getEligibleAltGids(items) {
  return items
    .filter(
      (i) =>
        !i.locked &&
        i.issues?.some((iss) => iss.field === "images.altText"),
    )
    .map((i) => i.productId);
}

function groupIssuesByField(items) {
  const groups = new Map();
  for (const item of items) {
    if (item.locked) continue;
    for (const issue of item.issues || []) {
      let g = groups.get(issue.field);
      if (!g) {
        g = {
          field: issue.field,
          impact: issue.impact,
          fix: issue.fix,
          productsSet: new Set(),
          issuesCount: 0,
          affectedProducts: [],
        };
        groups.set(issue.field, g);
      }
      g.impact = mostSevere(g.impact, issue.impact);
      g.issuesCount++;
      // Devolvemos todos los productos afectados (sin cap) para que el cliente
      // pueda mostrarlos al expandir el grupo. Los items vienen del cache local
      // — no hay coste extra de API.
      if (!g.productsSet.has(item.productId)) {
        g.productsSet.add(item.productId);
        g.affectedProducts.push({
          productId: item.productId,
          title: item.title,
          thumbnailUrl: item.thumbnailUrl,
        });
      }
    }
  }
  return Array.from(groups.values())
    .map((g) => ({
      field: g.field,
      impact: g.impact,
      fix: g.fix,
      issuesCount: g.issuesCount,
      productsCount: g.productsSet.size,
      affectedProducts: g.affectedProducts,
    }))
    .sort((a, b) => {
      const byImpact = IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact];
      if (byImpact !== 0) return byImpact;
      return b.productsCount - a.productsCount;
    });
}

export const loader = async ({ request }) => {
  const { admin, session, billing } = await authenticate.admin(request);

  const isPro = await checkIsPro(billing, session.shop);
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

  const groups = groupIssuesByField(cached.items);
  const eligibleAltGids = getEligibleAltGids(cached.items);

  // Los samples se cargan on-demand desde /api/bulk-preview cuando el merchant
  // abre el modal — antes los resolvíamos en cada loader inútilmente.
  return {
    groups,
    analyzedAt: cached.analyzedAt.toISOString(),
    isPro,
    bulkFix: {
      eligible: eligibleAltGids.length,
      processable: Math.min(eligibleAltGids.length, BULK_CAP),
      exceedsCap: eligibleAltGids.length > BULK_CAP,
    },
  };
};

export const action = async ({ request }) => {
  const { admin, session, billing } = await authenticate.admin(request);

  const isPro = await checkIsPro(billing, session.shop);
  if (!isPro) {
    return new Response(
      JSON.stringify({ error: "Esta acción es solo para plan Pro" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const cached = await getCachedItems(session.shop, "pro");
  if (!cached) {
    return { ok: false, error: "Cache no disponible. Recargá la página." };
  }
  const eligibleGids = getEligibleAltGids(cached.items).slice(0, BULK_CAP);
  if (eligibleGids.length === 0) {
    return { ok: true, totalProducts: 0, totalImages: 0, errors: [] };
  }

  const result = await bulkFixAltTextsForProducts(admin, eligibleGids);
  await invalidateCache(session.shop);

  return { ok: true, ...result };
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

export default function Issues() {
  const { groups, analyzedAt, isPro, bulkFix } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const location = useLocation();
  const upgradeUrl = `/app/upgrade${location.search}`;
  const isApplying = navigation.state === "submitting";
  const [expandedGroups, setExpandedGroups] = useState({});
  // Fetcher para cargar samples del bulk fix on-demand al abrir el modal.
  const previewFetcher = useFetcher();
  const samples = previewFetcher.data?.samples;
  const isLoadingPreview = previewFetcher.state === "loading";

  const toggleExpand = (field) =>
    setExpandedGroups((s) => ({ ...s, [field]: !s[field] }));

  useEffect(() => {
    if (!actionData) return;
    if (actionData.error) {
      shopify.toast.show(`Error: ${actionData.error}`, { isError: true });
      return;
    }
    if (actionData.totalImages === 0) {
      shopify.toast.show("No había alt texts para agregar");
      return;
    }
    const errCount = actionData.errors?.length || 0;
    const okCount = actionData.totalProducts - errCount;
    shopify.toast.show(
      `Listo: ${okCount} producto${okCount === 1 ? "" : "s"} · ${actionData.totalImages} alt text${actionData.totalImages === 1 ? "" : "s"}${errCount ? ` · ${errCount} error${errCount === 1 ? "" : "es"}` : ""}`,
      errCount ? { isError: true } : undefined,
    );
  }, [actionData, shopify]);

  return (
    <s-page heading="Issues">
      <s-link slot="breadcrumbActions" href="/app">
        Dashboard
      </s-link>

      <s-text tone="subdued">
        Último análisis {formatRelativeTime(analyzedAt)}
      </s-text>

      {groups.length === 0 ? (
        <s-section>
          <s-banner tone="success" heading="Sin issues detectados">
            <s-paragraph>
              Tu catálogo cumple los criterios SEO. Buen trabajo.
            </s-paragraph>
            <s-button slot="secondaryActions" href="/app">
              Volver al dashboard
            </s-button>
          </s-banner>
        </s-section>
      ) : (
        groups.map((group) => (
          <s-section
            key={group.field}
            heading={labelForField(group.field)}
          >
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="base" alignment="center">
                <s-badge tone={IMPACT_TONE[group.impact]}>
                  {IMPACT_LABEL[group.impact]}
                </s-badge>
                <s-text>
                  {group.productsCount} producto
                  {group.productsCount === 1 ? "" : "s"} · {group.issuesCount}{" "}
                  issue{group.issuesCount === 1 ? "" : "s"}
                </s-text>
              </s-stack>
              <s-paragraph tone="subdued">{group.fix}</s-paragraph>

              <s-stack direction="block" gap="tight">
                {(expandedGroups[group.field]
                  ? group.affectedProducts
                  : group.affectedProducts.slice(0, MAX_VISIBLE_PRODUCTS)
                ).map((p) => (
                  <s-clickable
                    key={p.productId}
                    href={`/app/products/${gidToNumericId(p.productId)}`}
                    padding="tight"
                    borderWidth="base"
                    borderRadius="base"
                  >
                    <s-stack direction="inline" gap="base" alignment="center">
                      {p.thumbnailUrl && (
                        <s-thumbnail
                          src={p.thumbnailUrl}
                          alt={p.title}
                          size="small"
                        />
                      )}
                      <s-text>{p.title}</s-text>
                    </s-stack>
                  </s-clickable>
                ))}
                {group.productsCount > MAX_VISIBLE_PRODUCTS && (
                  <s-button
                    variant="tertiary"
                    onClick={() => toggleExpand(group.field)}
                  >
                    {expandedGroups[group.field]
                      ? "Ver menos"
                      : `Ver ${group.productsCount - MAX_VISIBLE_PRODUCTS} más`}
                  </s-button>
                )}
              </s-stack>

              {group.field === "images.altText" && bulkFix.eligible > 0 && (
                <s-button
                  variant="primary"
                  command="--show"
                  commandFor={isPro ? "bulk-alt-modal" : "upgrade-modal"}
                  onClick={() => {
                    if (isPro && !samples && previewFetcher.state === "idle") {
                      previewFetcher.load("/api/bulk-preview");
                    }
                  }}
                >
                  {isPro
                    ? `Arreglar todos (${bulkFix.processable})`
                    : `Pro: arreglar todos (${bulkFix.eligible})`}
                </s-button>
              )}
            </s-stack>
          </s-section>
        ))
      )}

      {isPro && bulkFix.eligible > 0 && (
        <s-modal id="bulk-alt-modal" heading="Arreglar alt texts en lote">
          <s-paragraph>
            Vamos a procesar <s-text>{bulkFix.processable}</s-text> producto
            {bulkFix.processable === 1 ? "" : "s"} y agregar alt text a sus
            imágenes faltantes.
          </s-paragraph>
          {bulkFix.exceedsCap && (
            <s-banner tone="info">
              <s-paragraph>
                Tu tienda tiene {bulkFix.eligible} productos elegibles.
                Procesaremos los primeros {BULK_CAP}; volvé a ejecutar para el
                resto.
              </s-paragraph>
            </s-banner>
          )}
          {isLoadingPreview && (
            <s-stack direction="inline" gap="tight" alignment="center">
              <s-spinner />
              <s-text tone="subdued">Generando ejemplos…</s-text>
            </s-stack>
          )}
          {!isLoadingPreview && samples && samples.length > 0 && (
            <s-stack direction="block" gap="tight">
              <s-text tone="subdued">Ejemplos del patrón:</s-text>
              {samples.map((s, idx) => (
                <s-text key={idx}>
                  {s.productTitle} → &ldquo;{s.sampleAlt}&rdquo;
                </s-text>
              ))}
            </s-stack>
          )}
          <Form method="post" slot="primaryAction">
            <s-button
              type="submit"
              variant="primary"
              {...(isApplying ? { loading: true } : {})}
            >
              Aplicar a {bulkFix.processable} producto
              {bulkFix.processable === 1 ? "" : "s"}
            </s-button>
          </Form>
          <s-button
            slot="secondaryActions"
            command="--hide"
            commandFor="bulk-alt-modal"
          >
            Cancelar
          </s-button>
        </s-modal>
      )}

      {!isPro && bulkFix.eligible > 0 && (
        <s-modal id="upgrade-modal" heading="Mejora a Pro para usar bulk fix">
          <s-paragraph>
            El bulk fix de alt texts es exclusivo del plan Pro. Activalo y
            generamos alt text descriptivo para todas las imágenes en un click.
          </s-paragraph>
          <s-button
            slot="primaryAction"
            variant="primary"
            href={upgradeUrl}
            target="_top"
          >
            Mejorar a Pro · $9/mes (7 días gratis)
          </s-button>
          <s-button
            slot="secondaryActions"
            command="--hide"
            commandFor="upgrade-modal"
          >
            Cerrar
          </s-button>
        </s-modal>
      )}
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
