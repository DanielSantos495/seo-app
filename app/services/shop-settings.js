// CRUD de configuración del merchant para generación de contenido con IA.
// Lee/escribe el modelo ShopSettings en Postgres vía Prisma.

import prisma from "../db.server.js";

/**
 * Devuelve la configuración del shop.
 * Si no existe fila, devuelve defaults SIN crear fila en DB.
 * @param {string} shop
 * @returns {Promise<{ brandContext: string }>}
 */
export async function getSettings(shop) {
  const row = await prisma.shopSettings.findUnique({ where: { shop } });
  return { brandContext: row?.brandContext ?? "" };
}

/**
 * Crea o actualiza la configuración del shop.
 * Valores null/undefined en `brandContext` se normalizan a "".
 * @param {string} shop
 * @param {{ brandContext?: string | null }} params
 * @returns {Promise<object>} fila actualizada
 */
export async function saveSettings(shop, { brandContext } = {}) {
  const context = brandContext ?? "";
  return prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, brandContext: context },
    update: { brandContext: context },
  });
}
