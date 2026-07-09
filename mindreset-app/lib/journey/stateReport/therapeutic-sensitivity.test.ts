// Tests for the Therapeutic Sensitivity Layer fields added in PR α
// (2026-07-09). Data-collection phase — parser normalises + validates,
// no code enforcement yet.

import { describe, expect, it } from 'vitest';
import {
  parseStateReport,
  parseModalityRejected,
  splitReplyAndReport,
} from './parse';
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

describe('splitReplyAndReport — assessment block is stripped from humanReply', () => {
  // The BLOCKING fix from the PR α code-review pass. splitReplyAndReport
  // computes what gets persisted as the assistant message and rendered
  // on every page reload. If the assessment block isn't stripped here,
  // the AI's private clinical reasoning appears in the chat history on
  // the next reload — a critical clinical safety violation.

  it('strips the assessment block from humanReply when both blocks are present', () => {
    const raw =
      '<assessment>\nDominant process: somatic\nCycle: open\n</assessment>\n\n' +
      'Warm reply to the user goes here.\n\n' +
      '<state-report>{"intensity":5,"safetyFlag":"none","recommendedAction":"stay"}</state-report>';
    const split = splitReplyAndReport(raw);
    expect(split.humanReply).toBe('Warm reply to the user goes here.');
    expect(split.humanReply).not.toContain('Dominant process');
    expect(split.humanReply).not.toContain('<assessment>');
    expect(split.humanReply).not.toContain('</assessment>');
    expect(split.rawStateReport).toBe(
      '{"intensity":5,"safetyFlag":"none","recommendedAction":"stay"}',
    );
  });

  it('strips the assessment block when no state-report follows', () => {
    const raw =
      '<assessment>reasoning</assessment>\n\nJust a reply, no state report.';
    const split = splitReplyAndReport(raw);
    expect(split.humanReply).toBe('Just a reply, no state report.');
    expect(split.humanReply).not.toContain('reasoning');
    expect(split.rawStateReport).toBeNull();
  });

  it('returns empty humanReply when the assessment tag is opened but never closed', () => {
    const raw =
      '<assessment>\nEverything is private — no close tag was ever emitted.';
    const split = splitReplyAndReport(raw);
    expect(split.humanReply).toBe('');
    expect(split.humanReply).not.toContain('private');
    expect(split.rawStateReport).toBeNull();
  });

  it('preserves backwards compat when NO assessment block is present', () => {
    const raw =
      'Just a reply.\n\n<state-report>{"intensity":3,"safetyFlag":"none","recommendedAction":"stay"}</state-report>';
    const split = splitReplyAndReport(raw);
    expect(split.humanReply).toBe('Just a reply.');
    expect(split.rawStateReport).toContain('intensity');
  });

  it('strips assessment even when the reply contains angle brackets', () => {
    const raw =
      '<assessment>private</assessment>\n\nReply with <em>emphasis</em> here.';
    const split = splitReplyAndReport(raw);
    expect(split.humanReply).toBe('Reply with <em>emphasis</em> here.');
  });
});

describe('parseStateReport — clinicalRead', () => {
  it('parses clinicalRead when present', () => {
    const r = parseStateReport(
      JSON.stringify({
        intensity: 4,
        safetyFlag: 'none',
        recommendedAction: 'stay',
        clinicalRead: 'User in mid-somatic release, image not re-checked.',
      }),
    );
    expect(r.clinicalRead).toBe(
      'User in mid-somatic release, image not re-checked.',
    );
  });

  it('omits clinicalRead when absent', () => {
    const r = parseStateReport(
      JSON.stringify({
        intensity: 4,
        safetyFlag: 'none',
        recommendedAction: 'stay',
      }),
    );
    expect(r.clinicalRead).toBeUndefined();
  });

  it('omits clinicalRead when empty string', () => {
    const r = parseStateReport(
      JSON.stringify({
        intensity: 4,
        safetyFlag: 'none',
        recommendedAction: 'stay',
        clinicalRead: '',
      }),
    );
    expect(r.clinicalRead).toBeUndefined();
  });

  it('drops non-string clinicalRead', () => {
    const r = parseStateReport(
      JSON.stringify({
        intensity: 4,
        safetyFlag: 'none',
        recommendedAction: 'stay',
        clinicalRead: 42,
      }),
    );
    expect(r.clinicalRead).toBeUndefined();
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
    expect(r.clinicalRead).toBe(
      'User shifted from imagery to somatic activation. Cycle open — do not close.',
    );
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
