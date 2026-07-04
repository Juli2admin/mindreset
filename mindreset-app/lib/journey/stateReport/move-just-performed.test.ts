// Tests for moveJustPerformed — the canonical clinical-move naming field
// added in PR 4a (2026-07-04). The LLM emits an array of 1-3 canonical
// move IDs so the code can map the living session back to the 8-block
// method. Router does NOT consume this field yet.

import { describe, expect, it } from 'vitest';
import { parseStateReport, parseMoveJustPerformed } from './parse';
import {
  CANONICAL_MOVES,
  MOVE_NONE,
  MAX_MOVES_PER_TURN,
} from './schema';

const BASE = {
  intensity: 4,
  safetyFlag: 'none' as const,
  recommendedAction: 'stay' as const,
};

describe('CANONICAL_MOVES vocabulary — sanity checks', () => {
  it('contains universal.none as the reserved "no move" sentinel', () => {
    expect(CANONICAL_MOVES).toContain('universal.none');
    expect(MOVE_NONE).toBe('universal.none');
  });

  it('contains the two moves promoted to universal in the 2026-07-04 decision', () => {
    expect(CANONICAL_MOVES).toContain('universal.safety_reorientation');
    expect(CANONICAL_MOVES).toContain('universal.post_deep_check_in');
  });

  it('does not contain the stage-scoped versions of promoted moves', () => {
    expect(CANONICAL_MOVES).not.toContain('stage_7.safety_reorientation');
    expect(CANONICAL_MOVES).not.toContain('stage_4.post_deep_check_in');
  });

  it('has all 38 approved moves — 16 universal + 22 stage-scoped', () => {
    expect(CANONICAL_MOVES).toHaveLength(38);
    const universal = CANONICAL_MOVES.filter((m) => m.startsWith('universal.'));
    const stageScoped = CANONICAL_MOVES.filter((m) => m.startsWith('stage_'));
    expect(universal).toHaveLength(16);
    expect(stageScoped).toHaveLength(22);
  });

  it('has every ID in snake_case with a namespace prefix', () => {
    for (const id of CANONICAL_MOVES) {
      expect(id).toMatch(/^(universal|stage_[1-8])\.[a-z][a-z0-9_]*$/);
    }
  });

  it('caps moves-per-turn at 3', () => {
    expect(MAX_MOVES_PER_TURN).toBe(3);
  });
});

describe('parseMoveJustPerformed — pure helper', () => {
  it('returns undefined when input is not an array', () => {
    expect(parseMoveJustPerformed(undefined)).toBeUndefined();
    expect(parseMoveJustPerformed(null)).toBeUndefined();
    expect(parseMoveJustPerformed('stage_1.anchor_capture')).toBeUndefined();
    expect(parseMoveJustPerformed({ moves: [] })).toBeUndefined();
    expect(parseMoveJustPerformed(42)).toBeUndefined();
  });

  it('returns undefined for an empty array', () => {
    expect(parseMoveJustPerformed([])).toBeUndefined();
  });

  it('returns undefined when all items are unknown IDs', () => {
    expect(
      parseMoveJustPerformed(['not_a_real_move', 'also.not.real']),
    ).toBeUndefined();
  });

  it('returns undefined when array contains only non-string junk', () => {
    expect(parseMoveJustPerformed([1, true, null, {}])).toBeUndefined();
  });

  it('accepts a single known ID and returns it unchanged', () => {
    expect(parseMoveJustPerformed(['stage_1.anchor_capture'])).toEqual([
      'stage_1.anchor_capture',
    ]);
  });

  it('preserves primary-first order for multiple known IDs', () => {
    expect(
      parseMoveJustPerformed([
        'stage_4.compassion_bridge',
        'universal.practice_compassion',
        'universal.witness_and_reflect',
      ]),
    ).toEqual([
      'stage_4.compassion_bridge',
      'universal.practice_compassion',
      'universal.witness_and_reflect',
    ]);
  });

  it('drops unknown IDs and keeps known ones with order preserved', () => {
    expect(
      parseMoveJustPerformed([
        'stage_5.origin_voice_mapping',
        'stage_9.made_up',
        'universal.practice_narrative',
        123,
        null,
      ]),
    ).toEqual([
      'stage_5.origin_voice_mapping',
      'universal.practice_narrative',
    ]);
  });

  it('deduplicates repeated IDs while preserving order', () => {
    expect(
      parseMoveJustPerformed([
        'universal.witness_and_reflect',
        'universal.witness_and_reflect',
        'stage_2.soft_why_inquiry',
        'universal.witness_and_reflect',
      ]),
    ).toEqual([
      'universal.witness_and_reflect',
      'stage_2.soft_why_inquiry',
    ]);
  });

  it('caps output at 3 moves, dropping tail beyond that', () => {
    expect(
      parseMoveJustPerformed([
        'universal.session_open',
        'stage_1.assessment_gather',
        'stage_1.anchor_capture',
        'universal.witness_and_reflect', // 4th — dropped
        'universal.practice_regulation', // 5th — dropped
      ]),
    ).toEqual([
      'universal.session_open',
      'stage_1.assessment_gather',
      'stage_1.anchor_capture',
    ]);
  });

  it('keeps universal.none when it is the only known ID', () => {
    expect(parseMoveJustPerformed(['universal.none'])).toEqual(['universal.none']);
  });

  it('drops universal.none when combined with any real move (owner rule)', () => {
    expect(
      parseMoveJustPerformed(['universal.none', 'stage_2.soft_why_inquiry']),
    ).toEqual(['stage_2.soft_why_inquiry']);

    // Order doesn't matter — none is dropped either way.
    expect(
      parseMoveJustPerformed([
        'stage_4.compassion_bridge',
        'universal.none',
        'universal.practice_compassion',
      ]),
    ).toEqual([
      'stage_4.compassion_bridge',
      'universal.practice_compassion',
    ]);
  });

  it('returns [universal.none] when the LLM emits none plus only unknown IDs', () => {
    expect(
      parseMoveJustPerformed(['universal.none', 'not.a.real.move']),
    ).toEqual(['universal.none']);
  });

  it('deduplicates universal.none too', () => {
    expect(
      parseMoveJustPerformed(['universal.none', 'universal.none']),
    ).toEqual(['universal.none']);
  });
});

