#!/usr/bin/env node
/**
 * sync-placeholders.mjs
 *
 * Per the Phase 2b Option-B cadence: each placeholder locale bundle
 * (fr/de/es/it/pl/pt) holds a byte-identical copy of en.json until that
 * locale is promoted to native-quality via translate-missing.mjs + native
 * reviewer pass. This script enforces that property by copying en.json
 * verbatim into each placeholder bundle.
 *
 * It is mechanical and idempotent: running against a clean tree produces
 * zero diffs. Run it whenever en.json changes, or as part of `npm run
 * i18n` before a commit that touches en.json. Native-quality bundles
 * (en, ru) are never touched.
 *
 * Locale definitions are duplicated below (SOURCE OF TRUTH:
 * mindreset-app/i18n/routing.ts for the full set, and
 * mindreset-app/components/LanguagePicker.tsx for the native subset).
 * If you change either of those, mirror the change here.
 */

import { readFileSync, writeFileSync } from "node:fs";
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

function run() {
  const srcPath = resolve(MESSAGES_DIR, `${SOURCE_LOCALE}.json`);
  const srcRaw = readFileSync(srcPath, "utf8");

  // Validate the source bundle is parseable JSON before propagating.
  try {
    JSON.parse(srcRaw);
  } catch (err) {
    console.error(`[sync] ${SOURCE_LOCALE}.json is not valid JSON:`, err.message);
    process.exit(1);
  }

  const changed = [];
  for (const locale of PLACEHOLDER_LOCALES) {
    const targetPath = resolve(MESSAGES_DIR, `${locale}.json`);
    let existing = "";
    try {
      existing = readFileSync(targetPath, "utf8");
    } catch {
      // Missing file is fine — we'll create it.
    }
    if (existing === srcRaw) continue;
    writeFileSync(targetPath, srcRaw);
    changed.push(locale);
  }

  if (changed.length === 0) {
    console.log(`[sync] all placeholder bundles already match ${SOURCE_LOCALE}.json — no changes.`);
  } else {
    console.log(`[sync] synced ${changed.length} placeholder bundle(s) from ${SOURCE_LOCALE}.json: ${changed.join(", ")}`);
  }
}

run();
