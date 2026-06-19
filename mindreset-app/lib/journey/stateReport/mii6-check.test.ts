// Tests for the MII-6 (48-hour settling) wiring fix (audit P0 #1).
//
// Before the fix, the AI was told to emit `mii6Check` after a Deep Layer
// practice, but the field was dropped at every layer — schema, parser,
// save — and the gate at stage-gates.ts mii6Status === 'failed' was
// unreachable. These tests pin the fix:
//
//   1. parseStateReport accepts the four enum values
//   2. parseStateReport rejects invalid values silently
//   3. applyStateReportToProgress writes the correct mii status mapping
//      to state.mii.mii6_noDestabilisation
//   4. No mii6Check in the report = no mii write (no-op idempotent)

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock prisma BEFORE importing the module under test, same pattern as
// linkScreeningToUser.test.ts. We capture the .update call args so the
// tests can assert exactly what shape we persist.
const updates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
const findUniqueImpl = vi.fn();

vi.mock('@/lib/prisma', () => ({
  default: {
    recodeProgress: {
      findUnique: (...args: unknown[]) => findUniqueImpl(...args),
      update: vi.fn((args: { where: unknown; data: Record<string, unknown> }) => {
        updates.push(args);
        return Promise.resolve({});
      }),
    },
    journeyPart: {
      findFirst: vi.fn(() => Promise.resolve(null)),
      create: vi.fn(() => Promise.resolve({})),
      update: vi.fn(() => Promise.resolve({})),
    },
    journeyForeignFile: {
      findFirst: vi.fn(() => Promise.resolve(null)),
      create: vi.fn(() => Promise.resolve({})),
      update: vi.fn(() => Promise.resolve({})),
    },
    journeySignatureImage: {
      findFirst: vi.fn(() => Promise.resolve(null)),
      create: vi.fn(() => Promise.resolve({})),
    },
  },
}));

// Encryption is irrelevant for these tests but the save module imports
// it; stub it to a passthrough so we don't pull a real key dependency.
vi.mock('@/lib/encrypt', () => ({
  encrypt: (s: string) => `enc(${s})`,
  decrypt: (s: string) => s.replace(/^enc\((.*)\)$/, '$1'),
}));

import { parseStateReport } from './parse';
import { applyStateReportToProgress } from '../state/save';

const USER_ID = 'user_test_mii6';

const BASE_REPORT = {
  intensity: 4,
  safetyFlag: 'none' as const,
  recommendedAction: 'stay' as const,
};

beforeEach(() => {
  updates.length = 0;
  findUniqueImpl.mockReset();
  findUniqueImpl.mockResolvedValue({
    anchorTextEncrypted: 'enc(my bench in the garden)',
    mii: {},
  });
});

describe('parseStateReport — mii6Check field acceptance', () => {
  it('accepts "stable"', () => {
    const r = parseStateReport(JSON.stringify({ ...BASE_REPORT, mii6Check: 'stable' }));
    expect(r.mii6Check).toBe('stable');
  });

  it('accepts "destabilised"', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE_REPORT, mii6Check: 'destabilised' }),
    );
    expect(r.mii6Check).toBe('destabilised');
  });

  it('accepts "unsure"', () => {
    const r = parseStateReport(JSON.stringify({ ...BASE_REPORT, mii6Check: 'unsure' }));
    expect(r.mii6Check).toBe('unsure');
  });

  it('accepts "destabilised_then_recovered"', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE_REPORT, mii6Check: 'destabilised_then_recovered' }),
    );
    expect(r.mii6Check).toBe('destabilised_then_recovered');
  });

  it('drops invalid mii6Check values silently (fail-safe)', () => {
    const r = parseStateReport(
      JSON.stringify({ ...BASE_REPORT, mii6Check: 'totally_fine' }),
    );
    expect(r.mii6Check).toBeUndefined();
  });

  it('leaves mii6Check undefined when not present', () => {
    const r = parseStateReport(JSON.stringify(BASE_REPORT));
    expect(r.mii6Check).toBeUndefined();
  });
});

describe('applyStateReportToProgress — mii6_noDestabilisation persistence', () => {
  function lastMiiPatch(): Record<string, unknown> | null {
    const update = updates[updates.length - 1];
    const miiData = update?.data?.mii as Record<string, unknown> | undefined;
    return (miiData?.mii6_noDestabilisation as Record<string, unknown>) ?? null;
  }

  it('writes status:"met" when mii6Check is "stable"', async () => {
    await applyStateReportToProgress(USER_ID, { ...BASE_REPORT, mii6Check: 'stable' });
    expect(lastMiiPatch()?.status).toBe('met');
    expect(lastMiiPatch()?.lastCheckedAt).toEqual(expect.any(String));
  });

  it('writes status:"met" when mii6Check is "destabilised_then_recovered"', async () => {
    await applyStateReportToProgress(USER_ID, {
      ...BASE_REPORT,
      mii6Check: 'destabilised_then_recovered',
    });
    expect(lastMiiPatch()?.status).toBe('met');
  });

  it('writes status:"pending" when mii6Check is "unsure"', async () => {
    await applyStateReportToProgress(USER_ID, { ...BASE_REPORT, mii6Check: 'unsure' });
    expect(lastMiiPatch()?.status).toBe('pending');
  });

  it('writes status:"failed" when mii6Check is "destabilised" (the gate-trip case)', async () => {
    await applyStateReportToProgress(USER_ID, {
      ...BASE_REPORT,
      mii6Check: 'destabilised',
    });
    expect(lastMiiPatch()?.status).toBe('failed');
  });

  it('does not touch mii state when no mii6Check is emitted (idempotent no-op)', async () => {
    findUniqueImpl.mockResolvedValueOnce({
      anchorTextEncrypted: 'enc(x)',
      mii: { mii6_noDestabilisation: { status: 'met', lastCheckedAt: '2026-06-19T00:00:00Z' } },
    });
    await applyStateReportToProgress(USER_ID, BASE_REPORT);
    // mii update key shouldn't be present at all
    const u = updates[updates.length - 1];
    expect(u.data.mii).toBeUndefined();
  });

  it('preserves other mii fields when patching mii6_noDestabilisation', async () => {
    findUniqueImpl.mockResolvedValueOnce({
      anchorTextEncrypted: 'enc(x)',
      mii: {
        mii1_adultSelfStability: { status: 'met' },
        mii4_safeRelationship: { status: 'met', quality: 'compassion' },
      },
    });
    await applyStateReportToProgress(USER_ID, { ...BASE_REPORT, mii6Check: 'stable' });
    const merged = updates[updates.length - 1]?.data?.mii as Record<string, unknown>;
    expect(merged?.mii1_adultSelfStability).toEqual({ status: 'met' });
    expect(merged?.mii4_safeRelationship).toEqual({ status: 'met', quality: 'compassion' });
    expect((merged?.mii6_noDestabilisation as Record<string, unknown>)?.status).toBe('met');
  });
});
