import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useFetcher,
  useLoaderData,
  useLocation,
  useRevalidator,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { FREE_PLAN_PRODUCT_LIMIT } from "../services/seo-analyzer";
import { getCachedItems } from "../services/seo-cache";
import { checkIsPro } from "../services/billing";
import { gidToNumericId } from "../services/admin-links";
import { resizeCdnUrl } from "../services/image-url";
import { findActiveJob, serializeJob } from "../services/seo-job";
import {
  startAnalysisJob,
  startBulkAltJob,
} from "../services/seo-job-runner";
import { JobProgress, useJobPolling } from "../components/JobProgress";
import BulkFixSummaryBanner from "../components/BulkFixSummaryBanner";

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
      items: [],
      planLimit: FREE_PLAN_PRODUCT_LIMIT,
      analyzedAt: null,
      isPro,
      isStale: false,
      bulkFix: { eligible: 0, processable: 0 },
    };
  }

  // eligibleAltGids viene pre-computado del cache (Sprint 4).
  const eligibleCount = cached.eligibleAltGids.length;

  return {
    analyzing: false,
    analysisJob: serializeJob(activeAnalysisJob),
    bulkJob: serializeJob(activeBulkJob),
    items: cached.items,
    planLimit: FREE_PLAN_PRODUCT_LIMIT,
    analyzedAt: cached.analyzedAt.toISOString(),
    isPro,
    isStale: cached.isStale,
    bulkFix: {
      // Sin cap: el job procesa todos los elegibles.
      eligible: eligibleCount,
      processable: eligibleCount,
    },
  };
};

