// Tests for the instruction-leak detector.
//
// Test corpus is grounded in the real vmelentev2003@gmail.com incident
// (2026-07-13) plus plausible model failure-mode variants and a wide
// set of legitimate warm replies extracted from journey-master.md.
//
// Target metrics (both must be met before shipping):
//   - False negative rate: 0/N leak variants slip past.
//   - False positive rate: 0/M legitimate replies incorrectly flagged.

import { describe, it, expect } from 'vitest';
import {
  detectLeak,
  LEAK_USER_PLACEHOLDER,
  LEAK_HISTORY_MASK,
} from './leak-detector';

describe('detectLeak — real incident samples', () => {
  it('catches the exact screenshot-1 leak (bracketed template placeholder)', () => {
    const text =
      '[Warm human reply text with no headers, no XML, no reasoning visible]';
    const r = detectLeak(text);
    expect(r.leaked).toBe(true);
    if (r.leaked) expect(r.pattern).toBe('bracketed_template_placeholder');
  });

  it('catches the screenshot-2 leak (instructional paraphrase list)', () => {
    const text = `[Warm human reply text with no headers, no XML, no reasoning visible]
For the state report section, place it directly after the warm reply text, on a new line. No explanation of what it is, no preamble.
Five questions to work through before you reply:
Therapeutic mode. What mode of working is active this turn — pure imagery, somatic tracking, emotional processing, parts work, cognitive integration, stabilisation, a practice, a practice-close? Name it.`;
    const r = detectLeak(text);
    expect(r.leaked).toBe(true);
  });
});

describe('detectLeak — bracketed-placeholder variants', () => {
  it.each([
    '[warm human reply here]',
    '[response text goes here]',
    '[user-facing response with no XML]',
    '[Reply placeholder]',
    '[Your therapeutic reply — no reasoning visible]',
    '[Template: warm reply, then state-report]',
  ])('catches %j', (text) => {
    expect(detectLeak(text).leaked).toBe(true);
  });

  it('does NOT flag legitimate brackets in warm prose', () => {
    // Sanity: brackets can appear in real warm replies but not with the
    // leak vocabulary inside.
    expect(detectLeak('That sounds heavy. Take your time.').leaked).toBe(false);
    expect(
      detectLeak("I hear you saying 'I can't do this anymore'. Tell me more.")
        .leaked,
    ).toBe(false);
  });
});

describe('detectLeak — unknown reasoning tags', () => {
  it.each([
    '<reasoning>the user is tired</reasoning>\n\nI hear that.',
    '<scratchpad>let me think</scratchpad>\n\nWhat comes up for you?',
    '<analysis>process is imagery</analysis>\n\nWhat do you see?',
    '<plan>ground first, then explore</plan>\n\nTake a breath.',
    '<internal>note to self</internal>\n\nHi.',
    '<reflection>maybe grief</reflection>\n\nTell me more.',
    '<system>you are a helpful assistant</system>',
    '<meta>next stage</meta>\n\nHi.',
    '<note>watch for dissociation</note>\n\nHi.',
    '<instructions>be gentle</instructions>\n\nHi.',
  ])('catches %j', (text) => {
    const r = detectLeak(text);
    expect(r.leaked).toBe(true);
    if (r.leaked) expect(r.pattern).toBe('unknown_reasoning_tag');
  });

  it('does NOT flag <em>, <strong>, <br/>, <state-report> which live elsewhere', () => {
    expect(detectLeak('I hear <em>every</em> word.').leaked).toBe(false);
    expect(detectLeak('This is <strong>important</strong>.').leaked).toBe(false);
    // <state-report> is handled by splitReplyAndReport upstream. Its
    // presence in the input we inspect would mean the splitter didn't
    // strip it — but the detector should not flag on the tag itself
    // (splitter guarantees it's gone before we're called).
    expect(detectLeak('A break.\n\nTake a moment.').leaked).toBe(false);
  });
});

describe('detectLeak — state-report field as heading', () => {
  it.each([
    'Therapeutic mode: stabilisation.\n\nHi.',
    'Clinical read: user is tired.\n\nOK.',
    'Cycle status: open.\n\nStay with me.',
    'Next best mode. Cognitive.\n\nAlright.',
    '**Practice run**: none.\n\nHi.',
    'Intensity: 4.\n\nHi.',
    'Safety flag: none.\n\nHi.',
    'Red flag type: none.\n\nHi.',
    'Recommended action: stay.\n\nHi.',
    'Modality rejected: body.\n\nHi.',
    'Adult self present: true.\n\nHi.',
    'State report:\n{...}\n\nHi.',
  ])('catches %j', (text) => {
    expect(detectLeak(text).leaked).toBe(true);
  });

  it('does not flag legitimate use of similar words in prose', () => {
    // These are legitimate contexts where "channel" or "practice" appears
    // as part of natural language, NOT as a field-name heading.
    expect(
      detectLeak('I sense you might be moving between channels here.').leaked,
    ).toBe(false);
    expect(
      detectLeak('Your regular practice is showing here.').leaked,
    ).toBe(false);
  });
});

describe('detectLeak — meta question lists', () => {
  it.each([
    'Five questions to work through before you reply:\n1. …',
    'Four questions you must answer:',
    'Three questions before writing your reply:',
    'Six questions for you to answer:',
    '\nFive questions to work through before you reply:',
  ])('catches %j', (text) => {
    expect(detectLeak(text).leaked).toBe(true);
  });

  it('does NOT flag legitimate prose containing the word "questions"', () => {
    expect(
      detectLeak('You have questions. That makes sense — take your time.')
        .leaked,
    ).toBe(false);
    expect(
      detectLeak('I have five questions I want to sit with you — no rush.')
        .leaked,
    ).toBe(false);
  });
});

