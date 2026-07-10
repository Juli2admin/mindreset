// Parity tests for the tool-reader.
//
// PR η Step 1b (2026-07-10). Proves that readStateReportFromToolInput
// produces the SAME StateReport shape parseStateReport produces when given
// equivalent input. If any of these fail, downstream code (state-save,
// router, admin inspector) would see different values depending on which
// code path fed it — the whole point of A-full is that downstream is
// unchanged.

import { describe, expect, it } from 'vitest';
import { readStateReportFromToolInput } from './tool-reader';
import { parseStateReport } from './parse';

// Convenience: pass the same object literal through both readers and get
// their outputs back for comparison.
function bothWays(input: Record<string, unknown>) {
  return {
    fromTool: readStateReportFromToolInput(input),
    fromText: parseStateReport(JSON.stringify(input)),
  };
}

describe('readStateReportFromToolInput — defensive fallback', () => {
  it('returns DEFENSIVE_DEFAULT for null', () => {
    const r = readStateReportFromToolInput(null);
    expect(r).toEqual({
      intensity: 5,
      safetyFlag: 'watch',
      recommendedAction: 'stay',
    });
  });

  it('returns DEFENSIVE_DEFAULT for undefined', () => {
    const r = readStateReportFromToolInput(undefined);
    expect(r.intensity).toBe(5);
    expect(r.safetyFlag).toBe('watch');
    expect(r.recommendedAction).toBe('stay');
  });

  it('returns DEFENSIVE_DEFAULT for an array (not a state-report object)', () => {
    const r = readStateReportFromToolInput([1, 2, 3]);
    expect(r.intensity).toBe(5);
    expect(r.safetyFlag).toBe('watch');
    expect(r.recommendedAction).toBe('stay');
  });

  it('parity: same fallback shape as parseStateReport(null)', () => {
    expect(readStateReportFromToolInput(null)).toEqual(parseStateReport(null));
  });
});

describe('readStateReportFromToolInput — required-3 core parity', () => {
  it('preserves the required-3 fields exactly', () => {
    const input = {
      intensity: 7,
      safetyFlag: 'watch' as const,
      recommendedAction: 'stay' as const,
    };
    const { fromTool, fromText } = bothWays(input);
    expect(fromTool).toEqual(fromText);
  });

  it('clamps intensity 0..10 same as parser', () => {
    expect(readStateReportFromToolInput({ intensity: 42 }).intensity).toBe(10);
    expect(readStateReportFromToolInput({ intensity: -3 }).intensity).toBe(0);
    expect(readStateReportFromToolInput({ intensity: 6.7 }).intensity).toBe(7);
  });

  it('rejects invalid safetyFlag values → falls back to "watch"', () => {
    const r = readStateReportFromToolInput({
      intensity: 5,
      safetyFlag: 'panic',
    });
    expect(r.safetyFlag).toBe('watch');
  });
});

describe('readStateReportFromToolInput — PR γ required-on-substantive-turn fields', () => {
  it('copies channel, clinicalRead, moveJustPerformed through', () => {
    const input = {
      intensity: 4,
      safetyFlag: 'none' as const,
      recommendedAction: 'stay' as const,
      channel: 'kinesthetic' as const,
      clinicalRead: 'User located somatic weight in chest.',
      moveJustPerformed: [
        'universal.witness_and_reflect',
        'stage_2.affect_labelling_and_somatic_mapping',
      ],
    };
    const { fromTool, fromText } = bothWays(input);
    expect(fromTool.channel).toBe('kinesthetic');
    expect(fromTool.clinicalRead).toBe(input.clinicalRead);
    expect(fromTool.moveJustPerformed).toEqual(input.moveJustPerformed);
    expect(fromTool).toEqual(fromText);
  });

  it('caps moveJustPerformed at 3 items (matches parser slice)', () => {
    const r = readStateReportFromToolInput({
      intensity: 5,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      moveJustPerformed: [
        'universal.witness_and_reflect',
        'stage_2.affect_labelling_and_somatic_mapping',
        'stage_2.soft_why_inquiry',
        'universal.session_close',
      ],
    });
    expect(r.moveJustPerformed).toHaveLength(3);
    expect(r.moveJustPerformed).not.toContain('universal.session_close');
  });

  it('collapses [universal.none, X, Y] → [universal.none] (matches parser rule)', () => {
    const r = readStateReportFromToolInput({
      intensity: 5,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      moveJustPerformed: [
        'universal.none',
        'universal.witness_and_reflect',
      ],
    });
    expect(r.moveJustPerformed).toEqual(['universal.none']);
  });

  it('drops empty clinicalRead (matches copyStringField semantics)', () => {
    const r = readStateReportFromToolInput({
      intensity: 3,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      clinicalRead: '',
    });
    expect(r.clinicalRead).toBeUndefined();
  });
});