// El action dispara un job de bulk fix y devuelve inmediatamente el jobId.
// El cliente polléa /api/job-status para ver progreso. Sin bloqueo del POST.
export const action = async ({ request }) => {
  const { admin, session, billing } = await authenticate.admin(request);

  const isPro = await checkIsPro(billing, session.shop);
  if (!isPro) {
    return new Response(
      JSON.stringify({ error: "This action is only available on the Pro plan" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  // Tomamos los elegibles directamente del cache pre-computado.
  const cached = await getCachedItems(session.shop, "pro");
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

const SORT_OPTIONS = [
  { value: "worst", label: "Lowest score first" },
  { value: "best", label: "Highest score first" },
  { value: "az", label: "Name A–Z" },
  { value: "za", label: "Name Z–A" },
];

export default function Products() {
  const {
    analyzing,
    analysisJob: initialAnalysisJob,
    bulkJob: initialBulkJob,
    items,
    planLimit,
    isPro,
    isStale,
    bulkFix,
  } = useLoaderData();
  const shopify = useAppBridge();
  // Preview fetcher: trae los samples cuando se abre el modal.
  const previewFetcher = useFetcher();
  const samples = previewFetcher.data?.samples;
  const isLoadingPreview = previewFetcher.state === "loading";
  // Bulk fix fetcher: ya no usamos Form/useNavigation porque queremos disparar
  // el job sin remontar la página. El action devuelve { jobId } al toque.
  const bulkFetcher = useFetcher();
  const bulkActionData = bulkFetcher.data;
  const submittedJobId = bulkActionData?.jobId;
  // Upgrade va por GET con full-page reload (`target="_top"`) para evitar el bug
  // de single-fetch + billing.request. Conservamos los query params de Shopify.
  const location = useLocation();
  const upgradeUrl = `/app/upgrade${location.search}`;
  const revalidator = useRevalidator();

  // Job de análisis (stale-while-revalidate o primer fetch).
  const { job: analysisJob, isActive: isAnalyzing } = useJobPolling({
    initialJob: initialAnalysisJob,
    byType: "analysis",
    onFinish: () => revalidator.revalidate(),
  });

  // Banner persistente con el resumen del último bulk fix (se cierra
  // manualmente con "Entendido"). El toast efímero se mantiene como heads-up.
  const [lastBulkSummary, setLastBulkSummary] = useState(null);

  // Job de bulk fix activo.
  const { job: bulkJob, isActive: isBulkRunning } = useJobPolling({
    initialJob: submittedJobId
      ? { id: submittedJobId, status: "running", processed: 0, total: 0 }
      : initialBulkJob,
    byId: submittedJobId,
    byType: submittedJobId ? null : "bulk_alt",
    onFinish: (finalJob) => {
      // finalJob puede ser null si el polling no llegó a capturar el
      // resultado antes de que se limpie. Igual revalidamos para que el
      // loader refresque con la data nueva.
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

  // Si la action devolvió error. Ref para no duplicar toast en revalidaciones.
  const errorToastRef = useRef(null);
  useEffect(() => {
    if (!bulkActionData?.error) return;
    if (errorToastRef.current === bulkActionData) return;
    errorToastRef.current = bulkActionData;
    shopify.toast.show(`Error: ${bulkActionData.error}`, { isError: true });
  }, [bulkActionData, shopify]);

  const isApplying = bulkFetcher.state !== "idle" || isBulkRunning;

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("worst");
  const [page, setPage] = useState(1);
  // useDeferredValue evita filtrar el catálogo en cada keystroke — React
  // mantiene la UI receptiva y filtra cuando el render principal está libre.
  const deferredQuery = useDeferredValue(query);

  // Resetear página cuando cambia el filtro/orden — si estás en la pág 5 y
  // buscás algo que solo deja 30 items, no quedás "fuera de rango".
  useEffect(() => {
    setPage(1);
  }, [deferredQuery, sortKey]);

  const displayed = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const filtered = q
      ? items.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.handle.toLowerCase().includes(q),
        )
      : items;

    const sorted = [...filtered];
    // Locked siempre al final cuando ordenamos por score.
    const byScore = (dir) => (a, b) => {
      if (a.locked && !b.locked) return 1;
      if (!a.locked && b.locked) return -1;
      if (a.locked && b.locked) return 0;
      const aScore = a.score ?? -1;
      const bScore = b.score ?? -1;
      return dir === "asc" ? aScore - bScore : bScore - aScore;
    };

    switch (sortKey) {
      case "worst":
        sorted.sort(byScore("asc"));
        break;
      case "best":
        sorted.sort(byScore("desc"));
        break;
      case "az":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "za":
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      default:
        break;
    }
    return sorted;
  }, [items, deferredQuery, sortKey]);

  const lockedCount = items.filter((i) => i.locked).length;

  // Paginación cliente: renderizar 2k+ filas a la vez congela el navegador.
  // 50 por página + controles son suficientes y no requieren librerías.
  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(displayed.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = displayed.slice(pageStart, pageStart + PAGE_SIZE);

  // Primer análisis en curso: sin items, solo mostramos progreso.
  if (analyzing) {
    return (
      <s-page heading="Products">
        <s-link slot="breadcrumbActions" href="/app">
          Dashboard
        </s-link>
        <s-section heading="Analyzing your store">
          <JobProgress job={analysisJob} label="Analyzing products" />
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Products">
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

      {!isPro && lockedCount > 0 && (
        <s-banner tone="info" heading="You're on the Free plan">
          <s-paragraph>
            We analyzed the first {planLimit} products. You have {lockedCount}{" "}
            more product{lockedCount === 1 ? "" : "s"} waiting. Upgrade to Pro
            to unlock them all.
          </s-paragraph>
        </s-banner>
      )}

      <s-section>
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base">
            <s-search-field
              label="Search products"
              placeholder="Name or handle…"
              value={query}
              onInput={(event) => setQuery(event.target.value)}
            />
            <s-button
              icon="sort"
              variant="tertiary"
              command="--toggle"
              commandFor="sort-popover"
            >
              {SORT_OPTIONS.find((o) => o.value === sortKey)?.label}
            </s-button>
            <s-popover id="sort-popover" inlineSize="280">
              <s-stack direction="block" gap="none" padding="tight">
                {SORT_OPTIONS.map((opt) => (
                  <s-clickable
                    key={opt.value}
                    padding="base"
                    onClick={() => {
                      setSortKey(opt.value);
                      document.getElementById("sort-popover")?.hideOverlay?.();
                    }}
                  >
                    <s-stack
                      direction="inline"
                      alignment="center"
                      justifyContent="space-between"
                      gap="tight"
                    >
                      <s-text>{opt.label}</s-text>
                      {sortKey === opt.value && <s-icon type="check" />}
                    </s-stack>
                  </s-clickable>
                ))}
              </s-stack>
            </s-popover>
            {bulkFix.eligible > 0 && (
              <s-button
                variant="primary"
                command="--show"
                commandFor={isPro ? "bulk-alt-modal" : "upgrade-modal"}
                onClick={() => {
                  // Solo cargamos preview si es Pro y aún no lo cargamos.
                  if (isPro && !samples && previewFetcher.state === "idle") {
                    previewFetcher.load("/api/bulk-preview");
                  }
                }}
              >
                {isPro
                  ? `Fix alt texts (${bulkFix.processable})`
                  : `Pro: fix alt texts (${bulkFix.eligible})`}
              </s-button>
            )}
          </s-stack>

          {displayed.length === 0 ? (
            <s-banner tone="info">
              <s-paragraph>
                {items.length === 0
                  ? "This store doesn't have any products yet."
                  : `No products match "${query}".`}
              </s-paragraph>
            </s-banner>
          ) : (
            <>
              <s-table>
                <s-table-header-row>
                  <s-table-header>Product</s-table-header>
                  <s-table-header>Score</s-table-header>
                  <s-table-header>Issues</s-table-header>
                  <s-table-header>Action</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {pageRows.map((item) => (
                    <s-table-row key={item.productId}>
                      <s-table-cell>
                        <s-stack direction="inline" gap="base" alignment="center">
                          {item.thumbnailUrl && (
                            <s-thumbnail
                              src={resizeCdnUrl(item.thumbnailUrl, 80)}
                              alt={item.thumbnailAlt}
                              size="small"
                              loading="lazy"
                            />
                          )}
                          <s-stack direction="block" gap="tight">
                            <s-text>{item.title}</s-text>
                            <s-text tone="subdued">{item.handle}</s-text>
                          </s-stack>
                        </s-stack>
                      </s-table-cell>
                      <s-table-cell>
                        <ScoreBadge score={item.score} locked={item.locked} />
                      </s-table-cell>
                      <s-table-cell>
                        <IssuesSummary issues={item.issues} locked={item.locked} />
                      </s-table-cell>
                      <s-table-cell>
                        {item.locked ? (
                          <s-button
                            variant="tertiary"
                            command="--show"
                            commandFor="upgrade-modal"
                          >
                            Unlock
                          </s-button>
                        ) : (
                          <s-button
                            variant="tertiary"
                            href={`/app/products/${gidToNumericId(item.productId)}`}
                          >
                            View details
                          </s-button>
                        )}
                      </s-table-cell>
                    </s-table-row>
                  ))}
                </s-table-body>
              </s-table>

              {totalPages > 1 && (
                <s-stack direction="inline" gap="base" alignment="center">
                  <s-button
                    variant="tertiary"
                    {...(currentPage === 1 ? { disabled: true } : {})}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Previous
                  </s-button>
                  <s-text tone="subdued">
                    Page {currentPage} of {totalPages} · {displayed.length}{" "}
                    product{displayed.length === 1 ? "" : "s"}
                  </s-text>
                  <s-button
                    variant="tertiary"
                    {...(currentPage === totalPages ? { disabled: true } : {})}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next
                  </s-button>
                </s-stack>
              )}
            </>
          )}
        </s-stack>
      </s-section>

      {isPro && bulkFix.eligible > 0 && (
        <s-modal
          id="bulk-alt-modal"
          heading="Fix alt texts in bulk"
        >
          <s-box paddingBlockEnd="base">
            <s-stack direction="block" gap="base">
              <s-paragraph>
                We'll process <s-text>{bulkFix.processable}</s-text> product
                {bulkFix.processable === 1 ? "" : "s"} and add alt text to
                images that don't have it.
              </s-paragraph>
              {isBulkRunning && (
                <JobProgress job={bulkJob} label="Applying alt texts" />
              )}
              {!isBulkRunning && isLoadingPreview && (
                <s-stack direction="inline" gap="tight" alignment="center">
                  <s-spinner />
                  <s-text tone="subdued">Generating samples…</s-text>
                </s-stack>
              )}
              {!isBulkRunning && !isLoadingPreview && samples && samples.length > 0 && (
                <s-stack direction="block" gap="tight">
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

      <s-modal
        id="upgrade-modal"
        heading="Upgrade to Pro to unlock more products"
      >
        <s-paragraph>
          The Free plan analyzes the first {planLimit} products in your store.
          With the Pro plan, we analyze all of them with no limit and you
          unlock bulk alt text fixes.
        </s-paragraph>
        <s-button
          slot="primaryAction"
          variant="primary"
          href={upgradeUrl}
          target="_top"
        >
          Upgrade to Pro · $9/month (7-day free trial)
        </s-button>
        <s-button
          slot="secondaryActions"
          command="--hide"
          commandFor="upgrade-modal"
        >
          Close
        </s-button>
      </s-modal>
    </s-page>
  );
}

/* eslint-disable react/prop-types */
function ScoreBadge({ score, locked }) {
  if (locked) return <s-badge tone="neutral">Locked</s-badge>;
  let tone = "critical";
  if (score >= 80) tone = "success";
  else if (score >= 50) tone = "caution";
  return <s-badge tone={tone}>{score}</s-badge>;
}

function IssuesSummary({ issues, locked }) {
  if (locked) return <s-text tone="subdued">—</s-text>;
  if (issues.length === 0) return <s-text tone="subdued">No issues</s-text>;
  const counts = { high: 0, medium: 0, low: 0 };
  for (const i of issues) counts[i.impact]++;
  const parts = [];
  if (counts.high) parts.push(`${counts.high} critical`);
  if (counts.medium) parts.push(`${counts.medium} medium`);
  if (counts.low) parts.push(`${counts.low} low`);
  return <s-text>{parts.join(" · ")}</s-text>;
}
/* eslint-enable react/prop-types */

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
