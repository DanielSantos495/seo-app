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
      JSON.stringify({ error: "Esta acción es solo para plan Pro" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  // Tomamos los elegibles directamente del cache pre-computado.
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

const SORT_OPTIONS = [
  { value: "worst", label: "Peor score primero" },
  { value: "best", label: "Mejor score primero" },
  { value: "az", label: "Nombre A-Z" },
  { value: "za", label: "Nombre Z-A" },
];

const SORT_ICONS = {
  worst: "sort-descending",
  best: "sort-ascending",
  az: "sort-ascending",
  za: "sort-descending",
};

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
          shopify.toast.show("No había alt texts para agregar");
        } else if (totalImages === 0) {
          shopify.toast.show("Productos ya tenían alt — listado actualizado");
        } else {
          shopify.toast.show(
            `Listo: ${ok} producto${ok === 1 ? "" : "s"} · ${totalImages} alt text${totalImages === 1 ? "" : "s"}${errCount ? ` · ${errCount} error${errCount === 1 ? "" : "es"}` : ""}`,
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
      <s-page heading="Productos">
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
    <s-page heading="Productos">
      <s-button slot="breadcrumbActions" icon="arrow-left" variant="tertiary" href="/app">
        Dashboard
      </s-button>

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

      {!isPro && lockedCount > 0 && (
        <s-banner tone="info" heading="Estás en el plan Free">
          <s-paragraph>
            Analizamos los primeros {planLimit} productos. Tienes {lockedCount}{" "}
            producto{lockedCount === 1 ? "" : "s"} más esperando análisis.
            Mejora a Pro para desbloquear todos.
          </s-paragraph>
        </s-banner>
      )}

      <s-section>
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base">
            <s-search-field
              label="Buscar producto"
              placeholder="Nombre o handle…"
              value={query}
              onInput={(event) => setQuery(event.target.value)}
            />
            <s-button
              id="sort-btn"
              variant="secondary"
              icon={SORT_ICONS[sortKey]}
              command="--toggle"
              commandFor="sort-popover"
            >
              {SORT_OPTIONS.find((o) => o.value === sortKey)?.label}
            </s-button>
            <s-popover id="sort-popover">
              {SORT_OPTIONS.map((opt) => (
                <s-button
                  key={opt.value}
                  variant={sortKey === opt.value ? "secondary" : "auto"}
                  onClick={() => {
                    setSortKey(opt.value);
                    document.getElementById("sort-popover")?.hideOverlay?.();
                  }}
                >
                  {opt.label}
                </s-button>
              ))}
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
                  ? `Arreglar alt texts (${bulkFix.processable})`
                  : `Pro: arreglar alt texts (${bulkFix.eligible})`}
              </s-button>
            )}
          </s-stack>

          {displayed.length === 0 ? (
            <s-banner tone="info">
              <s-paragraph>
                {items.length === 0
                  ? "Esta tienda aún no tiene productos."
                  : `Ningún producto coincide con "${query}".`}
              </s-paragraph>
            </s-banner>
          ) : (
            <>
              <s-table>
                <s-table-header-row>
                  <s-table-header>Producto</s-table-header>
                  <s-table-header>Score</s-table-header>
                  <s-table-header>Issues</s-table-header>
                  <s-table-header>Acción</s-table-header>
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
                            Desbloquear
                          </s-button>
                        ) : (
                          <s-button
                            variant="tertiary"
                            href={`/app/products/${gidToNumericId(item.productId)}`}
                          >
                            Ver detalle
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
                    Anterior
                  </s-button>
                  <s-text tone="subdued">
                    Página {currentPage} de {totalPages} · {displayed.length}{" "}
                    producto{displayed.length === 1 ? "" : "s"}
                  </s-text>
                  <s-button
                    variant="tertiary"
                    {...(currentPage === totalPages ? { disabled: true } : {})}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Siguiente
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
          heading="Arreglar alt texts en lote"
        >
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

      <s-modal
        id="upgrade-modal"
        heading="Mejora a Pro para desbloquear más productos"
      >
        <s-paragraph>
          El plan Free analiza los primeros {planLimit} productos de tu tienda.
          Con el plan Pro analizamos todos sin límite y desbloqueas el bulk fix
          de alt texts.
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
    </s-page>
  );
}

/* eslint-disable react/prop-types */
function ScoreBadge({ score, locked }) {
  if (locked) return <s-badge tone="neutral">Bloqueado</s-badge>;
  let tone = "critical";
  if (score >= 80) tone = "success";
  else if (score >= 50) tone = "caution";
  return <s-badge tone={tone}>{score}</s-badge>;
}

function IssuesSummary({ issues, locked }) {
  if (locked) return <s-text tone="subdued">—</s-text>;
  if (issues.length === 0) return <s-text tone="subdued">Sin issues</s-text>;
  const counts = { high: 0, medium: 0, low: 0 };
  for (const i of issues) counts[i.impact]++;
  const parts = [];
  if (counts.high) parts.push(`${counts.high} crítico${counts.high === 1 ? "" : "s"}`);
  if (counts.medium) parts.push(`${counts.medium} medio${counts.medium === 1 ? "" : "s"}`);
  if (counts.low) parts.push(`${counts.low} bajo${counts.low === 1 ? "" : "s"}`);
  return <s-text>{parts.join(" · ")}</s-text>;
}
/* eslint-enable react/prop-types */

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
