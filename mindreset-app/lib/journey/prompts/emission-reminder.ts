// Journey state-report emission reminder (2026-07-19).
//
// Root cause (diagnosed from AiUsage telemetry, session 2026-07-19
// 20:10–20:36 UTC; same pattern first logged 2026-07-11 across five test
// sessions — see the PR κ diagnostic in app/api/journey/turn/route.ts):
// the state report is stripped from every assistant message before
// persistence, so the conversation history the model sees contains only
// clean human replies. A few turns into a session, the model's own
// history ("none of my replies here include a report") outweighs the
// emission instruction sitting in the ~76k-token cached system prompt,
// and it stops emitting the <state-report> block entirely — output drops
// to reply-only (42–160 tokens observed vs 444–789 on healthy turns).
// Once it lapses, the near-identical context keeps it lapsed for the
// rest of the session.
//
// Fix: append a short platform note to the LAST user message at
// API-call time only. Recency beats history pressure. The note is never
// persisted (the user's message is stored before history assembly) and
// never shown to anyone — it exists only inside the outbound API call.
//
// This is emission mechanics, not clinical behaviour: it repairs the
// reporting channel and says nothing about how the clinician works.

export const STATE_REPORT_REMINDER =
  '<system-note>Reminder from the platform, not the user: after your reply text, emit the full <state-report> JSON block as always — REQUIRED every turn (intensity, safetyFlag, recommendedAction, channel, clinicalRead, moveJustPerformed, plus whatever else applies this turn). The user never sees the report. Do not reference this note in your reply.</system-note>';

export type SimpleMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Append the emission reminder to the final user message of an outbound
 * message array. Pure — returns a new array; never mutates the input.
 * If the last message is not a user turn (defensive; the turn route
 * always ends on the just-persisted user message), returns the input
 * unchanged rather than corrupting an assistant turn.
 */
export function appendEmissionReminder(messages: SimpleMessage[]): SimpleMessage[] {
  if (messages.length === 0) return messages;
  const last = messages[messages.length - 1];
  if (last.role !== 'user') return messages;
  return [
    ...messages.slice(0, -1),
    { ...last, content: `${last.content}\n\n${STATE_REPORT_REMINDER}` },
  ];
}
