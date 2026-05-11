// Queries GraphQL contra la Admin API de Shopify.
// Mantener separadas del UI para poder testear el scoring sin red.

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
          images(first: 10) {
            edges {
              node {
                id
                altText
                url
              }
            }
          }
        }
      }
    }
  }
`;

export const UPDATE_PRODUCT_IMAGES_MUTATION = `#graphql
  mutation UpdateProductImages($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        images(first: 10) {
          edges {
            node { id altText }
          }
        }
      }
      userErrors {
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

// Aplana `images.edges[].node` a un array simple — más cómodo para el analyzer.
function normalizeProduct(node) {
  return {
    id: node.id,
    title: node.title,
    handle: node.handle,
    descriptionHtml: node.descriptionHtml || "",
    seo: {
      title: node.seo?.title || "",
      description: node.seo?.description || "",
    },
    images: (node.images?.edges || []).map((e) => ({
      id: e.node.id,
      altText: e.node.altText || "",
      url: e.node.url,
    })),
  };
}
