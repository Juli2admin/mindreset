#!/usr/bin/env node
/**
 * translate-missing.mjs
 *
 * Phase 2b skeleton: invoked manually pre-launch (or whenever a locale
 * is promoted from placeholder to native-quality). Reads translate-prompt.md
 * as the system prompt, sends Claude the EN source strings + target locale
 * code, and produces a side-by-side EN/target diff for owner review.
 *
 * Default mode: --dry-run (no file writes). Output is printed to stdout
 * as a side-by-side mapping; the owner approves before re-running with
 * --write to actually update the bundle.
 *
 * NOT wired into package.json — invoked manually:
 *   node i18n-tools/translate-missing.mjs --locale=fr
 *   node i18n-tools/translate-missing.mjs --locale=fr --write
 *
 * Requires ANTHROPIC_API_KEY in the environment.
 *
 * This is a SKELETON. The model prompt structure, batching strategy, and
 * the JSON-parsing of model output are first-pass and will need
 * iteration once Julia + reviewer-model do the first real translation
 * pass. Surface anything ambiguous as a [NOTE:...] in the diff rather
 * than silently choosing.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = resolve(__dirname, "..", "messages");
const PROMPT_PATH = resolve(__dirname, "translate-prompt.md");

const ALL_LOCALES = ["en", "ru", "fr", "de", "es", "it", "pl", "pt"];
const SOURCE_LOCALE = "en";
const NATIVE_LOCALES = new Set(["en", "ru"]);

// --- CLI parsing ---

function parseArgs(argv) {
  const args = { locale: null, write: false, model: "claude-opus-4-7", maxBatch: 30 };
  for (const a of argv.slice(2)) {
    if (a === "--write") args.write = true;
    else if (a === "--dry-run") args.write = false;
    else if (a.startsWith("--locale=")) args.locale = a.slice("--locale=".length);
    else if (a.startsWith("--model=")) args.model = a.slice("--model=".length);
    else if (a.startsWith("--max-batch=")) args.maxBatch = Number(a.slice("--max-batch=".length));
    else {
      console.error(`unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

function usage() {
  console.log(`Usage: node i18n-tools/translate-missing.mjs --locale=<code> [--write] [--model=<id>] [--max-batch=<n>]
  --locale=<code>   target locale (one of: ${ALL_LOCALES.filter((l) => l !== SOURCE_LOCALE).join(", ")})
  --write           apply translations to the bundle file (default: dry-run, prints diff only)
  --model=<id>      Anthropic model id (default: claude-opus-4-7)
  --max-batch=<n>   max strings sent per API call (default: 30)`);
}

// --- Bundle walking (shared shape with check-bundle-parity.mjs) ---

function walkLeaves(node, path, out) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) walkLeaves(node[i], `${path}[${i}]`, out);
    return;
  }
  if (node !== null && typeof node === "object") {
    for (const key of Object.keys(node)) {
      const childPath = path ? `${path}.${key}` : key;
      walkLeaves(node[key], childPath, out);
    }
    return;
  }
  out.set(path, node);
}

function setValueAtPath(root, path, value) {
  // path uses dotted keys + bracketed array indices. Navigate down,
  // creating objects/arrays as needed. Returns the mutated root.
  const tokens = path.split(/(?=\[)|\./).map((t) =>
    t.startsWith("[") ? Number(t.slice(1, -1)) : t,
  );
  let node = root;
  for (let i = 0; i < tokens.length - 1; i++) {
    const t = tokens[i];
    const nextT = tokens[i + 1];
    const nextIsIndex = typeof nextT === "number";
    if (node[t] === undefined || node[t] === null) {
      node[t] = nextIsIndex ? [] : {};
    }
    node = node[t];
  }
  node[tokens[tokens.length - 1]] = value;
  return root;
}

// --- Identify which leaves need translation ---

function findMissingOrPlaceholder(sourceLeaves, targetLeaves) {
  // A leaf needs translation when:
  //   - it's missing from the target bundle entirely, OR
  //   - the target value is byte-identical to the source value
  //     (i.e. still a placeholder).
  // Non-string leaves (numbers, booleans, null) are skipped — they are
  // structural, not translatable.
  const work = [];
  for (const [path, srcVal] of sourceLeaves) {
    if (typeof srcVal !== "string") continue;
    const targetVal = targetLeaves.get(path);
    if (targetVal === undefined || targetVal === srcVal) {
      work.push({ path, source: srcVal });
    }
  }
  return work;
}

// --- Anthropic call ---

async function translateBatch(client, model, systemPrompt, targetLocale, batch) {
  // Build a strict JSON-in/JSON-out user message. The model is instructed
  // to return ONLY the JSON object with key-path -> translated string.
  const userPayload = {
    target_locale: targetLocale,
    instructions: "Translate each EN source string into the target locale per the system prompt rules. Return a JSON object mapping each key path to the translated string. No prose. No markdown. JSON only.",
    strings: Object.fromEntries(batch.map((b) => [b.path, b.source])),
  };

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      { role: "user", content: JSON.stringify(userPayload, null, 2) },
    ],
  });

  const text = response.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");

  // The model is asked for strict JSON. Strip code-fence wrapping if present.
  const cleaned = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`model returned non-JSON content (first 200 chars): ${cleaned.slice(0, 200)}`);
  }
  return parsed;
}

// --- Diff output ---

function renderDiff(targetLocale, translations, batch) {
  const lines = [`# Translation dry-run — locale: ${targetLocale}`, ""];
  for (const { path, source } of batch) {
    const translated = translations[path] ?? "[MISSING IN MODEL OUTPUT]";
    lines.push(`## ${path}`);
    lines.push(`EN: ${JSON.stringify(source)}`);
    lines.push(`${targetLocale.toUpperCase()}: ${JSON.stringify(translated)}`);
    lines.push("");
  }
  return lines.join("\n");
}

// --- Main ---

async function run() {
  const args = parseArgs(process.argv);
  if (!args.locale) {
    usage();
    process.exit(2);
  }
  if (args.locale === SOURCE_LOCALE) {
    console.error(`refusing to translate INTO the source locale (${SOURCE_LOCALE}).`);
    process.exit(2);
  }
  if (!ALL_LOCALES.includes(args.locale)) {
    console.error(`unknown locale: ${args.locale} (expected one of ${ALL_LOCALES.join(", ")})`);
    process.exit(2);
  }
  if (NATIVE_LOCALES.has(args.locale) && args.write) {
    console.error(`refusing to --write into native locale ${args.locale} — translations into a hand-curated bundle must be reviewed manually.`);
    console.error(`re-run in dry-run mode to preview and apply changes by hand.`);
    process.exit(2);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set.");
    process.exit(2);
  }

  const systemPrompt = readFileSync(PROMPT_PATH, "utf8");
  const sourceBundle = JSON.parse(readFileSync(resolve(MESSAGES_DIR, `${SOURCE_LOCALE}.json`), "utf8"));
  const targetPath = resolve(MESSAGES_DIR, `${args.locale}.json`);
  const targetBundle = JSON.parse(readFileSync(targetPath, "utf8"));

  const sourceLeaves = new Map();
  walkLeaves(sourceBundle, "", sourceLeaves);
  const targetLeaves = new Map();
  walkLeaves(targetBundle, "", targetLeaves);

  const work = findMissingOrPlaceholder(sourceLeaves, targetLeaves);
  if (work.length === 0) {
    console.log(`[translate] ${args.locale}: nothing to translate — bundle has no missing or placeholder strings.`);
    return;
  }

  console.log(`[translate] ${args.locale}: ${work.length} string(s) need translation. mode=${args.write ? "WRITE" : "DRY-RUN"}, model=${args.model}`);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const translations = {};

  for (let i = 0; i < work.length; i += args.maxBatch) {
    const batch = work.slice(i, i + args.maxBatch);
    console.log(`[translate] batch ${Math.floor(i / args.maxBatch) + 1} (${batch.length} string${batch.length === 1 ? "" : "s"})...`);
    const result = await translateBatch(client, args.model, systemPrompt, args.locale, batch);
    Object.assign(translations, result);
  }

  // Always print the diff. The owner reviews this either way (dry-run = stop here, write = apply after).
  console.log("");
  console.log(renderDiff(args.locale, translations, work));

  if (!args.write) {
    console.log(`[translate] dry-run complete. Re-run with --write to apply.`);
    return;
  }

  for (const { path } of work) {
    const translated = translations[path];
    if (typeof translated !== "string") {
      console.error(`[translate] ABORT — model returned no translation for ${path}; refusing to write a partial bundle.`);
      process.exit(1);
    }
    setValueAtPath(targetBundle, path, translated);
  }
  writeFileSync(targetPath, JSON.stringify(targetBundle, null, 2) + "\n");
  console.log(`[translate] wrote ${work.length} translation(s) into ${args.locale}.json. Re-run \`npm run i18n:check\` to confirm parity.`);
}

run().catch((err) => {
  console.error(`[translate] error:`, err.message);
  process.exit(1);
});
