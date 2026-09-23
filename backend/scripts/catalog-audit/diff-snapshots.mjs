#!/usr/bin/env node
/**
 * SEO-015: compare two catalog snapshots (or gap-only if --prior omitted).
 *
 *   node diff-snapshots.mjs --current snap.json [--prior prior.json] [--out diff.json]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  diffEntities,
  gapInventory,
  matchRenameCandidates,
} from "./lib.mjs";

function usage(msg) {
  if (msg) console.error(msg);
  console.error(
    "Usage: node diff-snapshots.mjs --current <json> [--prior <json>] [--out <json>] [--hints <json>]",
  );
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--current") out.current = argv[++i];
    else if (a === "--prior") out.prior = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--hints") out.hints = argv[++i];
    else usage(`Unknown arg: ${a}`);
  }
  if (!out.current) usage();
  return out;
}

async function loadJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function main() {
  const args = parseArgs(process.argv);
  const current = await loadJson(args.current);
  const gaps = gapInventory(current);

  let mom = null;
  if (args.prior) {
    const prior = await loadJson(args.prior);
    const catDiff = diffEntities(prior.categories ?? [], current.categories ?? []);
    const prodDiff = diffEntities(prior.products ?? [], current.products ?? []);
    const rename_candidates = matchRenameCandidates(
      catDiff.removed,
      catDiff.added,
    );
    mom = {
      categories_added: catDiff.added,
      categories_removed: catDiff.removed,
      products_added_count: prodDiff.added.length,
      products_removed_count: prodDiff.removed.length,
      products_added_sample: prodDiff.added.slice(0, 50),
      products_removed_sample: prodDiff.removed.slice(0, 50),
      rename_candidates,
    };
  }

  let seeded_hints = [];
  const hintsPath =
    args.hints ||
    resolve(dirname(fileURLToPath(import.meta.url)), "known-structure-hints.json");
  try {
    const hints = await loadJson(hintsPath);
    seeded_hints = (hints.retired_or_renamed || []).map((h) => ({
      ...h,
      needs_human_confirmation: true,
      source: "known-structure-hints",
    }));
  } catch {
    /* optional */
  }

  // Mark which seeded hints are still absent from current snapshot
  const currentSlugs = new Set(
    (current.categories ?? []).map((c) => `${c.kind}:${c.slug}`),
  );
  const rename_from_hints = seeded_hints.map((h) => {
    const key = `${h.old_kind || "category"}:${h.old_slug}`;
    const still_missing = !currentSlugs.has(key);
    return { ...h, still_missing_from_current: still_missing };
  });

  const result = {
    schema_version: 1,
    task_id: "SEO-015",
    current_captured_at: current.captured_at,
    prior_path: args.prior ? resolve(args.prior) : null,
    gap_inventory: gaps,
    month_over_month: mom,
    rename_candidates_seeded: rename_from_hints,
    redirect_map_candidates: [
      ...(mom?.rename_candidates || []),
      ...rename_from_hints.filter((h) => h.still_missing_from_current),
    ].map((c) => ({
      old_path: c.old_live_path,
      guessed_new_path: c.guessed_new_live_path,
      confidence: c.confidence,
      needs_human_confirmation: true,
      reason: c.reason,
    })),
  };

  const json = JSON.stringify(result, null, 2) + "\n";
  if (args.out) {
    const outPath = resolve(args.out);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, json, "utf8");
    console.log(JSON.stringify({ ok: true, out: outPath }, null, 2));
  } else {
    process.stdout.write(json);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