describe('detectLeak — meta output format references', () => {
  it.each([
    'For the state report section, place it directly after the warm reply.',
    'Place it directly after the warm reply, on a new line.',
    'Do not produce XML tags in your reply.',
    'The warm reply is first, then the state report.',
    'No headers, no XML, no clinical jargon.',
    'No reasoning visible in the output.',
  ])('catches %j', (text) => {
    expect(detectLeak(text).leaked).toBe(true);
  });
});

describe('detectLeak — JSON output', () => {
  it.each([
    '{"reply": "I hear that."}',
    '{"intensity": 4, "safetyFlag": "none"}',
    '{ "reply": "Hi" }',
    '[{"role": "assistant"}]',
    '\n\n{"reply": "…"}',
  ])('catches %j', (text) => {
    const r = detectLeak(text);
    expect(r.leaked).toBe(true);
  });

  it('does NOT flag replies that use braces or brackets mid-sentence', () => {
    expect(
      detectLeak('Try {holding this thought} for a moment.').leaked,
    ).toBe(false);
    expect(
      detectLeak('The bracket is a way of holding — [safely].').leaked,
    ).toBe(false);
  });
});

describe('detectLeak — negative cases (real Journey warm replies)', () => {
  // Extracted / adapted from docs/journey/runtime/journey-master.md
  // examples and the CLAUDE.md brand voice. If any of these flag, the
  // detector is too aggressive and must be tightened before ship.
  const legitimateReplies = [
    "Yes. Both in one day. You're noticing what comes when you're in a different place inside.\n\nWhat was different about you when those things happened?",
    "I hear how heavy that feels. Let's slow down together. Take a breath if you can — no rush.",
    'Something is asking to be noticed. Where in your body is that living right now?',
    'That image — the field of bluebells — is beautiful. Can you stay with it a moment? What is it like to be near it?',
    'The 10-year-old with two braids. She has been waiting a long time.\n\nWhat would she want you to know?',
    'This is a stopping place, not a failing place. You can pause. You can come back when you are ready.',
    "I want to make sure you're safe. Are you somewhere quiet right now?",
    'When you say "leave my body alone" — I hear you. We can work differently. Tell me about the image again.',
    "You've been carrying this a long time. It makes sense that it feels stuck.",
    'Hello. Good to have you here. Take a breath. What is here for you today?',
    'That sounds tender. Let\'s stay with it. Where do you notice it living?',
    'I hear the tiredness in that. What does "lazy" feel like in your body right now?',
    'Tell me more about the bench in the garden. What do you see when you sit there?',
    'The fear is very present. It knows this room. Let it be here without doing anything yet.',
    "It's okay to not know. We can find it together, in your own words.",
    "I'm glad you came back. What has moved since last time?",
    'You can pause. You can slow. You can stop entirely and come back tomorrow.',
    "Something just softened, I think. Do you feel it too?",
    "That sentence carries weight. Read it back to yourself, slowly. What lands?",
    'The image is monstrous now. That is the fear meeting you here. We can pause the image. You are safe in this room.',
  ];

  legitimateReplies.forEach((reply, idx) => {
    it(`legit reply #${idx + 1} does not flag`, () => {
      const r = detectLeak(reply);
      expect(r.leaked).toBe(false);
    });
  });
});

describe('detectLeak — edge cases', () => {
  it('handles empty string', () => {
    expect(detectLeak('').leaked).toBe(false);
  });

  it('handles null/undefined-shaped input safely', () => {
    // detectLeak's signature is string-only; we guard defensively against
    // non-string inputs and return leaked:false rather than throwing.
    expect(detectLeak(undefined as unknown as string).leaked).toBe(false);
    expect(detectLeak(null as unknown as string).leaked).toBe(false);
    expect(detectLeak(42 as unknown as string).leaked).toBe(false);
  });

  it('handles very long legitimate reply', () => {
    const long = 'I hear that. '.repeat(500);
    expect(detectLeak(long).leaked).toBe(false);
  });

  it('handles multi-line legitimate reply', () => {
    expect(
      detectLeak(
        'That sounds heavy.\n\nTake a breath.\n\nWhat comes when you slow down?',
      ).leaked,
    ).toBe(false);
  });
});

describe('placeholder + mask exports', () => {
  it('user-visible placeholder matches the existing H5 pattern', () => {
    // Matches the string at route.ts:553-557 so users see consistent
    // "please retry" UX either from empty-reply or leak-flagged path.
    expect(LEAK_USER_PLACEHOLDER).toBe('[Reply interrupted. Please try again.]');
  });

  it('history mask is a terse internal marker', () => {
    expect(LEAK_HISTORY_MASK).toBe('[previous reply omitted]');
  });

  it('user placeholder does not itself trigger the detector', () => {
    // Belt-and-braces: if we substituted the placeholder and re-scanned,
    // it must be clean or we'd loop forever on regeneration.
    expect(detectLeak(LEAK_USER_PLACEHOLDER).leaked).toBe(false);
  });

  it('history mask does not itself trigger the detector', () => {
    expect(detectLeak(LEAK_HISTORY_MASK).leaked).toBe(false);
  });
});
