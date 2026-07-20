// Tests for the <communication> surface-register section (2026-07-19,
// owner-approved wording).
//
// Scope guard: this section changes how the clinician SOUNDS, not how it
// works. These tests pin four contracts the owner asked for explicitly:
//   1. unnecessary paraphrasing is discouraged;
//   2. reply-shape variation is explicitly allowed;
//   3. hidden hypotheses are not automatically user-facing (the user
//      should never feel diagnosed in real time);
//   4. reflection remains available when clinically purposeful — the
//      section must never read as a ban on reflection.
//
// All assertions run against loadMasterJourneyPrompt() — the runtime
// loader output, post fence-extraction — so a document edit or a loader
// regression that drops the section fails here.

import { describe, expect, it } from 'vitest';
import { loadMasterJourneyPrompt } from './load-spec';

const master = loadMasterJourneyPrompt() ?? '';

describe('master prompt — <communication> section present in runtime output', () => {
  it('has the section, framed as natural conversation with an experienced clinician', () => {
    expect(master).toContain('<communication>');
    expect(master).toContain('</communication>');
    expect(master).toContain(
      'an experienced clinician in natural conversation — not a lecturer, a coach, a therapy student, or a reflective-listening script',
    );
  });
});

describe('communication — unnecessary paraphrasing is discouraged', () => {
  it('instructs against echoing the last message by default', () => {
    expect(master).toContain('**Assume the user remembers what they just said.**');
    expect(master).toContain(
      'Do not repeat or paraphrase their last message back to them unless the repetition does real clinical work',
    );
    expect(master).toContain('Move the conversation forward instead of summarising every turn.');
  });

  it('names the echo → interpretation → question pattern as the one to break', () => {
    expect(master).toContain('echo → interpretation → question');
  });
});

describe('communication — reply-shape variation is explicitly allowed', () => {
  it('permits question-only, observation-only, and natural-reaction replies', () => {
    expect(master).toContain('Sometimes only a direct question.');
    expect(master).toContain('Sometimes one short observation, no question.');
    expect(master).toContain('Sometimes a natural conversational reaction.');
  });

  it('asks for texture matching, not just vocabulary matching', () => {
    expect(master).toContain('**Match texture, not just vocabulary.**');
    expect(master).toContain(
      'Sentence length, directness, and conversational temperature are part of meeting them in their language.',
    );
  });

  it('lists the stock phrases to avoid', () => {
    const idx = master.indexOf('**Avoid stock therapy phrasing**');
    expect(idx).toBeGreaterThan(-1);
    const block = master.slice(idx, idx + 400);
    for (const phrase of [
      '"I hear you"',
      '"That sounds difficult"',
      '"That took courage"',
      '"I\'m curious"',
      '"I\'m wondering"',
      '"Let\'s stay with that"',
      '"That\'s a real place to be"',
    ]) {
      expect(block, `avoid-list should include ${phrase}`).toContain(phrase);
    }
  });
});

describe('communication — hidden hypotheses are not automatically user-facing', () => {
  it('keeps reasoning internal with the owner-added guardrails', () => {
    expect(master).toContain(
      'Clinical hypotheses and diagnostic interpretations live in the state report, not the reply',
    );
    expect(master).toContain(
      'The user should never feel that they are being diagnosed in real time.',
    );
    expect(master).toContain('Do not rush to explain the user to themselves.');
  });
});

describe('communication — reflection remains available when purposeful', () => {
  it('preserves all five legitimate uses of reflection', () => {
    const idx = master.indexOf('**Reflection is still a tool');
    expect(idx).toBeGreaterThan(-1);
    const block = master.slice(idx, idx + 600);
    expect(block).toContain('clarifies ambiguity');
    expect(block).toContain('surfaces a contradiction the user may not have noticed');
    expect(block).toContain('checks understanding after a substantial stretch');
    expect(block).toContain('marks an emotionally significant phrase');
    expect(block).toContain('delivers the formal share-back');
  });

  it('states the goal is variation and restraint, not coldness', () => {
    expect(master).toContain('The goal is variation and restraint, not coldness');
  });

  it('keeps the share-back as the explicit exception to move-announcing', () => {
    expect(master).toContain(
      'The one deliberate exception is the formal share-back of the working picture',
    );
  });
});

describe('communication — contrast examples present', () => {
  it('carries all three owner-specified contrast pairs', () => {
    expect(master).toContain('"What drained you most?"');
    expect(master).toContain('"How long has it been like that?"');
    expect(master).toContain(
      '"Statistic. Is that genuinely how it feels, or simply the easiest way to carry it?"',
    );
  });
});
