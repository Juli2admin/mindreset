// PR θ regression guard for the master prompt cleanup (2026-07-10).
//
// The prior state of docs/journey/runtime/journey-master.md was documented in
// the root-cause audit as internally contradictory:
//   1. All 10 worked examples omitted `moveJustPerformed` (teaching the model
//      to skip it — the router's most-load-bearing field)
//   2. `clinicalRead` marked REQUIRED but absent from the Block 1 "before
//      emitting" checklist
//   3. Sensitivity Layer fields never appeared in a "MUST emit" step
//   4. L767 "Nothing else" undercut every earlier "required" declaration
//
// These tests lock in the cleanup so a future edit can't silently regress
// any of these fixes.

import { describe, expect, it } from 'vitest';
import { loadMasterJourneyPrompt } from './load-spec';

const master = loadMasterJourneyPrompt() ?? '';

describe('master prompt — file loads', () => {
  it('loads a non-empty string', () => {
    expect(typeof master).toBe('string');
    expect(master.length).toBeGreaterThan(1000);
  });
});

describe('master prompt — every worked example emits moveJustPerformed', () => {
  // The 10 worked examples in <examples> are the model's strongest few-shot
  // signal. Before cleanup, all 10 omitted moveJustPerformed — teaching the
  // model that the field was optional and probably not worth the tokens.
  // Now every example emits it. A regression here would silently unteach
  // that lesson.

  it('extracts all state-report JSON blocks from <examples>', () => {
    const examplesStart = master.indexOf('<examples>');
    const examplesEnd = master.indexOf('</examples>');
    expect(examplesStart).toBeGreaterThan(-1);
    expect(examplesEnd).toBeGreaterThan(examplesStart);
  });

  it('every state-report inside <examples> includes moveJustPerformed', () => {
    const examplesStart = master.indexOf('<examples>');
    const examplesEnd = master.indexOf('</examples>');
    const block = master.slice(examplesStart, examplesEnd);
    // Match every <state-report>{...}</state-report> pair in the examples
    // block. Split on the closing tag and take the first half of each
    // — cheap regex-free extraction.
    const openings = block.split('<state-report>').slice(1);
    const jsonBlocks = openings
      .map((chunk) => chunk.split('</state-report>')[0].trim())
      .filter((s) => s.length > 0);
    expect(jsonBlocks.length).toBeGreaterThanOrEqual(9); // 10 examples,
    // one (5b) is intentionally free of state-report per its own note.
    for (const raw of jsonBlocks) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(
          `Example state-report failed to parse as JSON:\n${raw.slice(0, 200)}`,
        );
      }
      expect(
        Array.isArray(parsed.moveJustPerformed),
        `worked-example state-report missing moveJustPerformed:\n${raw.slice(0, 200)}`,
      ).toBe(true);
      expect((parsed.moveJustPerformed as unknown[]).length).toBeGreaterThan(0);
    }
  });
});

describe('master prompt — Block 1 checklist includes the required-every-turn tier', () => {
  it('has a "before emitting the state report" checklist section', () => {
    expect(master).toContain('Before emitting the state report each turn, check');
  });

  it('checklist step 1 is Channel and marks it REQUIRED', () => {
    // Prior version placed Channel at step 5 and used softer "do not
    // leave null" phrasing. Cleanup promoted it to step 1 with an
    // explicit "REQUIRED every turn." marker.
    const idx = master.indexOf('1. **Channel.**');
    expect(idx).toBeGreaterThan(-1);
    // The REQUIRED marker should appear near the Channel step.
    const stepSlice = master.slice(idx, idx + 500);
    expect(stepSlice).toContain('REQUIRED every turn');
  });

  it('checklist step 2 is Clinical read and marks it REQUIRED', () => {
    // Prior version omitted clinicalRead from the checklist entirely,
    // despite marking it REQUIRED-on-substantive-turn in the schema block.
    // Cleanup adds it as step 2.
    const idx = master.indexOf('2. **Clinical read.**');
    expect(idx).toBeGreaterThan(-1);
    const stepSlice = master.slice(idx, idx + 500);
    expect(stepSlice).toContain('REQUIRED every turn');
    expect(stepSlice).toContain('clinicalRead');
  });

  it('checklist step 3 is Moves performed and marks it REQUIRED', () => {
    // Prior version marked moveJustPerformed REQUIRED-on-substantive-turn
    // in one place but the checklist never mentioned it. Cleanup adds it
    // as step 3 with an explicit REQUIRED marker.
    const idx = master.indexOf('3. **Moves performed.**');
    expect(idx).toBeGreaterThan(-1);
    const stepSlice = master.slice(idx, idx + 500);
    expect(stepSlice).toContain('REQUIRED every turn');
    expect(stepSlice).toContain('moveJustPerformed');
    // The step must show the model how to emit on a pure-witness turn.
    expect(stepSlice).toContain('universal.witness_and_reflect');
  });

  it('checklist has a Sensitivity layer step naming the six fields', () => {
    // Prior version described the Sensitivity Layer at length in a
    // separate section but the "before emitting" checklist never
    // referenced any of its fields — so the model treated them as
    // detached from the emission ritual. Cleanup adds a step that names
    // therapeuticMode / cycleStatus / cycleCanClose / modalityRejected /
    // channelShiftDetected / nextBestMode.
    const idx = master.indexOf('**Sensitivity layer.**');
    expect(idx).toBeGreaterThan(-1);
    const stepSlice = master.slice(idx, idx + 800);
    expect(stepSlice).toContain('therapeuticMode');
    expect(stepSlice).toContain('cycleStatus');
    expect(stepSlice).toContain('cycleCanClose');
    expect(stepSlice).toContain('modalityRejected');
    expect(stepSlice).toContain('channelShiftDetected');
    expect(stepSlice).toContain('nextBestMode');
  });

  it('checklist tail names channel / clinicalRead / moveJustPerformed as the every-turn trio', () => {
    // Explicit closing paragraph reinforces which fields are the
    // absolute must-emit set for the router.
    expect(master).toContain(
      '`channel`, `clinicalRead`, and `moveJustPerformed` are the three EVERY-TURN fields',
    );
  });
});

describe('master prompt — no undermining language', () => {
  it('does NOT contain "Nothing else." (undercut every earlier required declaration)', () => {
    // The audit flagged L767 "Your reply is the FIRST thing you write; the
    // state report is the LAST. Nothing else." — the terminal "Nothing
    // else." reads as a closure that permits skipping optional fields.
    // Cleanup removes the "Nothing else" phrasing.
    expect(master).not.toContain('Nothing else.');
  });

  it('replaces the undercut with an affirmative "state report is REQUIRED every turn" note', () => {
    expect(master).toContain('state report is REQUIRED every turn');
  });
});
