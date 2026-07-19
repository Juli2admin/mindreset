// Read a Journey prompt from docs/journey/ at module load.
// Two flavours:
//   1. Clinical specs in docs/journey/*.md — the reviewable canonical
//      source documents (Shared Core + 8 stage specs).
//   2. Engineered runtime prompts in docs/journey/runtime/*.md — the
//      distilled, XML-tagged prompts the AI actually receives. These
//      take precedence when present; the loader falls back to the
//      clinical spec for any stage that does not yet have an engineered
//      version.
//
// The engineered prompt files have the actual prompt content wrapped in
// a triple-backtick code block (so the .md is readable in GitHub with
// a metadata header above). We extract just the code-block content.
//
// In production, Vercel bundles these via outputFileTracingIncludes in
// next.config.mjs.

import { existsSync, readFileSync } from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const SPECS_DIR = path.join(PROJECT_ROOT, 'docs', 'journey');
const RUNTIME_DIR = path.join(SPECS_DIR, 'runtime');

const cache = new Map<string, string>();

export function loadSpec(filename: string): string {
  const hit = cache.get(filename);
  if (hit) return hit;
  const full = path.join(SPECS_DIR, filename);
  const content = readFileSync(full, 'utf8');
  cache.set(filename, content);
  return content;
}

// Convenience accessors for the clinical specs.
export const sharedCore = (): string => loadSpec('00-shared-core.md');
// The Practice Generation Algorithm — authoritative spec for how the AI
// generates practices at runtime. Stage-agnostic canon that describes the
// 5 practice families (regulation, somatic awareness, guided inner
// landscape, narrative rewriting, self-compassion) and the composition
// rules (user's own words + images, channel awareness, safety-first
// depth). Journey polish PR 2 (2026-07-04): the AI was over-emitting
// stabilisation practices — feet on floor, hand on chest, breathing —
// because the deeper generation method was scattered in stage docs and
// not loaded verbatim into the prompt. This loader brings the canonical
// algorithm into the always-hot prefix so it's read every turn.
export const practiceGenerationAlgorithm = (): string =>
  loadSpec('PRACTICE_GENERATION_ALGORITHM.md');
export const stage01 = (): string => loadSpec('01-stage-stabilisation.md');
export const stage02 = (): string => loadSpec('02-stage-pain.md');
export const stage03 = (): string => loadSpec('03-stage-adult-self.md');
export const stage04 = (): string => loadSpec('04-stage-parts.md');
export const stage05 = (): string => loadSpec('05-stage-foreign-material.md');
export const stage06 = (): string => loadSpec('06-stage-integration.md');
export const stage07 = (): string => loadSpec('07-stage-new-identity.md');
export const stage08 = (): string => loadSpec('08-stage-embodiment.md');

export function loadStageSpec(stage: number): string {
  switch (stage) {
    case 1: return stage01();
    case 2: return stage02();
    case 3: return stage03();
    case 4: return stage04();
    case 5: return stage05();
    case 6: return stage06();
    case 7: return stage07();
    case 8: return stage08();
    default: return stage01();
  }
}

// ---------------------------------------------------------------------------
// Engineered runtime prompts — docs/journey/runtime/stage-NN.md
// ---------------------------------------------------------------------------

// Extract the prompt content between the OUTER ```...``` code fence.
// The .md file wraps the prompt in a code block so it renders cleanly on
// GitHub with a metadata header. Runtime gets only what's inside.
//
// PR-1 loader fix (2026-07-19). The previous implementation closed at the
// FIRST ``` after the opening fence. The master prompt legitimately
// contains inner ``` fences (the "Output order every turn" example and the
// state-report emission example in the Therapeutic Sensitivity Layer,
// added 2026-07-09), so the loader silently truncated the runtime prompt
// at the first inner fence: the five silent clinician questions, ALL hard
// behaviour rules (modality rejection, body-activation switching, cycle
// close conditions) and the worked failure-mode example never reached the
// model in production (~6,101 characters dropped). Inner fences come in
// pairs, so the outer close is the LAST ``` in the file — close there.
// Regression-pinned by prompts/loader-fence-extraction.test.ts.
function extractCodeBlock(md: string): string | null {
  const openIdx = md.indexOf('```');
  if (openIdx < 0) return null;
  // Skip the opening fence line (which may carry a language tag).
  const afterOpenLine = md.indexOf('\n', openIdx);
  if (afterOpenLine < 0) return null;
  const closeIdx = md.lastIndexOf('```');
  if (closeIdx <= afterOpenLine) return null;
  return md.slice(afterOpenLine + 1, closeIdx).trim();
}

const runtimeCache = new Map<number, string | null>();
const masterCache = { value: null as string | null, loaded: false };

/**
 * Load the single master Journey runtime prompt, if it exists.
 * The master prompt holds the full 8-block toolkit as MOVES available
 * every turn — a clinician using whichever move serves the user now,
 * rather than walking them through fixed per-stage prompts.
 *
 * Returns the prompt body (extracted from the markdown code block), or
 * null if no master prompt file exists.
 */
export function loadMasterJourneyPrompt(): string | null {
  if (masterCache.loaded) return masterCache.value;
  const full = path.join(RUNTIME_DIR, 'journey-master.md');
  if (!existsSync(full)) {
    masterCache.loaded = true;
    masterCache.value = null;
    return null;
  }
  const md = readFileSync(full, 'utf8');
  masterCache.value = extractCodeBlock(md);
  masterCache.loaded = true;
  return masterCache.value;
}

/**
 * Load the engineered runtime prompt for a stage, if one exists.
 * Returns the prompt body (already extracted from its code block), or
 * null if no engineered version exists for this stage yet.
 *
 * Deprecated in favour of `loadMasterJourneyPrompt` — kept for fallback
 * during rollout.
 */
export function loadEngineeredStagePrompt(stage: number): string | null {
  if (runtimeCache.has(stage)) return runtimeCache.get(stage)!;
  const filename = `stage-${String(stage).padStart(2, '0')}.md`;
  const full = path.join(RUNTIME_DIR, filename);
  if (!existsSync(full)) {
    runtimeCache.set(stage, null);
    return null;
  }
  const md = readFileSync(full, 'utf8');
  const body = extractCodeBlock(md);
  runtimeCache.set(stage, body);
  return body;
}

