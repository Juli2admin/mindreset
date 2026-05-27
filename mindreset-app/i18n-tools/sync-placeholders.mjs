#!/usr/bin/env node
/**
 * sync-placeholders.mjs — SMART MERGE
 *
 * Upgraded 2026-05-27. Previous behaviour: byte-identical copy of en.json
 * over each placeholder bundle, which silently destroyed any hand-curated
 * translation that landed in those bundles between syncs.
 *
 * New behaviour: for each placeholder locale (fr/de/es/it/pl/pt), the
 * bundle is reconciled against en.json such that
 *
 *   - Every key in en.json exists in the target bundle. Missing keys are
 *     added with the EN value (acts as placeholder until translated).
 *   - Existing target values are PRESERVED when they differ from en.json
 *     (i.e., the value has been hand-translated). EN-identical values are
 *     treated as placeholders and stay aligned with en.json.
 *   - Keys present in the target but absent from en.json are dropped
 *     (stale cleanup).
 *   - Key order matches en.json for clean diffs.
 *
 * Hand-curated native bundles (en, ru) are never touched.
 *
 * Idempotent. Safe to re-run. Run after editing en.json, or as part of
 * `npm run i18n` before a commit that touches en.json.
 *
 * Locale definitions are duplicated below (SOURCE OF TRUTH:
 * mindreset-app/i18n/routing.ts for the full set, and
 * mindreset-app/components/LanguagePicker.tsx for the native subset).
 * If you change either of those, mirror the change here.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = resolve(__dirname, "..", "messages");

// All locales the app ships — mirrors i18n/routing.ts `locales`.
const ALL_LOCALES = ["en", "ru", "fr", "de", "es", "it", "pl", "pt"];

// Source locale — every other locale is keyed against this one.
const SOURCE_LOCALE = "en";

// Locales with hand-curated native-quality content — never overwritten.
// Mirrors components/LanguagePicker.tsx `NATIVE_CONTENT_LOCALES`.
const NATIVE_LOCALES = new Set(["en", "ru"]);

const PLACEHOLDER_LOCALES = ALL_LOCALES.filter(
  (l) => l !== SOURCE_LOCALE && !NATIVE_LOCALES.has(l),
);

/**
 * Smart-merge: walks source structure, returns a result that mirrors
 * source's shape but uses target's leaf values when they exist AND differ
 * from source (= translation present). Falls back to source value when
 * target is missing the path or matches source byte-for-byte
 * (= placeholder). Stale target keys not in source are dropped because
 * the result is built from source's key set.
 *
 * Side effect: increments counters in `stats` for visibility.
 */
function smartMerge(source, target, stats) {
  if (Array.isArray(source)) {
    if (!Array.isArray(target)) {
      // Shape mismatch — replace with a deep clone of source.
      return JSON.parse(JSON.stringify(source));
    }
    return source.map((item, i) => smartMerge(item, target[i], stats));
  }
  if (source !== null && typeof source === "object") {
    if (target === null || typeof target !== "object" || Array.isArray(target)) {
      return JSON.parse(JSON.stringify(source));
    }
    const result = {};
    for (const key of Object.keys(source)) {
      result[key] = smartMerge(source[key], target[key], stats);
    }
    return result;
  }
  // Leaf
  if (
    typeof source === "string" &&
    typeof target === "string" &&
    target !== source &&
    target.length > 0
  ) {
    stats.preserved += 1;
    return target;
  }
  if (target === undefined) {
    stats.added += 1;
  } else {
    stats.placeholder += 1;
  }
  return source;
}

function run() {
  const srcPath = resolve(MESSAGES_DIR, `${SOURCE_LOCALE}.json`);
  let source;
  try {
    source = JSON.parse(readFileSync(srcPath, "utf8"));
  } catch (err) {
    console.error(`[sync] ${SOURCE_LOCALE}.json is not valid JSON:`, err.message);
    process.exit(1);
  }

  const changed = [];
  for (const locale of PLACEHOLDER_LOCALES) {
    const targetPath = resolve(MESSAGES_DIR, `${locale}.json`);
    let target = {};
    if (existsSync(targetPath)) {
      try {
        target = JSON.parse(readFileSync(targetPath, "utf8"));
      } catch (err) {
        console.error(
          `[sync] ${locale}.json is not valid JSON; rewriting from source. (${err.message})`,
        );
        target = {};
      }
    }
    const stats = { preserved: 0, placeholder: 0, added: 0 };
    const merged = smartMerge(source, target, stats);
    const mergedStr = JSON.stringify(merged, null, 2) + "\n";
    const previousStr = existsSync(targetPath) ? readFileSync(targetPath, "utf8") : "";
    if (mergedStr !== previousStr) {
      writeFileSync(targetPath, mergedStr);
      changed.push({ locale, ...stats });
    } else {
      changed.push({ locale, ...stats, unchanged: true });
    }
  }

  const written = changed.filter((c) => !c.unchanged);
  if (written.length === 0) {
    console.log(
      `[sync] all placeholder bundles already aligned with ${SOURCE_LOCALE}.json — no file changes.`,
    );
  } else {
    console.log(
      `[sync] merged ${written.length} placeholder bundle(s) from ${SOURCE_LOCALE}.json:`,
    );
  }
  for (const { locale, preserved, placeholder, added, unchanged } of changed) {
    const note = unchanged ? "no change" : "written";
    console.log(
      `  ${locale}: ${preserved} translation(s) preserved, ${placeholder} placeholder(s), ${added} new key(s) added — ${note}`,
    );
  }
}

run();
