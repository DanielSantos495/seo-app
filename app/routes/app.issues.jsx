import { useEffect, useRef, useState } from "react";
import {
  useFetcher,
  useLoaderData,
  useLocation,
  useRevalidator,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getCachedItems } from "../services/seo-cache";
import { checkIsPro } from "../services/billing";
import { gidToNumericId } from "../services/admin-links";
import { resizeCdnUrl } from "../services/image-url";
import { findActiveJob, serializeJob } from "../services/seo-job";
import {
  startAnalysisJob,
  startBulkAltJob,
} from "../services/seo-job-runner";
import { labelForField, mostSevere } from "../services/issue-labels";
import { JobProgress, useJobPolling } from "../components/JobProgress";
import BulkFixSummaryBanner from "../components/BulkFixSummaryBanner";

const MAX_VISIBLE_PRODUCTS = 5;

const IMPACT_TONE = { high: "critical", medium: "caution", low: "info" };
const IMPACT_LABEL = { high: "Crítico", medium: "Medio", low: "Bajo" };
const IMPACT_ORDER = { high: 0, medium: 1, low: 2 };

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

  const cached = await getCachedItems(session.shop, currentPlan);

  let activeAnalysisJob = null;
  if (!cached) {
    activeAnalysisJob = await startAnalysisJob(session.shop, admin, { isPro });
  } else if (cached.isStale) {
    startAnalysisJob(session.shop, admin, { isPro }).catch(() => {});
    activeAnalysisJob = await findActiveJob(session.shop, "analysis");
  }

  const activeBulkJob = await findActiveJob(session.shop, "bulk_alt");

  if (!cached) {
    return {
      analyzing: true,
      analysisJob: serializeJob(activeAnalysisJob),
      bulkJob: serializeJob(activeBulkJob),
      groups: [],
      analyzedAt: null,
      isPro,
      isStale: false,
      bulkFix: { eligible: 0, processable: 0 },
    };
  }

  // groupIssuesByField sigue siendo on-demand: agrupar 10k items con
  // affectedProducts es ~10ms y depende del filter UI; no pre-computamos.
  const groups = groupIssuesByField(cached.items);
  const eligibleCount = cached.eligibleAltGids.length;

  return {
    analyzing: false,
    analysisJob: serializeJob(activeAnalysisJob),
    bulkJob: serializeJob(activeBulkJob),
    groups,
    analyzedAt: cached.analyzedAt.toISOString(),
    isPro,
    isStale: cached.isStale,
    bulkFix: {
      eligible: eligibleCount,
      processable: eligibleCount,
    },
  };
};

