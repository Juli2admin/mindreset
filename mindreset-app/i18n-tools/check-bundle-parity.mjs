#!/usr/bin/env node
/**
 * check-bundle-parity.mjs
 *
 * Verifies that every locale bundle under messages/ has the same key
 * structure as the source bundle (en.json). Catches drift introduced
 * by hand-editing an individual locale, by adding a new key to en.json
 * without running sync, or by promoting a bundle to native content
 * without porting every key.
 *
 * Checks performed:
 *   1. JSON validity for every bundle.
 *   2. Same set of key paths (deep walk through objects).
 *   3. Same array lengths at every array-typed key.
 *   4. Same set of ICU placeholders within each leaf string value
 *      (e.g. {name}, {when} must appear in every locale's same key).
 *
 * Exits 0 if all bundles are parity-clean; exits 1 with a per-locale
 * report otherwise. Wired into `npm run i18n:check` and the Vercel
 * pre-build step so drift blocks deploy.
 *
 * Locale list mirrors i18n/routing.ts (see comment in sync-placeholders.mjs).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = resolve(__dirname, "..", "messages");

const ALL_LOCALES = ["en", "ru", "fr", "de", "es", "it", "pl", "pt"];
const SOURCE_LOCALE = "en";
const ICU_PLACEHOLDER_RE = /\{[a-zA-Z_][a-zA-Z0-9_]*\}/g;

function loadBundle(locale) {
  const path = resolve(MESSAGES_DIR, `${locale}.json`);
  const raw = readFileSync(path, "utf8");
  return { raw, json: JSON.parse(raw) };
}

/**
 * Walk an object/array tree and yield records describing each leaf and
 * each array. Keys are dotted with bracketed array indices, e.g.
 * "Landing.heroBody[2]", "CrisisResources.crisisItems[0].name".
 */
function walk(node, path, acc) {
  if (Array.isArray(node)) {
    acc.arrays.set(path, node.length);
    for (let i = 0; i < node.length; i++) {
      walk(node[i], `${path}[${i}]`, acc);
    }
    return;
  }
  if (node !== null && typeof node === "object") {
    for (const key of Object.keys(node)) {
      const childPath = path ? `${path}.${key}` : key;
      walk(node[key], childPath, acc);
    }
    return;
  }
  // Leaf value (string, number, boolean, null).
  acc.leaves.set(path, node);
  if (typeof node === "string") {
    const placeholders = node.match(ICU_PLACEHOLDER_RE) ?? [];
    if (placeholders.length > 0) {
      acc.placeholders.set(path, new Set(placeholders));
    }
  }
}

function describeBundle(json) {
  const acc = { leaves: new Map(), arrays: new Map(), placeholders: new Map() };
  walk(json, "", acc);
  return acc;
}

function setDiff(a, b) {
  const only = [];
  for (const k of a) if (!b.has(k)) only.push(k);
  return only;
}

function run() {
  let source;
  try {
    source = loadBundle(SOURCE_LOCALE);
  } catch (err) {
    console.error(`[parity] FAIL — could not load ${SOURCE_LOCALE}.json: ${err.message}`);
    process.exit(1);
  }
  const srcDesc = describeBundle(source.json);
  const srcLeaves = new Set(srcDesc.leaves.keys());

  let totalErrors = 0;
  const report = [];

  for (const locale of ALL_LOCALES) {
    if (locale === SOURCE_LOCALE) continue;
    let bundle;
    try {
      bundle = loadBundle(locale);
    } catch (err) {
      report.push(`  ${locale}: FAIL — ${err.message}`);
      totalErrors++;
      continue;
    }
    const desc = describeBundle(bundle.json);
    const localeLeaves = new Set(desc.leaves.keys());

    const missingKeys = setDiff(srcLeaves, localeLeaves);
    const extraKeys = setDiff(localeLeaves, srcLeaves);
    const arrayMismatches = [];
    for (const [path, srcLen] of srcDesc.arrays) {
      const localeLen = desc.arrays.get(path);
      if (localeLen !== undefined && localeLen !== srcLen) {
        arrayMismatches.push(`${path} (en=${srcLen}, ${locale}=${localeLen})`);
      }
    }
    const placeholderMismatches = [];
    for (const [path, srcSet] of srcDesc.placeholders) {
      const localeSet = desc.placeholders.get(path);
      if (!localeSet) {
        // The leaf might be missing entirely (caught above) — only flag if leaf exists.
        if (localeLeaves.has(path)) {
          placeholderMismatches.push(`${path} missing ${[...srcSet].join(",")}`);
        }
        continue;
      }
      const srcMinusLocale = [...srcSet].filter((p) => !localeSet.has(p));
      const localeMinusSrc = [...localeSet].filter((p) => !srcSet.has(p));
      if (srcMinusLocale.length || localeMinusSrc.length) {
        const parts = [];
        if (srcMinusLocale.length) parts.push(`missing ${srcMinusLocale.join(",")}`);
        if (localeMinusSrc.length) parts.push(`unexpected ${localeMinusSrc.join(",")}`);
        placeholderMismatches.push(`${path} ${parts.join("; ")}`);
      }
    }

    const localeErrors = missingKeys.length + extraKeys.length + arrayMismatches.length + placeholderMismatches.length;
    if (localeErrors === 0) {
      report.push(`  ${locale}: OK`);
      continue;
    }
    totalErrors += localeErrors;
    const lines = [`  ${locale}: FAIL (${localeErrors} issue${localeErrors === 1 ? "" : "s"})`];
    if (missingKeys.length) {
      lines.push(`    missing keys (${missingKeys.length}):`);
      for (const k of missingKeys.slice(0, 10)) lines.push(`      - ${k}`);
      if (missingKeys.length > 10) lines.push(`      ... and ${missingKeys.length - 10} more`);
    }
    if (extraKeys.length) {
      lines.push(`    extra keys not in ${SOURCE_LOCALE} (${extraKeys.length}):`);
      for (const k of extraKeys.slice(0, 10)) lines.push(`      - ${k}`);
      if (extraKeys.length > 10) lines.push(`      ... and ${extraKeys.length - 10} more`);
    }
    if (arrayMismatches.length) {
      lines.push(`    array length mismatches (${arrayMismatches.length}):`);
      for (const m of arrayMismatches) lines.push(`      - ${m}`);
    }
    if (placeholderMismatches.length) {
      lines.push(`    ICU placeholder mismatches (${placeholderMismatches.length}):`);
      for (const m of placeholderMismatches) lines.push(`      - ${m}`);
    }
    report.push(lines.join("\n"));
  }

  if (totalErrors === 0) {
    console.log(`[parity] OK — all ${ALL_LOCALES.length - 1} non-source bundles match ${SOURCE_LOCALE}.json key structure.`);
    process.exit(0);
  }

  console.error(`[parity] FAIL — ${totalErrors} issue${totalErrors === 1 ? "" : "s"} across the bundle set:\n${report.join("\n")}`);
  console.error(`\nTo repair placeholder bundles from ${SOURCE_LOCALE}.json, run: npm run i18n:sync`);
  process.exit(1);
}

run();
