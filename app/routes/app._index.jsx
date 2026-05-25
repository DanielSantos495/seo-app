import {
  Form,
  redirect,
  useLoaderData,
  useRevalidator,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getCachedItems, invalidateCache } from "../services/seo-cache";
import { gidToNumericId } from "../services/admin-links";
import {
  findActiveJob,
  findRecentFailedJob,
  serializeJob,
} from "../services/seo-job";
import { startAnalysisJob } from "../services/seo-job-runner";
import { PrefetchButton, PrefetchClickable } from "../components/NavLink";
import { JobProgress, useJobPolling } from "../components/JobProgress";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const cached = await getCachedItems(session.shop);

  // Stale-while-revalidate: si tenemos cache (aunque sea stale), respondemos
  // YA con esos datos y disparamos un re-análisis en background sin esperarlo.
  // Si no hay cache, también disparamos el job pero respondemos en estado
  // "analyzing" para que la UI muestre progreso (no se queda colgada).
  let activeJob = null;
  if (!cached) {
    activeJob = await startAnalysisJob(session.shop, admin);
  } else if (cached.isStale) {
    // Fire-and-forget: el loader no espera al job.
    startAnalysisJob(session.shop, admin).catch(() => {});
    activeJob = await findActiveJob(session.shop, "analysis");
  }

  // Si el último intento falló y no hay uno activo, mostramos banner accionable
  // en lugar de degradar la UX silenciosamente.
  const failedJob = activeJob
    ? null
    : await findRecentFailedJob(session.shop, "analysis");

  if (!cached) {
    return {
      analyzing: true,
      job: serializeJob(activeJob),
      failedJob: serializeJob(failedJob),
      report: null,
      worstProducts: [],
      analyzedAt: null,
      isStale: false,
    };
  }

  // Derivados pre-computados al guardar el cache — el dashboard ya no
  // recalcula nada sobre `items`. Ver computeDerivatives en seo-cache.js.
  return {
    analyzing: false,
    job: serializeJob(activeJob),
    failedJob: serializeJob(failedJob),
    report: cached.summary,
    worstProducts: cached.worstProducts,
    analyzedAt: cached.analyzedAt.toISOString(),
    isStale: cached.isStale,
  };
};

// "Re-analizar ahora": dispara un job de análisis y vuelve al dashboard, que
// ahora muestra el progreso mientras corre.
export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  await invalidateCache(session.shop);
  await startAnalysisJob(session.shop, admin);
  return redirect("/app");
};

function formatRelativeTime(isoDate) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

