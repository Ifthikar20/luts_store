"""
GraphQL query and mutation strings for the Shopify Storefront API.

These are kept as plain strings so they can be reused by
``shopify_client/storefront.py``. They are written against the Storefront
API (2024-10) but are only exercised when real credentials are present.

A reusable product fragment keeps the field selections consistent with the
``Product`` shape the frontend expects (the service layer maps the raw
Storefront response into the camelCase contract).
"""

# ---------------------------------------------------------------------------
# Fragments
# ---------------------------------------------------------------------------
PRODUCT_FRAGMENT = """
fragment ProductFields on Product {
  id
  handle
  title
  description
  descriptionHtml
  productType
  vendor
  tags
  featuredImage {
    url
    altText
  }
  images(first: 10) {
    edges {
      node {
        url
        altText
      }
    }
  }
  priceRange {
    minVariantPrice { amount currencyCode }
    maxVariantPrice { amount currencyCode }
  }
  variants(first: 50) {
    edges {
      node {
        id
        title
        availableForSale
        price { amount currencyCode }
      }
    }
  }
  collections(first: 10) {
    edges {
      node { handle title }
    }
  }
  lutCount: metafield(namespace: "custom", key: "lut_count") { value }
  formats: metafield(namespace: "custom", key: "formats") { value }
  compatibleApps: metafield(namespace: "custom", key: "compatible_apps") { value }
  featuredFlag: metafield(namespace: "custom", key: "featured") { value }
}
"""

CART_FRAGMENT = """
fragment CartFields on Cart {
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount { amount currencyCode }
    totalAmount { amount currencyCode }
  }
  lines(first: 100) {
    edges {
      node {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            price { amount currencyCode }
            product {
              handle
              title
              featuredImage { url altText }
            }
          }
        }
      }
    }
  }
}
"""

# ---------------------------------------------------------------------------
# Catalog queries
# ---------------------------------------------------------------------------
COLLECTIONS_QUERY = """
query Collections($first: Int!) {
  collections(first: $first) {
    edges {
      node {
        handle
        title
        description
        image { url altText }
        products(first: 1) { edges { node { id } } }
      }
    }
  }
}
"""

COLLECTION_BY_HANDLE_QUERY = (
    """
query CollectionByHandle($handle: String!, $first: Int!) {
  collection(handle: $handle) {
    handle
    title
    description
    products(first: $first) {
      edges { node { ...ProductFields } }
    }
  }
}
"""
    + PRODUCT_FRAGMENT
)

PRODUCTS_QUERY = (
    """
query Products($first: Int!, $query: String) {
  products(first: $first, query: $query) {
    edges { node { ...ProductFields } }
  }
}
"""
    + PRODUCT_FRAGMENT
)

PRODUCT_BY_HANDLE_QUERY = (
    """
query ProductByHandle($handle: String!) {
  product(handle: $handle) {
    ...ProductFields
  }
}
"""
    + PRODUCT_FRAGMENT
)

# ---------------------------------------------------------------------------
# Cart mutations
# ---------------------------------------------------------------------------
CART_CREATE_MUTATION = (
    """
mutation CartCreate($lines: [CartLineInput!]) {
  cartCreate(input: { lines: $lines }) {
    cart { ...CartFields }
    userErrors { field message }
  }
}
"""
    + CART_FRAGMENT
)

CART_QUERY = (
    """
query CartQuery($id: ID!) {
  cart(id: $id) { ...CartFields }
}
"""
    + CART_FRAGMENT
)

CART_LINES_ADD_MUTATION = (
    """
mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
  cartLinesAdd(cartId: $cartId, lines: $lines) {
    cart { ...CartFields }
    userErrors { field message }
  }
}
"""
    + CART_FRAGMENT
)

CART_LINES_UPDATE_MUTATION = (
    """
mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
  cartLinesUpdate(cartId: $cartId, lines: $lines) {
    cart { ...CartFields }
    userErrors { field message }
  }
}
"""
    + CART_FRAGMENT
)

CART_LINES_REMOVE_MUTATION = (
    """
mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
  cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
    cart { ...CartFields }
    userErrors { field message }
  }
}
"""
    + CART_FRAGMENT
)

# ---------------------------------------------------------------------------
# Admin API (REST) - order read path is implemented in admin.py.
# ---------------------------------------------------------------------------
