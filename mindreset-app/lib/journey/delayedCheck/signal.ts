// Soft 48-hour settling-time signal.
//
// Per the revised Stage 4 and Stage 5 specs, the 48-hour window is NOT a
// hard lockout — the user is never blocked from returning early. It is a
// guideline for the AI to be gentler in the 1–2 sessions after Deep Layer
// contact, and the AI runs a soft check-in ("How have things been since we
// last sat together?") at the start of the next session.
//
// This module computes the signal. The state-block in lib/journey/prompts/
// assemble.ts surfaces the answer to the AI on every turn, and the AI's
// behaviour follows its stage spec accordingly.

import type { JourneyState } from '../state/types';

const HOUR_MS = 60 * 60 * 1000;

export type SettlingSignal = {
  // Hours since the last Deep Layer contact, or null if there hasn't been one.
  hoursSinceLastDeepContact: number | null;
  // True if a Deep Layer contact happened in the last 72 hours. Cue for the AI
  // to be gentler this turn.
  withinSettlingWindow: boolean;
  // True if more than 4 hours have passed since the previous activity AND
  // a Deep Layer contact happened recently — cue for the AI to run the
  // soft check-in question at the start of this turn.
  shouldRunCheckIn: boolean;
};

const SETTLING_WINDOW_HOURS = 72;
const SESSION_BREAK_THRESHOLD_HOURS = 4;

export function computeSettlingSignal(state: JourneyState): SettlingSignal {
  const now = Date.now();
  const hoursSinceLastDeep = state.lastDeepLayerContactAt
    ? (now - state.lastDeepLayerContactAt.getTime()) / HOUR_MS
    : null;
  const hoursSinceLastActivity = state.lastActivityAt
    ? (now - state.lastActivityAt.getTime()) / HOUR_MS
    : Infinity;

  const withinSettlingWindow =
    hoursSinceLastDeep != null && hoursSinceLastDeep <= SETTLING_WINDOW_HOURS;

  const shouldRunCheckIn =
    withinSettlingWindow && hoursSinceLastActivity >= SESSION_BREAK_THRESHOLD_HOURS;

  return {
    hoursSinceLastDeepContact: hoursSinceLastDeep,
    withinSettlingWindow,
    shouldRunCheckIn,
  };
}

/**
 * Render a brief instruction the prompt assembler can drop into the state
 * block to cue the AI's behaviour. Returns null when no signal is active
 * (no Deep Layer contact has happened, or it was long ago).
 */
export function renderSettlingSignalInstruction(state: JourneyState): string | null {
  const s = computeSettlingSignal(state);
  if (!s.withinSettlingWindow) return null;
  const hrs = Math.round(s.hoursSinceLastDeepContact ?? 0);
  const lines: string[] = [];
  lines.push(`**Settling-time signal:** the user's most recent Deep Layer contact was ${hrs} hours ago.`);
  lines.push('Be gentler this turn. No new Deep Layer work in this session. Lighter touch generally.');
  if (s.shouldRunCheckIn) {
    lines.push('At the start of this turn, run the soft check-in as your first move: *"How have things been since we last sat together?"* (in your own words, in the user\'s language). Capture their answer in the state report\'s `mii6Check` field as `stable`, `destabilised`, or `unsure`. If `destabilised` or `unsure`, stay at Surface or Middle Layer for the rest of this session and tend to whatever surfaced.');
  }
  return lines.join('\n');
}
