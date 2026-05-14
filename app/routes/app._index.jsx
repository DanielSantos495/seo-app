import {
  Form,
  redirect,
  useLoaderData,
  useLocation,
  useRevalidator,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { FREE_PLAN_PRODUCT_LIMIT } from "../services/seo-analyzer";
import { getCachedItems, invalidateCache } from "../services/seo-cache";
import { checkIsPro } from "../services/billing";
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
  const { admin, session, billing } = await authenticate.admin(request);

  // Si el merchant acaba de aprobar el upgrade, invalidamos el cache para que
  // el siguiente análisis se haga ya como Pro (sin límite).
  const url = new URL(request.url);
  if (url.searchParams.get("upgraded") === "1") {
    await invalidateCache(session.shop);
  }

  const isPro = await checkIsPro(billing, session.shop);
  const currentPlan = isPro ? "pro" : "free";

  const cached = await getCachedItems(session.shop, currentPlan);

  // Stale-while-revalidate: si tenemos cache (aunque sea stale), respondemos
  // YA con esos datos y disparamos un re-análisis en background sin esperarlo.
  // Si no hay cache, también disparamos el job pero respondemos en estado
  // "analyzing" para que la UI muestre progreso (no se queda colgada).
  let activeJob = null;
  if (!cached) {
    activeJob = await startAnalysisJob(session.shop, admin, { isPro });
  } else if (cached.isStale) {
    // Fire-and-forget: el loader no espera al job.
    startAnalysisJob(session.shop, admin, { isPro }).catch(() => {});
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
      planLimit: FREE_PLAN_PRODUCT_LIMIT,
      analyzedAt: null,
      isPro,
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
    planLimit: FREE_PLAN_PRODUCT_LIMIT,
    analyzedAt: cached.analyzedAt.toISOString(),
    isPro,
    isStale: cached.isStale,
  };
};

// "Re-analizar ahora": dispara un job de análisis y vuelve al dashboard, que
// ahora muestra el progreso mientras corre.
export const action = async ({ request }) => {
  const { admin, session, billing } = await authenticate.admin(request);
  const isPro = await checkIsPro(billing, session.shop);
  await invalidateCache(session.shop);
  await startAnalysisJob(session.shop, admin, { isPro });
  return redirect("/app");
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
    planLimit,
    analyzedAt,
    isPro,
    isStale,
  } = useLoaderData();
  // Preservar los query params de Shopify (host, embedded, id_token...) en el
  // link al upgrade. Importante: el upgrade va por GET con full-page reload
  // (`target="_top"`) para evitar el bug de single-fetch + billing.request.
  const location = useLocation();
  const upgradeUrl = `/app/upgrade${location.search}`;

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
          <s-banner tone="critical" heading="El último análisis falló">
            <s-paragraph>
              {failedJob.errorMessage ||
                "Hubo un error inesperado. Probá de nuevo."}
            </s-paragraph>
            <Form method="post" slot="primaryAction">
              <s-button type="submit" variant="primary">
                Reintentar análisis
              </s-button>
            </Form>
          </s-banner>
        )}
        <s-section heading="Analizando tu tienda">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Estamos analizando todos tus productos por primera vez. Esto
              puede tomar unos minutos para tiendas grandes — podés cerrar esta
              pestaña, el análisis sigue en background.
            </s-paragraph>
            <JobProgress job={job} label="Analizando productos" />
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="SEO Analyzer">
      {failedJob && !isActive && (
        <s-banner tone="critical" heading="El último análisis falló">
          <s-paragraph>
            Estamos mostrando datos del análisis anterior.{" "}
            {failedJob.errorMessage ||
              "Hubo un error inesperado al refrescar."}
          </s-paragraph>
          <Form method="post" slot="primaryAction">
            <s-button type="submit" variant="primary">
              Reintentar
            </s-button>
          </Form>
        </s-banner>
      )}
      {isStale && isActive && (
        <s-banner tone="info" heading="Actualizando datos">
          <s-paragraph>
            Mostramos el último análisis disponible mientras refrescamos en
            background.
          </s-paragraph>
          <JobProgress job={job} label="Re-analizando" />
        </s-banner>
      )}
      {!isPro && (
        <s-banner
          tone="info"
          heading={`Plan Free · análisis limitado a ${planLimit} productos`}
        >
          <s-paragraph>
            Mejora a Pro para analizar todos tus productos y desbloquear el bulk
            fix de alt texts.
          </s-paragraph>
          <s-button
            slot="secondaryActions"
            variant="primary"
            href={upgradeUrl}
            target="_top"
          >
            Mejorar a Pro · $9/mes (7 días gratis)
          </s-button>
        </s-banner>
      )}

      <s-section heading="Score general de tu tienda">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base" alignment="center">
            <s-heading size="large">{report.overallScore}/100</s-heading>
            <s-badge tone={report.overallScore >= 80 ? "success" : report.overallScore >= 50 ? "caution" : "critical"}>
              {report.overallScore >= 80 ? "Bueno" : report.overallScore >= 50 ? "Regular" : "Crítico"}
            </s-badge>
            <s-text>
              Promedio sobre {report.totalProducts} producto
              {report.totalProducts === 1 ? "" : "s"} analizado
              {report.totalProducts === 1 ? "" : "s"}
              {report.totalProducts >= planLimit
                ? ` (límite del plan free: ${planLimit}).`
                : "."}
            </s-text>
          </s-stack>
          <s-text tone="subdued">
            Último análisis {formatRelativeTime(analyzedAt)}
          </s-text>
          <s-stack direction="inline" gap="base">
            <PrefetchButton to="/app/products" variant="primary">
              Ver todos los productos
            </PrefetchButton>
            <Form method="post">
              <s-button type="submit" variant="secondary">
                Re-analizar ahora
              </s-button>
            </Form>
            {isPro ? (
              <s-button variant="secondary" onClick={() => downloadCsv()}>
                Exportar CSV
              </s-button>
            ) : (
              <s-button
                href={upgradeUrl}
                target="_top"
                variant="secondary"
              >
                Pro: exportar CSV
              </s-button>
            )}
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Issues encontrados">
        <s-stack direction="block" gap="base">
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
          <PrefetchButton to="/app/issues">Ver issues agrupados por tipo</PrefetchButton>
        </s-stack>
      </s-section>

      {worstProducts.length > 0 && (
        <s-section heading="Productos con peor SEO">
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
                  <s-stack direction="block" gap="tight">
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
