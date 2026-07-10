// Streaming state machine for Journey turn replies.
//
// The Anthropic stream produces the AI's output in three ordered sections:
//
//   1. OPTIONAL private reasoning tags — content that must NEVER be shown
//      to the user. Two shapes are stripped:
//        - `<assessment>...</assessment>` — the Therapeutic Sensitivity
//          Layer reasoning slot (PR α, 2026-07-09). Currently retained as
//          a defensive safety net; the master prompt does not ask for it.
//        - `<thinking>...</thinking>` — Claude's default reasoning shape.
//          The model reached for this on its own after PR γ tightened
//          state-report requirements (PR ζ, 2026-07-10) and leaked its
//          private reasoning into a real user's chat. Same clinical
//          safety violation as PR α's assessment leak; same fix — strip
//          from the visible stream AND from persistence.
//      Both tags are stripped anywhere they appear (start of reply OR
//      mid-reply). Anywhere they appear, both open and content and close
//      are dropped.
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
//   - Private tags are OPTIONAL. If the AI omits them entirely, the
//     processor detects the absence within the first non-whitespace
//     characters and starts streaming immediately.
//   - Malformed / unclosed private blocks: if the stream ends while still
//     inside a private tag, we return the empty string. Safer to lose the
//     reply than leak clinical reasoning.
//   - `<state-report>` truncation preserves a lookahead buffer of the
//     longest marker so partial open tags are never streamed.

export const ASSESSMENT_OPEN = '<assessment>';
export const ASSESSMENT_CLOSE = '</assessment>';
export const THINKING_OPEN = '<thinking>';
export const THINKING_CLOSE = '</thinking>';
export const STATE_REPORT_OPEN = '<state-report>';

// The stripped tag pairs, ordered by preference for detection. Consumers
// (tests, splitReplyAndReport) reference these names.
const PRIVATE_TAG_PAIRS: ReadonlyArray<{ open: string; close: string }> = [
  { open: ASSESSMENT_OPEN, close: ASSESSMENT_CLOSE },
  { open: THINKING_OPEN, close: THINKING_CLOSE },
];

// Longest marker length — used as the lookahead buffer when emitting the
// tail of streaming_reply so we never send a partial open tag.
const MAX_LOOKAHEAD = Math.max(
  STATE_REPORT_OPEN.length,
  ...PRIVATE_TAG_PAIRS.map((p) => p.open.length),
);

type Phase =
  /** Haven't received enough non-whitespace to decide private-tag presence. */
  | 'undecided'
  /** Currently inside a private tag (assessment or thinking), buffering silently. */
  | 'in_private_tag'
  /** After the close (or immediately if no private tag), streaming reply. */
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
  /** True after a private-tag close boundary until we have seen and
   *  skipped past any leading whitespace of the reply. Ensures the user's
   *  visible stream begins with the AI's first real character, not a
   *  stack of blank lines from the tag boundary. */
  skipLeadingWs: boolean;
  /** When in `in_private_tag`, the close string we are waiting for
   *  (`</assessment>` or `</thinking>`). Null otherwise. */
  currentCloseTag: string | null;
};

export function createProcessorState(): ProcessorState {
  return {
    phase: 'undecided',
    fullText: '',
    cursor: 0,
    skipLeadingWs: false,
    currentCloseTag: null,
  };
}

// Find the earliest position of any marker within text from `from`. Returns
// the position + which marker matched, or null if none found. Used to pick
// the next transition when multiple candidate boundaries could appear.
function findEarliestMarker(
  text: string,
  from: number,
  markers: readonly string[],
): { pos: number; marker: string } | null {
  let best: { pos: number; marker: string } | null = null;
  for (const marker of markers) {
    const pos = text.indexOf(marker, from);
    if (pos >= 0 && (best === null || pos < best.pos)) {
      best = { pos, marker };
    }
  }
  return best;
}

function findCloseForOpen(openTag: string): string {
  const pair = PRIVATE_TAG_PAIRS.find((p) => p.open === openTag);
  // Bare fallback would never fire — every open tag we detect comes from
  // PRIVATE_TAG_PAIRS by construction. Kept as a defensive default so the
  // type system stays sound and the state can never enter in_private_tag
  // with a null close.
  return pair ? pair.close : '';
}

