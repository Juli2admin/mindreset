// Middle Layer PR 10 (2026-08-14) — the prompt half of the advancement
// authority repair.
//
// Three instructions coupled a confirmed share-back to
// `recommendedAction: "advance"`, which the classic gates then read as a
// hard AND-term. The code half is removed in stage-gates.ts (proved
// behaviourally in router/advancement-authority.test.ts); these three
// instructions go with it.
//
// The point of this file is NOT that the strings are gone. It is that the
// CLINICAL protocol survived the removal intact — share-back is still
// offered, still collaborative, still open to correction, and a partial or
// qualified agreement is still information rather than a failed milestone.
// Every one of those is asserted below alongside the removals.

import { describe, expect, it } from 'vitest';
import { loadMasterJourneyPrompt } from './load-spec';

const master = loadMasterJourneyPrompt() ?? '';

function shareBackSection(): string {
  const start = master.indexOf('THE SHARE-BACK MILESTONE');
  expect(start).toBeGreaterThan(-1);
  const end = master.indexOf('</assessment_phase>', start);
  expect(end).toBeGreaterThan(start);
  return master.slice(start, end);
}

/** The Block 1 pre-emission checklist, items 1..12. */
function checklist(): string {
  const start = master.indexOf('**Before emitting the state report each turn, record the following.**');
  expect(start).toBeGreaterThan(-1);
  const end = master.indexOf('Emitting these structured fields when they apply is required', start);
  expect(end).toBeGreaterThan(start);
  return master.slice(start, end);
}

// ---------------------------------------------------------------------------
// The three couplings are gone
// ---------------------------------------------------------------------------

