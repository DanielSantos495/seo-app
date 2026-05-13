import { useEffect, useMemo, useState } from "react";
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

const BULK_CAP = 50;

function getEligibleGids(items) {
  return items
    .filter(
      (i) =>
        !i.locked &&
        i.issues?.some((iss) => iss.field === "images.altText"),
    )
    .map((i) => i.productId);
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

  const eligibleGids = getEligibleGids(cached.items);

  // Nota: ya no resolvemos `samples` acá. Se cargan on-demand desde
  // /api/bulk-preview cuando el merchant abre el modal — ahorra 3 round-trips
  // por navegación.
  return {
    items: cached.items,
    planLimit: FREE_PLAN_PRODUCT_LIMIT,
    analyzedAt: cached.analyzedAt.toISOString(),
    isPro,
    bulkFix: {
      eligible: eligibleGids.length,
      processable: Math.min(eligibleGids.length, BULK_CAP),
      exceedsCap: eligibleGids.length > BULK_CAP,
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

  // Recalcular elegibles con data fresca — no confiamos en lo que vino del cliente.
  const cached = await getCachedItems(session.shop, "pro");
  if (!cached) {
    return { ok: false, error: "Cache no disponible. Recargá la página." };
  }
  const eligibleGids = getEligibleGids(cached.items).slice(0, BULK_CAP);
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

const SORT_OPTIONS = [
  { value: "worst", label: "Peor score primero" },
  { value: "best", label: "Mejor score primero" },
  { value: "az", label: "Nombre A-Z" },
  { value: "za", label: "Nombre Z-A" },
];

export default function Products() {
  const { items, planLimit, analyzedAt, isPro, bulkFix } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  // Fetcher para cargar los samples del bulk fix on-demand al abrir el modal.
  const previewFetcher = useFetcher();
  const samples = previewFetcher.data?.samples;
  const isLoadingPreview = previewFetcher.state === "loading";
  // Upgrade va por GET con full-page reload (`target="_top"`) para evitar el bug
  // de single-fetch + billing.request. Conservamos los query params de Shopify.
  const location = useLocation();
  const upgradeUrl = `/app/upgrade${location.search}`;
  const isApplying = navigation.state === "submitting";

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

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("worst");

  const displayed = useMemo(() => {
    const q = query.trim().toLowerCase();
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
  }, [items, query, sortKey]);

  const lockedCount = items.filter((i) => i.locked).length;

  return (
    <s-page heading="Productos">
      <s-link slot="breadcrumbActions" href="/app">
        Dashboard
      </s-link>

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
          <s-text tone="subdued">
            Último análisis {formatRelativeTime(analyzedAt)}
          </s-text>
          <s-stack direction="inline" gap="base">
            <s-search-field
              label="Buscar producto"
              placeholder="Nombre o handle…"
              value={query}
              onInput={(event) => setQuery(event.target.value)}
            />
            <s-select
              label="Ordenar por"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value)}
            >
              {SORT_OPTIONS.map((opt) => (
                <s-option key={opt.value} value={opt.value}>
                  {opt.label}
                </s-option>
              ))}
            </s-select>
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
            <s-table>
              <s-table-header-row>
                <s-table-header>Producto</s-table-header>
                <s-table-header>Score</s-table-header>
                <s-table-header>Issues</s-table-header>
                <s-table-header>Acción</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {displayed.map((item) => (
                  <s-table-row key={item.productId}>
                    <s-table-cell>
                      <s-stack direction="inline" gap="base" alignment="center">
                        {item.thumbnailUrl && (
                          <s-thumbnail
                            src={item.thumbnailUrl}
                            alt={item.thumbnailAlt}
                            size="small"
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
          {bulkFix.exceedsCap && (
            <s-banner tone="info">
              <s-paragraph>
                Tu tienda tiene {bulkFix.eligible} productos elegibles.
                Procesaremos los primeros {BULK_CAP}; volvé a ejecutar para
                el resto.
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
