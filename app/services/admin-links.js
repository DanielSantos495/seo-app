// Deep links al admin embebido de Shopify.
// App Bridge intercepta las URLs `shopify://admin/...` y abre la vista correspondiente.

export function gidToNumericId(gid) {
  // "gid://shopify/Product/12345" → "12345"
  if (!gid) return "";
  return gid.split("/").pop();
}

export function productAdminUrl(productGid) {
  return `shopify://admin/products/${gidToNumericId(productGid)}`;
}
