#!/usr/bin/env node
// scripts/generate-feeds.mjs
//
// Regenerates sitemap.xml and merchant-center-feed.xml from live Supabase data.
// Run manually with `node scripts/generate-feeds.mjs`, or automatically by the
// scheduled GitHub Action at .github/workflows/update-feeds.yml.
//
// Uses the site's own public anon key (the same one already shipped to every
// visitor's browser in assets/supabase.js) over the Supabase REST API — no
// secrets required, nothing here can write to the database.
//
// Every value in the Merchant Center feed comes straight from a real Supabase
// column. A product with no colour/fabric/etc. simply omits that <g:...> tag
// rather than guessing a value — this script never invents data.

const SUPABASE_URL = "https://mgmgkwoxirvzdnmayhwq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_mS_exnQ_Am8_GWMNgCb63w_PfvFA7Mz";
const SITE_URL = "https://www.ahamstree.com";

// Google's own product taxonomy — a real, existing category (not invented),
// the closest fit for handwoven Indian sarees/suits in Google's public list:
// https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt
const GOOGLE_PRODUCT_CATEGORY = {
  saree: "2271", // Apparel & Accessories > Clothing > Traditional & Ceremonial Clothing > Sarees
  suit: "212",   // Apparel & Accessories > Clothing > Traditional & Ceremonial Clothing
};

