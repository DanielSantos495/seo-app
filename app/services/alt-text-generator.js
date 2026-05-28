// Generador naive de alt texts para imágenes sin alt.
// Usa el título del producto + información de variantes asociadas a cada imagen
// para producir alts diferenciados sin recurrir a IA.
//
// Reglas (en orden):
//   1. 1 imagen total           → `${title}`
//   2. Imagen con 1 variante    → `${title} - ${variant.title}`
//   3. Imagen con N variantes con primer atributo común → `${title} - ${atributo}`
//   4. Imagen con N variantes sin común → `${title} - ${variant.title[0]}`
//   5. Imagen huérfana, primera → `${title}`
//   6. Imagen huérfana, sucesiva → `${title} - vista N`
//
// Solo genera alt para imágenes con `altText` vacío — nunca sobreescribe.

export const MAX_LENGTH = 125;
const DEFAULT_VARIANT_TITLE = "Default Title";

export function generateAltTexts(product) {
  const result = new Map();
  const title = product.title || "";
  const images = product.images || [];
  const variants = product.variants || [];

  const missing = images.filter((img) => !img.altText?.trim());
  if (missing.length === 0) return result;

  // Caso especial: el producto tiene una sola imagen → usar título plano.
  if (images.length === 1) {
    result.set(missing[0].id, truncate(title));
    return result;
  }

  // Mapear imageId → array de variant titles asociados (excluyendo "Default Title").
  const variantsByImageId = new Map();
  for (const variant of variants) {
    if (!variant.imageId) continue;
    if (variant.title === DEFAULT_VARIANT_TITLE) continue;
    const list = variantsByImageId.get(variant.imageId) || [];
    list.push(variant.title);
    variantsByImageId.set(variant.imageId, list);
  }

  let orphanCount = 0;
  for (const image of missing) {
    const variantTitles = variantsByImageId.get(image.id);
    if (variantTitles && variantTitles.length > 0) {
      const descriptor =
        variantTitles.length === 1
          ? variantTitles[0]
          : extractCommonFirstOption(variantTitles);
      result.set(image.id, truncate(`${title} - ${descriptor}`));
    } else {
      orphanCount++;
      const alt =
        orphanCount === 1 ? title : `${title} - view ${orphanCount}`;
      result.set(image.id, truncate(alt));
    }
  }

  return result;
}

// Si todos los títulos de variante comparten el primer segmento separado por
// " / " (típicamente la primera opción del producto, ej. "Color"), devolvemos
// ese segmento. Si no, fallback al primer título completo.
function extractCommonFirstOption(variantTitles) {
  const firstSegments = variantTitles.map((t) => t.split(" / ")[0]);
  const allEqual = firstSegments.every((s) => s === firstSegments[0]);
  return allEqual ? firstSegments[0] : variantTitles[0];
}

export function truncate(text) {
  if (text.length <= MAX_LENGTH) return text;
  return `${text.slice(0, MAX_LENGTH - 1)}…`;
}
