// Construye el bloque de contexto que se antepone a las generaciones de IA.
// Diseñado para ser token-eficiente: solo incluye líneas con valor no vacío.
// El output es texto plano multilínea, sin boilerplate ni preambles.

export const MAX_MERCHANT_CONTEXT = 600;
export const MAX_DESC = 300;

/** Elimina etiquetas HTML y colapsa whitespace. */
function stripHtml(html) {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Trunca a `cap` caracteres. Usa el truncator de alt-text si está dentro del límite. */
function cap(text, limit) {
  if (!text) return "";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

/**
 * Ensambla el bloque de contexto conciso para generaciones de IA.
 *
 * @param {{ shop?: { name?: string, currencyCode?: string }, product?: object, merchantContext?: string }} params
 * @returns {string}
 */
export function buildContext({ shop, product, merchantContext } = {}) {
  const lines = [];

  const shopName = shop?.name?.trim();
  const currency = shop?.currencyCode?.trim();
  const merchant = merchantContext?.trim();

  if (shopName) lines.push(`Store: ${shopName}`);
  if (currency) lines.push(`Currency: ${currency}`);
  if (merchant) lines.push(`Brand context: ${cap(merchant, MAX_MERCHANT_CONTEXT)}`);

  if (product) {
    const title = product.title?.trim();
    const productType = product.productType?.trim();
    const vendor = product.vendor?.trim();
    const tags = Array.isArray(product.tags) ? product.tags.slice(0, 8).filter(Boolean) : [];
    const price = product.price?.toString().trim();
    const descRaw = stripHtml(product.descriptionHtml);
    const desc = cap(descRaw, MAX_DESC);

    if (title) lines.push(`Product: ${title}`);
    if (productType) lines.push(`Type: ${productType}`);
    if (vendor) lines.push(`Vendor: ${vendor}`);
    if (tags.length > 0) lines.push(`Tags: ${tags.join(", ")}`);
    if (price) lines.push(`Price: ${price}`);
    if (desc) lines.push(`Current description: ${desc}`);
  }

  return lines.join("\n");
}
