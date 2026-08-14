// Middle Layer PR 11 (2026-08-14) — Block loses depth authority.
//
// THE DEFECT. The runtime prompt carried TWO depth-permission systems.
// MIDDLE_LAYER.md derives `licensedRung` from persisted evidence; the master
// prompt separately forbade parts work, foreign-material release,
// integration, narrative rewriting and deep landscape work "in Block 1",
// lifting all five on one share-back. The audit found the two disagreed in
// BOTH directions on ten of sixteen kinds of work — Block was more
// restrictive than the rung for target-serving work (behaviour rehearsal,
// live tracking, body-signal work, non-causal parts contact) and LESS
// restrictive for causal work (every Rung-3 category opened on one
// confirmation, with no mechanism requirement anywhere).
//
// Block also had no representation: the two DB columns named for it
// (`currentBlock`, `blockProgress`) are read by no code and are marked
// legacy in the schema, so the model re-derived the phase from the
// transcript each turn, with no reset rule for rupture, regression or a new
// topic, and a share-back about one issue silently licensing depth on
// another.
//
// AND THE TERM WAS AMBIGUOUS. All eight stage specs define Block N ≡ Stage N
// from the clinical manual ("Block 2 — Identification & Acknowledgment of
// Pain" = Stage 2). The master prompt used the same word for an assessment
// phase closed by share-back. Both readings were loaded together.
//
// WHAT PR 11 DOES. Removes Block's depth authority only. The phase keeps its
// name (renamed to avoid the collision), its gather-list, its pacing, and
// its anti-rushing discipline. The stage specs are untouched.
//
// THE TWO INVARIANTS THIS FILE EXISTS TO HOLD, in both directions:
//
//   1. ONE depth authority — `licensedRung`. Not phase, not share-back, not
//      stage, not technique name, not session count.
//   2. This is NOT permission to go deeper sooner. Every counterweight the
//      Block prohibition was carrying must still be carried by something.
//
// Tests below are paired: each subtraction is asserted gone AND its
// counterweight asserted present. A bare absence assertion proves nothing
// here — the failure mode of over-subtracting is a Clinician that goes deep
// too early, which no absence test can catch.

import { describe, expect, it } from 'vitest';
import { loadMasterJourneyPrompt, loadSpec } from './load-spec';

const master = loadMasterJourneyPrompt() ?? '';

function section(startMarker: string, endMarker: string): string {
  const start = master.indexOf(startMarker);
  expect(start).toBeGreaterThan(-1);
  const end = master.indexOf(endMarker, start);
  expect(end).toBeGreaterThan(start);
  return master.slice(start, end);
}

const methodHeader = (): string => section('<method>', '**1. Anchor identification');
const assessmentPhase = (): string => section('<assessment_phase>', '</assessment_phase>');
const practicesEarly = (): string =>
  section('PRACTICES EARLY ON.', 'THE SHARE-BACK.');
const shareBack = (): string => section('THE SHARE-BACK.', '</assessment_phase>');
const emissionFocus = (): string =>
  section('**EARLY-PHASE STATE-REPORT FOCUS.**', '**Before emitting the state report');

// ---------------------------------------------------------------------------
// The two invariants, stated in the prompt itself
// ---------------------------------------------------------------------------

