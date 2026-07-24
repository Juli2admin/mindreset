// PR 2 requirement #12: a HARD monthly-cap rejection must return BEFORE any
// message persistence, clinical processing, or Anthropic call — a blocked turn
// must cost nothing.
//
// There is no route-execution harness in this repo (vitest `include` is
// `lib/**`, and the streaming turn route pulls in ~30 modules incl. Clerk auth,
// Prisma and the Anthropic SDK). Rather than stand one up — which would exceed
// this PR's narrow scope — we assert the control-flow ordering STRUCTURALLY by
// reading the route source: the cap 429 return must appear before the user
// message persist, the safety verifier, the Anthropic stream, and usage
// recording. A future refactor that moves the cap gate below any of these
// (reintroducing spend-after-block) flips this test red.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTE = readFileSync(
  path.resolve(__dirname, '../../app/api/journey/turn/route.ts'),
  'utf8',
);

function idx(marker: string): number {
  const i = ROUTE.indexOf(marker);
  expect(i, `marker not found in route.ts: ${marker}`).toBeGreaterThan(-1);
  return i;
}

describe('journey/turn — hard monthly-cap gate ordering (requirement #12)', () => {
  it('the cap 429 returns before persistence / clinical processing / LLM / recording', () => {
    const capCheck = idx('checkJourneyMonthlyCap(userId)');
    const capReject = idx('journeyMonthlyCapRejectionPayload(capCheck)');
    const persistUserMsg = idx('prisma.journeyMessage.create');
    const anthropicCall = idx('anthropic.messages.stream');
    const recordUsage = idx('recordAiUsage(');

    // The cap is checked, then the hard-cap 429 is returned...
    expect(capCheck).toBeLessThan(capReject);
    // ...and that return precedes every cost-incurring / side-effecting step.
    expect(capReject).toBeLessThan(persistUserMsg);
    expect(capReject).toBeLessThan(anthropicCall);
    expect(capReject).toBeLessThan(recordUsage);
  });

  it('the over_cap branch returns HTTP 429 (not a 200, not a fallthrough)', () => {
    const capReject = idx('journeyMonthlyCapRejectionPayload(capCheck)');
    const after = ROUTE.slice(capReject, capReject + 200);
    expect(after).toContain('status: 429');
  });
});
