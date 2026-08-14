// Middle Layer PR 7′ (2026-08-14) — the Rung-3 advancement-signal guard.
//
// The audit that preceded this PR found that a Rung-3 emission reaches
// advancement by TWO independent routes: the archived state report (read
// back by history.ts and handed to the stage gates) and persisted DB facts
// like `releasedAt`. Refusing one would not close the other, which is why
// this guard sits at the gates rather than at persistence — persistence is
// PR 8′'s job and is deliberately untouched here.
//
// Two things are under test and the second matters as much as the first:
//
//   1. Category-A Rung-3 signals earn ZERO advancement credit below the
//      persisted licensed rung, on BOTH lanes and from BOTH sources.
//   2. Nothing else changed. The report is preserved verbatim, the DB fact
//      is preserved, user-response evidence still counts, demotion still
//      works, aftercare still fires, and Rung-2 moves advance as before.

import { describe, expect, it } from 'vitest';
import {
  checkStage5Gate,
  checkStage6Gate,
  checkStage7Gate,
} from './stage-gates';
import { checkMoveBasedAdvance, getStageFromTurnMoves } from './move-based-advance';
import {
  RUNG_3_MOVE_IDS,
  RUNG3_REFUSED,
  rung3SignalsLicensed,
} from '../middleLayer/rung3-advancement';
import { normaliseMiddleLayerState } from '../middleLayer/sufficiency';
import { CANONICAL_MOVES_SET } from '../stateReport/schema';
import { CLOSURE_PROCESS_NONE } from '../closure/process';
import type { JourneyState, JourneyForeignFile, JourneyPart } from '../state/types';
import type { AuditTurn } from './history';
import type { StateReport, CanonicalMove } from '../stateReport/schema';

const RUNG_1 = normaliseMiddleLayerState({});
const RUNG_2 = normaliseMiddleLayerState({
  targetStatus: 'established',
  mechanismStatus: 'leading',
});
const RUNG_3 = normaliseMiddleLayerState({
  targetStatus: 'established',
  mechanismStatus: 'established',
});

function makeFile(overrides: Partial<JourneyForeignFile> = {}): JourneyForeignFile {
  return {
    id: 'file_1',
    userDescription: 'the "must be useful" voice',
    originDescription: 'my mother',
    returnedTo: "my mother's house",
    honouringPhrase: 'I see what this was',
    whatStaysAsMine: 'I love making things',
    identifiedAt: new Date('2026-06-15'),
    releaseClaimedAt: new Date('2026-06-19'),
    releasedAt: new Date('2026-06-20'),
    ...overrides,
  };
}

function makePart(): JourneyPart {
  return {
    id: 'part_1',
    userDescription: 'the ten-year-old with two braids',
    channel: 'visual',
    safeDistance: 'across the room',
    createdAt: new Date('2026-06-10'),
    updatedAt: new Date('2026-06-25'),
  } as unknown as JourneyPart;
}

function makeState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    userId: 'user_pr7', currentStage: 5, currentDepth: 'surface',
    startedAt: new Date('2026-06-01'), lastActivityAt: new Date('2026-06-27'),
    dischargedAt: null, anchorText: 'the trees outside my window',
    anchorSetAt: new Date('2026-06-02'), identityAnchor: 'someone who makes things',
    identityAnchorSetAt: new Date('2026-06-25'), processingChannel: 'visual',
    adultSelfQualities: 'the calm older me', lastIntensity: 4,
    lastIntensityAt: new Date('2026-06-27'), lastDeepLayerContactAt: null, mii: {},
    stage8WeeksElapsed: 0, frozenForReview: false, frozenAt: null, frozenReason: null,
    continuityNote: null, parts: [makePart()], foreignFiles: [makeFile()],
    signatureImages: [], patterns: [], sessionCount: 8, daysEngaged: 14,
    thisSessionMessageCount: 5, stageJustAdvanced: false, hoursSinceLastTurn: null,
    isSessionResume: false, hasOpenCycle: false, openCycleDescription: null,
    sessionRejectedModalities: [], recentChannelShift: false, taskContract: null,
    onboardingAnswers: null, closureProcess: CLOSURE_PROCESS_NONE,
    middleLayer: RUNG_3, workingMemory: null, ...overrides,
  };
}

