// Wrapper sobre `admin.graphql` con manejo central de rate limit + reintentos.
//
// Resuelve tres problemas que tenía el código previo:
//   1. THROTTLED de GraphQL no se reintentaba — el bulk fix se rompía.
//   2. No leíamos `extensions.cost.throttleStatus` para auto-throttle.
//   3. Backoff exponencial inconsistente entre llamadas.
//
// Uso:
//   import { shopifyGraphql } from "./shopify-fetch";
//   const json = await shopifyGraphql(admin, QUERY, { variables: {...} });
//
// Devuelve el JSON ya parseado (no la Response cruda). Si tras `MAX_RETRIES`
// sigue fallando, propaga el último error.

const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 500;
// Si el bucket de Shopify queda con menos de este % de capacidad disponible
// respecto al costo de la última query, esperamos a que se restaure.
const LOW_BUCKET_RATIO = 1.5;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// `admin.graphql` puede devolver una Response (fetch-like) o un objeto con `.json()`.
// Normalizamos a JSON.
async function toJson(response) {
  if (typeof response?.json === "function") return response.json();
  return response;
}

function isThrottled(json) {
  const errors = json?.errors || [];
  return errors.some(
    (e) => e.extensions?.code === "THROTTLED" || /throttled/i.test(e.message || ""),
  );
}

// Lee el throttleStatus del response y, si el bucket está bajo, espera
// `restoreRate` * `deficit` segundos antes de devolver. Esto evita que la
// próxima llamada pegue contra el límite.
async function autoThrottle(json, queryCost) {
  const status = json?.extensions?.cost?.throttleStatus;
  if (!status) return;
  const { currentlyAvailable, restoreRate } = status;
  const safeFloor = queryCost * LOW_BUCKET_RATIO;
  if (currentlyAvailable >= safeFloor) return;
  const deficit = safeFloor - currentlyAvailable;
  const waitMs = Math.ceil((deficit / restoreRate) * 1000);
  // Cap defensivo: nunca dormir más de 3s por auto-throttle.
  await sleep(Math.min(waitMs, 3000));
}

export async function shopifyGraphql(admin, query, options = {}) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await admin.graphql(query, options);
      // Si recibimos un 429 explícito, respetamos Retry-After.
      if (response?.status === 429) {
        const retryAfter = Number(response.headers?.get?.("Retry-After")) || 1;
        await sleep(retryAfter * 1000);
        continue;
      }
      const json = await toJson(response);
      if (isThrottled(json)) {
        // Backoff exponencial con jitter.
        const wait = BASE_BACKOFF_MS * 2 ** attempt + Math.random() * 200;
        await sleep(wait);
        continue;
      }
      const queryCost = json?.extensions?.cost?.requestedQueryCost || 1;
      await autoThrottle(json, queryCost);
      return json;
    } catch (err) {
      lastError = err;
      const wait = BASE_BACKOFF_MS * 2 ** attempt + Math.random() * 200;
      await sleep(wait);
    }
  }
  throw lastError || new Error("shopifyGraphql failed after retries");
}
