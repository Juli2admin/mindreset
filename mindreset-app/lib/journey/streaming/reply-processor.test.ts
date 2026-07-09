// Unit tests for the reply streaming state machine.
//
// The processor is the ONLY thing standing between the AI's private
// reasoning and the user's screen — so we hammer it. Cases cover:
//
//   - Assessment block properly opened + closed → stripped
//   - No assessment block → backwards-compatible passthrough
//   - Assessment block chunked across arbitrary delta boundaries
//   - Assessment block that never closes → nothing streamed (safer)
//   - Partial <assessment> open tag inside a chunk → waits for confirmation
//   - Text that starts with `<` but isn't <assessment> → streams normally
//   - Both <assessment> and <state-report> present
//   - Only <state-report> (existing behaviour, must not regress)
//   - Whitespace at start
//   - Empty stream

import { describe, expect, it } from 'vitest';
import {
  ASSESSMENT_OPEN,
  ASSESSMENT_CLOSE,
  STATE_REPORT_OPEN,
  createProcessorState,
  ingestChunk,
  finaliseStream,
  extractStateReportRaw,
} from './reply-processor';

/**
 * Feed a full model output as a series of chunks to the processor and
 * collect what the user would have seen. `chunkSizes` optionally
 * controls how the input is split — otherwise we feed byte-by-byte
 * (the harshest test of the tag detection).
 */
function runProcessor(
  fullOutput: string,
  chunkSizes?: number[],
): { visible: string; finalisedTail: string; fullText: string } {
  const state = createProcessorState();
  let visible = '';
  let cursor = 0;
  if (chunkSizes) {
    for (const size of chunkSizes) {
      const delta = fullOutput.slice(cursor, cursor + size);
      cursor += size;
      visible += ingestChunk(state, delta);
    }
    if (cursor < fullOutput.length) {
      visible += ingestChunk(state, fullOutput.slice(cursor));
    }
  } else {
    // Byte-by-byte — hardest test of tag boundary detection.
    for (const ch of fullOutput) {
      visible += ingestChunk(state, ch);
    }
  }
  const finalisedTail = finaliseStream(state);
  return { visible, finalisedTail, fullText: state.fullText };
}

describe('reply-processor — no assessment block (backwards compatible)', () => {
  const output =
    "Hello, this is the reply.\n\nSecond paragraph.\n\n" +
    `${STATE_REPORT_OPEN}{"intensity":3,"safetyFlag":"none","recommendedAction":"stay"}</state-report>`;

  it('streams the entire reply, stripping only <state-report>', () => {
    const { visible, finalisedTail } = runProcessor(output);
    const total = visible + finalisedTail;
    expect(total).toBe('Hello, this is the reply.\n\nSecond paragraph.\n\n');
    expect(total).not.toContain(STATE_REPORT_OPEN);
    expect(total).not.toContain('intensity');
  });

  it('handles the reply with no state-report at all — flushes remainder on finalise', () => {
    const noReport = 'Just a reply, nothing else.';
    const { visible, finalisedTail } = runProcessor(noReport);
    expect(visible + finalisedTail).toBe(noReport);
  });

  it('handles arbitrary chunk boundaries', () => {
    // Feed in 3-char chunks — will land in the middle of the state-report open tag.
    const { visible, finalisedTail } = runProcessor(output, [
      3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
    ]);
    expect(visible + finalisedTail).toBe('Hello, this is the reply.\n\nSecond paragraph.\n\n');
  });
});

describe('reply-processor — with assessment block (Therapeutic Sensitivity Layer)', () => {
  const assessmentContent =
    '\nProcess: somatic activation.\n' +
    'Channel: shifted from imagery to body.\n' +
    'Cycle: open — do not close.\n' +
    'Next: allow_discharge.\n';

  const output =
    `${ASSESSMENT_OPEN}${assessmentContent}${ASSESSMENT_CLOSE}\n\n` +
    "Stay with me. Right here, right now.\n\n" +
    "The image shifted into the body — that's important.\n\n" +
    `${STATE_REPORT_OPEN}{"intensity":6,"safetyFlag":"watch","recommendedAction":"stay","therapeuticMode":"somatic","cycleStatus":"open"}</state-report>`;

  it('strips the assessment block entirely from the visible stream', () => {
    const { visible, finalisedTail } = runProcessor(output);
    const total = visible + finalisedTail;
    expect(total).toContain('Stay with me');
    expect(total).toContain('The image shifted into the body');
    expect(total).not.toContain('Process:');
    expect(total).not.toContain('somatic activation');
    expect(total).not.toContain(ASSESSMENT_OPEN);
    expect(total).not.toContain(ASSESSMENT_CLOSE);
  });

  it('starts the visible stream at the AI reply, not with leading whitespace', () => {
    const { visible, finalisedTail } = runProcessor(output);
    const total = visible + finalisedTail;
    // Should not have a stack of leading newlines from the tag boundary.
    expect(total.startsWith('Stay with me')).toBe(true);
  });

  it('strips state-report too — user never sees any hidden JSON', () => {
    const { visible, finalisedTail } = runProcessor(output);
    const total = visible + finalisedTail;
    expect(total).not.toContain(STATE_REPORT_OPEN);
    expect(total).not.toContain('therapeuticMode');
    expect(total).not.toContain('intensity');
  });

  it('captures the assessment in fullText so it CAN be audited server-side if we want later', () => {
    const { fullText } = runProcessor(output);
    // Full raw text is preserved for audit — just never streamed.
    expect(fullText).toContain('Process: somatic activation');
    expect(fullText).toContain(ASSESSMENT_OPEN);
  });

  it('handles the whole thing chunked byte-by-byte (worst-case boundary test)', () => {
    const { visible, finalisedTail } = runProcessor(output);
    const total = visible + finalisedTail;
    expect(total).toContain('Stay with me');
    expect(total).not.toContain('Process:');
  });

  it('handles the whole thing arriving in one big chunk', () => {
    const state = createProcessorState();
    const visible = ingestChunk(state, output);
    const tail = finaliseStream(state);
    expect(visible + tail).toContain('Stay with me');
    expect(visible + tail).not.toContain('Process:');
    expect(visible + tail).not.toContain(STATE_REPORT_OPEN);
  });

  it('handles chunk boundary landing INSIDE the <assessment> open tag', () => {
    // Split so first chunk is "<asses" — partial open tag.
    const { visible, finalisedTail } = runProcessor(output, [6, output.length - 6]);
    const total = visible + finalisedTail;
    expect(total).toContain('Stay with me');
    expect(total).not.toContain('Process:');
    expect(total).not.toContain('<asses');
  });

  it('handles chunk boundary landing INSIDE the </assessment> close tag', () => {
    // Find the close tag position and split there.
    const closeIdx = output.indexOf(ASSESSMENT_CLOSE);
    const boundaryInsideClose = closeIdx + 5; // partway through "</asse..."
    const { visible, finalisedTail } = runProcessor(output, [
      boundaryInsideClose,
      output.length - boundaryInsideClose,
    ]);
    const total = visible + finalisedTail;
    expect(total).toContain('Stay with me');
    expect(total).not.toContain('Process:');
    expect(total).not.toContain('</asse');
  });
});

