// Platform profile types — Step 1 (2026-07-20).
//
// The 4-step account-page onboarding stores button CODES (display copy
// lives in the i18n bundles). Code vocabularies are the owner's canonical
// lists from docs/platform/plan-2026-07-20-step1-platform-profile.md.
// Unknown codes are rejected at the write path (profile.ts), never
// silently stored.

export const ONBOARDING_WHY = [
  'lost_myself',
  'repeating_patterns',
  'dont_know_what_i_want',
  'difficult_decision',
  'relationships_not_working',
  'understand_reactions',
  'stuck',
  'curious',
] as const;
export type OnboardingWhy = (typeof ONBOARDING_WHY)[number];

export const ONBOARDING_AREA = [
  'relationships',
  'career_purpose',
  'confidence_worth',
  'family',
  'money',
  'boundaries_pleasing',
  'emotional_reactions',
  'several_areas',
] as const;
export type OnboardingArea = (typeof ONBOARDING_AREA)[number];

export const ONBOARDING_STYLE = [
  'direct_practical',
  'reflective_exploratory',
  'guide_me',
] as const;
export type OnboardingStyle = (typeof ONBOARDING_STYLE)[number];

export const ONBOARDING_GOAL = [
  'whats_holding_me_back',
  'decision_clarity',
  'why_repeating_patterns',
  'mine_vs_expected',
  'feel_like_myself',
  'understand_reactions',
  'what_no_longer_fits',
  'not_sure',
] as const;
export type OnboardingGoal = (typeof ONBOARDING_GOAL)[number];

// Partial by design: step 2's UI may save per step. onboardingCompletedAt
// is stamped by the write path once all four answers are present.
export type OnboardingAnswers = {
  why?: OnboardingWhy;
  area?: OnboardingArea;
  style?: OnboardingStyle;
  goal?: OnboardingGoal;
};

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
