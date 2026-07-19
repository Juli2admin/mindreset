// Journey P2 regression guard — closure discipline (2026-07-19).
//
// The clinical rule under pin: a session or an active process closes on
// GENUINE completion — settled body, resolved activation, the user's own
// confirmation — never on surface markers (release language, a named
// emotion, a calmer tone, a completed practice). The master prompt carries:
//
//   1. The stabilising-before-closing 1-10 protocol with the sub-6
//      threshold (a user below 6 is not closed on vague reassurance).
//   2. Hard rule 6's do-not-end conditions, including the unaddressed /
//      unparked user request.
//   3. Hard rule 7's containment fallback — deep material that cannot
//      complete this session is contained or given an explicit safe
//      stopping point, never just dropped.
//   4. Hard rule 8's silent closure check (8 internal questions), the
//      do-not-close-merely-because list, and the no-forced-positive-
//      endings instruction.
//
// All assertions run against loadMasterJourneyPrompt() — the RUNTIME
// loader output, post fence-extraction — so a regression in either the
// document or the loader (see loader-fence-extraction.test.ts for the
// 6,101-char truncation this repo has already shipped once) fails here.

import { describe, expect, it } from 'vitest';
import { loadMasterJourneyPrompt } from './load-spec';

const master = loadMasterJourneyPrompt() ?? '';

describe('master prompt — stabilising-before-closing threshold (sub-6)', () => {
  it('pins the 1-10 protocol threshold: 6 or above permits close', () => {
    expect(master).toContain('If the user answers **6 or above** → close is permitted');
  });

  it('pins the sub-6 block in the do-not-end conditions', () => {
    expect(master).toContain('`stabilityCheck.score < 6` (see Stabilising-before-closing protocol)');
  });
});

describe('master prompt — hard rule 6 do-not-end conditions', () => {
  it('includes the unaddressed / unparked request condition', () => {
    expect(master).toContain(
      'The request the user brought has been neither addressed nor explicitly parked with the user',
    );
  });

  it('still includes the unfinished-work condition', () => {
    expect(master).toContain('The user has said the work is unfinished');
  });
});

describe('master prompt — hard rule 7 containment fallback', () => {
  it('requires containment or an explicit safe stopping point when completion is unreachable', () => {
    expect(master).toContain(
      'CONTAIN the material or establish an explicit safe stopping point with the user — never just stop',
    );
  });
});

describe('master prompt — hard rule 8 silent closure check', () => {
  it('has the closure check rule, framed as silent/internal', () => {
    expect(master).toContain('**The closure check — run silently before any close.**');
    expect(master).toContain('You do not ask these aloud.');
  });

  it('carries all 8 internal questions', () => {
    const idx = master.indexOf('**The closure check — run silently before any close.**');
    expect(idx).toBeGreaterThan(-1);
    const block = master.slice(idx, idx + 2200);
    expect(block).toContain('Has the request the user brought been addressed?');
    expect(block).toContain("Has the current focus of today's work been addressed?");
    expect(block).toContain('Did the intervention help, not help, or remain unclear?');
    expect(block).toContain("Has the user's state changed since the session opened?");
    expect(block).toContain('Is any emotional or parts-related activation unresolved?');
    expect(block).toContain('Is containment needed?');
    expect(block).toContain('Has a new important question emerged that should be named before stopping?');
    expect(block).toContain('Is this stopping point clinically coherent?');
  });

  it('carries the do-not-close-merely-because list (surface markers are not completion)', () => {
    const idx = master.indexOf('**Do NOT close merely because**');
    expect(idx).toBeGreaterThan(-1);
    const block = master.slice(idx, idx + 700);
    expect(block).toContain('release language appeared');
    expect(block).toContain('an emotion was named');
    expect(block).toContain('a practice completed');
    expect(block).toContain("the user's tone became calmer");
    expect(block).toContain('None of these alone means the work is done');
  });

  it('permits honest open endings — no forced positive close', () => {
    expect(master).toContain(
      'an honest open ending with a safe stopping point is better clinical work than a manufactured close',
    );
  });

  it('instructs reconnecting or parking an unreached request WITH the user', () => {
    expect(master).toContain('say so plainly and reconnect or park it WITH the user');
  });
});