function makeTurn(daysAgo: number, report: Partial<StateReport> = {}): AuditTurn {
  const d = new Date('2026-06-27');
  d.setDate(d.getDate() - daysAgo);
  const full: StateReport = {
    intensity: 4, safetyFlag: 'none', recommendedAction: 'stay',
    adultSelfPresent: true, ...report,
  };
  return {
    id: `t_${daysAgo}`, createdAt: d, stageAtTurn: 5, depthAtTurn: 'surface',
    intensityReported: full.intensity, safetyFlag: full.safetyFlag,
    recommendedAction: full.recommendedAction ?? 'stay', report: full,
  };
}

// ===========================================================================
// 0. The allowlist itself
// ===========================================================================

describe('the Category-A allowlist', () => {
  it('is exactly the four owner-approved IDs', () => {
    expect(Array.from(RUNG_3_MOVE_IDS).sort()).toEqual([
      'stage_5.clean_identity_statement',
      'stage_5.symbolic_return',
      'stage_6.identity_anchoring_ritual',
      'stage_7.symbolic_identity_map',
    ]);
  });

  it('every ID is a real canonical move — no typos, no invented IDs', () => {
    for (const id of Array.from(RUNG_3_MOVE_IDS)) expect(CANONICAL_MOVES_SET.has(id)).toBe(true);
  });

  it('does NOT gate by stage prefix — Rung-2 siblings are excluded', () => {
    for (const sibling of [
      'stage_5.origin_voice_mapping',   // identification, not release
      'stage_4.first_contact',          // meeting a part
      'stage_4.compassion_bridge',
      'stage_6.internal_consensus_check',
      'stage_7.qualities_inventory',
      'universal.practice_landscape',   // generic imagery
    ]) {
      expect(RUNG_3_MOVE_IDS.has(sibling)).toBe(false);
    }
  });

  it('persisted rung is the sole licensing input', () => {
    expect(rung3SignalsLicensed(makeState({ middleLayer: RUNG_1 }))).toBe(false);
    expect(rung3SignalsLicensed(makeState({ middleLayer: RUNG_2 }))).toBe(false);
    expect(rung3SignalsLicensed(makeState({ middleLayer: RUNG_3 }))).toBe(true);
  });
});

// ===========================================================================
// 1. Move lane
// ===========================================================================

describe('move lane — Rung-3 moves earn no credit below rung 3', () => {
  const window = (move: CanonicalMove) =>
    [4, 3, 2, 1].map((d) => makeTurn(d, { moveJustPerformed: [move] }));

  // A stage-N move advances a user AT stage N-1, since targetStage is
  // currentStage + 1 and the move must reach it.
  for (const [id, from] of [
    ['stage_5.symbolic_return', 4],
    ['stage_6.identity_anchoring_ritual', 5],
    ['stage_7.symbolic_identity_map', 6],
  ] as const) {
    it(`${id}: advances at rung 3`, () => {
      expect(checkMoveBasedAdvance(from, window(id), true).canAdvance).toBe(true);
    });
    it(`${id}: does NOT advance at rung 1`, () => {
      expect(checkMoveBasedAdvance(from, window(id), false).canAdvance).toBe(false);
    });
    it(`${id}: does NOT advance at rung 2 either`, () => {
      // Rung 2 yields the same `false` — the guard is >= 3, not "not rung 1".
      expect(checkMoveBasedAdvance(from, window(id), false).canAdvance).toBe(false);
    });
  }

  it('a Rung-3 move is skipped for stage extraction, not the whole turn', () => {
    const turn = makeTurn(1, {
      moveJustPerformed: ['stage_5.symbolic_return', 'stage_4.first_contact'],
    });
    // Licensed: the higher (Rung-3) move wins → stage 5.
    expect(getStageFromTurnMoves(turn, true)).toBe(5);
    // Unlicensed: the Rung-3 move is skipped, the legitimate Rung-2 move
    // still counts → stage 4. The turn is NOT discarded.
    expect(getStageFromTurnMoves(turn, false)).toBe(4);
  });

  it('REGRESSION: Rung-2 moves advance identically at every rung', () => {
    // stage_6.internal_consensus_check is NOT on the allowlist, so it must
    // keep advancing a stage-5 user regardless of licensed rung.
    const w = [4, 3, 2, 1].map((d) =>
      makeTurn(d, { moveJustPerformed: ['stage_6.internal_consensus_check'] }),
    );
    expect(checkMoveBasedAdvance(5, w, true).canAdvance).toBe(true);
    expect(checkMoveBasedAdvance(5, w, false).canAdvance).toBe(true);
  });

  it('defaults to licensed, so non-Rung-3 behaviour is unchanged for old callers', () => {
    const w = [4, 3, 2, 1].map((d) =>
      makeTurn(d, { moveJustPerformed: ['stage_6.internal_consensus_check'] }),
    );
    expect(checkMoveBasedAdvance(5, w).canAdvance).toBe(checkMoveBasedAdvance(5, w, true).canAdvance);
  });
});

