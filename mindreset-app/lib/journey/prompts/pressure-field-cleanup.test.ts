// Middle Layer PR 9 (2026-08-14) — pressure-field cleanup regression guard.
//
// Three fields in the master prompt pushed the Clinician toward a settled
// answer faster than the evidence could license one. PR 9 narrows their
// wording. Nothing about advancement changes — see the final describe block,
// which is the guard that keeps it that way.
//
//   1. `continuityNote` carried a ONE-GATE promotion rule ("clearly better
//      supported ... and has survived the user's correction"). Two of §1's
//      four conditions, written as if they were all of them — so a
//      formulation could be promoted in prose on half the standard.
//
//   2. `clinicalRead` was specified as "recording the current formulation
//      status" every substantive turn. A field that asks for a status every
//      turn teaches that having one is the normal state, and that not having
//      one is an omission to be fixed.
//
//   3. The share-back instructions claimed emitting three fields is "what
//      makes the confirmed share-back real to the system" and that the
//      share-back "is not 'done'" without them. That is false: the clinical
//      event is the user recognising the picture as theirs. Telling a model
//      its emission constitutes the event invites emitting it to produce one.
//
// EXPLICITLY NOT CHANGED, and asserted below: `recommendedAction: "advance"`
// at both instruction sites. That coupling is live — `standardGuards` reads
// it for every classic gate — and it belongs to PR 10, not here.
//
// The prompt-wording assertions are deliberately about SEMANTICS, not exact
// sentences. They check the load-bearing clause is present and the retracted
// claim is absent, so the wording can still be improved without a red test.

import { describe, expect, it } from 'vitest';
import { loadMasterJourneyPrompt } from './load-spec';

const master = loadMasterJourneyPrompt() ?? '';

/** The `<memory>` section's continuity-note specification. */
function continuityNoteSpec(): string {
  const start = master.indexOf('Continuity note — your running case formulation');
  expect(start).toBeGreaterThan(-1);
  const end = master.indexOf('3. **Recent conversation.**', start);
  expect(end).toBeGreaterThan(start);
  return master.slice(start, end);
}

/** The state-report schema entry for `clinicalRead`. */
function clinicalReadSpec(): string {
  const start = master.indexOf('- `clinicalRead` — a concise internal update');
  expect(start).toBeGreaterThan(-1);
  const end = master.indexOf('- `moveJustPerformed`', start);
  expect(end).toBeGreaterThan(start);
  return master.slice(start, end);
}

/** The `<assessment_phase>` share-back milestone block. */
function shareBackSection(): string {
  const start = master.indexOf('THE SHARE-BACK MILESTONE');
  expect(start).toBeGreaterThan(-1);
  const end = master.indexOf('</assessment_phase>', start);
  expect(end).toBeGreaterThan(start);
  return master.slice(start, end);
}

describe('master prompt loads', () => {
  it('is a non-empty string', () => {
    expect(typeof master).toBe('string');
    expect(master.length).toBeGreaterThan(1000);
  });
});

// ---------------------------------------------------------------------------
// 1. continuityNote
// ---------------------------------------------------------------------------

describe('continuityNote — promotion requires the full §1 standard', () => {
  it('the old one-gate promotion wording is gone', () => {
    // The retracted rule: better-supported + survived correction, and that
    // was the whole gate. Conditions 3 (independent corroboration) and 4
    // (U/E/C provenance) were simply absent.
    expect(master).not.toContain(
      'once one is clearly better supported than the alternatives and has survived the user',
    );
    expect(continuityNoteSpec()).not.toContain('none promoted yet);');
  });

  it('references the Middle Layer §1 standard by name', () => {
    expect(continuityNoteSpec()).toContain('Middle Layer §1 standard');
  });

  it('names all four promotion conditions', () => {
    const spec = continuityNoteSpec();
    expect(spec).toContain('all four');
    // (1) better supported than each realistic alternative
    expect(spec).toMatch(/better supported than each realistic alternative/i);
    // (2) survived a genuine opportunity to correct
    expect(spec).toMatch(/survived at least one genuine opportunity/i);
    // (3) independent corroboration
    expect(spec).toMatch(/independently corroborated/i);
    // (4) U/E/C provenance, C never load-bearing
    expect(spec).toContain('(U)');
    expect(spec).toContain('(E)');
    expect(spec).toContain('(C)');
    expect(spec).toMatch(/load-bearing/i);
  });

  it('states that short of all four it is a differential, not a formulation', () => {
    expect(continuityNoteSpec()).toMatch(
      /Short of all four.*differential, not a formulation/i,
    );
  });

  it('prior notes are context, not findings', () => {
    const spec = continuityNoteSpec();
    expect(spec).toContain('Prior notes are context, not findings');
    expect(spec).toMatch(/never evidence that the thing is true now/i);
  });

  it('contradiction updates or demotes the formulation', () => {
    const spec = continuityNoteSpec();
    expect(spec).toContain('Contradiction updates or demotes');
    expect(spec).toMatch(/move the reading back down the ladder/i);
    // The pre-existing "never wipe history" rule must not be readable as
    // "never demote" — the new text has to reconcile the two explicitly.
    expect(spec).toContain('Never wipe history; refine it.');
    expect(spec).toMatch(/keep the record of what was believed, not keep believing it/i);
  });

  it('is not a second source of truth beside code-owned Middle Layer state', () => {
    const spec = continuityNoteSpec();
    expect(spec).toContain('not a second source of truth');
    expect(spec).toMatch(/Nothing you write here grants permission/i);
    expect(spec).toMatch(/does not raise your rung/i);
  });
});