describe('invariant 1 — one depth authority', () => {
  it('names licensedRung as the single authority and denies the alternatives by name', () => {
    const p = assessmentPhase();
    expect(p).toContain('**There is one depth authority: the licensed rung in the state block.**');
    // Each competing candidate the audit found, denied explicitly.
    expect(p).toMatch(/Not the phase you think you are in/);
    expect(p).toMatch(/not whether a share-back has happened/);
    expect(p).toMatch(/not the router's stage label/);
    expect(p).toMatch(/not the name of a technique/);
    expect(p).toMatch(/not how many sessions have passed/);
    expect(p).toMatch(/None of those is a second permission system/);
  });

  it('states that the phase has no formal end and grants nothing', () => {
    const p = assessmentPhase();
    expect(p).toContain('**This phase has no formal end and grants nothing.**');
    expect(p).toMatch(/not a state you are in or a gate you close/);
    expect(p).toMatch(/Target Sufficiency \(§3a\) opens target-level work/);
    expect(p).toMatch(/Mechanism Sufficiency \(§3b\) opens deep causal work/);
  });

  it('keeps investigation running at every rung', () => {
    expect(assessmentPhase()).toMatch(
      /investigation continues at every rung — it never stops being part of the work/,
    );
  });
});

describe('invariant 2 — not permission to go deeper sooner', () => {
  it('says so explicitly, with the counterweights enumerated in place', () => {
    const p = assessmentPhase();
    expect(p).toContain('**And the reverse, which matters just as much: none of this is permission to go deeper sooner.**');
    expect(p).toMatch(/go wide before you go deep/i);
    expect(p).toMatch(/gather the whole picture/i);
    expect(p).toMatch(/build rapport and orientation first/i);
    expect(p).toMatch(/take the least deep action the evidence supports/i);
    expect(p).toMatch(/never choose a method because the material resembles its cues/i);
    expect(p).toMatch(/stop questioning when no further question can discriminate/i);
  });

  it('the pre-existing counterweight paragraphs survive verbatim', () => {
    const p = assessmentPhase();
    expect(p).toContain('GO WIDE BEFORE YOU GO DEEP — but assessment is bounded, not open-ended');
    expect(p).toContain('**Let the user show you the whole map before you go deep.**');
    expect(p).toContain('**Match the depth and certainty of your action to the quality of the evidence.**');
    expect(p).toContain('take the **least deep action the evidence supports**');
    expect(p).toContain(
      'Do not continue assessment merely to obtain certainty the next decision does not need',
    );
  });

  it('the gather-list and its descriptive session pacing survive', () => {
    const p = assessmentPhase();
    expect(p).toContain('What you gather in the wide-assessment phase, across 2–4 sessions:');
    for (const dimension of [
      '**Resources and strengths**',
      '**The personal anchor**',
    ]) {
      expect(p).toContain(dimension);
    }
  });

  it('the anti-jumping discipline survives', () => {
    expect(master).toContain(
      'Jumping: early on, the temptation is to commit to a formulation the moment something interesting surfaces',
    );
    expect(master).toContain("Don't. This phase is wide assessment.");
    expect(master).toContain('Holding formulations lightly across multiple sessions');
  });

  it('session count is never permission-bearing', () => {
    // Ruling 2: "2–4 sessions" is descriptive. No line may make an action
    // conditional on a session count.
    const offenders = master.split('\n').filter(
      (l) =>
        /\d\s*[-–]\s*\d\s*sessions|session count/i.test(l) &&
        /(only|until|before you may|not until|requires|must wait)/i.test(l),
    );
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// A1 — moves are not classified by rung
// ---------------------------------------------------------------------------

describe('A1 — depth follows what the use assumes, not the move name', () => {
  it('the old "guided by which Block the user is in" gate is gone', () => {
    expect(master).not.toContain('guided by which Block the user is in');
    expect(master).not.toContain(
      'are held until the relevant picture has been gathered AND checked with the user',
    );
  });

  it('refuses to create a move → rung taxonomy', () => {
    const h = methodHeader();
    expect(h).toContain('**No move is "a Rung-2 move" or "a Rung-3 move."**');
    expect(h).toMatch(/the test is not which technique is used but \*\*what your use of it assumes\*\*/);
    expect(h).toMatch(/The same move can be either/);
    expect(h).toMatch(/does this proceed without asserting why the pattern runs\?/);
  });

  it('points depth at the licensed rung, and keeps Rung 1 open unconditionally', () => {
    const h = methodHeader();
    expect(h).toContain('**how deep you take it is governed by the licensed rung in the state block**');
    expect(h).toMatch(/are open at every rung and need nothing/);
  });

  it('keeps both counterweights that lived in this paragraph', () => {
    const h = methodHeader();
    expect(h).toContain(
      'Being able to name a possible next move is not the same as understanding enough to go deep',
    );
    expect(h).toMatch(/resembles\* its cues, rather than because its reading won the differential, is a method error/);
  });
});

// ---------------------------------------------------------------------------
// A2 / A3 — the allowlist and the prohibition list
// ---------------------------------------------------------------------------

describe('A2 — the closed practice allowlist is gone', () => {
  it('"PRACTICES IN BLOCK 1 — limited to" no longer exists', () => {
    expect(master).not.toContain('PRACTICES IN BLOCK 1');
    expect(master).not.toContain('limited to:');
  });

  it('the two early practices survive as description, explicitly not a closed list', () => {
    const p = practicesEarly();
    expect(p).toContain('- Light regulation / grounding when distress climbs');
    expect(p).toContain('- Light self-compassion when self-attack is active');
    expect(p).toMatch(/\*\*not a closed list\*\*/);
  });

  it('pairs the opening with the anti-stall rule in both directions', () => {
    const p = practicesEarly();
    expect(p).toMatch(/act as soon as it is selectable \(§6\)/);
    expect(p).toMatch(/waiting is the failure, not the caution/);
    expect(p).toMatch(/Do not reach past the rung you have; do not sit below it either/);
  });

  it('the anchor-is-not-a-practice rule survives verbatim', () => {
    expect(practicesEarly()).toContain(
      '(Anchor identification is NOT a practice — it is silent observation, never a `practiceRun`; see move §1 and Shared Core §6.)',
    );
  });
});

describe('A3 — the categorical prohibition becomes an evidence condition', () => {
  it('"Do NOT offer in Block 1" is gone', () => {
    expect(master).not.toContain('Do NOT offer in Block 1');
  });

  it('parts splits by what the work assumes (owner ruling 1)', () => {
    const p = practicesEarly();
    expect(p).toMatch(/\*\*Meeting a part\.\*\*/);
    expect(p).toMatch(/without claiming the part explains it needs the Target \(§3a\)/);
    expect(p).toMatch(/as the reason the pattern runs\* is a causal claim and needs Mechanism Sufficiency \(§3b\)/);
  });

  it('each remaining category names the evidence its depth rests on', () => {
    const p = practicesEarly();
    expect(p).toMatch(/\*\*Foreign material release\*\*[\s\S]{0,220}§3b/);
    expect(p).toMatch(/\*\*Integration work\*\* and \*\*narrative rewriting of core beliefs\*\*[\s\S]{0,200}same test/);
    expect(p).toMatch(/\*\*Deep imagery organised around a cause\*\*/);
    expect(p).toMatch(/what your use of it assumes\*\*, never the name of the technique/);
  });

  it('naming stays always-available and recognition still never licenses intervention', () => {
    const p = practicesEarly();
    expect(p).toMatch(/naming is recognition, always available/);
    expect(p).toMatch(/treat it as the explanation before it has won its differential/);
    expect(p).toContain('Recognition never licenses intervention (§0).');
  });
});

// ---------------------------------------------------------------------------
// A5 / A6 — share-back
// ---------------------------------------------------------------------------

describe('A5 / A6 — share-back is clinical, not permission machinery', () => {
  it('the milestone no longer closes anything', () => {
    expect(master).not.toContain('closes Block 1');
    expect(master).not.toContain('THE SHARE-BACK MILESTONE');
    expect(shareBack()).toContain('THE SHARE-BACK. When the picture feels comprehensive');
  });

  it('keeps the descriptive pacing inside the share-back paragraph', () => {
    expect(shareBack()).toContain('roughly 2–4 sessions in, with the major dimensions filled');
  });

  it('the Block 2+ permission framing of trap #11 is gone', () => {
    expect(master).not.toContain('deeper Block 2+ work rests on your interpretation alone');
    expect(master).not.toContain('Block 2+');
  });

  it('trap #11 survives, narrowed to causal work and to the §3b standard', () => {
    const s = shareBack();
    expect(s).toContain('**Do not build causal work on a formulation that has not earned it.**');
    expect(s).toMatch(/must rest on a mechanism reading that has met the §3b standard/);
    expect(s).toMatch(/beat its differential and survived the user's correction/);
    expect(s).toMatch(/trap #11 takes hold/);
  });

  it('explicitly does NOT hold target-level work behind a causal confirmation', () => {
    // Owner correction 2: the old verbatim sentence implied Rung-2 work
    // waited for a confirmed causal formulation. This is the reconciliation.
    const s = shareBack();
    expect(s).toContain('This is not a bar on target-level work.');
    expect(s).toMatch(/does \*\*not\*\* wait for a confirmed causal formulation/);
    expect(s).toMatch(/does not wait for the user to agree with one/);
    expect(s).toMatch(/Rung 2 opens on Target Sufficiency \(§3a\) alone/);
  });

  it('collaborative seeking survives, as practice not permission', () => {
    const s = shareBack();
    expect(s).toContain("Seek the user's agreement in whatever form is clinically appropriate");
    expect(s).toMatch(/a full share-back, or a lighter check of a specific observation or pattern/);
    expect(s).toMatch(/collaborative practice and good clinical work, not a permission step/);
  });

  it('partial agreement, correction and narrowing are evidence, not failure', () => {
    const s = shareBack();
    expect(s).toMatch(/partial agreement, correction or narrowing is evidence you have gained, never a milestone you have failed/);
    expect(s).toContain('`recognitionConfirmed` / `recognitionContradicted`');
    expect(s).toMatch(/work from their version/);
  });

  it('everything PR 9 and PR 10 established in this section survives', () => {
    const s = shareBack();
    expect(s).toMatch(/\*\*optional and clinically determined\*\*/);
    expect(s).toContain('The user confirms, corrects, or adds. You revise accordingly.');
    expect(s).toMatch(/record the clinical event; they do not constitute it/);
    expect(s).toContain('**Their agreement is not a progression signal.**');
    expect(s).toContain('`readinessTouched: ["formulation_confirmed"]`');
    expect(s).toMatch(/not the same as promoting a causal formulation/);
  });
});

// ---------------------------------------------------------------------------
// A7 / A8 — foreign material, in both places
// ---------------------------------------------------------------------------

describe('A7 / A8 — identification always available, release needs §3b', () => {
  it('"Block 2+ only" is gone from both sites', () => {
    expect(master).not.toContain('(Block 2+ only)');
    expect(master).not.toContain('foreign-material identification move (Block 2+)');
  });

  it('the practice route rule carries the rung condition and keeps the discipline', () => {
    const rule = master.slice(
      master.indexOf('5. **Old voice / foreign sentence activates**'),
      master.indexOf('\n6. **Signature image emerges**'),
    );
    expect(rule).toMatch(/Identification is recognition and is always available/);
    expect(rule).toMatch(/Ritual release is deep causal work and needs Mechanism Sufficiency \(§3b\)/);
    expect(rule).toMatch(/do NOT release ritually before that mechanism has won its differential/);
  });

  it('the quick move table agrees with the route rule', () => {
    expect(master).toContain(
      '- **Old voice activates** → foreign-material identification (always available — naming is recognition; ritual release needs §3b).',
    );
  });
});

// ---------------------------------------------------------------------------
// C — the emission-suppression repair
// ---------------------------------------------------------------------------

describe('C — the null-the-fields instruction is gone', () => {
  it('"IGNORE entirely / remain null until then" no longer exists', () => {
    expect(master).not.toContain('IGNORE entirely');
    expect(master).not.toContain('should remain null until then');
    expect(master).not.toContain('the Block 1 → Block 2 gate cannot close');
  });

  it('replaced with record-what-happened, and says why it matters', () => {
    const f = emissionFocus();
    expect(f).toContain('**Record what actually occurred. Never null one of these for something that did happen.**');
    expect(f).toMatch(/That is a consequence of what has happened, not an instruction/);
    expect(f).toMatch(/Most of these are read by a stage gate/);
    expect(f).toMatch(/`adultSelfPresent` is read by the router besides/);
    expect(f).toMatch(/starves the code of an observation the user actually earned/);
  });

  it('every previously-suppressed field is still listed, none dropped', () => {
    const f = emissionFocus();
    for (const field of [
      'partSecured', 'partsTouched', 'foreignFilesTouched', 'foreignFileReleased',
      'identityAnchor', 'cleanIdentityStatement', 'whatStaysAsMine', 'symbolicIdentityMap',
      'compassionBridgeQuality', 'cohesionAwareness', 'emergingQualities', 'innerDirection',
      'urgencyMarkers', 'feltAligned', 'feltOld', 'calRunOn', 'calLayer',
      'userReportedRedirection', 'adultSelfThisWeek', 'observerSeatTouched',
      'adultSelfPresent', 'adultSelfQualities',
    ]) {
      expect(f).toContain(`\`${field}\``);
    }
  });

  it('recording is not licensing — PR 7 prime / 8 prime are named as still binding', () => {
    const f = emissionFocus();
    expect(f).toMatch(/Emitting one is a record, never a licence/);
    expect(f).toMatch(/refused advancement credit and refused persistence/);
    expect(f).toMatch(/stays visible in the report exactly as you wrote it/);
  });

  it('the gate-required tokens instruction still fires', () => {
    expect(master).toContain(
      'the gate-required tokens must fire when they apply, or the code cannot see work the user has actually done',
    );
    expect(master).toContain('**GATE-REQUIRED tokens**');
  });
});

// ---------------------------------------------------------------------------
// B — disambiguation
// ---------------------------------------------------------------------------

describe('B — "Block" no longer names a phase in the master prompt', () => {
  it('no phase use of Block survives', () => {
    for (const phrase of [
      'Block 1 is the assessment phase',
      'in Block 1',
      'In Block 1',
      'Block 1 IGNORE',
      'Block 1 required every turn',
      'Block 1 set when applicable',
      'Block 1 GATE-REQUIRED',
      'Block 1 SIGNAL',
      'BLOCK 1 STATE-REPORT FOCUS',
      'Block 1 gate tokens',
      'Block 1 anchors',
      'Block 2+',
    ]) {
      expect(master).not.toContain(phrase);
    }
  });

  it('every surviving "Block N" in the master prompt is the canonical stage sense', () => {
    const hits = master.match(/Block \d+/g) ?? [];
    // Only the Stage 3 cross-references in the anchor section remain, and
    // both disambiguate themselves inline.
    expect(new Set(hits)).toEqual(new Set(['Block 3']));
    expect(master).toContain('In Block 3 (Adult Self), the anchor becomes explicit resource material');
  });

  it('the phase is renamed, not deleted', () => {
    expect(master).toContain('The early assessment phase.');
    expect(master).toContain('the wide-assessment phase');
    expect(master).toContain('**EARLY-PHASE STATE-REPORT FOCUS.**');
    expect(master).toContain('<assessment_phase>');
    expect(master).toContain('</assessment_phase>');
  });
});

describe('the canonical stage-spec Block terminology is byte-untouched', () => {
  // Ruling 5: Block N ≡ Stage N is clinical-manual canon and stays.
  const CANON: Array<[string, string]> = [
    ['01-stage-stabilisation.md', '"STOP / Grounding & Immediate Stabilisation"'],
    ['02-stage-pain.md', '"Block 2 — Identification & Acknowledgment of Pain"'],
    ['03-stage-adult-self.md', '"Block 3 — Contact with the Inner Self (Adult Self Activation)"'],
    ['04-stage-parts.md', '"Block 4 — Meeting the Inner Parts & Child Self"'],
    ['05-stage-foreign-material.md', '"Block 5 — Breaking with the External / Removing Foreign Beliefs, Roles, and Internalised Others"'],
    ['06-stage-integration.md', '"Block 6 — Integration & Identity Consolidation"'],
    ['07-stage-new-identity.md', '"Block 7 — Creation of the New Identity Map"'],
    ['08-stage-embodiment.md', '"Block 8 — Stabilisation & Embodiment of the New Identity"'],
  ];

  for (const [file, reference] of CANON) {
    it(`${file} keeps its clinical-reference header`, () => {
      expect(loadSpec(file)).toContain(`> **Clinical reference** (manual): ${reference}.`);
    });
  }
});

// ---------------------------------------------------------------------------
// Reintroduction scans
// ---------------------------------------------------------------------------

describe('reintroduction scans', () => {
  // Lines that mention a coupling in order to DENY it. Exempted from the
  // scans by exact identity — never by a loose "contains 'not'" rule, which
  // would gut them. Each is asserted to still exist below, so an exemption
  // cannot quietly outlive the sentence it was written for.
  const DENIALS = [
    "**There is one depth authority: the licensed rung in the state block.** Not the phase you think you are in, not whether a share-back has happened, not the router's stage label, not the name of a technique, not how many sessions have passed. None of those is a second permission system, and none of them grants or withholds depth on its own.",
  ];

  it('every exempted denial sentence is still present', () => {
    for (const d of DENIALS) expect(master).toContain(d);
  });

  const lines = master.split('\n').filter((l) => !DENIALS.includes(l));

  it('no line couples a phase/Block term to a permission verb', () => {
    const offenders = lines.filter(
      (l) =>
        /\bBlock \d|early assessment phase|wide-assessment phase|assessment phase\b/i.test(l) &&
        /(may not|must not|do not offer|forbidden|not permitted|unlocks?|permits?|licen[cs]es?|allowed only|only after|waits for|until then)/i.test(l),
    );
    expect(offenders).toEqual([]);
  });

  it('no line ties share-back or agreement to depth, a rung, or a stage', () => {
    const offenders = lines.filter(
      (l) =>
        /share-?back|user (confirms?|agrees?)|their agreement|agreed the picture/i.test(l) &&
        /(unlocks?|licen[cs]es?|opens? Rung|grants?|permits?|advance the stage|next stage|Rung [23] (is )?(now )?open)/i.test(l),
    );
    expect(offenders).toEqual([]);
  });

  it('no line makes a technique name by itself carry a rung', () => {
    // e.g. "parts work is Rung 3" — forbidden by owner ruling 1.
    const offenders = lines.filter((l) =>
      /(parts work|foreign[- ]material release|imagery|integration work|narrative rewriting)\s+(is|are)\s+(a\s+)?Rung\s*[123]\b/i.test(l),
    );
    expect(offenders).toEqual([]);
  });

  it('no second permission state was invented', () => {
    for (const invented of [
      'assessment complete',
      'assessment_complete',
      'phase_complete',
      'blockTransition',
      'block_closed',
      'assessment phase closed',
    ]) {
      expect(master.toLowerCase()).not.toContain(invented.toLowerCase());
    }
  });
});