// ===========================================================================
// 2. Classic gates — both sources
// ===========================================================================

function stage5Turns(extra: Partial<StateReport> = {}): AuditTurn[] {
  return [
    makeTurn(7, { somaticRelease: true }),
    makeTurn(5, {
      cleanIdentityStatement: 'I am someone who makes things because she loves to.',
      bodyConfirmation: 'lighter in my chest, room to breathe',
    }),
    makeTurn(3, {}), makeTurn(2, {}),
    makeTurn(1, { recommendedAction: 'advance', ...extra }),
  ];
}

describe('classic gates — Category-A signals', () => {
  it('STAGE 5: passes at rung 3', () => {
    expect(checkStage5Gate(makeState({ middleLayer: RUNG_3 }), stage5Turns()).passed).toBe(true);
  });

  it('STAGE 5: refuses at rung 1 — releasedAt (DB) and cleanIdentityStatement (report)', () => {
    const r = checkStage5Gate(makeState({ middleLayer: RUNG_1 }), stage5Turns());
    expect(r.passed).toBe(false);
    expect(r.reasons).toContain(RUNG3_REFUSED.SYMBOLIC_RETURN);
    expect(r.reasons).toContain(RUNG3_REFUSED.CLEAN_IDENTITY_STATEMENT);
  });

  it('STAGE 5: refuses at rung 2 as well', () => {
    const r = checkStage5Gate(makeState({ middleLayer: RUNG_2 }), stage5Turns());
    expect(r.passed).toBe(false);
    expect(r.reasons).toContain(RUNG3_REFUSED.SYMBOLIC_RETURN);
  });

  it('STAGE 5: the refusal is DISTINCT from "signal missing"', () => {
    // A user who never did the work gets the missing reason; a user who did
    // it unlicensed gets the rung reason. Conflating them would hide which
    // problem a reviewer is looking at.
    const missing = checkStage5Gate(
      makeState({ middleLayer: RUNG_3, foreignFiles: [makeFile({ releasedAt: null })] }),
      stage5Turns(),
    );
    expect(missing.reasons).toContain('no_symbolic_return_completed');
    expect(missing.reasons).not.toContain(RUNG3_REFUSED.SYMBOLIC_RETURN);
  });

  it('STAGE 6: identityAnchor earns no credit below rung 3', () => {
    const s = (ml: JourneyState['middleLayer']) => makeState({ currentStage: 6, middleLayer: ml });
    expect(checkStage6Gate(s(RUNG_1), stage5Turns()).reasons).toContain(RUNG3_REFUSED.IDENTITY_ANCHOR);
    expect(checkStage6Gate(s(RUNG_2), stage5Turns()).reasons).toContain(RUNG3_REFUSED.IDENTITY_ANCHOR);
    expect(checkStage6Gate(s(RUNG_3), stage5Turns()).reasons).not.toContain(RUNG3_REFUSED.IDENTITY_ANCHOR);
  });

  it('STAGE 7: symbolicIdentityMap and identityAnchor earn no credit below rung 3', () => {
    const turns = [...stage5Turns(), makeTurn(1, { symbolicIdentityMap: 'rooted but not stiff' })];
    const r1 = checkStage7Gate(makeState({ currentStage: 7, middleLayer: RUNG_1 }), turns);
    expect(r1.reasons).toContain(RUNG3_REFUSED.SYMBOLIC_IDENTITY_MAP);
    expect(r1.reasons).toContain(RUNG3_REFUSED.IDENTITY_ANCHOR);
    const r3 = checkStage7Gate(makeState({ currentStage: 7, middleLayer: RUNG_3 }), turns);
    expect(r3.reasons).not.toContain(RUNG3_REFUSED.SYMBOLIC_IDENTITY_MAP);
  });
});

