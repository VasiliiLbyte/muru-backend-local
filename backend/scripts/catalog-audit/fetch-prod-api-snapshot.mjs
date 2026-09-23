#!/usr/bin/env node
/**
 * SEO-015 fallback when VPS psql SSH is unavailable: read-only public catalog API.
 *
 * Categories/subcategories: SEO flags are accurate (empty string from API = empty DB).
 * Products: has_seo_title uses seoTitleCustom; has_seo_description is true only when
 * seo.description is non-empty AND not equal to the product title (API falls back to
 * title when DB seo_description is empty). has_description mirrors that heuristic
 * (list endpoint does not expose body description) — prefer SQL export for body gaps.
 *
 *   node fetch-prod-api-snapshot.mjs --out /path/catalog-snapshot-YYYY-MM-DD.json
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const BASE = process.env.MURU_CATALOG_API_BASE || "https://muru.ru/api/catalog";

function usage(msg) {
  if (msg) console.error(msg);
  console.error("Usage: node fetch-prod-api-snapshot.mjs --out <json>");
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") out.out = argv[++i];
    else if (a === "--base") out.base = argv[++i];
    else usage(`Unknown arg: ${a}`);
  }
  if (!out.out) usage();
  return out;
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "seo-015-catalog-audit" },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function populated(s) {
  return typeof s === "string" && s.trim().length > 0;
}

function walkTree(nodes, categories, parentSlug = null, parentId = null) {
  for (const node of nodes || []) {
    const kind = parentSlug ? "subcategory" : "category";
    const live_path = parentSlug
      ? `/catalog/${parentSlug}/${node.slug}/`
      : `/catalog/${node.slug}/`;
    categories.push({
      id: null,
      kind,
      slug: node.slug,
      parent_id: parentId,
      parent_slug: parentSlug,
      name: node.name,
      live_path,
      has_seo_title: populated(node.seoTitle),
      has_seo_description: populated(node.seoDescription),
      has_seo_text:
        populated(node.seoIntroTop) || populated(node.seoTextBottom),
      has_seo_h1: populated(node.seoH1),
      sort_order: 0,
    });
    if (node.children?.length) {
      walkTree(node.children, categories, node.slug, null);
    }
  }
}

async function fetchSitemapSubcategories() {
  const res = await fetch("https://muru.ru/sitemap.xml", {
    headers: { "User-Agent": "seo-015-catalog-audit" },
  });
  if (!res.ok) throw new Error(`sitemap ${res.status}`);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>(https:\/\/muru\.ru\/catalog\/[^<]+)<\/loc>/g)].map(
    (m) => m[1].replace("https://muru.ru", ""),
  );
  const subs = [];
  const seen = new Set();
  for (const path of locs) {
    const parts = path.replace(/\/$/, "").split("/").filter(Boolean);
    // catalog / top / leaf
    if (parts.length !== 3 || parts[0] !== "catalog") continue;
    const [, top, leaf] = parts;
    const key = `${top}/${leaf}`;
    if (seen.has(key)) continue;
    seen.add(key);
    subs.push({
      id: null,
      kind: "subcategory",
      slug: leaf,
      parent_id: null,
      parent_slug: top,
      name: leaf,
      live_path: `/catalog/${top}/${leaf}/`,
      has_seo_title: null,
      has_seo_description: null,
      has_seo_text: null,
      has_seo_h1: null,
      sort_order: 0,
      seo_flags_unknown: true,
    });
  }
  return subs;
}

async function fetchAllProducts(base) {

  const products = [];
  let page = 1;
  let total = Infinity;
  while ((page - 1) * 24 < total) {
    const url = `${base}/products?limit=24&page=${page}`;
    const data = await getJson(url);
    const items = data.items || [];
    total = Number(data.total ?? items.length);
    for (const p of items) {
      const title = p.title || "";
      const seoDesc = p.seo?.description || "";
      const hasCustomTitle = Boolean(p.seoTitleCustom);
      const descIsReal = populated(seoDesc) && seoDesc.trim() !== title.trim();
      const slugs = p.categorySlugs || [];
      const top = slugs[0] || null;
      const leaf = slugs.length > 1 ? slugs[slugs.length - 1] : null;
      products.push({
        id: null,
        sku: p.sku,
        slug: p.slug,
        name: title,
        category_slug: top,
        subcategory_slug: leaf && leaf !== top ? leaf : null,
        live_path:
          top && p.slug
            ? `/catalog/${top}/${leaf && leaf !== top ? leaf + "/" : ""}${p.slug}/`
            : null,
        has_seo_title: hasCustomTitle,
        has_seo_description: descIsReal,
        // List API has no body description; heuristic only — SQL export is authoritative.
        has_description: descIsReal,
        has_seo_h1: populated(p.seoH1) && p.seoH1.trim() !== title.trim(),
      });
    }
    if (items.length === 0) break;
    page += 1;
    if (page > 50) break;
  }
  return products;
}

async function main() {
  const args = parseArgs(process.argv);
  const base = (args.base || BASE).replace(/\/$/, "");
  const treePayload = await getJson(`${base}/tree`);
  const tree = treePayload.data || treePayload;
  const categories = [];
  walkTree(Array.isArray(tree) ? tree : [], categories);
  // Prod /tree currently returns empty children[]; recover leaf hubs from sitemap.
  const fromSitemap = await fetchSitemapSubcategories();
  const existing = new Set(
    categories.filter((c) => c.kind === "subcategory").map((c) => `${c.parent_slug}/${c.slug}`),
  );
  for (const sub of fromSitemap) {
    const key = `${sub.parent_slug}/${sub.slug}`;
    if (!existing.has(key)) categories.push(sub);
  }
  const products = await fetchAllProducts(base);

  const snapshot = {
    schema_version: 1,
    task_id: "SEO-015",
    source: "muru_ru_public_catalog_api",
    captured_at: new Date().toISOString(),
    note:
      "Read-only public API+sitemap fallback (VPS SSH unavailable). Top-category SEO flags match DB empties; subcategory SEO flags are null (tree.children empty on prod — flags need SQL). Product seo_title uses seoTitleCustom; description flags are heuristics — re-run SQL on muru_db for authoritative product body/seo_description gaps. seo_text = seoIntroTop OR seoTextBottom.",
    categories,
    products,
  };

  const outPath = resolve(args.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(
    JSON.stringify(
      {
        ok: true,
        out: outPath,
        categories: categories.length,
        products: products.length,
        source: snapshot.source,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
