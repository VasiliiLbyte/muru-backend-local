/**
 * Pure helpers for SEO-015 catalog audit (no DB, no network).
 */

export function isPopulated(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** Packet alias: seo_text ≈ seo_intro_top OR seo_text_bottom */
export function hasSeoText(introTop, textBottom) {
  return isPopulated(introTop) || isPopulated(textBottom);
}

export function parseBool(raw) {
  if (typeof raw === "boolean") return raw;
  const s = String(raw ?? "").trim().toLowerCase();
  return s === "t" || s === "true" || s === "1" || s === "yes";
}

export function normalizeName(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim();
}

/**
 * Best-effort rename match: removed rows vs added rows by normalized name,
 * preferring same parent_slug. Always needs_human_confirmation.
 */
export function matchRenameCandidates(removed, added) {
  const unused = new Set(added.map((_, i) => i));
  const candidates = [];

  for (const oldRow of removed) {
    const oldName = normalizeName(oldRow.name);
    if (!oldName) continue;

    let best = null;
    for (const idx of unused) {
      const neu = added[idx];
      if (normalizeName(neu.name) !== oldName) continue;
      const sameParent =
        (oldRow.parent_slug ?? null) === (neu.parent_slug ?? null);
      const score = sameParent ? 2 : 1;
      if (!best || score > best.score) {
        best = { idx, neu, score, sameParent };
      }
    }
    if (!best) continue;
    unused.delete(best.idx);
    candidates.push({
      old_slug: oldRow.slug,
      old_kind: oldRow.kind,
      old_live_path: oldRow.live_path,
      old_parent_slug: oldRow.parent_slug ?? null,
      guessed_new_slug: best.neu.slug,
      guessed_new_kind: best.neu.kind,
      guessed_new_live_path: best.neu.live_path,
      guessed_new_parent_slug: best.neu.parent_slug ?? null,
      reason: best.sameParent
        ? "Same normalized name and parent_slug"
        : "Same normalized name, different parent",
      confidence: best.sameParent ? "medium" : "low",
      needs_human_confirmation: true,
    });
  }
  return candidates;
}

export function gapInventory(snapshot) {
  const categories = snapshot.categories ?? [];
  const products = snapshot.products ?? [];

  const tops = categories.filter((c) => c.kind === "category");
  const subs = categories.filter((c) => c.kind === "subcategory");

  const byTop = {};
  const ensureTop = (slug) => {
    const key = slug || "(no-category)";
    if (!byTop[key]) {
      byTop[key] = {
        top_slug: key,
        categories_total: 0,
        subcategories_total: 0,
        products_total: 0,
        cat_missing_seo_title: 0,
        cat_missing_seo_description: 0,
        cat_missing_seo_text: 0,
        sub_missing_seo_title: 0,
        sub_missing_seo_description: 0,
        sub_missing_seo_text: 0,
        prod_missing_seo_title: 0,
        prod_missing_seo_description: 0,
        prod_missing_description: 0,
      };
    }
    return byTop[key];
  };

  for (const c of tops) {
    const b = ensureTop(c.slug);
    b.categories_total += 1;
    if (c.has_seo_title === false) b.cat_missing_seo_title += 1;
    if (c.has_seo_description === false) b.cat_missing_seo_description += 1;
    if (c.has_seo_text === false) b.cat_missing_seo_text += 1;
  }
  for (const s of subs) {
    const b = ensureTop(s.parent_slug);
    b.subcategories_total += 1;
    if (s.has_seo_title === false) b.sub_missing_seo_title += 1;
    if (s.has_seo_description === false) b.sub_missing_seo_description += 1;
    if (s.has_seo_text === false) b.sub_missing_seo_text += 1;
  }
  for (const p of products) {
    const b = ensureTop(p.category_slug);
    b.products_total += 1;
    if (p.has_seo_title === false) b.prod_missing_seo_title += 1;
    if (p.has_seo_description === false) b.prod_missing_seo_description += 1;
    if (p.has_description === false) b.prod_missing_description += 1;
  }

  const totals = {
    categories: tops.length,
    subcategories: subs.length,
    products: products.length,
    cat_missing_seo_title: tops.filter((c) => c.has_seo_title === false).length,
    cat_missing_seo_description: tops.filter((c) => c.has_seo_description === false).length,
    cat_missing_seo_text: tops.filter((c) => c.has_seo_text === false).length,
    sub_missing_seo_title: subs.filter((c) => c.has_seo_title === false).length,
    sub_missing_seo_description: subs.filter((c) => c.has_seo_description === false).length,
    sub_missing_seo_text: subs.filter((c) => c.has_seo_text === false).length,
    prod_missing_seo_title: products.filter((p) => p.has_seo_title === false).length,
    prod_missing_seo_description: products.filter((p) => p.has_seo_description === false).length,
    prod_missing_description: products.filter((p) => p.has_description === false).length,
  };

  return {
    totals,
    by_top_category: Object.values(byTop).sort((a, b) =>
      a.top_slug.localeCompare(b.top_slug),
    ),
  };
}

export function indexBySlug(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.kind ?? "item"}:${row.slug}`;
    map.set(key, row);
  }
  return map;
}

export function diffEntities(priorRows, currentRows) {
  const prior = indexBySlug(priorRows);
  const current = indexBySlug(currentRows);
  const added = [];
  const removed = [];
  for (const [key, row] of current) {
    if (!prior.has(key)) added.push(row);
  }
  for (const [key, row] of prior) {
    if (!current.has(key)) removed.push(row);
  }
  return { added, removed };
}