async function downloadCsv() {
  // App Bridge React 4 adjunta automáticamente el session token a `fetch`
  // hacia rutas same-origin. Si en algún momento el patch falla, fallback
  // a `target="_top"` con `id_token` en query.
  const response = await fetch("/api/export.csv");
  if (!response.ok) {
    throw new Error(`Export failed: ${response.status}`);
  }
  const blob = await response.blob();
  const filename =
    response.headers
      .get("Content-Disposition")
      ?.match(/filename="(.+)"/)?.[1] || "seo-report.csv";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Index() {
  const {
    analyzing,
    job: initialJob,
    failedJob,
    report,
    worstProducts,
    analyzedAt,
    isStale,
  } = useLoaderData();

  // Polling del job de análisis: si hay uno corriendo (sea porque no había
  // cache o porque el cache es stale), trackeamos su progreso y revalidamos
  // el loader cuando termina para mostrar el reporte fresco.
  const revalidator = useRevalidator();
  const { job, isActive } = useJobPolling({
    initialJob,
    byType: "analysis",
    onFinish: () => revalidator.revalidate(),
  });

  // Estado "primer análisis": no hay reporte aún, mostramos solo progreso.
  if (analyzing && !report) {
    return (
      <s-page heading="SEO Analyzer">
        {failedJob && (
          <s-banner tone="critical" heading="Last analysis failed">
            <s-paragraph>
              {failedJob.errorMessage ||
                "An unexpected error occurred. Try again."}
            </s-paragraph>
            <Form method="post" slot="primaryAction">
              <s-button type="submit" variant="primary">
                Retry analysis
              </s-button>
            </Form>
          </s-banner>
        )}
        <s-section heading="Analyzing your store">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              We&apos;re analyzing all your products for the first time. This can
              take a few minutes for large stores — you can close this tab and
              the analysis will keep running in the background.
            </s-paragraph>
            <JobProgress job={job} label="Analyzing products" />
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="SEO Analyzer">
      {failedJob && !isActive && (
        <s-banner tone="critical" heading="Last analysis failed">
          <s-paragraph>
            Showing data from the previous analysis.{" "}
            {failedJob.errorMessage ||
              "An unexpected error occurred while refreshing."}
          </s-paragraph>
          <Form method="post" slot="primaryAction">
            <s-button type="submit" variant="primary">
              Retry
            </s-button>
          </Form>
        </s-banner>
      )}
      {isStale && isActive && (
        <s-banner tone="info" heading="Refreshing data">
          <s-paragraph>
            Showing the latest available analysis while we refresh in the
            background.
          </s-paragraph>
          <JobProgress job={job} label="Re-analyzing" />
        </s-banner>
      )}
      <s-section heading="Catalog completeness check">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base" alignment="center">
            <s-heading size="large">{report.overallScore}/100</s-heading>
            <s-badge tone={report.overallScore >= 80 ? "success" : report.overallScore >= 50 ? "caution" : "critical"}>
              {report.overallScore >= 80 ? "Good" : report.overallScore >= 50 ? "Fair" : "Needs work"}
            </s-badge>
            <s-text>
              Average across {report.totalProducts} product
              {report.totalProducts === 1 ? "" : "s"} on the five checks below.
            </s-text>
          </s-stack>
          <s-text tone="subdued">
            This score reflects how many of the five technical checks
            (meta title, meta description, image alt text, product description
            length, URL handle) are passing across your catalog. It is not a
            Google ranking or a traffic estimate.
          </s-text>
          <s-text tone="subdued">
            Last analyzed {formatRelativeTime(analyzedAt)}
          </s-text>
          <s-stack direction="inline" gap="base">
            <PrefetchButton to="/app/products" variant="primary">
              View all products
            </PrefetchButton>
            <Form method="post">
              <s-button type="submit" variant="secondary">
                Re-analyze now
              </s-button>
            </Form>
            <s-button variant="secondary" onClick={() => downloadCsv()}>
              Export CSV
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Issues found">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="large">
            {[
              { label: "Critical", count: report.issuesByImpact.high, tone: "critical" },
              { label: "Medium", count: report.issuesByImpact.medium, tone: "caution" },
              { label: "Low", count: report.issuesByImpact.low, tone: "info" },
            ].map(({ label, count, tone }) => (
              <s-box
                key={label}
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <s-stack direction="block" gap="small-300" alignment="center">
                  <s-heading>{count}</s-heading>
                  <s-text tone={tone}>{label}</s-text>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
          <PrefetchButton to="/app/issues">View issues grouped by type</PrefetchButton>
        </s-stack>
      </s-section>

      {worstProducts.length > 0 && (
        <s-section heading="Lowest-scoring products">
          <s-stack direction="block" gap="base">
            {worstProducts.map((product) => (
              <PrefetchClickable
                key={product.productId}
                to={`/app/products/${gidToNumericId(product.productId)}`}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="inline" gap="base" alignment="center">
                  <s-heading>{product.score}</s-heading>
                  <s-stack direction="block" gap="small-300">
                    <s-text>{product.title}</s-text>
                    <s-text tone="subdued">
                      {product.issues.length} issue
                      {product.issues.length === 1 ? "" : "s"} ·{" "}
                      {product.issues[0]?.message}
                    </s-text>
                  </s-stack>
                </s-stack>
              </PrefetchClickable>
            ))}
          </s-stack>
        </s-section>
      )}

      {report.totalProducts === 0 && (
        <s-section heading="No products">
          <s-paragraph>
            This store doesn&apos;t have any products yet. Create some in your
            Shopify admin, then come back to see the analysis.
          </s-paragraph>
        </s-section>
      )}
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
