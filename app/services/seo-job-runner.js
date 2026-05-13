// Orquestador de jobs en background. Sin queue externa (BullMQ, etc.) —
// usamos promises sin await que persisten progreso en cada batch. Cuando se
// justifique por escala, este es el único módulo que cambia.
//
// Garantías:
//   - El loader que dispara el job NO espera a que termine (responde rápido).
//   - Cada batch hace un heartbeat en la DB; si el proceso muere, el job
//     queda zombie y `findActiveJob` lo marca failed (ver seo-job.js).
//   - El job conoce su `processed/total` en todo momento para polling.

import { fetchAllProducts, bulkFixAltTextsForProducts } from "./shopify-api";
import {
  buildItemsFromProducts,
  setCachedItems,
  updateCachedItems,
} from "./seo-cache";
import { analyzeProduct, FREE_PLAN_PRODUCT_LIMIT } from "./seo-analyzer";
import {
  bumpProgress,
  createJob,
  failJob,
  findActiveJob,
  finishJob,
  startJob,
} from "./seo-job";

// Dispara un job de análisis full del catálogo. Si ya existe uno activo,
// devuelve ese mismo (idempotente).
export async function startAnalysisJob(shop, admin, { isPro }) {
  const existing = await findActiveJob(shop, "analysis");
  if (existing) return existing;

  const job = await createJob(shop, "analysis", {
    payload: { plan: isPro ? "pro" : "free" },
  });

  // Fire-and-forget: el caller no espera al resultado.
  runAnalysisJob(job.id, shop, admin, { isPro }).catch(async (err) => {
    console.error("[seo-job] analysis failed", err);
    await failJob(job.id, err.message);
  });

  return job;
}

async function runAnalysisJob(jobId, shop, admin, { isPro }) {
  await startJob(jobId);

  // Heartbeat cada N items para evitar zombies durante fetches largos. Por
  // cada página de productos (50 por default) hacemos un bump.
  const products = await fetchAllProducts(admin, {
    limit: isPro ? null : FREE_PLAN_PRODUCT_LIMIT,
    onPage: async ({ processed }) => {
      await bumpProgress(jobId, { processed });
    },
  });

  const items = buildItemsFromProducts(products, {
    limit: isPro ? null : FREE_PLAN_PRODUCT_LIMIT,
  });
  await setCachedItems(shop, items, isPro ? "pro" : "free");

  await finishJob(jobId, {
    resultSummary: { totalProducts: items.length },
  });
}

// Dispara un job de bulk fix de alt texts. `productGids` viene del cache
// (filtrado server-side, no del cliente). Sin cap: si la tienda tiene 1834
// elegibles, los procesamos todos.
export async function startBulkAltJob(shop, admin, productGids) {
  const existing = await findActiveJob(shop, "bulk_alt");
  if (existing) return existing;

  const job = await createJob(shop, "bulk_alt", {
    total: productGids.length,
    payload: { productGids },
  });

  runBulkAltJob(job.id, shop, admin, productGids).catch(async (err) => {
    console.error("[seo-job] bulk_alt failed", err);
    await failJob(job.id, err.message);
  });

  return job;
}

async function runBulkAltJob(jobId, shop, admin, productGids) {
  await startJob(jobId);

  const result = await bulkFixAltTextsForProducts(admin, productGids, {
    onProgress: async ({ processed }) => {
      await bumpProgress(jobId, { processed });
    },
  });

  // Update granular del cache: solo los productos que tocamos. Mucho mejor
  // que invalidar todo el catálogo y forzar un re-fetch completo en el
  // siguiente loader. Asumimos que tras el fix de alt texts, esos productos
  // pasan a 0 issues de tipo images.altText.
  if (result.fixedProductIds.length > 0) {
    await updateCachedItems(shop, result.fixedProductIds, (item) => {
      const newIssues = (item.issues || []).filter(
        (iss) => iss.field !== "images.altText",
      );
      // Re-calculamos score sumando los puntos del check de alt texts (20).
      const fixedPoints = item.issues?.some(
        (iss) => iss.field === "images.altText",
      )
        ? 20
        : 0;
      return {
        ...item,
        issues: newIssues,
        score: Math.min(100, (item.score || 0) + fixedPoints),
      };
    });
  }

  await finishJob(jobId, {
    resultSummary: {
      totalProducts: result.totalProducts,
      totalImages: result.totalImages,
      errors: result.errors,
    },
  });
}

// Helper para `analyzeProduct` desde fuera (lo necesita el runBulkAltJob si
// queremos re-calcular score con data real — futura mejora).
export { analyzeProduct };
