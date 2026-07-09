// Streaming state machine for Journey turn replies.
//
// The Anthropic stream produces the AI's output in three ordered sections:
//
//   1. OPTIONAL `<assessment>...</assessment>` block — private clinical
//      reasoning that must NEVER be shown to the user. Added in the
//      Therapeutic Sensitivity Layer PR (2026-07-09). Buffering until
//      `</assessment>` closes is what delays first-byte — the trade-off
//      Julia explicitly accepted to guarantee reasoning-before-reply.
//
//   2. WARM REPLY — plain text streamed to the user.
//
//   3. `<state-report>...</state-report>` block — hidden JSON for the
//      server, parsed after the stream completes.
//
// This module is a pure state machine over incoming delta strings. Zero
// I/O, zero Anthropic-specific types. The caller supplies chunks; the
// module returns which characters to send to the user and (at end) the
// full raw text for the parser layer.
//
// Design notes:
//   - The `<assessment>` block is OPTIONAL. If the AI omits it entirely
//     (which will happen sometimes in the first days after ship), the
//     processor detects the absence within the first non-whitespace
//     characters and starts streaming immediately.
//   - Malformed / unclosed `<assessment>` blocks: if the stream ends
//     while still inside an assessment, we treat the whole thing as
//     private and never flush it. Safer than accidentally leaking
//     clinical reasoning.
//   - `<state-report>` truncation preserves the existing lookahead
//     buffer (STATE_REPORT_OPEN.length) so partial open tags are never
//     streamed.

export const ASSESSMENT_OPEN = '<assessment>';
export const ASSESSMENT_CLOSE = '</assessment>';
export const STATE_REPORT_OPEN = '<state-report>';

type Phase =
  /** Haven't received enough non-whitespace to decide assessment presence. */
  | 'undecided'
  /** Currently inside an <assessment> block, buffering silently. */
  | 'in_assessment'
  /** After </assessment> (or immediately if no assessment), streaming reply. */
  | 'streaming_reply'
  /** Hit <state-report> — stop streaming, buffer only for parser. */
  | 'truncated_at_state_report';

export type ProcessorState = {
  phase: Phase;
  /** Total raw text accumulated across all chunks. */
  fullText: string;
  /** Index into fullText — anything before this has been considered by
   *  the state machine (streamed or discarded). */
  cursor: number;
  /** True after a </assessment> boundary until we have seen and skipped
   *  past any leading whitespace of the reply. Ensures the user's visible
   *  stream begins with the AI's first real character, not a stack of
   *  blank lines from the tag boundary. */
  skipLeadingWs: boolean;
};

export function createProcessorState(): ProcessorState {
  return { phase: 'undecided', fullText: '', cursor: 0, skipLeadingWs: false };
}

/**
 * Ingest one delta chunk from the Anthropic stream. Returns the text (if
 * any) that should be sent to the user for this chunk. Multiple chunks
 * may accumulate into a single visible flush; empty deltas (whitespace
 * inside assessment, etc.) return the empty string.
 *
 * Mutates `state` in place — the state object carries phase + cursor
 * between calls.
 */