describe('readStateReportFromToolInput — Therapeutic Sensitivity Layer parity', () => {
  it('preserves all six sensitivity fields', () => {
    const input = {
      intensity: 6,
      safetyFlag: 'watch' as const,
      recommendedAction: 'stay' as const,
      therapeuticMode: 'somatic' as const,
      channelShiftDetected: true,
      modalityRejected: ['body' as const],
      cycleStatus: 'open' as const,
      cycleCanClose: false,
      nextBestMode: 'allow_discharge' as const,
    };
    const { fromTool, fromText } = bothWays(input);
    expect(fromTool.therapeuticMode).toBe('somatic');
    expect(fromTool.channelShiftDetected).toBe(true);
    expect(fromTool.modalityRejected).toEqual(['body']);
    expect(fromTool.cycleStatus).toBe('open');
    expect(fromTool.cycleCanClose).toBe(false);
    expect(fromTool.nextBestMode).toBe('allow_discharge');
    expect(fromTool).toEqual(fromText);
  });

  it('modalityRejected dedup: [body, body, imagery] → [body, imagery]', () => {
    const r = readStateReportFromToolInput({
      intensity: 5,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      modalityRejected: ['body', 'body', 'imagery'],
    });
    expect(r.modalityRejected).toEqual(['body', 'imagery']);
  });

  it("modalityRejected drops 'none' when combined with real values", () => {
    const r = readStateReportFromToolInput({
      intensity: 5,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      modalityRejected: ['none', 'body'],
    });
    expect(r.modalityRejected).toEqual(['body']);
  });

  it("modalityRejected preserves ['none'] when it's the only value", () => {
    const r = readStateReportFromToolInput({
      intensity: 5,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      modalityRejected: ['none'],
    });
    expect(r.modalityRejected).toEqual(['none']);
  });
});

describe('readStateReportFromToolInput — practiceRun nested', () => {
  it('parity with parser on a full practiceRun', () => {
    const input = {
      intensity: 4,
      safetyFlag: 'none' as const,
      recommendedAction: 'stay' as const,
      practiceRun: {
        kind: 'generated' as const,
        name: 'Hand on chest — meeting the weight',
        family: 'somatic' as const,
        status: 'completed' as const,
        depth: 'surface' as const,
        userImages: 'a black heavy ball, lower in chest',
      },
    };
    const { fromTool, fromText } = bothWays(input);
    expect(fromTool.practiceRun).toEqual(fromText.practiceRun);
  });

  it('drops practiceRun when kind is missing (parser drop condition)', () => {
    const r = readStateReportFromToolInput({
      intensity: 5,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      practiceRun: { status: 'completed' },
    });
    expect(r.practiceRun).toBeUndefined();
  });

  it('drops practiceRun when status is missing', () => {
    const r = readStateReportFromToolInput({
      intensity: 5,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      practiceRun: { kind: 'generated' },
    });
    expect(r.practiceRun).toBeUndefined();
  });
});

describe('readStateReportFromToolInput — landscape arrays', () => {
  it('preserves userImagesCaptured', () => {
    const input = {
      intensity: 5,
      safetyFlag: 'none' as const,
      recommendedAction: 'stay' as const,
      userImagesCaptured: ['the field of bluebells', 'the office desk'],
    };
    const { fromTool, fromText } = bothWays(input);
    expect(fromTool.userImagesCaptured).toEqual(fromText.userImagesCaptured);
  });

  it('preserves partsTouched with nested channel + safeDistance', () => {
    const input = {
      intensity: 5,
      safetyFlag: 'watch' as const,
      recommendedAction: 'stay' as const,
      partsTouched: [
        {
          description: 'the little one, calm in my lap',
          channel: 'visual' as const,
          safeDistance: 'right in my hands',
        },
      ],
    };
    const { fromTool, fromText } = bothWays(input);
    expect(fromTool.partsTouched).toEqual(fromText.partsTouched);
  });

  it('preserves patternsTouched with context', () => {
    const input = {
      intensity: 5,
      safetyFlag: 'none' as const,
      recommendedAction: 'stay' as const,
      patternsTouched: [
        {
          category: 'not_enough_schema',
          description: 'stop being an idiot, stop being naive',
          context: { trigger: 'friend_not_testing_app' },
        },
      ],
    };
    const { fromTool, fromText } = bothWays(input);
    expect(fromTool.patternsTouched).toEqual(fromText.patternsTouched);
  });
});

