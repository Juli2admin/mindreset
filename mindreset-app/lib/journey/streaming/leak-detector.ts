// Instruction-leak detector.
//
// Pure content-inspection module. Given a candidate assistant reply,
// returns whether it looks like the model has leaked its own internal
// instructions (system-prompt content, reasoning tags, JSON output,
// state-report field names as prose, bracketed template placeholders,
// meta references to output format) instead of writing a warm reply.
//
// This module makes ZERO changes to the clinical prompt. It only looks
// at the model's own output. It fires ONLY on shapes that a real warm
// reply essentially never contains. See scripts/leak-detector-proof.mjs
// for the empirical calibration: 5/5 caught, 0/20 false positives across
// hand-authored + master-prompt-example replies.
//
// Consumers:
//   - app/api/journey/turn/route.ts::finaliseTurn — persistence gate.
//     If detected, the assistant message is replaced with a placeholder
//     BEFORE being written to JourneyMessage. This prevents leaked text
//     from being (a) rendered to the user on the next /journey visit and
//     (b) fed back into the Anthropic call as poisoned history.
//   - app/api/journey/turn/route.ts (history load) — mask gate.
//     Runs over every historical assistant message BEFORE feeding to
//     Anthropic. Any pre-existing leaked row is masked with a stub so
//     the model isn't primed by it. Belt-and-braces for legacy DB rows
//     that pre-date the persistence gate.
//
// Pattern updates: add a new entry to LEAK_PATTERNS and a test line to
// leak-detector.test.ts. Do not remove patterns without an explicit
// review — every pattern here is grounded in a shape observed in a real
// or plausible incident.

export type LeakDetection =
  | { leaked: false }
  | { leaked: true; pattern: string };

type LeakPattern = {
  /** Short kebab-case identifier for logs and admin surfaces. */
  name: string;
  /** Regex whose first match triggers the leak verdict. */
  re: RegExp;
};

// Ordered most-specific → most-general. Order affects only which
// `pattern` name is reported; every pattern is checked as a hit.
const LEAK_PATTERNS: readonly LeakPattern[] = [
  {
    // The exact shape observed in the vmelentev2003@gmail.com incident.
    //   "[Warm human reply text with no headers, no XML, no reasoning visible]"
    // Any bracketed phrase whose interior mentions our output-format
    // vocabulary. A real warm reply essentially never uses "no headers /
    // no XML / no JSON / no reasoning / placeholder / template" inside
    // brackets.
    name: 'bracketed_template_placeholder',
    re: /\[[^\]\n]*(?:no headers|no XML|no JSON|no reasoning|reasoning visible|placeholder|template|text goes here|goes here|warm human reply)[^\]\n]*\]/i,
  },
  {
    // Any reasoning-shape tag we do NOT allowlist. <assessment> and
    // <thinking> are stripped by reply-processor.ts. Anything else is
    // meta-output that must not reach persistence.
    // <state-report> is intentionally NOT in this list — the splitter
    // handles it upstream.
    name: 'unknown_reasoning_tag',
    re: /<\s*(reasoning|scratchpad|analysis|plan|internal|reflection|system|meta|note|instructions?)\s*[>/]/i,
  },
  {
    // State-report field names appearing as visible prose headings.
    // Real warm replies never open a line with these words followed by
    // a colon or period.
    name: 'state_report_field_as_heading',
    re: /(^|\n)\s*(?:\*\*)?(?:Therapeutic mode|Clinical read|Cycle status|Next best mode|Practice run|Channel|Red flag type|Recommended action|Safety flag|Intensity|Modality rejected|State report|Adult self present)(?:\*\*)?\s*[.:]/,
  },
  {
    // The "five questions to answer silently" section paraphrased as
    // visible output — the shape observed in screenshot 2 of the
    // vmelentev2003 incident.
    name: 'meta_question_list',
    re: /(?:^|\n)\s*(?:Five|Four|Three|Six)\s+questions?\s+(?:to work through|you must answer|before you reply|before writing|for you to answer)/i,
  },
  {
    // Any prose that directly references the reply-format contract.
    // Screenshot 2 contained "For the state report section, place it
    // directly after..." and "Do not produce XML tags". A real warm
    // reply never talks about its own output structure.
    name: 'meta_output_format_reference',
    re: /(?:for the state report section|place it directly after|do not produce XML|warm reply is first|no headers,? no XML|no reasoning visible)/i,
  },
  {
    // Reply opens with JSON structure: `{` (always suspicious for a
    // warm reply) or `[` followed by JSON tokens `{ " '`. A `[` opening
    // followed by a letter is a bracketed word or our own placeholder
    // — those must NOT flag here.
    name: 'json_opening',
    re: /^\s*(?:\{|\[\s*[{"'])/,
  },
];

/**
 * Inspect an assistant reply for instruction leak. Returns the first
 * pattern hit (deterministic given a fixed pattern order) or leaked=false.
 *
 * Pure function. Does not mutate input, does not touch I/O, safe to
 * call from any layer.
 */
export function detectLeak(text: string): LeakDetection {
  if (typeof text !== 'string' || text.length === 0) {
    return { leaked: false };
  }
  for (const p of LEAK_PATTERNS) {
    if (p.re.test(text)) return { leaked: true, pattern: p.name };
  }
  return { leaked: false };
}

/**
 * Text substituted at persistence when a leak is detected. Matches the
 * H5 fallback pattern already used for empty replies (route.ts:553-557),
 * so users see a consistent "please retry" message either way.
 */
export const LEAK_USER_PLACEHOLDER = '[Reply interrupted. Please try again.]';

/**
 * Text substituted when masking a previously-leaked historical assistant
 * message before it is sent to Anthropic. Terse and semantically clear:
 * the model reads it as "the earlier turn did not produce a usable reply"
 * and is not primed by any leaked content.
 */
export const LEAK_HISTORY_MASK = '[previous reply omitted]';
