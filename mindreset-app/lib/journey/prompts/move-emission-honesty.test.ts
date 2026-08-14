// PR 12 (2026-08-14) — remove move-emission progression pressure.
//
// THE DEFECT. `moveJustPerformed` is honesty-critical telemetry: the model's
// own record of what it clinically did this turn. Four instructions in the
// master prompt told it that emitting the field is how the user advances —
// "leaving it null costs the user real progression", "AND advance the user
// through stages", "The router uses this to advance the user through
// stages", "the router is starved of the signal it needs to advance the
// user".
//
// That is an incentive to over-report. The move lane counts `stage_N.*` IDs
// and ignores `universal.*`, so a model that believes emission drives
// progress has a standing reason to reach for a stage-scoped move where a
// universal one is what actually happened — and three such turns advance a
// stage on self-report alone.
//
// WHAT THIS PR IS NOT. Not move-lane retirement. `move-based-advance.ts` is
// byte-untouched and the lane still runs exactly as before. The claims the
// prompt made were *true* — that is the point. A true statement that turns
// a record into a lever is still a bad instruction to give.
//
// WHAT SURVIVES, asserted below alongside each removal:
//   * the field itself, its canonical vocabulary, its parser contract
//   * honest recording — "what did you actually perform this turn"
//   * a no-move turn representable without inventing anything
//     (`universal.none`, which the parser documents as the schema's own
//     "no clinical move" signal, and which the lane never counts)
//   * `universal.session_close`, read by the closure close-guard — the
//     non-advancement consumer that makes deleting the field impossible

import { describe, expect, it } from 'vitest';
import { loadMasterJourneyPrompt, loadSpec } from './load-spec';
import { CANONICAL_MOVES, CANONICAL_MOVES_SET } from '../stateReport/schema';
import { parseMoveJustPerformed } from '../stateReport/parse';
import { claimsVisibleClose } from '../closure/close-guard';
import { STATE_REPORT_REMINDER } from './emission-reminder';
import type { StateReport } from '../stateReport/schema';

const master = loadMasterJourneyPrompt() ?? '';

/** Every prompt source actually loaded into the runtime context. */
const RUNTIME_SOURCES: string[] = [
  master,
  loadSpec('00-shared-core.md'),
  loadSpec('MIDDLE_LAYER.md'),
  loadSpec('PRACTICE_GENERATION_ALGORITHM.md'),
  loadSpec('01-stage-stabilisation.md'),
  loadSpec('02-stage-pain.md'),
  loadSpec('03-stage-adult-self.md'),
  loadSpec('04-stage-parts.md'),
  loadSpec('05-stage-foreign-material.md'),
  loadSpec('06-stage-integration.md'),
  loadSpec('07-stage-new-identity.md'),
  loadSpec('08-stage-embodiment.md'),
];

const allRuntimeLines = (): string[] =>
  RUNTIME_SOURCES.flatMap((s) => s.split('\n'));

// ---------------------------------------------------------------------------
// 1-3. The four retracted claims
// ---------------------------------------------------------------------------

describe('the four progression-pressure claims are gone', () => {
  it('site 1: null does not "cost the user real progression"', () => {
    for (const src of RUNTIME_SOURCES) {
      expect(src).not.toContain('costs the user real progression');
      expect(src).not.toContain('The stage-advancement router reads this');
    }
  });

  it('site 2: the field is not described as existing to advance the user', () => {
    for (const src of RUNTIME_SOURCES) {
      expect(src).not.toContain('AND advance the user through stages');
      expect(src).not.toContain('the router reads this field to detect qualifying turns');
    }
  });

  it('site 3: "The router uses this to advance the user through stages" is gone', () => {
    for (const src of RUNTIME_SOURCES) {
      expect(src).not.toContain('The router uses this to advance the user through stages');
    }
  });

  it('site 4: the router is not described as "starved" without it', () => {
    for (const src of RUNTIME_SOURCES) {
      expect(src).not.toContain('starved of the signal');
      expect(src).not.toContain('the router relies on');
    }
  });
});

// ---------------------------------------------------------------------------
// 4. No equivalent wording anywhere — semantic scan
// ---------------------------------------------------------------------------