describe('the share-back → advance coupling is removed', () => {
  it('the same-turn recording bundle no longer lists recommendedAction', () => {
    const section = shareBackSection();
    expect(section).not.toContain('`recommendedAction: "advance"`');
    // The bundle is now two items, not three, and both survivors are named.
    expect(section).toContain(
      '1. `readinessTouched: ["formulation_confirmed"]` (add to any existing tokens)',
    );
    expect(section).toContain(
      '2. A revised `continuityNote` reflecting the confirmed picture',
    );
    expect(section).not.toContain('\n3. A revised `continuityNote`');
  });

  it('the Block 1 field spec no longer says to emit advance after the milestone', () => {
    expect(master).not.toContain(
      'set "advance" ONLY when the share-back milestone has fired',
    );
    expect(master).not.toContain('share-back milestone has fired');
  });

  it('checklist item 10 no longer sets recommendedAction', () => {
    const list = checklist();
    const item10 = list.slice(list.indexOf('10. **Share-back.**'), list.indexOf('\n11. '));
    expect(item10).not.toContain('recommendedAction');
    expect(item10).toContain('`"formulation_confirmed"` to `readinessTouched`');
  });

  it('no instruction anywhere ties a user confirmation to advance', () => {
    // Belt-and-braces against a reworded reintroduction: no line may
    // mention both a confirmation and the advance token.
    const offenders = master
      .split('\n')
      .filter(
        (l) =>
          /`?recommendedAction`?\s*[:=]?\s*"?advance/i.test(l) &&
          /confirm|agree|share-back|shared-back/i.test(l),
      );
    expect(offenders).toEqual([]);
  });

  it('states positively that agreement is not a progression signal', () => {
    const section = shareBackSection();
    expect(section).toContain('**Their agreement is not a progression signal.**');
    expect(section).toMatch(/there is no field to emit that would/i);
    expect(section).toMatch(
      /Stage advancement is decided by code from the clinical criteria it can verify/i,
    );
  });

  it('recommendedAction is described as not a progression request', () => {
    expect(master).toContain(
      '- `recommendedAction` — usually "stay". Not a progression request:',
    );
    // The clinically live values keep their instructions.
    expect(master).toMatch(/regress_to_grounding` \/ `regress_to_parts` when stepping back/);
    expect(master).toMatch(/`red_flag` per Shared Core §7/);
  });
});

// ---------------------------------------------------------------------------
// The clinical protocol survives
// ---------------------------------------------------------------------------

describe('share-back is not made less available', () => {
  it('the decision whether to share at all is unchanged', () => {
    const section = shareBackSection();
    expect(section).toMatch(/\*\*optional and clinically determined\*\*/);
    expect(section).toContain('never done to avoid a rupture');
  });

  it('the six sharing conditions survive in both places', () => {
    expect(master).toContain(
      'You may share part of it only when: it is supported by repeated or converging evidence;',
    );
    expect(shareBackSection()).toContain(
      "Share it only when the conditions for sharing a formulation are met (converging evidence; it serves the user's present task; they have enough context; it will not overwhelm, shame, narrow, or prematurely define them; alternatives considered; you are open to correction)",
    );
  });

  it('the milestone, the worked example, and the invitation to correct survive', () => {
    const section = shareBackSection();
    expect(section).toContain('THE SHARE-BACK MILESTONE');
    expect(section).toMatch(/Does this match how you see yourself\? Anything I'm missing or have wrong\?/);
    expect(section).toContain('The user confirms, corrects, or adds. You revise accordingly.');
  });

  it('the recording-vs-clinical-event distinction from PR 9 survives', () => {
    const section = shareBackSection();
    expect(section).toMatch(/record the clinical event; they do not constitute it/i);
    expect(section).toMatch(/never manufactures an agreement that did not happen/i);
  });

  it('formulation_confirmed survives as telemetry, with vocabulary and gloss', () => {
    expect(shareBackSection()).toContain('`readinessTouched: ["formulation_confirmed"]`');
    expect(master).toContain('"foreign_file_released", "formulation_confirmed".');
    expect(master).toContain(
      '`"formulation_confirmed"` — user has explicitly agreed the shared-back picture is theirs',
    );
  });

  it('the revised continuityNote survives', () => {
    expect(shareBackSection()).toContain(
      'A revised `continuityNote` reflecting the confirmed picture',
    );
    expect(master).toContain(
      '- `continuityNote` — your running case formulation across sessions.',
    );
  });

  it('the rule against deep work on an unconfirmed formulation survives', () => {
    expect(shareBackSection()).toContain(
      'do not build deep work on an unconfirmed formulation',
    );
  });

  it("PR 9's four-condition promotion standard survives in both sites", () => {
    for (const anchor of [
      '- **The case formulation (one primary, evolving).**',
      '- **Working formulation** —',
    ]) {
      const i = master.indexOf(anchor);
      expect(i).toBeGreaterThan(-1);
      const chunk = master.slice(i, i + 1400);
      expect(chunk).toContain('Middle Layer §1 standard in full');
      expect(chunk).toContain('all four');
    }
  });

  it('agreement with the factual picture is still distinguished from a promoted cause', () => {
    expect(shareBackSection()).toMatch(
      /not the same as promoting a causal formulation.*Middle Layer §1 standard in full/i,
    );
  });
});

describe('partial or qualified agreement is not defined as failure', () => {
  // The documented 2026-06-26 failure: users stuck because realistic
  // confirmation is "nearly / maybe / partly", not a clean explicit yes.
  // Checklist item 10 previously enumerated four clean-yes phrasings and
  // nothing else. It now names the partial case explicitly and routes it
  // to the evidence emission that already exists for it.

  it('checklist item 10 accepts agreement in whatever form it arrives', () => {
    const list = checklist();
    const item10 = list.slice(list.indexOf('10. **Share-back.**'), list.indexOf('\n11. '));
    expect(item10).toMatch(/in whatever form they gave it/i);
    expect(item10).toMatch(/agreed in part, corrected it, or narrowed it/i);
    expect(item10).toMatch(/that is information, not a failed milestone/i);
    expect(item10).toContain('recognitionContradicted');
  });

  it('recognitionContradicted still covers rejection, correction AND narrowing', () => {
    expect(master).toContain(
      '`recognitionContradicted` — `{recognition}`. On a LATER turn: they rejected it, corrected it, or narrowed it.',
    );
    expect(master).toMatch(/It is not a failure — a correction is information/);
  });

  it('the recognition and mechanism evidence exchanges are intact', () => {
    for (const field of [
      'recognitionOffered',
      'recognitionConfirmed',
      'recognitionContradicted',
      'mechanismOffered',
      'mechanismConfirmed',
      'mechanismContradicted',
    ]) {
      expect(master).toContain(`\`${field}\``);
    }
  });

  it('no partial_confirmation token was invented', () => {
    // Explicitly out of scope for PR 10 — the schema is unchanged.
    expect(master).not.toContain('partial_confirmation');
    expect(master).not.toContain('partially_confirmed');
  });
});

describe('Block 1 / Block 2+ is deliberately untouched', () => {
  // Owner ruling: licensedRung is the future authority for depth
  // permission, but the Block system is NOT repaired in PR 10. These
  // assertions exist so that a later PR has to change them on purpose.
  it('the Block 1 depth prohibitions are still present', () => {
    expect(master).toContain('Do NOT offer in Block 1:');
    expect(master).toContain('- Foreign material release (formal ritualised release with returned-to)');
    expect(master).toContain('That waits for Block 2+.');
  });

  it('the assessment_phase tags are still present', () => {
    expect(master).toContain('<assessment_phase>');
    expect(master).toContain('</assessment_phase>');
  });
});
