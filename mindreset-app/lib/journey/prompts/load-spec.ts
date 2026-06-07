// Read a Journey clinical spec from docs/journey/ at module load.
// The .md files are the canonical, reviewable source of truth; runtime
// reads them directly to avoid any drift between docs and runtime.
//
// In production, Vercel bundles these via outputFileTracingIncludes in
// next.config.mjs.

import { readFileSync } from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const SPECS_DIR = path.join(PROJECT_ROOT, 'docs', 'journey');

const cache = new Map<string, string>();

export function loadSpec(filename: string): string {
  const hit = cache.get(filename);
  if (hit) return hit;
  const full = path.join(SPECS_DIR, filename);
  const content = readFileSync(full, 'utf8');
  cache.set(filename, content);
  return content;
}

// Convenience accessors — used by the assembler.
export const sharedCore = (): string => loadSpec('00-shared-core.md');
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
