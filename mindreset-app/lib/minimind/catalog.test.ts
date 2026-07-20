// Pin the owner-approved module catalog — Step 4 part B (2026-07-20).
//
// The catalog fills the suggestion protocol's [module name] placeholder;
// these tests keep its discipline intact: all nine modules nameable, the
// never-at-first-sign rule restated, Journey positioning honest and
// pressure-free, and no prices anywhere (commerce stays on module pages).

import { describe, expect, it } from 'vitest';
import { MODULE_CATALOG_BLOCK } from './catalog';

describe('MiniMind module catalog', () => {
  it('names all four State modules and all five Themes', () => {
    for (const name of [
      '**Anxiety**', '**Apathy**', '**Loss of self**', '**Inner emptiness**',
      '**Shame & Guilt**', '**Money**', '**Body**', '**Family**', '**Self-Realisation**',
    ]) {
      expect(MODULE_CATALOG_BLOCK).toContain(name);
    }
  });

  it('restates the suggestion discipline so the catalog cannot loosen it', () => {
    expect(MODULE_CATALOG_BLOCK).toContain(
      'never at the first sign of a feeling',
    );
    expect(MODULE_CATALOG_BLOCK).toContain('pattern-detection threshold');
  });

  it('positions the Journey honestly and without pressure', () => {
    expect(MODULE_CATALOG_BLOCK).toContain('It is not daily support and not quick clarity.');
    expect(MODULE_CATALOG_BLOCK).toContain('always as information, never pressure');
    expect(MODULE_CATALOG_BLOCK).toContain('the choice is entirely theirs');
  });

  it('contains no prices — commerce stays on the module pages', () => {
    expect(MODULE_CATALOG_BLOCK).not.toContain('£');
    expect(MODULE_CATALOG_BLOCK).not.toMatch(/\d+\s*(GBP|pounds)/i);
  });
});
