// Platform profile types — onboarding v2 (2026-07-20, owner-approved
// typing questionnaire).
//
// The 4-step account-page onboarding stores button CODES (display copy
// lives in the i18n bundles). v2 measures one dimension per step:
//   Step 1 (why column)  — what's most present right now (state)
//   Step 2 (area column) — where it shows up (area + breadth)
//   Step 3 (goal column) — what kind of work they seek (the TYPE decider)
//   Step 4 (style)       — how to talk (voice only, unchanged from v1)
// Unknown codes are rejected at the write path (profile.ts), never
// silently stored. Legacy v1 codes stored before 2026-07-20 are
// translated at READ time by normalizeOnboardingAnswers below.

export const ONBOARDING_WHY = [
  'anxiety_overwhelm',
  'no_energy_drive',
  'far_from_myself',
  'emptiness_numbness',
  'strong_reactions',
  'repeating_story',
  'weighing_decision',
  'understand_myself',
] as const;
export type OnboardingWhy = (typeof ONBOARDING_WHY)[number];

export const ONBOARDING_AREA = [
  'money',
  'family_parents',
  'love_relationships',
  'body_intimacy',
  'self_worth_shame',
  'work_purpose',
  'several_areas',
  'whole_life_identity',
] as const;
export type OnboardingArea = (typeof ONBOARDING_AREA)[number];

export const ONBOARDING_STYLE = [
  'direct_practical',
  'reflective_exploratory',
  'guide_me',
] as const;
export type OnboardingStyle = (typeof ONBOARDING_STYLE)[number];

export const ONBOARDING_GOAL = [
  'relief_now',
  'talk_through',
  'focused_work',
  'transformation',
  'not_sure',
] as const;
export type OnboardingGoal = (typeof ONBOARDING_GOAL)[number];

// Partial by design: the UI saves per step. onboardingCompletedAt is
// stamped by the write path once all four answers are present.
export type OnboardingAnswers = {
  why?: OnboardingWhy;
  area?: OnboardingArea;
  style?: OnboardingStyle;
  goal?: OnboardingGoal;
};

// ---------------------------------------------------------------------------
// Legacy v1 codes → v2 (read-time translation)
// ---------------------------------------------------------------------------
// Users who onboarded before v2 have v1 codes stored. Conservative,
// honest translations only:
//   - v1 answers that carry the same meaning map across;
//   - v1 answers with no honest v2 equivalent are DROPPED (the field
//     reads as unanswered) rather than guessed — the user can update via
//     "Change your answers";
//   - all v1 goal codes map to 'talk_through' (except not_sure): v1 never
//     asked about depth, so legacy users become Companion users. The
//     Journey is never inferred for someone who was never asked.

const LEGACY_MAP: Record<'why' | 'area' | 'goal', Record<string, string>> = {
  why: {
    lost_myself: 'far_from_myself',
    repeating_patterns: 'repeating_story',
    dont_know_what_i_want: 'understand_myself',
    difficult_decision: 'weighing_decision',
    understand_reactions: 'strong_reactions',
    stuck: 'no_energy_drive',
    curious: 'understand_myself',
    // relationships_not_working: no honest v2 equivalent → dropped
  },
  area: {
    relationships: 'love_relationships',
    career_purpose: 'work_purpose',
    confidence_worth: 'self_worth_shame',
    family: 'family_parents',
    // money / several_areas: unchanged codes, valid in v2
    // boundaries_pleasing, emotional_reactions: no v2 equivalent → dropped
  },
  goal: {
    whats_holding_me_back: 'talk_through',
    decision_clarity: 'talk_through',
    why_repeating_patterns: 'talk_through',
    mine_vs_expected: 'talk_through',
    feel_like_myself: 'talk_through',
    understand_reactions: 'talk_through',
    what_no_longer_fits: 'talk_through',
    // not_sure: unchanged code, valid in v2
  },
};

function normalizeCode(
  field: 'why' | 'area' | 'goal',
  vocabulary: readonly string[],
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  if (vocabulary.includes(value)) return value;
  return LEGACY_MAP[field][value] ?? null;
}

/**
 * Translate possibly-legacy stored codes to the v2 vocabulary. Applied at
 * every READ path (profile projections) so the engine, the context block,
 * the dashboard and the onboarding preselect all see v2 codes only.
 * Style codes are unchanged between versions and pass through when valid.
 */
export function normalizeOnboardingAnswers(raw: {
  why?: string | null;
  area?: string | null;
  style?: string | null;
  goal?: string | null;
}): {
  why: OnboardingWhy | null;
  area: OnboardingArea | null;
  style: OnboardingStyle | null;
  goal: OnboardingGoal | null;
} {
  return {
    why: normalizeCode('why', ONBOARDING_WHY, raw.why) as OnboardingWhy | null,
    area: normalizeCode('area', ONBOARDING_AREA, raw.area) as OnboardingArea | null,
    style:
      raw.style && (ONBOARDING_STYLE as readonly string[]).includes(raw.style)
        ? (raw.style as OnboardingStyle)
        : null,
    goal: normalizeCode('goal', ONBOARDING_GOAL, raw.goal) as OnboardingGoal | null,
  };
}

export const RECOMMENDATION_SOURCES = ['platform_rule', 'minimind', 'journey'] as const;
export type RecommendationSource = (typeof RECOMMENDATION_SOURCES)[number];

export const RECOMMENDATION_RESPONSES = ['accepted', 'declined', 'ignored'] as const;
export type RecommendationResponse = (typeof RECOMMENDATION_RESPONSES)[number];

// Derived — computed from Purchase / RecodeProgress / tier fields, never
// duplicated as columns (single source of truth stays with those tables).
export type ActiveProducts = {
  minimindTier: string | null; // 'free' | 'essential' | 'extended' | null
  journey: { purchased: boolean; started: boolean; discharged: boolean };
  states: ModuleAccess[];
  themes: ModuleAccess[];
};

export type ModuleAccess = {
  moduleId: string;
  accessExpiresAt: Date | null;
  active: boolean; // accessExpiresAt in the future (or null = untimed)
};

export type UserFacingRecommendation = {
  id: string;
  product: string;
  // Rule recommendations carry a ruleKey — the dashboard localises the
  // reason from it. AI-sourced recommendations may carry decrypted
  // reason text instead; display precedence: reason ?? t(reason_<ruleKey>).
  ruleKey: string | null;
  reason: string | null; // decrypted; may quote the user's own words
  createdAt: Date;
};

// =============================================================================
// USER-FACING PROJECTION — the ONLY platform-profile shape a dashboard may
// render. Hidden diagnostics (states, themes, risk markers, attachment,
// regulation capacity, engine notes, channel) are structurally absent from
// this type: adding one is a deliberate act, not an accident, and the
// field-list test in profile.test.ts pins it.
// =============================================================================
export type UserFacingProfile = {
  onboarding: {
    why: OnboardingWhy | null;
    area: OnboardingArea | null;
    style: OnboardingStyle | null;
    goal: OnboardingGoal | null;
    completedAt: Date | null;
    skippedAt: Date | null;
  };
  activeRecommendations: UserFacingRecommendation[];
  products: ActiveProducts;
};