// El action dispara un job de bulk fix y vuelve al toque con el jobId. El
// cliente hace polling al estado del job — el POST no bloquea.
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
  const eligibleGids = cached.eligibleAltGids;
  if (eligibleGids.length === 0) {
    return { ok: true, jobId: null, empty: true };
  }

  const job = await startBulkAltJob(session.shop, admin, eligibleGids);
  return { ok: true, jobId: job.id };
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
  const {
    analyzing,
    analysisJob: initialAnalysisJob,
    bulkJob: initialBulkJob,
    groups,
    analyzedAt,
    isPro,
    isStale,
    bulkFix,
  } = useLoaderData();
  const shopify = useAppBridge();
  const location = useLocation();
  const upgradeUrl = `/app/upgrade${location.search}`;
  const revalidator = useRevalidator();
  const [expandedGroups, setExpandedGroups] = useState({});
  // Preview fetcher: samples del modal.
  const previewFetcher = useFetcher();
  const samples = previewFetcher.data?.samples;
  const isLoadingPreview = previewFetcher.state === "loading";
  // Bulk fix fetcher: dispara job sin remontar.
  const bulkFetcher = useFetcher();
  const bulkActionData = bulkFetcher.data;
  const submittedJobId = bulkActionData?.jobId;

  const toggleExpand = (field) =>
    setExpandedGroups((s) => ({ ...s, [field]: !s[field] }));

  // Job de análisis (stale o primer fetch).
  const { job: analysisJob, isActive: isAnalyzing } = useJobPolling({
    initialJob: initialAnalysisJob,
    byType: "analysis",
    onFinish: () => revalidator.revalidate(),
  });

  const [lastBulkSummary, setLastBulkSummary] = useState(null);

  // Job de bulk fix.
  const { job: bulkJob, isActive: isBulkRunning } = useJobPolling({
    initialJob: submittedJobId
      ? { id: submittedJobId, status: "running", processed: 0, total: 0 }
      : initialBulkJob,
    byId: submittedJobId,
    byType: submittedJobId ? null : "bulk_alt",
    onFinish: (finalJob) => {
      // finalJob puede ser null si el polling no llegó al resultado.
      // Igual revalidamos para que el loader refresque con data nueva.
      const summary = finalJob?.resultSummary || null;
      if (summary) {
        setLastBulkSummary(summary);
        const errCount = summary.errors?.length || 0;
        const ok = (summary.totalProducts || 0) - errCount;
        if (summary.totalImages === 0) {
          shopify.toast.show("No había alt texts para agregar");
        } else {
          shopify.toast.show(
            `Listo: ${ok} producto${ok === 1 ? "" : "s"} · ${summary.totalImages || 0} alt text${summary.totalImages === 1 ? "" : "s"}${errCount ? ` · ${errCount} error${errCount === 1 ? "" : "es"}` : ""}`,
            errCount ? { isError: true } : undefined,
          );
        }
      }
      revalidator.revalidate();
    },
  });

  // Ref para no duplicar toast si el loader revalida con el mismo actionData.
  const errorToastRef = useRef(null);
  useEffect(() => {
    if (!bulkActionData?.error) return;
    if (errorToastRef.current === bulkActionData) return;
    errorToastRef.current = bulkActionData;
    shopify.toast.show(`Error: ${bulkActionData.error}`, { isError: true });
  }, [bulkActionData, shopify]);

  const isApplying = bulkFetcher.state !== "idle" || isBulkRunning;

  if (analyzing) {
    return (
      <s-page heading="Issues">
        <s-link slot="breadcrumbActions" href="/app">
          Dashboard
        </s-link>
        <s-section heading="Analizando tu tienda">
          <JobProgress job={analysisJob} label="Analizando productos" />
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Issues">
      <s-link slot="breadcrumbActions" href="/app">
        Dashboard
      </s-link>

      {lastBulkSummary && (
        <BulkFixSummaryBanner
          summary={lastBulkSummary}
          onDismiss={() => setLastBulkSummary(null)}
        />
      )}

      {isStale && isAnalyzing && (
        <s-banner tone="info" heading="Actualizando datos">
          <s-paragraph>
            Mostramos el último análisis disponible mientras refrescamos en
            background.
          </s-paragraph>
          <JobProgress job={analysisJob} label="Re-analizando" />
        </s-banner>
      )}

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
                          src={resizeCdnUrl(p.thumbnailUrl, 80)}
                          alt={p.title}
                          size="small"
                          loading="lazy"
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
          {isBulkRunning && (
            <JobProgress job={bulkJob} label="Aplicando alt texts" />
          )}
          {!isBulkRunning && isLoadingPreview && (
            <s-stack direction="inline" gap="tight" alignment="center">
              <s-spinner />
              <s-text tone="subdued">Generando ejemplos…</s-text>
            </s-stack>
          )}
          {!isBulkRunning &&
            !isLoadingPreview &&
            samples &&
            samples.length > 0 && (
              <s-stack direction="block" gap="tight">
                <s-text tone="subdued">Ejemplos del patrón:</s-text>
                {samples.map((s, idx) => (
                  <s-text key={idx}>
                    {s.productTitle} → &ldquo;{s.sampleAlt}&rdquo;
                  </s-text>
                ))}
              </s-stack>
            )}
          <bulkFetcher.Form method="post" slot="primaryAction">
            <s-button
              type="submit"
              variant="primary"
              {...(isApplying ? { loading: true } : {})}
              {...(isBulkRunning ? { disabled: true } : {})}
            >
              {isBulkRunning
                ? "En curso…"
                : `Aplicar a ${bulkFix.processable} producto${bulkFix.processable === 1 ? "" : "s"}`}
            </s-button>
          </bulkFetcher.Form>
          <s-button
            slot="secondaryActions"
            command="--hide"
            commandFor="bulk-alt-modal"
          >
            {isBulkRunning ? "Cerrar (sigue en background)" : "Cancelar"}
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
