// Helper para transformar URLs de Shopify CDN aplicando resize on-the-fly.
// El CDN de Shopify acepta el query param `width` (y `height`, `crop`) y
// devuelve la imagen ya redimensionada — ahorra MBs vs descargar el full-size.
//
// Si la URL no es de Shopify CDN (o es null/undefined), devolvemos tal cual.

export function resizeCdnUrl(url, width) {
  if (!url || !width) return url;
  // Solo transformamos URLs de Shopify CDN (cdn.shopify.com, cdn.shopifycdn.net).
  if (!/cdn\.shopify(?:cdn)?\.(?:com|net)/.test(url)) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("width", String(width));
    return u.toString();
  } catch {
    return url;
  }
}