async function supaGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase REST error ${res.status} for ${path}: ${await res.text()}`);
  }
  return res.json();
}

function xmlEscape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Weave line names already start with "Chanderi" and sometimes already contain
// the fabric name (e.g. weave "Chanderi Cotton" + fabric "Cotton") — avoid
// emitting "Chanderi Cotton Cotton".
function materialLabel(p) {
  const weave = p.weave_line?.name || "";
  const fabric = p.fabric?.name || "";
  if (!weave && !fabric) return "";
  if (weave && fabric && weave.toLowerCase().includes(fabric.toLowerCase())) return weave;
  return [weave, fabric].filter(Boolean).join(" ");
}

function cdata(s) {
  return `<![CDATA[${String(s ?? "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

async function main() {
  const [products, collections, blogPosts, fabrics, weaveLines] = await Promise.all([
    supaGet(
      "products?select=id,slug,title,description,category,price_inr,sale_price_inr,sku,inventory_qty,is_active,colour,print_type,craft,motif,border_type,zari,occasion,updated_at,fabric:fabrics(name),weave_line:weave_lines(name),product_images(image_url,sort_order)&is_active=eq.true&order=updated_at.desc"
    ),
    supaGet("collections?select=slug,name,updated_at:created_at&is_active=eq.true"),
    supaGet("blog_posts?select=slug,title,published_at&is_published=eq.true&order=published_at.desc"),
    supaGet("fabrics?select=slug,name&is_active=eq.true"),
    supaGet("weave_lines?select=slug,name&is_active=eq.true"),
  ]);

  // ── sitemap.xml ──
  const today = new Date().toISOString().slice(0, 10);
  const staticUrls = [
    { loc: "/", priority: "1.0" },
    { loc: "/products.html", priority: "0.9" },
    { loc: "/products.html?type=saree", priority: "0.9" },
    { loc: "/products.html?type=suit", priority: "0.8" },
    { loc: "/collections.html", priority: "0.8" },
    { loc: "/new-arrivals.html", priority: "0.8" },
    { loc: "/sale.html", priority: "0.8" },
    { loc: "/blogs.html", priority: "0.7" },
    { loc: "/about.html", priority: "0.6" },
    { loc: "/contact.html", priority: "0.6" },
    { loc: "/help.html", priority: "0.5" },
    { loc: "/shipping.html", priority: "0.5" },
    { loc: "/returns.html", priority: "0.5" },
    { loc: "/privacy.html", priority: "0.3" },
    { loc: "/terms.html", priority: "0.3" },
    { loc: "/cookies.html", priority: "0.3" },
  ];

  // The 5 weave/fabric collection views this project currently has real
  // tagged products for (see the SEO audit report for why the other 5
  // requested collections aren't included yet).
  for (const w of weaveLines) {
    staticUrls.push({ loc: `/products.html?type=saree&weave=${encodeURIComponent(w.slug)}`, priority: "0.8" });
  }
  staticUrls.push({ loc: `/products.html?type=saree&fabric=cotton-silk`, priority: "0.8" });

  const collectionUrls = collections.map((c) => ({
    loc: `/collection.html?slug=${encodeURIComponent(c.slug)}`,
    priority: "0.7",
  }));

  const productUrls = products.map((p) => ({
    loc: p.slug ? `/product.html?slug=${encodeURIComponent(p.slug)}` : `/product.html?id=${encodeURIComponent(p.id)}`,
    lastmod: p.updated_at ? p.updated_at.slice(0, 10) : today,
    priority: "0.7",
  }));

  const blogUrls = blogPosts.map((b) => ({
    loc: `/blog.html?slug=${encodeURIComponent(b.slug)}`,
    lastmod: b.published_at ? b.published_at.slice(0, 10) : today,
    priority: "0.5",
  }));

  const allUrls = [...staticUrls, ...collectionUrls, ...productUrls, ...blogUrls];

  const sitemapXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    allUrls
      .map(
        (u) =>
          `  <url>\n` +
          `    <loc>${xmlEscape(SITE_URL + u.loc)}</loc>\n` +
          (u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : "") +
          `    <priority>${u.priority}</priority>\n` +
          `  </url>`
      )
      .join("\n") +
    `\n</urlset>\n`;

  // ── merchant-center-feed.xml (Google Shopping RSS 2.0) ──
  const items = products
    .filter((p) => p.price_inr != null && p.title)
    .map((p) => {
      const images = (p.product_images || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const mainImage = images[0]?.image_url;
      if (!mainImage) return null; // Merchant Center requires an image; skip products with none rather than fake one.

      // g:id below stays the permanent UUID (Merchant Center tracks a product
      // by that id across feed refreshes — changing it would look like a
      // brand-new product and lose review/performance history). Only the
      // landing-page link itself uses the SEO slug.
      const link = p.slug
        ? `${SITE_URL}/product.html?slug=${encodeURIComponent(p.slug)}`
        : `${SITE_URL}/product.html?id=${encodeURIComponent(p.id)}`;
      const price = p.price_inr;
      const salePrice = p.sale_price_inr && p.sale_price_inr > 0 && p.sale_price_inr < price ? p.sale_price_inr : null;
      const availability = (p.inventory_qty ?? 0) > 0 ? "in_stock" : "out_of_stock";
      const productType = p.category === "suit" ? "Suit" : "Saree";
      const googleCategory = GOOGLE_PRODUCT_CATEGORY[p.category] || GOOGLE_PRODUCT_CATEGORY.saree;
      const description = p.description && p.description.trim() ? p.description : p.title;

      const extraImages = images
        .slice(1, 11)
        .map((im) => `      <g:additional_image_link>${xmlEscape(im.image_url)}</g:additional_image_link>`)
        .join("\n");

      const optionalTags = [
        p.sku ? `      <g:mpn>${cdata(p.sku)}</g:mpn>` : "",
        p.colour ? `      <g:color>${cdata(p.colour)}</g:color>` : "",
        materialLabel(p) ? `      <g:material>${cdata(materialLabel(p))}</g:material>` : "",
      ]
        .filter(Boolean)
        .join("\n");

      return (
        `    <item>\n` +
        `      <g:id>${xmlEscape(p.id)}</g:id>\n` +
        `      <title>${cdata(p.title)}</title>\n` +
        `      <description>${cdata(description)}</description>\n` +
        `      <link>${xmlEscape(link)}</link>\n` +
        `      <g:image_link>${xmlEscape(mainImage)}</g:image_link>\n` +
        (extraImages ? extraImages + "\n" : "") +
        `      <g:availability>${availability}</g:availability>\n` +
        `      <g:price>${price}.00 INR</g:price>\n` +
        (salePrice ? `      <g:sale_price>${salePrice}.00 INR</g:sale_price>\n` : "") +
        `      <g:brand>AhamStree</g:brand>\n` +
        `      <g:condition>new</g:condition>\n` +
        `      <g:google_product_category>${googleCategory}</g:google_product_category>\n` +
        `      <g:product_type>${cdata(productType)}</g:product_type>\n` +
        `      <g:identifier_exists>no</g:identifier_exists>\n` +
        (optionalTags ? optionalTags + "\n" : "") +
        `    </item>`
      );
    })
    .filter(Boolean);

  const feedXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">\n` +
    `  <channel>\n` +
    `    <title>AhamStree Product Feed</title>\n` +
    `    <link>${SITE_URL}</link>\n` +
    `    <description>Auto-generated Google Merchant Center product feed for AhamStree, regenerated from live Supabase product data.</description>\n` +
    items.join("\n") +
    `\n  </channel>\n` +
    `</rss>\n`;

  const fs = await import("node:fs/promises");
  await fs.writeFile(new URL("../sitemap.xml", import.meta.url), sitemapXml, "utf8");
  await fs.writeFile(new URL("../merchant-center-feed.xml", import.meta.url), feedXml, "utf8");

  console.log(`sitemap.xml: ${allUrls.length} URLs (${productUrls.length} products, ${collectionUrls.length} collections, ${blogUrls.length} blog posts)`);
  console.log(`merchant-center-feed.xml: ${items.length} items (${products.length} active products total, ${products.length - items.length} skipped for missing image/price)`);
}

main().catch((err) => {
  console.error("generate-feeds failed:", err);
  process.exit(1);
});
