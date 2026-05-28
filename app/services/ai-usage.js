// Tracking mensual de uso de features de IA por tienda.
// Módulo server-only: usa prisma + quota de plan.

import prisma from "../db.server.js";
import { quota } from "./plan.js";

// Costo estimado por alt text generado con Claude Haiku Vision (~$0.002/imagen).
export const AI_ALT_COST_USD = 0.002;

// Umbral de alerta de costo mensual por tienda.
export const COST_ALERT_USD = 5;

// ---------------------------------------------------------------------------
// Helpers puros (sin DB, testeables unitariamente)
// ---------------------------------------------------------------------------

/**
 * Devuelve el período actual como "YYYY-MM" en UTC.
 * @param {Date} date
 * @returns {string}
 */
export function currentPeriod(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

/**
 * Calcula unidades restantes del período dado el uso ya registrado.
 * Clampea a 0 (nunca negativo).
 * @param {string} plan  - tier del merchant ("free"|"pro"|"pro_plus")
 * @param {string} key   - clave de entitlement ("aiAlt"|"aiMeta"|…)
 * @param {number} used  - unidades ya consumidas en el período
 * @returns {number}
 */
export function remainingFromUsed(plan, key, used) {
  return Math.max(0, quota(plan, key) - used);
}

/**
 * Costo estimado en USD dado un número de generaciones de alt text.
 * @param {number} count
 * @returns {number}
 */
export function estimatedCostUsd(count) {
  return count * AI_ALT_COST_USD;
}

// ---------------------------------------------------------------------------
// Funciones async con DB
// ---------------------------------------------------------------------------

/**
 * Lee la fila AiUsage del período actual para la tienda.
 * Si no existe, devuelve un objeto default SIN crear fila en DB.
 * @param {string} shop
 * @returns {Promise<{shop:string, period:string, aiAlt:number}>}
 */
export async function getUsage(shop) {
  const period = currentPeriod();
  const row = await prisma.aiUsage.findUnique({
    where: { shop_period: { shop, period } },
  });
  return row ?? { shop, period, aiAlt: 0 };
}

/**
 * Unidades restantes del período actual para la tienda y plan dados.
 * @param {string} shop
 * @param {string} plan
 * @param {string} key
 * @returns {Promise<number>}
 */
export async function remaining(shop, plan, key) {
  const usage = await getUsage(shop);
  return remainingFromUsed(plan, key, usage[key] ?? 0);
}

/**
 * Incrementa el contador `key` en `n` para la tienda, período actual.
 * Hace upsert: crea la fila si no existe, la actualiza si existe.
 * Emite console.warn si el costo estimado cruza COST_ALERT_USD.
 * @param {string} shop
 * @param {string} key
 * @param {number} n
 * @returns {Promise<object>} - fila actualizada
 */
export async function increment(shop, key, n = 1) {
  const period = currentPeriod();
  const updated = await prisma.aiUsage.upsert({
    where: { shop_period: { shop, period } },
    create: { shop, period, [key]: n },
    update: { [key]: { increment: n } },
  });

  const cost = estimatedCostUsd(updated[key]);
  if (cost >= COST_ALERT_USD) {
    // eslint-disable-next-line no-console
    console.warn(
      `[ai-usage] COST ALERT: shop=${shop} period=${period} key=${key} count=${updated[key]} estimatedCost=$${cost.toFixed(4)}`,
    );
  }

  return updated;
}