describe('readStateReportFromToolInput — stabilityCheck normalization', () => {
  it('truncates contextNote to 80 chars (matches parser)', () => {
    const longNote = 'x'.repeat(200);
    const r = readStateReportFromToolInput({
      intensity: 5,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      stabilityCheck: { score: 8, contextNote: longNote },
    });
    expect(r.stabilityCheck!.contextNote).toHaveLength(80);
  });

  it('clamps score to [1, 10] (matches parser)', () => {
    const r = readStateReportFromToolInput({
      intensity: 5,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      stabilityCheck: { score: 15 },
    });
    expect(r.stabilityCheck!.score).toBe(10);
  });

  it('drops stabilityCheck when score is missing', () => {
    const r = readStateReportFromToolInput({
      intensity: 5,
      safetyFlag: 'none',
      recommendedAction: 'stay',
      stabilityCheck: { contextNote: 'orphaned note' },
    });
    expect(r.stabilityCheck).toBeUndefined();
  });
});

describe('readStateReportFromToolInput — integration with a rich real-world turn', () => {
  it('matches parser output for a fully populated Journey turn', () => {
    // Modelled on Julia's actual "black heavy ball" turn from the live
    // PR γ test — the shape the sensitivity layer wants to see.
    const input = {
      intensity: 5,
      safetyFlag: 'watch' as const,
      recommendedAction: 'stay' as const,
      channel: 'kinesthetic' as const,
      clinicalRead:
        'User located weight in chest and stomach — black heavy ball image emerged. Invited hand-on-chest somatic contact.',
      moveJustPerformed: [
        'universal.witness_and_reflect',
        'stage_2.affect_labelling_and_somatic_mapping',
      ],
      therapeuticMode: 'somatic' as const,
      channelShiftDetected: true,
      cycleStatus: 'open' as const,
      cycleCanClose: false,
      nextBestMode: 'continue_imagery' as const,
      practiceRun: {
        kind: 'generated' as const,
        name: 'Hand on chest — meeting the ball',
        family: 'somatic' as const,
        status: 'completed' as const,
        depth: 'surface' as const,
      },
      patternsTouched: [
        {
          category: 'post_breakthrough_rawness',
          description: 'two hours of certainty then doubt what next',
          context: { trigger: 'post_session_return' },
        },
      ],
      readinessTouched: [
        'emotion_named',
        'body_located',
        'orientation_present',
      ],
      continuityNote:
        'Presenting issues: business vision gap. Somatic release ongoing. Ball smaller by close.',
    };
    const { fromTool, fromText } = bothWays(input);
    expect(fromTool).toEqual(fromText);
  });
});

describe('readStateReportFromToolInput — light turn parity', () => {
  it('a bare "hi"-style turn returns the required-6 shape (matches PR γ intent)', () => {
    const input = {
      intensity: 2,
      safetyFlag: 'none' as const,
      recommendedAction: 'stay' as const,
      channel: 'mixed' as const,
      clinicalRead: 'Brief opener; no clinical content this turn.',
      moveJustPerformed: ['universal.none' as const],
    };
    const r = readStateReportFromToolInput(input);
    expect(r.intensity).toBe(2);
    expect(r.channel).toBe('mixed');
    expect(r.clinicalRead).toBe(input.clinicalRead);
    expect(r.moveJustPerformed).toEqual(['universal.none']);
    // Optional fields should be undefined.
    expect(r.therapeuticMode).toBeUndefined();
    expect(r.practiceRun).toBeUndefined();
    expect(r.patternsTouched).toBeUndefined();
  });
});
