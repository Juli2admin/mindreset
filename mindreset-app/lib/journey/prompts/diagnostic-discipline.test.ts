// Regression guard for the diagnostic-discipline repair (2026-07-27, owner-approved).
//
// The #356 reconciliation loosened the Block-1 assessment gate from the old
// "hold deep moves until the picture is built and confirmed with the user" to
// "act once the next appropriate action can be selected". A forensic regression
// investigation confirmed that this — not the runtime/background/inspector,
// which are unchanged since the good era — was the behaviour-relevant change.
// This repair restores the gather-before-depth gate and differential thinking
// while preserving the current restraint/flexibility improvements.
//
// These are PROMPT-CONTENT guards: they assert the restored rules are present
// so a future edit can't silently remove them. They are NOT live behavioural
// tests — the owner's Test A–E behavioural cases (fresh intake, one metaphor,
// user correction, low-risk issue, genuine convergence) require the live
// golden harness (eval/journey) with ANTHROPIC_API_KEY set, which this
// environment does not have. The mapping to A–E is noted per block.

import { describe, expect, it } from 'vitest';
import { loadMasterJourneyPrompt } from './load-spec';

const master = loadMasterJourneyPrompt() ?? '';

describe('diagnostic discipline — gather-before-depth gate is restored and operational', () => {
  it('the method intro holds the deeper moves until the picture is gathered AND checked', () => {
    expect(master).toContain(
      'deeper moves (3–8 — causal/root work, parts work, foreign-material release, identity-level, deep somatic-symbolic and imagery work) are held until the relevant picture has been gathered AND checked with the user',
    );
  });

  it('assessment_phase restores "let the user show you the whole map before you go deep"', () => {
    expect(master).toContain('Let the user show you the whole map before you go deep.');
    // early possible root is held silently, not committed to or organised around
    expect(master).toContain('hold it **silently** as one provisional possibility among others');
    expect(master).toContain('never on the strength of one statement, image, metaphor or felt sense');
  });

  it('preserves the anti-interrogation guard (not a questionnaire) alongside the restored gate', () => {
    expect(master).toContain('never an interrogation or a questionnaire');
  });
});

describe('diagnostic discipline — depth is proportionate to evidence (available move ≠ enough understanding)', () => {
  it('replaces unqualified "act once selectable" with depth-proportionality', () => {
    expect(master).toContain('Match the depth and certainty of your action to the quality of the evidence.');
    expect(master).toContain('take the **least deep action the evidence supports**');
  });

  it('encodes the owner\'s exact principle verbatim', () => {
    expect(master).toContain(
      'an available next move and enough understanding to go deep are not the same thing',
    );
  });

  it('a deep/high-certainty intervention is gated on a gathered AND checked picture', () => {
    expect(master).toContain(
      'must NOT begin until the relevant history, chronology, dynamics and present situation have been gathered AND the emerging picture has been checked with the user',
    );
  });

  it('the old unqualified trigger is gone', () => {
    expect(master).not.toContain('**Once you can select the next appropriate action, act.**');
  });
});

describe('diagnostic discipline — differential thinking restored', () => {
  it('holds a small internal differential while the picture is incomplete', () => {
    expect(master).toContain(
      'hold two or more possible explanations open as a small internal differential',
    );
    expect(master).toContain('early possibilities must remain possibilities, not become the organising truth');
  });

  it('a primary formulation requires being better-supported than alternatives AND surviving contradiction', () => {
    expect(master).toContain(
      'clearly better supported than the realistic alternatives',
    );
    expect(master).toContain('survived at least one opportunity for the user to correct or contradict it');
  });

  it('the continuity-note working formulation reflects the differential', () => {
    // Reworded by PR 9 (2026-08-14). The original assertion pinned the exact
    // phrase "the small differential of possible explanations you are holding
    // open (none promoted yet)", whose trailing clause let a formulation be
    // promoted in prose on two of §1's four conditions. The differential
    // requirement this test exists to guard is unchanged — only the sentence
    // carrying it moved. The four-condition standard itself is asserted in
    // pressure-field-cleanup.test.ts.
    expect(master).toContain(
      'the differential of realistic explanations you are currently holding open, with what supports and what weighs against each',
    );
  });
});

describe('diagnostic discipline — the user\'s explicit request governs (Test C proxy)', () => {
  it('on correction/redirect, drop the interpretation and return to gathering', () => {
    expect(master).toContain("**The user's explicit request governs.**");
    expect(master).toContain('return to listening and gathering, and drop the interpretation you were pursuing');
  });

  it('a rejected interpretation must not survive indirectly through the same metaphor/route', () => {
    expect(master).toContain(
      'must NOT stay alive indirectly through the same metaphor, image, body sensation, practice, or investigative route',
    );
  });
});

describe('diagnostic discipline — analysis stays clinician-side (no open diagnosis)', () => {
  it('the check with the user is of the recognisable picture, not an announced root/diagnosis', () => {
    expect(master).toContain('your internal formulation stays internal');
    expect(master).toContain('not announcing an interpretation, a diagnosis, or a "root"');
  });

  it('the share-back example no longer announces an underlying root Y to the user', () => {
    expect(master).not.toContain('What I think is underneath — and tell me if this is wrong — is Y');
  });
});

describe('diagnostic discipline — early examples model gather-first, not turn-1 depth (Tests A & B proxy)', () => {
  // Example 1 (fresh, minimal info) and Example 3 (one pattern statement) must
  // no longer demonstrate a turn-1 stage_2 depth move.
  it('Example 1 gathers (assessment_gather), not stage_2 depth', () => {
    const ex1 = master.slice(master.indexOf('EXAMPLE 1'), master.indexOf('EXAMPLE 2'));
    expect(ex1).toContain('stage_1.assessment_gather');
    expect(ex1).not.toContain('stage_2.affect_labelling_and_somatic_mapping');
    expect(ex1).toContain('Gathering, not depth');
  });

  it('Example 3 gathers onset + a concrete instance instead of a turn-1 parts/causal reframe', () => {
    const ex3 = master.slice(master.indexOf('EXAMPLE 3'), master.indexOf('EXAMPLE 4'));
    expect(ex3).toContain('stage_1.assessment_gather');
    expect(ex3).not.toContain('stage_2.soft_why_inquiry');
    expect(ex3).toContain('when did you first notice this pattern');
  });

  it('Example 4 holds the read as a provisional possibility, not a formulation, from one disclosure', () => {
    const ex4 = master.slice(master.indexOf('EXAMPLE 4'), master.indexOf('EXAMPLE 5'));
    expect(ex4).toContain('Provisional possibility, held silently among others');
    expect(ex4).not.toContain('Formulation: hypervigilance');
  });
});
