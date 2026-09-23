#!/usr/bin/env node
/**
 * SEO-015: markdown gap report from snapshot (+ optional prior diff).
 *
 *   node report-catalog-audit.mjs --current snap.json [--prior prior.json] \
 *     --out report.md [--diff-json diff.json]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function usage(msg) {
  if (msg) console.error(msg);
  console.error(
    "Usage: node report-catalog-audit.mjs --current <json> [--prior <json>] --out <md> [--diff-json <json>]",
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
    else if (a === "--diff-json") out.diffJson = argv[++i];
    else usage(`Unknown arg: ${a}`);
  }
  if (!out.current || !out.out) usage();
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const here = dirname(fileURLToPath(import.meta.url));
  const diffOut =
    args.diffJson ||
    resolve(dirname(resolve(args.out)), "catalog-audit-diff-tmp.json");

  const diffArgs = [
    resolve(here, "diff-snapshots.mjs"),
    "--current",
    resolve(args.current),
    "--out",
    diffOut,
  ];
  if (args.prior) {
    diffArgs.push("--prior", resolve(args.prior));
  }
  const run = spawnSync(process.execPath, diffArgs, { encoding: "utf8" });
  if (run.status !== 0) {
    console.error(run.stderr || run.stdout);
    process.exit(run.status || 1);
  }

  const diff = JSON.parse(await readFile(diffOut, "utf8"));
  const t = diff.gap_inventory.totals;
  const lines = [];
  lines.push("# MURU catalog audit report (SEO-015)");
  lines.push("");
  lines.push(`**Snapshot:** \`${args.current}\``);
  lines.push(`**Captured at:** ${diff.current_captured_at}`);
  lines.push(`**Prior:** ${diff.prior_path ?? "_(none — first baseline)_"}`);
  lines.push("");
  lines.push(
    "> **Note:** DB has no `seo_text` column. Category/subcategory `seo_text` in this report means `seo_intro_top` OR `seo_text_bottom` is non-empty.",
  );
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push("| Slice | Count |");
  lines.push("|---|---:|");
  lines.push(`| Top categories | ${t.categories} |`);
  lines.push(`| Subcategories | ${t.subcategories} |`);
  lines.push(`| Products (not archived) | ${t.products} |`);
  lines.push(
    `| Top cats missing seo_title | ${t.cat_missing_seo_title} |`,
  );
  lines.push(
    `| Top cats missing seo_description | ${t.cat_missing_seo_description} |`,
  );
  lines.push(`| Top cats missing seo_text | ${t.cat_missing_seo_text} |`);
  lines.push(
    `| Subs missing seo_title | ${t.sub_missing_seo_title} |`,
  );
  lines.push(
    `| Subs missing seo_description | ${t.sub_missing_seo_description} |`,
  );
  lines.push(`| Subs missing seo_text | ${t.sub_missing_seo_text} |`);
  lines.push(
    `| Products missing seo_title | ${t.prod_missing_seo_title} |`,
  );
  lines.push(
    `| Products missing seo_description | ${t.prod_missing_seo_description} |`,
  );
  lines.push(
    `| Products missing description | ${t.prod_missing_description} |`,
  );
  lines.push("");
  lines.push("## Gaps by top-level category");
  lines.push("");
  lines.push(
    "| Top slug | cats | subs | products | cat−title | cat−desc | cat−text | sub−title | sub−desc | sub−text | prod−title | prod−desc | prod−body |",
  );
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const row of diff.gap_inventory.by_top_category) {
    lines.push(
      `| \`${row.top_slug}\` | ${row.categories_total} | ${row.subcategories_total} | ${row.products_total} | ${row.cat_missing_seo_title} | ${row.cat_missing_seo_description} | ${row.cat_missing_seo_text} | ${row.sub_missing_seo_title} | ${row.sub_missing_seo_description} | ${row.sub_missing_seo_text} | ${row.prod_missing_seo_title} | ${row.prod_missing_seo_description} | ${row.prod_missing_description} |`,
    );
  }
  lines.push("");
  lines.push("## Renamed / removed category candidates");
  lines.push("");
  lines.push(
    "**All rows require human confirmation. Do not auto-apply to redirect-map or CMS.**",
  );
  lines.push("");
  const seeded = diff.rename_candidates_seeded || [];
  const momRenames = diff.month_over_month?.rename_candidates || [];
  if (seeded.length === 0 && momRenames.length === 0) {
    lines.push("_No rename candidates._");
  } else {
    lines.push(
      "| Old path | Guessed new path | Confidence | Still missing? | Source | Reason |",
    );
    lines.push("|---|---|---|---|---|---|");
    for (const c of seeded) {
      lines.push(
        `| \`${c.old_live_path}\` | \`${c.guessed_new_live_path}\` | ${c.confidence} | ${c.still_missing_from_current ? "yes" : "no"} | hints | ${c.reason.replace(/\|/g, "/")} |`,
      );
    }
    for (const c of momRenames) {
      lines.push(
        `| \`${c.old_live_path}\` | \`${c.guessed_new_live_path}\` | ${c.confidence} | yes | MoM name-match | ${c.reason.replace(/\|/g, "/")} |`,
      );
    }
  }
  lines.push("");
  lines.push("## Redirect-map candidates (not applied)");
  lines.push("");
  lines.push(
    "Feed a future SEO-012-style packet after human confirmation. This packet does **not** edit `redirects_preview.csv`.",
  );
  lines.push("");
  if ((diff.redirect_map_candidates || []).length === 0) {
    lines.push("_None._");
  } else {
    lines.push("| Old | New guess | Confidence |");
    lines.push("|---|---|---|");
    for (const c of diff.redirect_map_candidates) {
      lines.push(
        `| \`${c.old_path}\` | \`${c.guessed_new_path}\` | ${c.confidence} |`,
      );
    }
  }
  lines.push("");
  if (diff.month_over_month) {
    lines.push("## Month-over-month");
    lines.push("");
    lines.push(
      `- Categories added: **${diff.month_over_month.categories_added.length}**`,
    );
    lines.push(
      `- Categories removed: **${diff.month_over_month.categories_removed.length}**`,
    );
    lines.push(
      `- Products added: **${diff.month_over_month.products_added_count}**`,
    );
    lines.push(
      `- Products removed: **${diff.month_over_month.products_removed_count}**`,
    );
    lines.push("");
  } else {
    lines.push("## Month-over-month");
    lines.push("");
    lines.push(
      "_Skipped — first baseline (no `--prior`). Next month pass `--prior` pointing at this snapshot._",
    );
    lines.push("");
  }

  const outPath = resolve(args.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, lines.join("\n"), "utf8");

  // keep stable diff json next to report if not custom
  if (!args.diffJson) {
    const stable = resolve(
      dirname(outPath),
      outPath.replace(/\.md$/, "") + "-diff.json".replace(/catalog-audit-report/, "catalog-audit"),
    );
    // simpler: write sibling
    const sibling = outPath.replace(/\.md$/, ".diff.json");
    await writeFile(sibling, JSON.stringify(diff, null, 2) + "\n", "utf8");
  }

  console.log(JSON.stringify({ ok: true, out: outPath, totals: t }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
