#!/usr/bin/env node
/**
 * SEO-015: CSV exports → dated catalog-snapshot JSON.
 *
 * Usage:
 *   node build-snapshot.mjs \
 *     --categories /path/categories.csv \
 *     --products /path/products.csv \
 *     --out /path/to/muru-docs/data/evidence/catalog-snapshot-YYYY-MM-DD.json
 */
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse } from "node:path";
import { createInterface } from "node:readline";
import { parseBool } from "./lib.mjs";

function usage(msg) {
  if (msg) console.error(msg);
  console.error(
    "Usage: node build-snapshot.mjs --categories <csv> --products <csv> --out <json> [--captured-at ISO]",
  );
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--categories") out.categories = argv[++i];
    else if (a === "--products") out.products = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--captured-at") out.capturedAt = argv[++i];
    else if (a === "--source") out.source = argv[++i];
    else usage(`Unknown arg: ${a}`);
  }
  if (!out.categories || !out.products || !out.out) usage();
  return out;
}

/** Minimal CSV parser: handles quoted fields with commas/newlines via line-buffer approach for simple flags CSV (no multiline). */
async function readCsv(path) {
  const text = await import("node:fs/promises").then((fs) =>
    fs.readFile(path, "utf8"),
  );
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 1) return [];
  const headers = splitCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length === 1 && cols[0] === "") continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function mapCategory(row) {
  return {
    id: Number(row.id),
    kind: row.kind,
    slug: row.slug,
    parent_id: row.parent_id === "" || row.parent_id == null ? null : Number(row.parent_id),
    parent_slug: row.parent_slug === "" || row.parent_slug == null ? null : row.parent_slug,
    name: row.name,
    live_path: row.live_path,
    has_seo_title: parseBool(row.has_seo_title),
    has_seo_description: parseBool(row.has_seo_description),
    has_seo_text: parseBool(row.has_seo_text),
    has_seo_h1: parseBool(row.has_seo_h1),
    sort_order: row.sort_order === "" ? 0 : Number(row.sort_order),
  };
}

function mapProduct(row) {
  return {
    id: Number(row.id),
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    category_slug: row.category_slug || null,
    subcategory_slug: row.subcategory_slug || null,
    live_path: row.live_path || null,
    has_seo_title: parseBool(row.has_seo_title),
    has_seo_description: parseBool(row.has_seo_description),
    has_description: parseBool(row.has_description),
    has_seo_h1: parseBool(row.has_seo_h1),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const catRows = await readCsv(resolve(args.categories));
  const prodRows = await readCsv(resolve(args.products));
  const snapshot = {
    schema_version: 1,
    task_id: "SEO-015",
    source: args.source || "muru_db",
    captured_at: args.capturedAt || new Date().toISOString(),
    note:
      "seo_text flag = seo_intro_top OR seo_text_bottom (no seo_text column in DB)",
    categories: catRows.map(mapCategory),
    products: prodRows.map(mapProduct),
  };
  const outPath = resolve(args.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(
    JSON.stringify(
      {
        ok: true,
        out: outPath,
        categories: snapshot.categories.length,
        products: snapshot.products.length,
        captured_at: snapshot.captured_at,
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