describe('parseStateReport — moveJustPerformed integration', () => {
  it('parses moveJustPerformed onto the returned StateReport', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE,
        moveJustPerformed: [
          'stage_4.compassion_bridge',
          'universal.practice_compassion',
        ],
      }),
    );
    expect(r.moveJustPerformed).toEqual([
      'stage_4.compassion_bridge',
      'universal.practice_compassion',
    ]);
  });

  it('omits moveJustPerformed when the field is absent', () => {
    const r = parseStateReport(JSON.stringify({ ...BASE }));
    expect(r.moveJustPerformed).toBeUndefined();
  });

  it('omits moveJustPerformed when the array is empty or all-unknown', () => {
    const r1 = parseStateReport(
      JSON.stringify({ ...BASE, moveJustPerformed: [] }),
    );
    expect(r1.moveJustPerformed).toBeUndefined();

    const r2 = parseStateReport(
      JSON.stringify({ ...BASE, moveJustPerformed: ['nope', 'nada'] }),
    );
    expect(r2.moveJustPerformed).toBeUndefined();
  });

  it('applies all normalisation rules end-to-end via parseStateReport', () => {
    const r = parseStateReport(
      JSON.stringify({
        ...BASE,
        moveJustPerformed: [
          'universal.session_open',
          'universal.none', // dropped — real moves present
          'stage_1.anchor_capture',
          'stage_1.anchor_capture', // dedup
          'unknown.junk', // dropped
          'universal.witness_and_reflect',
          'stage_2.soft_why_inquiry', // over cap of 3, dropped
        ],
      }),
    );
    expect(r.moveJustPerformed).toEqual([
      'universal.session_open',
      'stage_1.anchor_capture',
      'universal.witness_and_reflect',
    ]);
  });

  it('leaves core required fields untouched when moveJustPerformed is present', () => {
    const r = parseStateReport(
      JSON.stringify({
        intensity: 7,
        safetyFlag: 'watch',
        recommendedAction: 'stay',
        moveJustPerformed: ['stage_5.symbolic_return'],
      }),
    );
    expect(r.intensity).toBe(7);
    expect(r.safetyFlag).toBe('watch');
    expect(r.recommendedAction).toBe('stay');
    expect(r.moveJustPerformed).toEqual(['stage_5.symbolic_return']);
  });

  it('is defensive when moveJustPerformed is a string rather than an array', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE, moveJustPerformed: 'stage_1.anchor_capture' }),
    );
    // Not an array → field is absent on the parsed report.
    expect(r.moveJustPerformed).toBeUndefined();
  });
});