describe('no surviving incentive to emit a move for progression', () => {
  // A line is exempt only if it carries one of these markers — phrases
  // that can occur only in a sentence DENYING the incentive. Exemption is
  // earned by the text saying the denial, not by listing paragraphs. Each
  // marker is asserted to occur exactly once, so an exemption cannot
  // outlive the sentence it was written for.
  const DENIAL_MARKERS = [
    'never a lever',
    'because it might read as progress',
    "nothing about the user's progress turns on which move you name",
    'not the one that would look best',
  ];

  it('every denial marker occurs exactly once', () => {
    for (const m of DENIAL_MARKERS) {
      expect(master.split(m).length - 1).toBe(1);
    }
  });

  const scannableLines = (): string[] =>
    allRuntimeLines().filter((l) => !DENIAL_MARKERS.some((m) => l.includes(m)));

  // The acceptance question, mechanised: does any single line both talk
  // about the move field AND present emitting it as helping the user get
  // somewhere? Scanned across every runtime-loaded source, not just the
  // four edited sites.
  it('no runtime line ties move emission to advancement or progress', () => {
    const offenders = scannableLines().filter(
      (l) =>
        /moveJustPerformed|canonical (clinical-)?move|move ID/i.test(l) &&
        /(advance|advancement|progress|progression|qualifying turn|starv|costs? the user|router (reads|relies|needs|uses))/i.test(l),
    );
    expect(offenders).toEqual([]);
  });

  it('no runtime line frames a null move as a loss to the user', () => {
    const offenders = scannableLines().filter(
      (l) =>
        /\bnull\b|universal\.none/i.test(l) &&
        /(costs?|loses?|denies?|holds? (them|the user) back|slows? (them|the user)|prevents? (them|the user))/i.test(l),
    );
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. Honest recording survives
// ---------------------------------------------------------------------------

describe('truthful-recording framing survives at all four sites', () => {
  it('site 1 says the field is a record, never a lever', () => {
    expect(master).toContain(
      'This field is a record of what you did, never a lever: do not add, infer or upgrade a move to influence routing.',
    );
  });

  it('site 2 keeps "Name what you actually did this turn"', () => {
    expect(master).toContain('Name what you actually did this turn');
    expect(master).toMatch(
      /never a deeper or later-stage one because it might read as progress/,
    );
  });

  it('site 3 keeps "which .* did you actually perform this turn"', () => {
    expect(master).toContain(
      'Which of the canonical clinical moves did you actually perform this turn',
    );
    expect(master).toContain('Report the move that happened, not the one that would look best.');
    // Primary-first ordering is unchanged.
    expect(master).toContain('Set `moveJustPerformed` to 1–3 IDs, primary first.');
  });

  it('site 4 keeps per-turn accountability without the router rationale', () => {
    expect(master).toContain(
      '`channel`, `clinicalRead`, and `moveJustPerformed` are the three fields to account for on every turn',
    );
    expect(master).toMatch(/nothing about the user's progress turns on which move you name/);
  });
});

// ---------------------------------------------------------------------------
// 6. A no-move turn is representable without fabrication
// ---------------------------------------------------------------------------

describe('a turn with no canonical move needs no invention', () => {
  it('the prompt says universal.none is the correct and complete answer', () => {
    expect(master).toContain(
      '`["universal.none"]` is the correct and complete answer',
    );
    expect(master).toContain(
      'that is the honest answer, not a gap, and it costs the user nothing',
    );
  });

  it('"REQUIRED every turn" no longer reads as "find a move every turn"', () => {
    const idx = master.indexOf('3. **Moves performed.**');
    const step = master.slice(idx, idx + 600);
    expect(step).toContain('**Account for this field every turn** — which does not mean finding a move every turn');
  });

  it('the parser treats universal.none as a real answer, not a dropped field', () => {
    // The schema contract this instruction rests on, exercised directly.
    expect(parseMoveJustPerformed(['universal.none'])).toEqual(['universal.none']);
    // And the field is optional: omitting it entirely is also valid.
    expect(parseMoveJustPerformed(undefined)).toBeUndefined();
    expect(parseMoveJustPerformed([])).toBeUndefined();
  });

  it('universal.none never earns advancement credit', () => {
    // Which is why recommending it costs the user nothing, as the prompt
    // now says: the lane counts only `stage_N.*`.
    expect(CANONICAL_MOVES_SET.has('universal.none')).toBe(true);
    expect('universal.none'.startsWith('stage_')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7-9. Vocabulary, parser and closure untouched
// ---------------------------------------------------------------------------

describe('vocabulary, parser and closure are untouched', () => {
  it('the canonical move vocabulary is intact', () => {
    expect(CANONICAL_MOVES.length).toBe(44);
    for (const id of CANONICAL_MOVES) {
      expect(master).toContain(id);
    }
  });

  it('parser normalisation is unchanged', () => {
    // A real move drops `none`; unknown IDs are dropped; order preserved.
    expect(parseMoveJustPerformed(['universal.none', 'stage_3.observer_seat'])).toEqual([
      'stage_3.observer_seat',
    ]);
    expect(parseMoveJustPerformed(['not_a_move'])).toBeUndefined();
    expect(
      parseMoveJustPerformed(['universal.witness_and_reflect', 'stage_2.soft_why_inquiry']),
    ).toEqual(['universal.witness_and_reflect', 'stage_2.soft_why_inquiry']);
  });

  it('universal.session_close survives and the close-guard still reads it', () => {
    expect(CANONICAL_MOVES_SET.has('universal.session_close')).toBe(true);
    expect(master).toContain('universal.session_close');
    const closing = { intensity: 4, safetyFlag: 'none', recommendedAction: 'stay',
      moveJustPerformed: ['universal.session_close'] } as unknown as StateReport;
    const notClosing = { intensity: 4, safetyFlag: 'none', recommendedAction: 'stay',
      moveJustPerformed: ['universal.witness_and_reflect'] } as unknown as StateReport;
    expect(claimsVisibleClose(closing)).toBe(true);
    expect(claimsVisibleClose(notClosing)).toBe(false);
  });

  it('the emission reminder still lists the field, with no progression claim', () => {
    // emission-reminder.ts is code-resident prompt text. Its "REQUIRED
    // every turn" attaches to emitting the state-report BLOCK, and the
    // field list is parenthetical — interpretation A, so PR 12 leaves it
    // alone. Asserted so a future edit cannot quietly make it B.
    expect(STATE_REPORT_REMINDER).toContain('moveJustPerformed');
    expect(STATE_REPORT_REMINDER).toContain('emit the full <state-report> JSON block');
    expect(STATE_REPORT_REMINDER).not.toMatch(/advance|progress|router/i);
  });
});
