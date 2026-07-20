// Onboarding context block — v2 vocabulary (2026-07-20).
//
// Renders the user's 4-step onboarding answers into a compact system-
// prompt block each product appends to its own prompt. This is the
// read-bridge that makes the answers WORK: the product's first real
// reply opens from what the user already told us — never from a blank
// generic greeting.
//
// Owner's rule (locked): the first AI message must NEVER open with
// "How was your day?" or "How are you feeling today?" — it is generated
// from the user's choices. Style shapes voice only; the stated answers
// are the INITIAL focus, refreshed conversationally as the work moves
// (never re-asked as a questionnaire).
//
// Pure module: build the block from answers. Loading the answers lives
// in lib/platform/profile.ts (getOnboardingAnswers), which also
// translates legacy v1 codes — this module only ever sees v2 codes.

import type { OnboardingAnswers } from './types';

// English display labels for the model's benefit. These deliberately
// mirror messages/en.json `Onboarding.*` — the parity test in
// onboarding-context.test.ts keeps them in lockstep, so the model reads
// exactly what the user tapped.
export const WHY_LABELS: Record<string, string> = {
  anxiety_overwhelm: "Anxiety or overwhelm — my mind won't settle.",
  no_energy_drive: 'No energy, no drive — things feel pointless.',
  far_from_myself: "I feel far away from myself — like I'm losing who I am.",
  emptiness_numbness: 'Emptiness or numbness — like the connection to myself is gone.',
  strong_reactions:
    "Strong reactions I don't fully understand — anger, tears, shutting down.",
  repeating_story: 'The same painful story keeps happening in my life again.',
  weighing_decision: "A decision or situation that's weighing on me.",
  understand_myself: 'Nothing acute — I simply want to understand myself better.',
};

export const AREA_LABELS: Record<string, string> = {
  money: 'Money',
  family_parents: 'Family and parents',
  love_relationships: 'Love and relationships',
  body_intimacy: 'My body, intimacy, sexuality',
  self_worth_shame: 'How I see and treat myself — worth, shame, guilt',
  work_purpose: 'Work, purpose, direction',
  several_areas: 'Several areas at once',
  whole_life_identity: "It's not one area — it's my whole life, who I am",
};

export const GOAL_LABELS: Record<string, string> = {
  relief_now: "Support and relief right now — help me steady what I'm feeling.",
  talk_through: 'To talk things through and see more clearly.',
  focused_work: 'To properly work on one specific area — understand it and change it.',
  transformation:
    'Deep work on myself — reach the roots and change the pattern of my life; not quickly, but for real.',
  not_sure: "I'm not sure yet — help me find out.",
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
    lines.push(`- What's most present for them right now: "${WHY_LABELS[answers.why]}"`);
  }
  if (answers.area && AREA_LABELS[answers.area]) {
    lines.push(`- Where it shows up most: ${AREA_LABELS[answers.area]}`);
  }
  if (answers.goal && GOAL_LABELS[answers.goal]) {
    lines.push(`- The kind of work they're looking for: "${GOAL_LABELS[answers.goal]}"`);
  }
  if (answers.style && STYLE_GUIDANCE[answers.style]) {
    lines.push(`- ${STYLE_GUIDANCE[answers.style]}`);
  }
  if (lines.length === 0) return '';

  return [
    '## What this person told us when they joined (their own choices, before any conversation)',
    '',
    ...lines,
    '',
    'Use this to open well. If the conversation is just beginning — or their first message is a bare greeting — do NOT open generically: never "How was your day?", never "How are you feeling today?". Open from what they already told us, with one specific, inviting question shaped by their chosen style. Treat their stated answers as the INITIAL focus only: let today\'s conversation refresh it naturally, and never re-ask these questions as a questionnaire. If what they bring today differs from these answers, today wins.',
  ].join('\n');
}
