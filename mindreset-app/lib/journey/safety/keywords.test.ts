// Tests for the synchronous keyword scan. Primary focus: the "I don't want to
// live" pattern must catch real suicidality without misclassifying domestic-
// abuse disclosures ("I don't want to live with him") as crisis. That specific
// false positive was observed in a live session (2026-07-01) and instantly
// froze a user who was doing correct Block-2 anger work about her marriage.
// The design principle (keywords.ts:2) is "conservative pattern set: false
// positives acceptable, false negatives are not" — but a false positive that
// re-victimises an abuse survivor is not an acceptable false positive.
// Ambiguous phrasing falls through to the async verifier, whose SYSTEM_PROMPT
// (verifier.ts:78-83) is tuned for exactly this case.

import { describe, it, expect } from 'vitest';
import { scanForJourneyRedFlag } from './keywords';

describe('scanForJourneyRedFlag — "I don\'t want to live" (suicidal)', () => {
  it('MATCHES the bare phrase (end of message)', () => {
    expect(scanForJourneyRedFlag("I don't want to live").matched).toBe(true);
  });

  it('MATCHES with sentence punctuation', () => {
    expect(scanForJourneyRedFlag("I don't want to live.").matched).toBe(true);
    expect(scanForJourneyRedFlag("I don't want to live!").matched).toBe(true);
    expect(scanForJourneyRedFlag("I don't want to live, please help").matched).toBe(true);
    expect(scanForJourneyRedFlag("I don't want to live; there is no point").matched).toBe(true);
  });

  it('MATCHES with intensifiers (anymore / any more / any longer)', () => {
    expect(scanForJourneyRedFlag("I don't want to live anymore").matched).toBe(true);
    expect(scanForJourneyRedFlag("I don't want to live any more").matched).toBe(true);
    expect(scanForJourneyRedFlag("I don't want to live any longer.").matched).toBe(true);
  });

  it('MATCHES tolerant of apostrophe / spelling variants', () => {
    expect(scanForJourneyRedFlag("i dont want to live.").matched).toBe(true);
    expect(scanForJourneyRedFlag('I do not want to live.').matched).toBe(true);
    // Curly / backtick apostrophe variants are NOT matched by design (ASCII
    // only); these fall through to the async verifier same as any other
    // borderline phrasing. Documented here so a future contributor doesn't
    // "fix" the regex thinking it's a gap.
  });

  it('MATCHES when phrase is mid-message but terminated by punctuation', () => {
    expect(
      scanForJourneyRedFlag("I told him: I don't want to live. He didn't care.").matched,
    ).toBe(true);
  });

  it('classifies as "suicidal" red-flag type', () => {
    const hit = scanForJourneyRedFlag("I don't want to live.");
    expect(hit.matched).toBe(true);
    expect(hit.flagType).toBe('suicidal');
  });
});

describe('scanForJourneyRedFlag — "I don\'t want to live WITH" (abuse disclosure, NOT crisis)', () => {
  // The live-session case that motivated this fix. The user was disclosing an
  // abusive marriage; the previous `\b` word boundary matched "with" as a
  // separator and the pattern fired as suicidal.
  it('does NOT match "I don\'t want to live with him"', () => {
    expect(scanForJourneyRedFlag("I don't want to live with him").matched).toBe(false);
  });

  it('does NOT match "I don\'t want to live with him." (with punctuation)', () => {
    expect(scanForJourneyRedFlag("I don't want to live with him.").matched).toBe(false);
  });

  it('does NOT match "I don\'t want to live with him anymore"', () => {
    // "anymore" here modifies "live with him", not "live" — this is life-
    // circumstance disclosure, not suicidality. The verifier handles nuance.
    expect(
      scanForJourneyRedFlag("I don't want to live with him anymore").matched,
    ).toBe(false);
  });

  it('does NOT match other cohabitation / location disclosures', () => {
    expect(scanForJourneyRedFlag("I don't want to live with her").matched).toBe(false);
    expect(scanForJourneyRedFlag("I don't want to live with my mother").matched).toBe(false);
    expect(scanForJourneyRedFlag("I don't want to live in this house").matched).toBe(false);
    expect(scanForJourneyRedFlag("I don't want to live in this country").matched).toBe(false);
    expect(scanForJourneyRedFlag("I don't want to live like this").matched).toBe(false);
    expect(scanForJourneyRedFlag("I don't want to live here").matched).toBe(false);
    expect(scanForJourneyRedFlag("I don't want to live near him").matched).toBe(false);
    expect(scanForJourneyRedFlag("I don't want to live under his roof").matched).toBe(false);
  });
});

describe('scanForJourneyRedFlag — the sibling patterns still work', () => {
  // Confidence check: the neighbouring suicidal patterns on lines 43, 45–48 of
  // the source are unaffected by this change.
  it('still matches "I want to die"', () => {
    expect(scanForJourneyRedFlag("I want to die.").matched).toBe(true);
  });

  it('still matches "kill myself"', () => {
    expect(scanForJourneyRedFlag("I'm going to kill myself tonight").matched).toBe(true);
  });

  it('still matches "everyone would be better off without me"', () => {
    expect(scanForJourneyRedFlag("everyone would be better off without me").matched).toBe(true);
  });

  it('still returns no-match for normal Journey content', () => {
    expect(scanForJourneyRedFlag("I feel exhausted with all of this").matched).toBe(false);
    expect(scanForJourneyRedFlag("It has been like this for fifteen years").matched).toBe(false);
    expect(scanForJourneyRedFlag("I hate my husband").matched).toBe(false);
  });
});
