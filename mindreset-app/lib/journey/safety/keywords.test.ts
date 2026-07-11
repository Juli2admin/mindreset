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

describe('scanForJourneyRedFlag — "I don\'t want to be here" (suicidal, same fix shape)', () => {
  // Sibling of the line-44 bug. The old pattern `\bi\s+...\s+want\s+to\s+be\s+(here|alive)\b`
  // matched "I don't want to be here with him" as suicidal. Same narrowing
  // applied to the "here" branch; "alive" stays as-is (unambiguous).

  it('MATCHES the bare phrase (end of message)', () => {
    expect(scanForJourneyRedFlag("I don't want to be here").matched).toBe(true);
  });

  it('MATCHES with punctuation / intensifiers', () => {
    expect(scanForJourneyRedFlag("I don't want to be here.").matched).toBe(true);
    expect(scanForJourneyRedFlag("I don't want to be here anymore").matched).toBe(true);
    expect(scanForJourneyRedFlag("I don't want to be here any longer.").matched).toBe(true);
  });

  it('classifies as "suicidal" red-flag type', () => {
    const hit = scanForJourneyRedFlag("I don't want to be here.");
    expect(hit.matched).toBe(true);
    expect(hit.flagType).toBe('suicidal');
  });

  it('does NOT match "I don\'t want to be here WITH him" (abuse / life-circumstance)', () => {
    expect(scanForJourneyRedFlag("I don't want to be here with him").matched).toBe(false);
    expect(scanForJourneyRedFlag("I don't want to be here with him.").matched).toBe(false);
    expect(scanForJourneyRedFlag("I don't want to be here with my mother").matched).toBe(false);
    expect(scanForJourneyRedFlag("I don't want to be here in this house").matched).toBe(false);
    expect(scanForJourneyRedFlag("I don't want to be here around them").matched).toBe(false);
  });

  it('still matches "I don\'t want to be alive" (unambiguous, kept as-is)', () => {
    expect(scanForJourneyRedFlag("I don't want to be alive").matched).toBe(true);
    expect(scanForJourneyRedFlag("I don't want to be alive anymore").matched).toBe(true);
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

describe('scanForJourneyRedFlag — "I can\'t breathe" (2026-07-11 false-positive fix)', () => {
  // Live-session case: user was doing a foreign-material release (dark stone /
  // meteorite image) and after the release described the somatic residue —
  // "kind of my chest gone down and squeezed my lungs. I can't breathe. I
  // feel heavy to breathe. Difficult." — as normal post-release body-report.
  // The old bare pattern `\bi\s+(am\s+)?(can'?t|cannot)\s+breathe\b` matched
  // and froze the user mid-integration. The tightened pattern now requires
  // co-occurring emergency signalling; bare somatic body-report falls
  // through to the async verifier, whose SYSTEM_PROMPT explicitly
  // classifies post-release "can't breathe" as clear_safe.

  it('does NOT match Julia\'s live conversation somatic residue message', () => {
    // The exact message that fired the freeze in the 2026-07-11 session.
    const msg =
      "It's still heavy because kind of my chest gone down and squeezed my lungs. I can't breathe. I feel heavy to breathe. Difficult.";
    expect(scanForJourneyRedFlag(msg).matched).toBe(false);
  });

  it("does NOT match bare 'I can't breathe' as post-release body-report", () => {
    expect(scanForJourneyRedFlag("I can't breathe").matched).toBe(false);
    expect(scanForJourneyRedFlag("I cannot breathe").matched).toBe(false);
    expect(scanForJourneyRedFlag('i can\'t breathe').matched).toBe(false);
    expect(scanForJourneyRedFlag("I can't breathe properly").matched).toBe(false);
  });

  it("does NOT match somatic body-locating replies containing 'can't breathe'", () => {
    // Common Journey-work replies where the user is describing what they
    // notice when the AI asks about a body sensation.
    expect(
      scanForJourneyRedFlag("Heavy on my chest. I can't breathe deeply.")
        .matched,
    ).toBe(false);
    expect(
      scanForJourneyRedFlag(
        "The image is pressing down. I can't breathe. It's like a stone on my chest.",
      ).matched,
    ).toBe(false);
    expect(
      scanForJourneyRedFlag(
        "There's a hole in my chest and I can't breathe well",
      ).matched,
    ).toBe(false);
  });

  it("MATCHES real panic emergencies (co-occurring help-signalling)", () => {
    // The tightened pattern still catches genuine acute distress where the
    // user is signalling an emergency they cannot manage.
    expect(scanForJourneyRedFlag("Help me I can't breathe").matched).toBe(true);
    expect(scanForJourneyRedFlag("I can't breathe, call someone").matched).toBe(true);
    expect(scanForJourneyRedFlag("I can't breathe, call 999").matched).toBe(true);
    expect(scanForJourneyRedFlag("I can't breathe, call 911").matched).toBe(true);
    expect(
      scanForJourneyRedFlag("I can't breathe I think I'm passing out").matched,
    ).toBe(true);
    expect(
      scanForJourneyRedFlag("I can't breathe I'm dying help").matched,
    ).toBe(true);
    expect(
      scanForJourneyRedFlag("Emergency — I can't breathe").matched,
    ).toBe(true);
  });

  it("classifies real panic emergencies as 'panic_severe' red-flag type", () => {
    const hit = scanForJourneyRedFlag("Help me I can't breathe");
    expect(hit.matched).toBe(true);
    expect(hit.flagType).toBe('panic_severe');
  });

  it('still matches other unambiguous panic patterns (heart attack / dying)', () => {
    // Confidence check: the other PANIC_SEVERE_PATTERNS entries are
    // unchanged by this fix.
    expect(scanForJourneyRedFlag("I think I'm having a heart attack").matched).toBe(true);
    expect(scanForJourneyRedFlag("I am dying right now").matched).toBe(true);
  });
});