describe('continuityNote — caution is paired with action (§6/§7)', () => {
  // The counterfactual risk of this PR: written as pure subtraction, a
  // narrower promotion bar reads as "keep investigating", which is the
  // stuck-era failure. Every caution here has to carry its own stop rule.

  it('says to act as soon as the next action is selectable (§6)', () => {
    const spec = continuityNoteSpec();
    expect(spec).toMatch(/act as soon as the next clinically appropriate action is selectable/i);
    expect(spec).toContain('(§6)');
    expect(spec).toMatch(/least deep action the evidence supports/i);
  });

  it('forbids investigating for certainty the current decision does not need (§7)', () => {
    const spec = continuityNoteSpec();
    expect(spec).toMatch(/certainty the current decision does not need/i);
    expect(spec).toContain('(§7)');
  });

  it('records not-knowing-why as a complete position', () => {
    expect(continuityNoteSpec()).toMatch(
      /don't yet know why this happens, and we don't need to know yet to work on it/i,
    );
  });

  it('keeps the field, its shape, and its emission instruction', () => {
    // PR 9 narrows semantics only. The field itself, its section list, and
    // the separate emission entry in the state-report schema all survive.
    const spec = continuityNoteSpec();
    expect(spec).toContain('`continuityNote` field');
    for (const section of [
      '**Presenting issues**',
      '**Working formulation**',
      '**Resources identified**',
      '**Worked so far**',
      '**Queued**',
      '**Stuck points**',
      '**Notes for next session**',
    ]) {
      expect(spec).toContain(section);
    }
    expect(master).toContain(
      '- `continuityNote` — your running case formulation across sessions.',
    );
  });
});

// ---------------------------------------------------------------------------
// 2. clinicalRead
// ---------------------------------------------------------------------------

