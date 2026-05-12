// Queries GraphQL contra la Admin API de Shopify.
// Mantener separadas del UI para poder testear el scoring sin red.

// En API 2026-04 las imágenes viven bajo `media` (modelo unificado con
// videos/3D). Para SEO solo nos interesan las MediaImage.
const MEDIA_FIELDS = `#graphql
  media(first: 50) {
    edges {
      node {
        id
        alt
        mediaContentType
        ... on MediaImage {
          image { url }
        }
      }
    }
  }
`;

export const GET_PRODUCTS_SEO_QUERY = `#graphql
  query GetProductsSeo($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          descriptionHtml
          seo {
            title
            description
          }
          ${MEDIA_FIELDS}
        }
      }
    }
  }
`;

export const GET_PRODUCT_SEO_QUERY = `#graphql
  query GetProductSeo($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      descriptionHtml
      seo {
        title
        description
      }
      ${MEDIA_FIELDS}
      variants(first: 100) {
        edges {
          node {
            id
            title
            media(first: 1) {
              edges {
                node { id }
              }
            }
          }
        }
      }
    }
  }
`;

export const PRODUCT_UPDATE_MEDIA_MUTATION = `#graphql
  mutation ProductUpdateMedia($productId: ID!, $media: [UpdateMediaInput!]!) {
    productUpdateMedia(productId: $productId, media: $media) {
      media { id alt }
      mediaUserErrors {
        field
        message
      }
    }
  }
`;

// Trae productos paginando con cursor. Aplana edges → array de nodos.
// `limit` opcional para el plan free (corta al llegar a N productos).
export async function fetchAllProducts(admin, { limit } = {}) {
  const products = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await admin.graphql(GET_PRODUCTS_SEO_QUERY, {
      variables: { cursor },
    });
    const json = await response.json();
    const page = json?.data?.products;
    if (!page) break;

    for (const edge of page.edges) {
      products.push(normalizeProduct(edge.node));
      if (limit && products.length >= limit) return products;
    }

    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  return products;
}

// Trae un único producto por GID. Devuelve `null` si no existe.
export async function fetchProductById(admin, gid) {
  const response = await admin.graphql(GET_PRODUCT_SEO_QUERY, {
    variables: { id: gid },
  });
  const json = await response.json();
  const product = json?.data?.product;
  return product ? normalizeProduct(product) : null;
}

// Aplana `media` (filtrando solo MediaImage) y `variants` — más cómodo para
// el analyzer y el generador de alt texts. La shape `images` se mantiene por
// compatibilidad con el analyzer; ahora cada `id` es un MediaImage GID.
function normalizeProduct(node) {
  const mediaImages = (node.media?.edges || [])
    .map((e) => e.node)
    .filter((m) => m.mediaContentType === "IMAGE");

  return {
    id: node.id,
    title: node.title,
    handle: node.handle,
    descriptionHtml: node.descriptionHtml || "",
    seo: {
      title: node.seo?.title || "",
      description: node.seo?.description || "",
    },
    images: mediaImages.map((m) => ({
      id: m.id,
      altText: m.alt || "",
      url: m.image?.url || null,
    })),
    variants: (node.variants?.edges || []).map((e) => ({
      id: e.node.id,
      title: e.node.title,
      imageId: e.node.media?.edges?.[0]?.node?.id || null,
    })),
  };
}

// Aplica nuevos alt texts a un producto vía `productUpdateMedia`.
// `altTextsByImageId` es un Map o objeto { mediaId: newAltText }.
// Devuelve { ok, userErrors }.
export async function updateProductAltTexts(
  admin,
  productGid,
  altTextsByImageId,
) {
  const entries =
    altTextsByImageId instanceof Map
      ? Array.from(altTextsByImageId.entries())
      : Object.entries(altTextsByImageId);

  if (entries.length === 0) return { ok: true, userErrors: [] };

  const media = entries.map(([id, alt]) => ({ id, alt }));

  const response = await admin.graphql(PRODUCT_UPDATE_MEDIA_MUTATION, {
    variables: { productId: productGid, media },
  });
  const json = await response.json();
  const userErrors = json?.data?.productUpdateMedia?.mediaUserErrors || [];
  return { ok: userErrors.length === 0, userErrors };
}
