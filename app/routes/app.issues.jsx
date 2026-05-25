import { useEffect, useRef, useState } from "react";
import {
  useFetcher,
  useLoaderData,
  useRevalidator,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getCachedItems } from "../services/seo-cache";
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
const IMPACT_LABEL = { high: "Critical", medium: "Medium", low: "Low" };
const IMPACT_ORDER = { high: 0, medium: 1, low: 2 };

function groupIssuesByField(items) {
  const groups = new Map();
  for (const item of items) {
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
  const { admin, session } = await authenticate.admin(request);

  const cached = await getCachedItems(session.shop);

  let activeAnalysisJob = null;
  if (!cached) {
    activeAnalysisJob = await startAnalysisJob(session.shop, admin);
  } else if (cached.isStale) {
    startAnalysisJob(session.shop, admin).catch(() => {});
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
  const { admin, session } = await authenticate.admin(request);

  const cached = await getCachedItems(session.shop);
  if (!cached) {
    return { ok: false, error: "Cache unavailable. Reload the page." };
  }
  const eligibleGids = cached.eligibleAltGids;
  if (eligibleGids.length === 0) {
    return { ok: true, jobId: null, empty: true };
  }

  const job = await startBulkAltJob(session.shop, admin, eligibleGids);
  return { ok: true, jobId: job.id };
};

export default function Issues() {
  const {
    analyzing,
    analysisJob: initialAnalysisJob,
    bulkJob: initialBulkJob,
    groups,
    isStale,
    bulkFix,
  } = useLoaderData();
  const shopify = useAppBridge();
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
        const totalImages = summary.totalImages || 0;
        const ok = (summary.totalProducts || 0) - errCount;
        if (totalImages === 0 && summary.totalProducts === 0) {
          shopify.toast.show("No alt texts to add");
        } else if (totalImages === 0) {
          shopify.toast.show("Products already had alt text — list updated");
        } else {
          shopify.toast.show(
            `Done: ${ok} product${ok === 1 ? "" : "s"} · ${totalImages} alt text${totalImages === 1 ? "" : "s"} added${errCount ? ` · ${errCount} error${errCount === 1 ? "" : "s"}` : ""}`,
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
        <s-box slot="breadcrumbActions" paddingBlockEnd="base">
          <s-button icon="arrow-left" variant="tertiary" href="/app">
            Dashboard
          </s-button>
        </s-box>
        <s-section heading="Analyzing your store">
          <JobProgress job={analysisJob} label="Analyzing products" />
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Issues">
      <s-box slot="breadcrumbActions" paddingBlockEnd="base">
        <s-button icon="arrow-left" variant="tertiary" href="/app">
          Dashboard
        </s-button>
      </s-box>

      {lastBulkSummary && (
        <BulkFixSummaryBanner
          summary={lastBulkSummary}
          onDismiss={() => setLastBulkSummary(null)}
        />
      )}

      {isStale && isAnalyzing && (
        <s-banner tone="info" heading="Refreshing data">
          <s-paragraph>
            Showing the latest available analysis while we refresh in the
            background.
          </s-paragraph>
          <JobProgress job={analysisJob} label="Re-analyzing" />
        </s-banner>
      )}

      {groups.length === 0 ? (
        <s-section>
          <s-banner tone="success" heading="No issues found">
            <s-paragraph>
              Your catalog meets the SEO criteria. Nice work.
            </s-paragraph>
            <s-button slot="secondaryActions" href="/app">
              Back to dashboard
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
                  {group.productsCount} product
                  {group.productsCount === 1 ? "" : "s"} · {group.issuesCount}{" "}
                  issue{group.issuesCount === 1 ? "" : "s"}
                </s-text>
              </s-stack>
              <s-paragraph tone="subdued">{group.fix}</s-paragraph>

              <s-table>
                <s-table-header-row>
                  <s-table-header>Product</s-table-header>
                  <s-table-header>Action</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {(expandedGroups[group.field]
                    ? group.affectedProducts
                    : group.affectedProducts.slice(0, MAX_VISIBLE_PRODUCTS)
                  ).map((p) => (
                    <s-table-row key={p.productId}>
                      <s-table-cell>
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
                      </s-table-cell>
                      <s-table-cell>
                        <s-button
                          variant="tertiary"
                          href={`/app/products/${gidToNumericId(p.productId)}`}
                        >
                          View details
                        </s-button>
                      </s-table-cell>
                    </s-table-row>
                  ))}
                </s-table-body>
              </s-table>

              {group.productsCount > MAX_VISIBLE_PRODUCTS && (
                <s-button
                  variant="secondary"
                  onClick={() => toggleExpand(group.field)}
                >
                  {expandedGroups[group.field]
                    ? "Show less"
                    : `Show ${group.productsCount - MAX_VISIBLE_PRODUCTS} more`}
                </s-button>
              )}

              {group.field === "images.altText" && bulkFix.eligible > 0 && (
                <s-button
                  variant="primary"
                  command="--show"
                  commandFor="bulk-alt-modal"
                  onClick={() => {
                    if (!samples && previewFetcher.state === "idle") {
                      previewFetcher.load("/api/bulk-preview");
                    }
                  }}
                >
                  Fix all ({bulkFix.processable})
                </s-button>
              )}
            </s-stack>
          </s-section>
        ))
      )}

      {bulkFix.eligible > 0 && (
        <s-modal id="bulk-alt-modal" heading="Fix alt texts in bulk">
          <s-box paddingBlockEnd="base">
            <s-stack direction="block" gap="base">
              <s-paragraph>
                We&apos;ll process <s-text>{bulkFix.processable}</s-text> product
                {bulkFix.processable === 1 ? "" : "s"} and add alt text to
                images that don&apos;t have it.
              </s-paragraph>
              {isBulkRunning && (
                <JobProgress job={bulkJob} label="Applying alt texts" />
              )}
              {!isBulkRunning && isLoadingPreview && (
                <s-stack direction="inline" gap="small-300" alignment="center">
                  <s-spinner />
                  <s-text tone="subdued">Generating samples…</s-text>
                </s-stack>
              )}
              {!isBulkRunning && !isLoadingPreview && samples && samples.length > 0 && (
                <s-stack direction="block" gap="small-300">
                  <s-text tone="subdued">Pattern samples:</s-text>
                  {samples.map((s, idx) => (
                    <s-text key={idx}>
                      {s.productTitle} → &ldquo;{s.sampleAlt}&rdquo;
                    </s-text>
                  ))}
                </s-stack>
              )}
            </s-stack>
          </s-box>
          <s-stack direction="inline" gap="base" justifyContent="end">
            <s-button command="--hide" commandFor="bulk-alt-modal">
              {isBulkRunning ? "Close (keeps running)" : "Cancel"}
            </s-button>
            <s-button
              variant="primary"
              {...(isApplying ? { loading: true } : {})}
              {...(isBulkRunning ? { disabled: true } : {})}
              onClick={() => {
                if (!isApplying) bulkFetcher.submit({}, { method: "post" });
              }}
            >
              {isBulkRunning
                ? "Running…"
                : `Apply to ${bulkFix.processable} product${bulkFix.processable === 1 ? "" : "s"}`}
            </s-button>
          </s-stack>
        </s-modal>
      )}

    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
