// Tests for the Therapeutic Sensitivity Layer fields added in PR α
// (2026-07-09). Data-collection phase — parser normalises + validates,
// no code enforcement yet.

import { describe, expect, it } from 'vitest';
import { parseStateReport, parseModalityRejected } from './parse';
import {
  THERAPEUTIC_MODES,
  MODALITIES_REJECTED,
  CYCLE_STATUSES,
  NEXT_BEST_MODES,
} from './schema';

const BASE = {
  intensity: 4,
  safetyFlag: 'none' as const,
  recommendedAction: 'stay' as const,
};

describe('parseStateReport — therapeuticMode', () => {
  it('accepts every documented value', () => {
    for (const mode of THERAPEUTIC_MODES) {
      const r = parseStateReport(
        JSON.stringify({ ...BASE, therapeuticMode: mode }),
      );
      expect(r.therapeuticMode).toBe(mode);
    }
  });

  it('drops unknown values silently', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE, therapeuticMode: 'not_a_real_mode' }),
    );
    expect(r.therapeuticMode).toBeUndefined();
  });

  it('drops non-string values', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE, therapeuticMode: 42 }),
    );
    expect(r.therapeuticMode).toBeUndefined();
  });

  it('omits the field when absent', () => {
    const r = parseStateReport(JSON.stringify({ ...BASE }));
    expect(r.therapeuticMode).toBeUndefined();
  });
});

describe('parseStateReport — channelShiftDetected', () => {
  it('accepts true', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE, channelShiftDetected: true }),
    );
    expect(r.channelShiftDetected).toBe(true);
  });

  it('accepts false explicitly', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE, channelShiftDetected: false }),
    );
    expect(r.channelShiftDetected).toBe(false);
  });

  it('drops non-boolean values', () => {
    const r1 = parseStateReport(
      JSON.stringify({ ...BASE, channelShiftDetected: 'yes' }),
    );
    expect(r1.channelShiftDetected).toBeUndefined();
    const r2 = parseStateReport(
      JSON.stringify({ ...BASE, channelShiftDetected: 1 }),
    );
    expect(r2.channelShiftDetected).toBeUndefined();
  });
});

describe('parseModalityRejected — pure helper', () => {
  it('returns undefined for non-array', () => {
    expect(parseModalityRejected(undefined)).toBeUndefined();
    expect(parseModalityRejected(null)).toBeUndefined();
    expect(parseModalityRejected('body')).toBeUndefined();
    expect(parseModalityRejected({ modality: 'body' })).toBeUndefined();
  });

  it('returns undefined for an empty array', () => {
    expect(parseModalityRejected([])).toBeUndefined();
  });

  it('accepts each documented modality', () => {
    for (const m of MODALITIES_REJECTED) {
      const r = parseModalityRejected([m]);
      expect(r).toEqual([m]);
    }
  });

  it('deduplicates repeats', () => {
    expect(parseModalityRejected(['body', 'body', 'imagery'])).toEqual([
      'body',
      'imagery',
    ]);
  });

  it('drops unknown items but keeps valid ones', () => {
    expect(
      parseModalityRejected(['body', 'made_up', 'imagery', 42, null]),
    ).toEqual(['body', 'imagery']);
  });

  it("drops 'none' when combined with real rejections (real values win)", () => {
    expect(parseModalityRejected(['none', 'body'])).toEqual(['body']);
    expect(parseModalityRejected(['body', 'none'])).toEqual(['body']);
    expect(parseModalityRejected(['body', 'none', 'imagery'])).toEqual([
      'body',
      'imagery',
    ]);
  });

  it("keeps ['none'] when it is the only known value", () => {
    expect(parseModalityRejected(['none'])).toEqual(['none']);
  });

  it('returns undefined when all values are unknown', () => {
    expect(parseModalityRejected(['nope', 'nada'])).toBeUndefined();
  });
});

describe('parseStateReport — cycleStatus', () => {
  it('accepts every documented value', () => {
    for (const s of CYCLE_STATUSES) {
      const r = parseStateReport(
        JSON.stringify({ ...BASE, cycleStatus: s }),
      );
      expect(r.cycleStatus).toBe(s);
    }
  });

  it('drops unknown values', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE, cycleStatus: 'unresolved' }),
    );
    expect(r.cycleStatus).toBeUndefined();
  });
});

describe('parseStateReport — cycleCanClose', () => {
  it('accepts true / false', () => {
    const r1 = parseStateReport(
      JSON.stringify({ ...BASE, cycleCanClose: true }),
    );
    expect(r1.cycleCanClose).toBe(true);
    const r2 = parseStateReport(
      JSON.stringify({ ...BASE, cycleCanClose: false }),
    );
    expect(r2.cycleCanClose).toBe(false);
  });

  it('drops non-boolean', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE, cycleCanClose: 'yes' }),
    );
    expect(r.cycleCanClose).toBeUndefined();
  });
});

describe('parseStateReport — nextBestMode', () => {
  it('accepts every documented value', () => {
    for (const m of NEXT_BEST_MODES) {
      const r = parseStateReport(
        JSON.stringify({ ...BASE, nextBestMode: m }),
      );
      expect(r.nextBestMode).toBe(m);
    }
  });

  it('drops unknown values', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE, nextBestMode: 'do_a_dance' }),
    );
    expect(r.nextBestMode).toBeUndefined();
  });
});

describe('parseStateReport — full integration example', () => {
  it('parses all sensitivity fields from a well-formed state report', () => {
    const r = parseStateReport(
      JSON.stringify({
        intensity: 6,
        safetyFlag: 'watch',
        recommendedAction: 'stay',
        therapeuticMode: 'somatic',
        channelShiftDetected: true,
        modalityRejected: ['body'],
        cycleStatus: 'open',
        cycleCanClose: false,
        nextBestMode: 'allow_discharge',
        clinicalRead:
          'User shifted from imagery to somatic activation. Cycle open — do not close.',
      }),
    );
    expect(r.therapeuticMode).toBe('somatic');
    expect(r.channelShiftDetected).toBe(true);
    expect(r.modalityRejected).toEqual(['body']);
    expect(r.cycleStatus).toBe('open');
    expect(r.cycleCanClose).toBe(false);
    expect(r.nextBestMode).toBe('allow_discharge');
  });

  it('leaves all fields undefined when the AI omits them (backwards compat)', () => {
    const r = parseStateReport(JSON.stringify(BASE));
    expect(r.therapeuticMode).toBeUndefined();
    expect(r.channelShiftDetected).toBeUndefined();
    expect(r.modalityRejected).toBeUndefined();
    expect(r.cycleStatus).toBeUndefined();
    expect(r.cycleCanClose).toBeUndefined();
    expect(r.nextBestMode).toBeUndefined();
  });
});
