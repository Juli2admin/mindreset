// Onboarding context block — Step 3 (2026-07-20).
//
// Renders the user's 4-step onboarding answers into a compact system-
// prompt block each product appends to its own prompt. This is the
// read-bridge that makes the answers WORK: the product's first real
// reply opens from what the user already told us — never from a blank
// generic greeting.
//
// Owner's rule (locked): the first AI message must NEVER open with
// "How was your day?" or "How are you feeling today?" — it is generated
// from the user's choices. Style shapes voice only; the goal is the
// INITIAL focus, refreshed conversationally as the work moves (never
// re-asked as a questionnaire).
//
// Pure module: build the block from answers. Loading the answers lives
// in lib/platform/profile.ts (getOnboardingAnswers).

import type { OnboardingAnswers } from './types';

// English display labels for the model's benefit. These deliberately
// mirror messages/en.json `Onboarding.*` — the parity test in
// onboarding-context.test.ts keeps them in lockstep, so the model reads
// exactly what the user tapped.
export const WHY_LABELS: Record<string, string> = {
  lost_myself: "I feel like I've lost myself.",
  repeating_patterns: 'I keep repeating the same patterns in my life.',
  dont_know_what_i_want: "I don't know what I really want anymore.",
  difficult_decision: 'I am facing a difficult decision.',
  relationships_not_working: 'Something is not working in my relationships.',
  understand_reactions: 'I want to understand why I react the way I do.',
  stuck: 'I feel stuck in my life.',
  curious: "I'm simply curious about understanding myself.",
};

export const AREA_LABELS: Record<string, string> = {
  relationships: 'Relationships',
  career_purpose: 'Career and purpose',
  confidence_worth: 'Confidence and self-worth',
  family: 'Family',
  money: 'Money',
  boundaries_pleasing: 'Boundaries and people-pleasing',
  emotional_reactions: 'Emotional reactions',
  several_areas: 'Several areas at once',
};

export const GOAL_LABELS: Record<string, string> = {
  whats_holding_me_back: 'I want to understand what is really holding me back.',
  decision_clarity: 'I want clarity about an important decision.',
  why_repeating_patterns: 'I want to understand why I keep repeating the same patterns.',
  mine_vs_expected: 'I want to separate what I want from what others expect of me.',
  feel_like_myself: 'I want to feel more like myself.',
  understand_reactions: 'I want to understand my emotional reactions.',
  what_no_longer_fits: 'I want to understand what no longer fits my life.',
  not_sure: "I'm not sure yet.",
};

const STYLE_GUIDANCE: Record<string, string> = {
  direct_practical:
    'They asked to begin direct & practical: clear, concrete questions; no long preambles.',
  reflective_exploratory:
    'They asked to begin reflective & exploratory: give room to explore thoughts, feelings and experiences in depth.',
  guide_me:
    'They asked to be guided: they are not sure where to begin — take the lead gently, one clear step at a time.',
};

/**
 * Build the onboarding context block, or '' when the user answered
 * nothing (skipped onboarding entirely). Partial answers render partial
 * blocks — whatever the user gave, the product uses.
 */
export function buildOnboardingContextBlock(
  answers: OnboardingAnswers | null,
): string {
  if (!answers) return '';
  const lines: string[] = [];
  if (answers.why && WHY_LABELS[answers.why]) {
    lines.push(`- What brought them here: "${WHY_LABELS[answers.why]}"`);
  }
  if (answers.area && AREA_LABELS[answers.area]) {
    lines.push(`- Where it shows up most: ${AREA_LABELS[answers.area]}`);
  }
  if (answers.style && STYLE_GUIDANCE[answers.style]) {
    lines.push(`- ${STYLE_GUIDANCE[answers.style]}`);
  }
  if (answers.goal && GOAL_LABELS[answers.goal]) {
    lines.push(`- What would make this worthwhile: "${GOAL_LABELS[answers.goal]}"`);
  }
  if (lines.length === 0) return '';

  return [
    '## What this person told us when they joined (their own choices, before any conversation)',
    '',
    ...lines,
    '',
    'Use this to open well. If the conversation is just beginning — or their first message is a bare greeting — do NOT open generically: never "How was your day?", never "How are you feeling today?". Open from what they already told us, with one specific, inviting question shaped by their chosen style. Treat their stated goal as the INITIAL focus only: let today\'s conversation refresh it naturally, and never re-ask these questions as a questionnaire. If what they bring today differs from these answers, today wins.',
  ].join('\n');
}