describe('clinicalRead — records the differential, not a settled status', () => {
  it('no longer requires "the current formulation status"', () => {
    expect(master).not.toContain(
      'recording the current formulation status and the most clinically relevant change this turn',
    );
    expect(master).not.toContain(
      'the current formulation status and the most clinically relevant change this turn; not a new hypothesis',
    );
  });

  it('asks for differential / change / evidence / next decision', () => {
    const spec = clinicalReadSpec();
    expect(spec).toMatch(/current state of the differential/i);
    expect(spec).toMatch(/what changed this turn/i);
    expect(spec).toMatch(/supports or weakens the leading possibilities/i);
    expect(spec).toMatch(/what decision or evidence is needed next/i);
  });

  it('admits "no formulation leads yet" as complete and valid', () => {
    expect(clinicalReadSpec()).toContain(
      '"no formulation leads yet" is a complete and valid `clinicalRead`',
    );
  });

  it('says explicitly that a settled formulation status is not required', () => {
    expect(clinicalReadSpec()).toMatch(/does \*\*not\*\* require a settled formulation status/i);
  });

  it('is not a promotion channel — promotion stays under §1 and its own fields', () => {
    const spec = clinicalReadSpec();
    expect(spec).toMatch(/not a place to promote/i);
    expect(spec).toContain('Middle Layer §1 standard');
    expect(spec).toContain('`taskContract.target`');
    expect(spec).toContain('`mechanismDifferential`');
  });

  it('must not create pressure to keep assessing (§7)', () => {
    const spec = clinicalReadSpec();
    expect(spec).toMatch(/must not create pressure to keep assessing/i);
    expect(spec).toMatch(/if enough is known for the next clinically appropriate action/i);
    expect(spec).toContain('(§7)');
  });

  it('the Block 1 checklist entry matches the narrowed semantics', () => {
    // Both places that specify what goes in the field have to agree, or the
    // checklist quietly reinstates the status requirement.
    const checklist = master.slice(master.indexOf('2. **Clinical read.**'));
    const entry = checklist.slice(0, checklist.indexOf('\n3. '));
    expect(entry).toMatch(/where the differential stands/i);
    expect(entry).toMatch(/no formulation leads yet" is a complete answer/i);
    expect(entry).toContain('**REQUIRED every turn.**');
  });

  it('keeps the field required every turn and internal-only', () => {
    expect(clinicalReadSpec()).toContain('never surfaced');
    expect(master).toContain(
      '`channel`, `clinicalRead`, and `moveJustPerformed` are the three EVERY-TURN fields',
    );
  });
});

// ---------------------------------------------------------------------------
// 3. share-back / formulation_confirmed
// ---------------------------------------------------------------------------

describe('share-back — emissions record the event, they do not constitute it', () => {
  it('the false "real to the system" claim is gone', () => {
    expect(master).not.toContain('real to the system');
    expect(master).not.toContain(
      'Emitting all three is what makes the confirmed share-back',
    );
  });

  it('the false "share-back is not done unless emitted" claim is gone', () => {
    expect(master).not.toContain('The share-back is not "done" if these aren\'t emitted');
    expect(master).not.toContain('not "done"');
  });

  it('"you MUST emit ALL THREE" is now a recording instruction', () => {
    expect(master).not.toContain('you MUST emit ALL THREE');
    expect(shareBackSection()).toContain(
      '— record what happened, in the same turn, in the state report:',
    );
  });

  it('states that the fields record the clinical event rather than making it', () => {
    const section = shareBackSection();
    expect(section).toMatch(/record the clinical event; they do not constitute it/i);
    expect(section).toMatch(/user recognised the picture as theirs and said so/i);
    expect(section).toMatch(/never manufactures an agreement that did not happen/i);
  });

  it('genuine collaborative share-back language remains', () => {
    const section = shareBackSection();
    // The user's four possible responses, and the clinician's openness.
    expect(section).toContain('The user confirms, corrects, or adds. You revise accordingly.');
    expect(section).toMatch(/open to correction/i);
    expect(section).toMatch(/Does this match how you see yourself\? Anything I'm missing or have wrong\?/);
    // Sharing stays clinically determined, never obligatory.
    expect(section).toMatch(/\*\*optional and clinically determined\*\*/);
  });

  it('the rule against deep work on an unconfirmed formulation remains', () => {
    expect(shareBackSection()).toContain(
      'do not build deep work on an unconfirmed formulation',
    );
  });

  it('confirmation of the picture is distinguished from promoting a formulation', () => {
    expect(shareBackSection()).toMatch(
      /not the same as promoting a causal formulation.*Middle Layer §1 standard in full/i,
    );
  });

  it('formulation_confirmed survives as telemetry, vocabulary and gloss', () => {
    // Preserved deliberately. PR 9 corrects what the emission MEANS, not
    // whether it exists — removing the token is a separate change.
    expect(shareBackSection()).toContain(
      '1. `readinessTouched: ["formulation_confirmed"]` (add to any existing tokens)',
    );
    expect(shareBackSection()).toMatch(/`formulation_confirmed` is telemetry/i);
    // vocabulary list
    expect(master).toContain('"foreign_file_released", "formulation_confirmed".');
    // gloss
    expect(master).toContain(
      '`"formulation_confirmed"` — user has explicitly agreed the shared-back picture is theirs',
    );
  });
});

// ---------------------------------------------------------------------------
// The PR 10 boundary — advancement is untouched
// ---------------------------------------------------------------------------

describe('advancement coupling is byte-identical (belongs to PR 10)', () => {
  // `standardGuards` requires `report.recommendedAction === expectedAction`
  // for every classic gate, Stages 1–7. If PR 9 had softened either
  // instruction site, users would stop advancing. Both are asserted
  // verbatim, as full lines.

  it('the share-back triple still instructs recommendedAction: "advance"', () => {
    expect(master).toContain('\n2. `recommendedAction: "advance"`\n');
  });

  it('the Block 1 checklist still couples confirmation to advance', () => {
    expect(master).toContain(
      '10. **Share-back.** Did the user confirm my shared-back formulation ("yes that\'s me", "yeah that\'s accurate", "yes whole picture", "yes, true")? → Add `"formulation_confirmed"` to `readinessTouched` AND set `recommendedAction: "advance"`.',
    );
  });

  it('the recommendedAction schema entry is unchanged', () => {
    expect(master).toContain(
      '- `recommendedAction` — "stay" | "advance" | "regress_to_grounding" | "regress_to_parts" | "red_flag" | "discharge". Default "stay". Code makes the final call; this is advisory.',
    );
  });

  it('moveJustPerformed advancement framing is unchanged', () => {
    expect(master).toContain(
      'The stage-advancement router reads this; leaving it null costs the user real progression.',
    );
  });

  it('therapeuticMode is untouched and recommendedDepth is absent', () => {
    expect(master).toContain('therapeuticMode');
    expect(master).not.toContain('recommendedDepth');
  });
});