// ===========================================================================
// 3. Nothing else changed — exemptions and preservation
// ===========================================================================

describe('exemptions and preservation', () => {
  it('the archived report is NOT rewritten — the emission survives refusal', () => {
    const turns = stage5Turns();
    checkStage5Gate(makeState({ middleLayer: RUNG_1 }), turns);
    // Same objects, same content, after the gate refused to count them.
    expect(turns[1].report.cleanIdentityStatement).toBe(
      'I am someone who makes things because she loves to.',
    );
    expect(turns[0].report.somaticRelease).toBe(true);
  });

  it('the persisted DB fact is NOT cleared — releasedAt survives refusal', () => {
    const state = makeState({ middleLayer: RUNG_1 });
    checkStage5Gate(state, stage5Turns());
    expect(state.foreignFiles[0].releasedAt).toBeInstanceOf(Date);
    expect(state.identityAnchor).toBe('someone who makes things');
  });

  it('USER-RESPONSE evidence is never suppressed or reclassified', () => {
    // somaticRelease and bodyConfirmation are the USER's answers, not the
    // Clinician's licensing claim. At rung 1 they must still be seen —
    // their absence must produce their OWN reasons, never a rung reason.
    const r = checkStage5Gate(makeState({ middleLayer: RUNG_1 }), stage5Turns());
    expect(r.reasons).not.toContain('somatic_release_not_confirmed');
    expect(r.reasons).not.toContain('clean_identity_statement_not_body_confirmed');
  });

  it('a user who never did the Rung-3 work still gets the ordinary missing reasons', () => {
    const bare = [makeTurn(3, {}), makeTurn(2, {}), makeTurn(1, { recommendedAction: 'advance' })];
    const r = checkStage5Gate(
      makeState({ middleLayer: RUNG_1, foreignFiles: [makeFile({ releasedAt: null })] }),
      bare,
    );
    expect(r.reasons).toContain('no_symbolic_return_completed');
    expect(r.reasons).toContain('somatic_release_not_confirmed');
  });

  it('EXEMPTION: the guard never mentions releaseInvalidated, depth, or aftercare', async () => {
    // Structural proof that PR 7' did not reach into the exempt paths.
    const { readFileSync } = await import('fs');
    const src = readFileSync('lib/journey/middleLayer/rung3-advancement.ts', 'utf8');
    const code = src.replace(/\/\/[^\n]*/g, ''); // strip comments; the header discusses them
    expect(code).not.toContain('releaseInvalidated');
    expect(code).not.toContain('lastDeepLayerContactAt');
    expect(code).not.toContain('deepLayerContact');
    expect(code).not.toMatch(/practiceRun/);
  });

  it('EXEMPTION: no persistence refusal was introduced early (PR 8′ owns that)', async () => {
    const { readFileSync } = await import('fs');
    const save = readFileSync('lib/journey/state/save.ts', 'utf8');
    // save.ts must not consult the rung at all yet.
    expect(save).not.toContain('rung3SignalsLicensed');
    expect(save).not.toContain('RUNG_3_MOVE_IDS');
    // And the aftercare stamp is still unconditional.
    expect(save).toContain('if (u.deepLayerContact) data.lastDeepLayerContactAt = new Date();');
  });

  it('EXEMPTION: practiceRun.depth is not used as a rung proxy anywhere in the guard', async () => {
    const { readFileSync } = await import('fs');
    for (const f of [
      'lib/journey/middleLayer/rung3-advancement.ts',
      'lib/journey/router/move-based-advance.ts',
    ]) {
      const src = readFileSync(f, 'utf8').replace(/\/\/[^\n]*/g, '');
      expect(src).not.toMatch(/depth === 'deep'/);
    }
  });
});