export function ingestChunk(state: ProcessorState, delta: string): string {
  if (delta.length === 0) return '';
  state.fullText += delta;

  let visible = '';

  // Loop because a single chunk can traverse multiple phases
  // (e.g. delta = `</assessment>\n\nHi there`).
  let progress = true;
  while (progress) {
    progress = false;

    if (state.phase === 'undecided') {
      // Look at the raw text from cursor onwards, skipping leading
      // whitespace. Decide whether it begins with <assessment>.
      const rest = state.fullText.slice(state.cursor);
      const firstNonWs = rest.search(/\S/);
      if (firstNonWs < 0) {
        // Still all whitespace — buffer without deciding. Whitespace at
        // the very start is discarded (matches the current behaviour of
        // the AI reply starting with actual content).
        return visible;
      }
      // Absolute position (into fullText) of first non-whitespace char.
      const firstNonWsAbs = state.cursor + firstNonWs;
      const tail = state.fullText.slice(firstNonWsAbs);

      if (tail.startsWith(ASSESSMENT_OPEN)) {
        // Confirmed assessment block. Advance cursor to just AFTER the
        // open tag; content between there and </assessment> is private.
        state.phase = 'in_assessment';
        state.cursor = firstNonWsAbs + ASSESSMENT_OPEN.length;
        progress = true;
        continue;
      }
      // If tail is a proper prefix of ASSESSMENT_OPEN, we don't know yet
      // — wait for more characters.
      if (ASSESSMENT_OPEN.startsWith(tail) && tail.length < ASSESSMENT_OPEN.length) {
        return visible;
      }
      // Tail starts with something else (letter, digit, punctuation)
      // that isn't a prefix of <assessment>. Skip leading whitespace and
      // treat the whole reply as user-facing from firstNonWsAbs.
      state.phase = 'streaming_reply';
      state.cursor = firstNonWsAbs;
      progress = true;
      continue;
    }

    if (state.phase === 'in_assessment') {
      // Cursor sits at "start of assessment content" (right after the
      // open tag) throughout this phase and DOES NOT advance until the
      // close tag arrives. Advancing here would miss the close tag when
      // it lands in a later chunk (indexOf would search from a position
      // past the tag's start position). The assessment block is small
      // enough that unbounded buffering isn't a practical concern.
      const closeIdx = state.fullText.indexOf(ASSESSMENT_CLOSE, state.cursor);
      if (closeIdx < 0) {
        return visible;
      }
      // Close tag arrived. Move past it and transition. The reply
      // typically starts with a blank-line gap after the close tag; the
      // `skipLeadingWs` flag continues eating whitespace across future
      // chunks so the user's visible stream begins with the AI's first
      // real character.
      state.cursor = closeIdx + ASSESSMENT_CLOSE.length;
      state.phase = 'streaming_reply';
      state.skipLeadingWs = true;
      progress = true;
      continue;
    }

    if (state.phase === 'streaming_reply') {
      // Post-assessment whitespace suppression. Advance the cursor past
      // any run of whitespace at the start of the reply, then clear the
      // flag once we've found the first real character.
      if (state.skipLeadingWs) {
        const rest = state.fullText.slice(state.cursor);
        const firstNonWs = rest.search(/\S/);
        if (firstNonWs < 0) {
          // Still all whitespace — advance cursor to end and wait.
          state.cursor = state.fullText.length;
          return visible;
        }
        state.cursor += firstNonWs;
        state.skipLeadingWs = false;
      }
      const idx = state.fullText.indexOf(STATE_REPORT_OPEN, state.cursor);
      if (idx >= 0) {
        // Emit everything up to the <state-report> tag, then stop.
        const chunk = state.fullText.slice(state.cursor, idx);
        if (chunk.length > 0) visible += chunk;
        state.cursor = idx;
        state.phase = 'truncated_at_state_report';
        return visible;
      }
      // No state-report yet. Emit up to (fullText.length -
      // STATE_REPORT_OPEN.length) to guard against a partial tag.
      const safeUpTo = Math.max(
        state.cursor,
        state.fullText.length - STATE_REPORT_OPEN.length,
      );
      if (safeUpTo > state.cursor) {
        visible += state.fullText.slice(state.cursor, safeUpTo);
        state.cursor = safeUpTo;
      }
      return visible;
    }

    if (state.phase === 'truncated_at_state_report') {
      return visible;
    }
  }

  return visible;
}

/**
 * Called after the stream has ended. Returns any remaining visible text
 * that was buffered against a partial-tag boundary. If the stream ended
 * while inside an assessment (unclosed tag), we return the empty string
 * — safer to lose the reply than leak clinical reasoning.
 */
export function finaliseStream(state: ProcessorState): string {
  if (state.phase === 'in_assessment') return '';
  if (state.phase === 'truncated_at_state_report') return '';
  if (state.phase === 'undecided') {
    // Stream ended before we could decide. If it was all whitespace,
    // return empty. Otherwise the tail-of-text case: flush what's left.
    return state.fullText.slice(state.cursor);
  }
  // streaming_reply: flush any residual buffer past the cursor.
  return state.fullText.slice(state.cursor);
}

/**
 * Extract the raw `<state-report>` JSON payload (without surrounding
 * tags) from the accumulated fullText, or null if the block is missing
 * or malformed. Kept here rather than in the parser because it's a
 * property of the stream, not the state report itself.
 */
export function extractStateReportRaw(fullText: string): string | null {
  const openIdx = fullText.indexOf(STATE_REPORT_OPEN);
  if (openIdx < 0) return null;
  const closeIdx = fullText.indexOf('</state-report>', openIdx);
  if (closeIdx < 0) return null;
  return fullText.slice(openIdx + STATE_REPORT_OPEN.length, closeIdx).trim();
}