/**
 * Ingest one delta chunk from the Anthropic stream. Returns the text (if
 * any) that should be sent to the user for this chunk. Multiple chunks
 * may accumulate into a single visible flush; empty deltas (whitespace
 * inside a private tag, etc.) return the empty string.
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
      // whitespace. Decide whether it begins with any private tag.
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

      // Check for each known private-tag open.
      const matchedPair = PRIVATE_TAG_PAIRS.find((p) => tail.startsWith(p.open));
      if (matchedPair) {
        // Confirmed private tag. Advance cursor to just AFTER the open
        // tag; content between there and the matching close is private.
        state.phase = 'in_private_tag';
        state.currentCloseTag = matchedPair.close;
        state.cursor = firstNonWsAbs + matchedPair.open.length;
        progress = true;
        continue;
      }
      // If tail is a proper prefix of any known open tag, we don't know
      // yet — wait for more characters.
      const partialPrefix = PRIVATE_TAG_PAIRS.some(
        (p) => p.open.startsWith(tail) && tail.length < p.open.length,
      );
      if (partialPrefix) {
        return visible;
      }
      // Tail starts with something that isn't a prefix of any private
      // tag. Skip leading whitespace and treat the whole reply as
      // user-facing from firstNonWsAbs.
      state.phase = 'streaming_reply';
      state.cursor = firstNonWsAbs;
      progress = true;
      continue;
    }

    if (state.phase === 'in_private_tag') {
      // Cursor sits at "start of private content" (right after the open
      // tag) throughout this phase and DOES NOT advance until the close
      // tag arrives. Advancing here would miss the close tag when it
      // lands in a later chunk (indexOf would search from a position
      // past the tag's start position). Private blocks are small enough
      // that unbounded buffering isn't a practical concern.
      const closeTag = state.currentCloseTag ?? '';
      const closeIdx = state.fullText.indexOf(closeTag, state.cursor);
      if (closeIdx < 0) {
        return visible;
      }
      // Close tag arrived. Move past it and transition. The reply
      // typically starts with a blank-line gap after the close tag; the
      // `skipLeadingWs` flag continues eating whitespace across future
      // chunks so the user's visible stream begins with the AI's first
      // real character.
      state.cursor = closeIdx + closeTag.length;
      state.phase = 'streaming_reply';
      state.currentCloseTag = null;
      state.skipLeadingWs = true;
      progress = true;
      continue;
    }

    if (state.phase === 'streaming_reply') {
      // Post-private-tag whitespace suppression. Advance the cursor past
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
      // Find the earliest of: any private-tag open (mid-reply leak), or
      // <state-report>. State-report is a hard terminator; a private tag
      // is a mid-reply strip.
      const privateOpens = PRIVATE_TAG_PAIRS.map((p) => p.open);
      const earliest = findEarliestMarker(state.fullText, state.cursor, [
        ...privateOpens,
        STATE_REPORT_OPEN,
      ]);
      if (earliest && earliest.marker === STATE_REPORT_OPEN) {
        // Emit everything up to <state-report>, then stop.
        const chunk = state.fullText.slice(state.cursor, earliest.pos);
        if (chunk.length > 0) visible += chunk;
        state.cursor = earliest.pos;
        state.phase = 'truncated_at_state_report';
        return visible;
      }
      if (earliest && earliest.marker !== STATE_REPORT_OPEN) {
        // Mid-reply private tag. Flush the visible prefix, then enter
        // the private buffering phase until the corresponding close.
        const chunk = state.fullText.slice(state.cursor, earliest.pos);
        if (chunk.length > 0) visible += chunk;
        state.phase = 'in_private_tag';
        state.currentCloseTag = findCloseForOpen(earliest.marker);
        state.cursor = earliest.pos + earliest.marker.length;
        progress = true;
        continue;
      }
      // No marker found. Emit up to (fullText.length - MAX_LOOKAHEAD) to
      // guard against a partial tag straddling this and the next chunk.
      const safeUpTo = Math.max(
        state.cursor,
        state.fullText.length - MAX_LOOKAHEAD,
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
 * while inside a private tag (unclosed), we return the empty string
 * — safer to lose the reply than leak clinical reasoning.
 */
export function finaliseStream(state: ProcessorState): string {
  if (state.phase === 'in_private_tag') return '';
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
