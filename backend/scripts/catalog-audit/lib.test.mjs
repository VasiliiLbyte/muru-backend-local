import assert from "node:assert/strict";
import {
  gapInventory,
  hasSeoText,
  isPopulated,
  matchRenameCandidates,
  normalizeName,
  parseBool,
} from "./lib.mjs";

assert.equal(isPopulated(""), false);
assert.equal(isPopulated("  "), false);
assert.equal(isPopulated("x"), true);
assert.equal(hasSeoText("", "body"), true);
assert.equal(hasSeoText("intro", ""), true);
assert.equal(hasSeoText("", ""), false);
assert.equal(parseBool("t"), true);
assert.equal(parseBool("f"), false);
assert.equal(normalizeName("Вазы  и  кувшины"), "вазы и кувшины");

const removed = [
  {
    kind: "category",
    slug: "old-vazy",
    name: "Вазы",
    parent_slug: null,
    live_path: "/catalog/old-vazy/",
  },
];
const added = [
  {
    kind: "subcategory",
    slug: "svet",
    name: "Вазы",
    parent_slug: "mebel-i-svet",
    live_path: "/catalog/mebel-i-svet/svet/",
  },
];
const cand = matchRenameCandidates(removed, added);
assert.equal(cand.length, 1);
assert.equal(cand[0].needs_human_confirmation, true);
assert.equal(cand[0].guessed_new_slug, "svet");

const snap = {
  categories: [
    {
      kind: "category",
      slug: "tekstil",
      has_seo_title: true,
      has_seo_description: false,
      has_seo_text: false,
    },
    {
      kind: "subcategory",
      slug: "spalnya",
      parent_slug: "tekstil",
      has_seo_title: false,
      has_seo_description: false,
      has_seo_text: true,
    },
  ],
  products: [
    {
      category_slug: "tekstil",
      has_seo_title: false,
      has_seo_description: true,
      has_description: true,
    },
  ],
};
const gaps = gapInventory(snap);
assert.equal(gaps.totals.categories, 1);
assert.equal(gaps.totals.subcategories, 1);
assert.equal(gaps.totals.prod_missing_seo_title, 1);
assert.equal(gaps.by_top_category[0].sub_missing_seo_title, 1);

console.log("lib.test.mjs: ok");
