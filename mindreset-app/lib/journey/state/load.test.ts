// Unit tests for the pure derivation helpers in load.ts. loadJourneyState
// itself is not tested here — it's I/O against Prisma. We test the pure
// functions that gate the AI's time-awareness rendering.

import { describe, expect, it } from 'vitest';
import {
  deriveContinuitySignals,
  formatTimeSinceLastTurnBucket,
  SESSION_BOUNDARY_MS,
} from './load';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('formatTimeSinceLastTurnBucket', () => {
  it('returns null for a first-ever turn (no prior turn)', () => {
    expect(formatTimeSinceLastTurnBucket(null)).toBeNull();
  });

  it('buckets sub-30-minute gaps as "just now"', () => {
    expect(formatTimeSinceLastTurnBucket(0)).toBe('just now');
    expect(formatTimeSinceLastTurnBucket(0.4)).toBe('just now');
  });

  it('buckets 30 min–8 h as "today"', () => {
    expect(formatTimeSinceLastTurnBucket(0.5)).toBe('today');
    expect(formatTimeSinceLastTurnBucket(2)).toBe('today');
    expect(formatTimeSinceLastTurnBucket(7.9)).toBe('today');
  });

  it('buckets 8–36 h as "yesterday"', () => {
    expect(formatTimeSinceLastTurnBucket(8)).toBe('yesterday');
    expect(formatTimeSinceLastTurnBucket(24)).toBe('yesterday');
    expect(formatTimeSinceLastTurnBucket(35.9)).toBe('yesterday');
  });

  it('buckets 2–7 days as "a few days ago"', () => {
    expect(formatTimeSinceLastTurnBucket(36)).toBe('a few days ago');
    expect(formatTimeSinceLastTurnBucket(24 * 3)).toBe('a few days ago');
    expect(formatTimeSinceLastTurnBucket(24 * 7 - 0.01)).toBe('a few days ago');
  });

  it('buckets 7–14 days as "last week"', () => {
    expect(formatTimeSinceLastTurnBucket(24 * 7)).toBe('last week');
    expect(formatTimeSinceLastTurnBucket(24 * 10)).toBe('last week');
    expect(formatTimeSinceLastTurnBucket(24 * 14 - 0.01)).toBe('last week');
  });

  it('buckets 14–28 days as "a couple weeks ago"', () => {
    expect(formatTimeSinceLastTurnBucket(24 * 14)).toBe('a couple weeks ago');
    expect(formatTimeSinceLastTurnBucket(24 * 21)).toBe('a couple weeks ago');
    expect(formatTimeSinceLastTurnBucket(24 * 28 - 0.01)).toBe('a couple weeks ago');
  });

  it('buckets 28–60 days as "last month"', () => {
    expect(formatTimeSinceLastTurnBucket(24 * 28)).toBe('last month');
    expect(formatTimeSinceLastTurnBucket(24 * 45)).toBe('last month');
    expect(formatTimeSinceLastTurnBucket(24 * 60 - 0.01)).toBe('last month');
  });

  it('buckets > 60 days as "months ago"', () => {
    expect(formatTimeSinceLastTurnBucket(24 * 60)).toBe('months ago');
    expect(formatTimeSinceLastTurnBucket(24 * 200)).toBe('months ago');
    expect(formatTimeSinceLastTurnBucket(24 * 365 * 5)).toBe('months ago');
  });
});

describe('deriveContinuitySignals — time-awareness fields', () => {
  const now = new Date('2026-07-04T12:00:00Z');

  function turnAt(iso: string, stage = 1) {
    return { createdAt: new Date(iso), stageAtTurn: stage };
  }

  it('reports null hoursSinceLastTurn and no session-resume when there are no prior turns', () => {
    const r = deriveContinuitySignals(1, [], now);
    expect(r.hoursSinceLastTurn).toBeNull();
    expect(r.isSessionResume).toBe(false);
    expect(r.sessionCount).toBe(0);
  });

  it('computes fractional hours since the most recent turn', () => {
    const r = deriveContinuitySignals(
      1,
      [turnAt('2026-07-04T09:30:00Z')],
      now,
    );
    expect(r.hoursSinceLastTurn).toBeCloseTo(2.5, 5);
  });

  it('sets isSessionResume=false for a gap under the 4-hour boundary', () => {
    const r = deriveContinuitySignals(
      1,
      [turnAt('2026-07-04T10:00:00Z')],
      now,
    );
    expect(r.hoursSinceLastTurn).toBeCloseTo(2, 5);
    expect(r.isSessionResume).toBe(false);
  });

  it('sets isSessionResume=true at exactly the 4-hour boundary', () => {
    const boundaryTurn = new Date(now.getTime() - SESSION_BOUNDARY_MS);
    const r = deriveContinuitySignals(
      1,
      [{ createdAt: boundaryTurn, stageAtTurn: 1 }],
      now,
    );
    expect(r.isSessionResume).toBe(true);
  });

  it('sets isSessionResume=true for a multi-week gap', () => {
    const r = deriveContinuitySignals(
      1,
      [turnAt('2026-06-01T12:00:00Z')],
      now,
    );
    expect(r.hoursSinceLastTurn).toBeCloseTo(24 * 33, 0);
    expect(r.isSessionResume).toBe(true);
  });

  it('uses the most recent turn even when older turns are present out of order', () => {
    const r = deriveContinuitySignals(
      1,
      [
        turnAt('2026-06-01T12:00:00Z'),
        turnAt('2026-07-04T10:30:00Z'), // most recent
        turnAt('2026-07-04T09:00:00Z'),
      ],
      now,
    );
    expect(r.hoursSinceLastTurn).toBeCloseTo(1.5, 5);
    expect(r.isSessionResume).toBe(false);
  });

  it('clamps negative hoursSinceLastTurn to 0 on server-clock skew', () => {
    // Simulate a last-turn timestamp in the future — should not produce
    // a negative reading in the AI prompt.
    const futureTurn = new Date(now.getTime() + 5 * 60 * 1000);
    const r = deriveContinuitySignals(
      1,
      [{ createdAt: futureTurn, stageAtTurn: 1 }],
      now,
    );
    expect(r.hoursSinceLastTurn).toBe(0);
    expect(r.isSessionResume).toBe(false);
  });

  it('preserves all pre-existing continuity fields unchanged', () => {
    const r = deriveContinuitySignals(
      2,
      [
        turnAt('2026-07-01T09:00:00Z', 1),
        turnAt('2026-07-01T09:30:00Z', 1),
        turnAt('2026-07-04T10:00:00Z', 1),
      ],
      now,
    );
    expect(r.sessionCount).toBe(2); // gap of 3 days > 4h boundary
    expect(r.daysEngaged).toBe(2);
    expect(r.thisSessionMessageCount).toBe(1);
    expect(r.stageJustAdvanced).toBe(true); // currentStage 2 > lastTurn.stage 1
  });
});
