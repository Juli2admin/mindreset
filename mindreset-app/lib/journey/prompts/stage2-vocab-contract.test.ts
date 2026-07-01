// PR 4 — unblock Stage 2. Guards the emit↔require contract the audit found
// broken: checkStage2Gate() requires the AI to emit `soft_why` and
// `emotion_located` (or `body_located`), but the master prompt's
// readinessTouched vocabulary listed neither — and its own "omit fields not in
// the schema" rule then forbade the AI from emitting them. Result: Stage 2 was
// impassable. This test pins the master prompt so the vocabulary can't drift
// out of sync with the gate again.

import { describe, expect, it } from 'vitest';
import { loadMasterJourneyPrompt } from './load-spec';

describe('master prompt — Stage 2 emit↔require contract', () => {
  const master = loadMasterJourneyPrompt();
  const m = master ?? '';

  it('the master prompt loads', () => {
    expect(master).not.toBeNull();
  });

  it('readinessTouched vocabulary lists every token the Stage 2 gate accepts', () => {
    // Gate conditions (checkStage2Gate): emotion_named; emotion_located OR
    // body_located; soft_why.
    expect(m).toContain('"emotion_named"');
    expect(m).toContain('"emotion_located"');
    expect(m).toContain('"body_located"');
    expect(m).toContain('"soft_why"');
  });

  it('move 2 instructs emitting the located + Soft Why tokens at the right moment', () => {
    expect(m).toContain('Soft Why');
    expect(m).toContain('add `"emotion_located"`');
    expect(m).toContain('add `"soft_why"`');
  });
});