describe('reply-processor — malformed / defensive', () => {
  it('leaks nothing when the assessment never closes (unclosed tag)', () => {
    const unclosed = `${ASSESSMENT_OPEN}\nBig important reasoning here that must NEVER reach the user.\nNo close tag, stream ended.`;
    const { visible, finalisedTail } = runProcessor(unclosed);
    const total = visible + finalisedTail;
    expect(total).toBe('');
    expect(total).not.toContain('important reasoning');
    expect(total).not.toContain('NEVER reach the user');
  });

  it('leaks nothing when the assessment never closes AND state-report never opens', () => {
    const partial = `${ASSESSMENT_OPEN}\nEverything is inside the assessment, nothing else.`;
    const { visible, finalisedTail } = runProcessor(partial);
    expect(visible + finalisedTail).toBe('');
  });

  it('handles empty stream', () => {
    const { visible, finalisedTail } = runProcessor('');
    expect(visible + finalisedTail).toBe('');
  });

  it('handles a stream that is just whitespace', () => {
    const { visible, finalisedTail } = runProcessor('   \n\n   ');
    expect(visible + finalisedTail).toBe('   \n\n   ');
  });

  it('does NOT treat a reply starting with an unrelated < as assessment', () => {
    // AI opens the reply with a less-than symbol that happens to
    // appear early — must not be mistaken for the assessment open tag.
    const output = "<3 to you today. That's my whole reply.";
    const { visible, finalisedTail } = runProcessor(output);
    expect(visible + finalisedTail).toBe(output);
  });

  it('does NOT treat a reply starting with a different tag as assessment', () => {
    const output = '<em>Emphasis</em> at the start of the reply.';
    const { visible, finalisedTail } = runProcessor(output);
    expect(visible + finalisedTail).toBe(output);
  });

  it('strips assessment even when reply contains angle brackets after it', () => {
    const output =
      `${ASSESSMENT_OPEN}reasoning${ASSESSMENT_CLOSE}\n\n` +
      'The user said <angle brackets are fine> here.\n\n' +
      `${STATE_REPORT_OPEN}{}</state-report>`;
    const { visible, finalisedTail } = runProcessor(output);
    expect(visible + finalisedTail).toContain('<angle brackets are fine>');
    expect(visible + finalisedTail).not.toContain('reasoning');
  });
});

describe('extractStateReportRaw', () => {
  it('extracts the raw JSON between tags', () => {
    const raw = extractStateReportRaw(
      `Reply text${STATE_REPORT_OPEN}{"intensity":5}</state-report>`,
    );
    expect(raw).toBe('{"intensity":5}');
  });

  it('trims surrounding whitespace inside the tags', () => {
    const raw = extractStateReportRaw(
      `Reply${STATE_REPORT_OPEN}\n  {"intensity":5}  \n</state-report>`,
    );
    expect(raw).toBe('{"intensity":5}');
  });

  it('returns null when the open tag is missing', () => {
    expect(extractStateReportRaw('Reply with no report tag.')).toBeNull();
  });

  it('returns null when the close tag is missing', () => {
    expect(
      extractStateReportRaw(`Reply${STATE_REPORT_OPEN}{"intensity":5}`),
    ).toBeNull();
  });

  it('extracts state-report correctly even when an assessment block precedes it', () => {
    const raw = extractStateReportRaw(
      `${ASSESSMENT_OPEN}private${ASSESSMENT_CLOSE}\nreply\n${STATE_REPORT_OPEN}{"a":1}</state-report>`,
    );
    expect(raw).toBe('{"a":1}');
  });
});
