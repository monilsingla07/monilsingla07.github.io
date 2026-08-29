// assets/seo.js
//
// Shared SEO helpers: dynamic <title>/meta description/canonical/Open Graph/
// Twitter Card tags, and JSON-LD structured data builders.
//
// Nothing in this file invents data. Every builder takes real values already
// loaded from Supabase (or hardcoded site facts like the brand name/URL) and
// only emits a field when the caller actually has a value for it — optional
// fields are simply omitted rather than filled with a placeholder.
//
// Usage pattern (see product.html / products.html / collection.html):
//   import { setPageMeta, injectJsonLd, buildOrganizationSchema, ... } from "./seo.js";
//   setPageMeta({ title, description, path: "/product.html?id=" + id, image });
//   injectJsonLd("ld-product", buildProductSchema(product, images));

export const SITE_NAME = "AhamStree";
export const SITE_URL = "https://www.ahamstree.com";
export const DEFAULT_OG_IMAGE = SITE_URL + "/hero-1-launch.jpg";

function absUrl(pathOrUrl) {
  if (!pathOrUrl) return SITE_URL + "/";
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return SITE_URL + (pathOrUrl.startsWith("/") ? pathOrUrl : "/" + pathOrUrl);
}

function upsertMeta(attr, key, content) {
  if (content === undefined || content === null || content === "") return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Sets document.title, meta description, canonical link, and Open Graph /
 * Twitter Card tags for the current page. Safe to call more than once (e.g.
 * once with a generic value before data loads, then again once the real
 * product/collection data arrives) — every call fully overwrites the prior
 * values so a page never ends up with stale/mismatched tags.
 *
 * @param {Object} opts
 * @param {string} opts.title - Full page title (already includes "| AhamStree" if wanted).
 * @param {string} [opts.description] - 1-2 sentence meta description, ideally 120-160 chars.
 * @param {string} [opts.path] - Path (or full URL) this page should canonicalize to, e.g. "/product.html?id=...".
 * @param {string} [opts.image] - Absolute or relative image URL for social sharing.
 * @param {string} [opts.type] - Open Graph type: "website" | "product" | "article". Defaults to "website".
 * @param {boolean} [opts.noindex] - If true, adds a noindex robots meta tag (for thin/utility pages).
 */
export function setPageMeta({ title, description, path, image, type = "website", noindex = false } = {}) {
  if (title) document.title = title;

  upsertMeta("name", "description", description);
  upsertLink("canonical", path ? absUrl(path) : undefined);

  if (noindex) {
    upsertMeta("name", "robots", "noindex, follow");
  } else {
    upsertMeta("name", "robots", "index, follow");
  }

  const url = path ? absUrl(path) : undefined;
  const ogImage = image ? absUrl(image) : DEFAULT_OG_IMAGE;

  upsertMeta("property", "og:site_name", SITE_NAME);
  upsertMeta("property", "og:type", type);
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:url", url);
  upsertMeta("property", "og:image", ogImage);

  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", ogImage);
}

/**
 * Injects (or replaces) one JSON-LD <script> block, identified by a stable id
 * so repeated calls (e.g. once product data loads) update it in place instead
 * of piling up duplicate blocks.
 */
export function injectJsonLd(id, data) {
  if (!data) return;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  // Guard against a "</script>" substring inside any string value breaking out
  // of the script block.
  el.textContent = JSON.stringify(data).replace(/<\/script/gi, "<\\/script");
}

export function removeJsonLd(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

/** Site-wide Organization schema. Only real, verified profile links go in sameAs. */
export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": SITE_NAME,
    "url": SITE_URL,
    "logo": SITE_URL + "/ahamstree-logo.png",
    "sameAs": [
      "https://www.instagram.com/ahamstree/",
    ],
  };
}

/** Site-wide WebSite schema with the real on-site search action (search.html?q=...). */
export function buildWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": SITE_NAME,
    "url": SITE_URL,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": SITE_URL + "/search.html?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * @param {Array<{name: string, path: string}>} items - in order, home first.
 * `path` may be relative ("/products.html") or the current page itself.
 */
export function buildBreadcrumbSchema(items) {
  if (!items || !items.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((it, idx) => ({
      "@type": "ListItem",
      "position": idx + 1,
      "name": it.name,
      "item": absUrl(it.path),
    })),
  };
}

/**
 * Product + Offer schema for a single product detail page.
 * Only emits fields the DB actually has values for (fabric/weave/colour/etc.
 * are all optional and simply omitted when null) — nothing is guessed.
 *
 * @param {Object} product - a row from `products`, optionally joined with fabric/weave_line names.
 * @param {Array<{image_url: string}>} images
 * @param {string} pagePath - e.g. "/product.html?id=<uuid>"
 */
export function buildProductSchema(product, images, pagePath) {
  if (!product) return null;
  const price = product.sale_price_inr ?? product.price_inr;
  const inStock = (product.inventory_qty ?? 0) > 0;

  const additionalProperty = [];
  const attrs = [
    ["Colour", product.colour],
    ["Weave", product.weave_line_name],
    ["Fabric", product.fabric_name],
    ["Print type", product.print_type],
    ["Craft", product.craft],
    ["Motif", product.motif],
    ["Border", product.border_type],
    ["Zari", product.zari],
    ["Occasion", product.occasion],
  ];
  for (const [name, value] of attrs) {
    if (value) additionalProperty.push({ "@type": "PropertyValue", "name": name, "value": value });
  }

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.title,
    "description": product.description || product.title,
    "sku": product.sku || undefined,
    "url": absUrl(pagePath),
    "image": (images || []).map((im) => absUrl(im.image_url)).filter(Boolean),
    "brand": { "@type": "Brand", "name": SITE_NAME },
    "category": product.category === "suit" ? "Suit" : "Saree",
    "offers": {
      "@type": "Offer",
      "url": absUrl(pagePath),
      "priceCurrency": "INR",
      "price": price,
      "availability": inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": { "@type": "Organization", "name": SITE_NAME },
    },
  };
  if (additionalProperty.length) schema.additionalProperty = additionalProperty;
  return schema;
}

/**
 * CollectionPage/ItemList schema for a filtered product listing (weave/fabric/
 * category view) or a curated collection page.
 * @param {Object} opts
 * @param {string} opts.name
 * @param {string} opts.description
 * @param {string} opts.path
 * @param {Array<{title: string, path: string, image?: string}>} opts.products
 */
export function buildCollectionSchema({ name, description, path, products }) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": name,
    "description": description || undefined,
    "url": absUrl(path),
    "mainEntity": {
      "@type": "ItemList",
      "itemListElement": (products || []).slice(0, 48).map((p, idx) => ({
        "@type": "ListItem",
        "position": idx + 1,
        "url": absUrl(p.path),
        "name": p.title,
      })),
    },
  };
}

/** BlogPosting schema for a single blog post page. */
export function buildBlogPostingSchema(post, pagePath) {
  if (!post) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.excerpt || undefined,
    "image": post.cover_image_url ? absUrl(post.cover_image_url) : undefined,
    "datePublished": post.published_at || undefined,
    "author": { "@type": "Organization", "name": SITE_NAME },
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "logo": { "@type": "ImageObject", "url": SITE_URL + "/ahamstree-logo.png" },
    },
    "mainEntityOfPage": absUrl(pagePath),
    "url": absUrl(pagePath),
  };
}

/** Truncates text to a meta-description-friendly length without cutting mid-word. */
export function truncateForMeta(text, maxLen = 160) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + "…";
}
