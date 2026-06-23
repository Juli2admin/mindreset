// Tests for the 11 missing canonical capture fields added in PR 4.
// Per audit P4 (2026-06-23 design-vs-delivery investigation), the
// canon names 11 fields that had no schema entry. These tests verify
// the parser accepts them and the new gate hooks enforce them.

import { describe, expect, it } from 'vitest';
import { parseStateReport } from './parse';

const BASE = {
  intensity: 4,
  safetyFlag: 'none' as const,
  recommendedAction: 'stay' as const,
};

describe('parseStateReport — Bundle B fields (PR 4)', () => {
  describe('Stage 3 — Adult Self Co-Creation', () => {
    it('accepts adultSelfAnchorLinked boolean', () => {
      const r = parseStateReport(
        JSON.stringify({ ...BASE, adultSelfAnchorLinked: true }),
      );
      expect(r.adultSelfAnchorLinked).toBe(true);
    });

    it('accepts heldEmotionInAdultSelf boolean', () => {
      const r = parseStateReport(
        JSON.stringify({ ...BASE, heldEmotionInAdultSelf: true }),
      );
      expect(r.heldEmotionInAdultSelf).toBe(true);
    });

    it('drops non-boolean values for both Stage 3 fields', () => {
      const r = parseStateReport(
        JSON.stringify({
          ...BASE,
          adultSelfAnchorLinked: 'yes',
          heldEmotionInAdultSelf: 1,
        }),
      );
      expect(r.adultSelfAnchorLinked).toBeUndefined();
      expect(r.heldEmotionInAdultSelf).toBeUndefined();
    });
  });

  describe('Stage 4 — Compassion Bridge + Securing the Part', () => {
    it('accepts bridgeAchievedAt string', () => {
      const r = parseStateReport(
        JSON.stringify({ ...BASE, bridgeAchievedAt: '2026-06-23T10:00:00Z' }),
      );
      expect(r.bridgeAchievedAt).toBe('2026-06-23T10:00:00Z');
    });

    it('accepts userGrounded boolean (Securing the Part close marker)', () => {
      const r = parseStateReport(JSON.stringify({ ...BASE, userGrounded: true }));
      expect(r.userGrounded).toBe(true);
    });
  });

  describe('Stage 5 — Origin Voice Mapping / Symbolic Return / Clean Identity', () => {
    it('accepts originIdentified string', () => {
      const r = parseStateReport(
        JSON.stringify({ ...BASE, originIdentified: 'my mother' }),
      );
      expect(r.originIdentified).toBe('my mother');
    });

    it('accepts somaticRelease boolean', () => {
      const r = parseStateReport(
        JSON.stringify({ ...BASE, somaticRelease: true }),
      );
      expect(r.somaticRelease).toBe(true);
    });

    it('accepts bodyConfirmation string', () => {
      const r = parseStateReport(
        JSON.stringify({ ...BASE, bodyConfirmation: 'lighter in the chest' }),
      );
      expect(r.bodyConfirmation).toBe('lighter in the chest');
    });
  });

  describe('Stage 6 — Self-Loyalty Commitment', () => {
    it('accepts selfLoyaltyStatement string', () => {
      const r = parseStateReport(
        JSON.stringify({
          ...BASE,
          selfLoyaltyStatement: 'I choose to stay on my own side',
        }),
      );
      expect(r.selfLoyaltyStatement).toBe('I choose to stay on my own side');
    });

    it('accepts oneSmallAction string', () => {
      const r = parseStateReport(
        JSON.stringify({
          ...BASE,
          oneSmallAction: 'put my own coffee first tomorrow morning',
        }),
      );
      expect(r.oneSmallAction).toBe('put my own coffee first tomorrow morning');
    });
  });

  describe('Stage 7 — Safety Reorientation', () => {
    it('accepts safetyReorientation boolean', () => {
      const r = parseStateReport(
        JSON.stringify({ ...BASE, safetyReorientation: true }),
      );
      expect(r.safetyReorientation).toBe(true);
    });
  });

  describe('Stage 8 — Discharge Readiness', () => {
    it('accepts dischargeReadiness "not_ready"', () => {
      const r = parseStateReport(
        JSON.stringify({ ...BASE, dischargeReadiness: 'not_ready' }),
      );
      expect(r.dischargeReadiness).toBe('not_ready');
    });

    it('accepts dischargeReadiness "maybe"', () => {
      const r = parseStateReport(
        JSON.stringify({ ...BASE, dischargeReadiness: 'maybe' }),
      );
      expect(r.dischargeReadiness).toBe('maybe');
    });

    it('accepts dischargeReadiness "ready"', () => {
      const r = parseStateReport(
        JSON.stringify({ ...BASE, dischargeReadiness: 'ready' }),
      );
      expect(r.dischargeReadiness).toBe('ready');
    });

    it('drops invalid dischargeReadiness values (fail-safe)', () => {
      const r = parseStateReport(
        JSON.stringify({ ...BASE, dischargeReadiness: 'definitely_yes' }),
      );
      expect(r.dischargeReadiness).toBeUndefined();
    });
  });
});
