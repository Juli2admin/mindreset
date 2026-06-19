// lib/competitors/index.ts
//
// Phase E step 3 — registry of head-to-head comparison pages served
// from /vs/[slug]. Each entry holds the prose for one /vs/{competitor}
// page; the renderer in app/[locale]/vs/[slug]/page.tsx walks the same
// shape for every entry, so adding a new competitor = adding an entry
// here. The /journal pattern (lib/journal/articles.ts) inspired the
// shape — content in TS for type safety, no i18n for prose (en-only),
// just shared template strings via the Vs namespace.
//
// Brand rules baked in (audit at PR review):
// - MindReset.ai (with the TLD) appears in H1 + first reference so the
//   page disambiguates from other "MindReset" brands
// - "Built by Julia Loya · UK" byline locks the founder + geography
//   for AI entity-grounding
// - No therapy-price comparisons anywhere
// - "Therapist" never describes any MindReset product
// - Competitor framed by THEIR claims, not assertions of fact (Wysa
//   "cites a research base", Woebot "aimed at mild-to-moderate", etc.)
// - Two-tier positioning locked: MiniMind = £14.99/mo daily companion
//   with free 50-msg taster; The Journey = £599 once or £55/wk
// - "Not therapy, not coaching, not a crisis service" lockup preserved

export type CompetitorComparison = {
  /** URL slug — /vs/<slug>. Once shipped, never change (breaks crawled links). */
  slug: string;
  /** Display name as it appears in the H1 and prose. */
  name: string;
  /** Canonical URL of the competitor (used in JSON-LD @id and as a sameAs link). */
  homepage: string;
  /** <title> tag. */
  metaTitle: string;
  /** <meta description>. 140-180 chars. */
  metaDescription: string;
  /** Intro paragraphs above the first H2 — 2-3 paras. */
  intro: string[];
  /** "What [name] is" — factual description, their claims framed as theirs. */
  whatTheyAre: string;
  /**
   * "What MindReset.ai is" — restates the locked positioning. Per-page
   * tunable lead-in is allowed (contextual contrast with the competitor)
   * but the audience + product + "not therapy" lockup paragraph stays
   * verbatim across all pages.
   */
  whatMindResetIs: string[];
  /** "[name] fits when:" bullets. */
  theyFitWhen: string[];
  /** "MindReset.ai fits when:" bullets. */
  mindresetFitsWhen: string[];
  /** "Honest overlap" — 2 paragraphs naming the genuine shared ground. */
  honestOverlap: string[];
  /** Closing paragraph(s) before the CTAs. */
  closing: string[];
};

const MINDRESET_LOCKED_PARAGRAPH =
  "MiniMind (£14.99/month) is the daily companion you can think out loud with — a quiet place to set down what your mind is carrying. The Journey (£599 once, or £55/week) is the deeper work: an eight-stage structured method, paced for safety. A free 50-message taster on MiniMind to start, no card. MindReset.ai is not therapy, not coaching, and not a crisis service.";

export const COMPARISONS: CompetitorComparison[] = [
  {
    slug: 'wysa',
    name: 'Wysa',
    homepage: 'https://www.wysa.com/',
    metaTitle: 'MindReset.ai vs Wysa — honest comparison · MindReset.ai',
    metaDescription:
      'MindReset.ai vs Wysa — what each is for, who each serves best, where they overlap and where they differ. A clear comparison from the founder.',
    intro: [
      'Two AI companions that get compared a lot. They sound similar on the surface — both are conversational, both work via text, both sit alongside therapy rather than replace it. But they\'re built for different people doing different work, and the differences matter once you sit with them.',
      'Here is a clear picture of what each is, who it serves best, and where each genuinely fits.',
    ],
    whatTheyAre:
      "Wysa is an AI chatbot built around cognitive behavioural therapy (CBT) and dialectical behaviour therapy (DBT) techniques. It cites a research base and is structured around short, on-demand exercises — naming a thought, reframing it, working through a brief practice. It's broadly aimed at people experiencing mild anxiety or low mood who want practical, symptom-focused tools they can use in five or ten minutes. General-audience: no specific stage-of-life or demographic targeting. The conversational style is brisk and structured, matching its CBT roots.",
    whatMindResetIs: [
      'MindReset.ai is built for one audience specifically: women aged 35 to 55 in midlife who feel internally stuck despite functioning well externally. It\'s a self-help wellbeing platform, not symptom-management software. The starting point isn\'t "what symptom are you having today" — it\'s "what part of you got lost, and how do we come back to her."',
      MINDRESET_LOCKED_PARAGRAPH,
    ],
    theyFitWhen: [
      'You want short, on-demand CBT exercises you can use during a stressed moment',
      'Your discomfort is mostly symptom-shaped — anxious thoughts, low-mood spirals — and you want to work directly with the thoughts',
      "You're early in your inner work and want a low-commitment way to try AI conversation",
      "You're not in a specific life stage that needs targeted material",
    ],
    mindresetFitsWhen: [
      "You're a woman in midlife and the patterns you keep running feel older than the current circumstances",
      '"Just reframe the thought" doesn\'t reach what you\'re carrying — you want something that meets the deeper layer',
      'You want a sustained method that builds over weeks and months, not a tool for one anxious afternoon',
      "The way you're stuck is identity-shaped, not symptom-shaped — you've stopped knowing what you want underneath the function",
    ],
    honestOverlap: [
      "Both are AI-driven self-help. Both sit in the broader category of digital wellbeing tools. Both are upfront that they're not a replacement for therapy. If you're considering both, that's reasonable — they solve for different parts of a similar landscape.",
      'The clearest dividing line: Wysa is symptom-focused, brief, and broad. MindReset.ai is identity-focused, sustained, and audience-specific. If you mostly want techniques for difficult moments, Wysa is built for that. If you want the slower work of coming back to yourself, MindReset.ai is built for that.',
    ],
    closing: [
      "If you'd like to try MindReset.ai, MiniMind's first 50 messages are free, no card needed. Not therapy. Not a quick fix. A structured way to come home to yourself, at your own pace.",
    ],
  },
  {
    slug: 'betterhelp',
    name: 'BetterHelp',
    homepage: 'https://www.betterhelp.com/',
    metaTitle: 'MindReset.ai vs BetterHelp — honest comparison · MindReset.ai',
    metaDescription:
      'MindReset.ai vs BetterHelp — one is therapy with a licensed clinician, the other is self-help reflection. An honest guide to which you actually need.',
    intro: [
      "These two get compared, and they shouldn't be — not because the comparison is unfair, but because they're solving for different problems. BetterHelp is therapy. MindReset.ai is self-help reflection. The first is a clinical service with a licensed professional; the second is a structured digital tool you use alone.",
      "If you're searching for one and considering the other, this page is to help you tell which you actually need. Honest is more useful than persuasive here.",
    ],
    whatTheyAre:
      "BetterHelp is an online therapy platform connecting users with licensed human therapists. You book weekly sessions, message between them, and the therapist is a real clinical professional held to professional standards in their jurisdiction. It's a subscription service with a premium price tag, and what you're paying for is access to qualified human therapy. BetterHelp serves a general adult population — no specific demographic targeting beyond the broad \"people who want therapy.\"",
    whatMindResetIs: [
      "MindReset.ai is not therapy and is not a substitute for therapy. It's a self-help wellbeing platform for women aged 35 to 55 in midlife. There is no human clinician on the other end — there's an AI built to support structured self-reflection in a specific, paced way. If your situation calls for clinical care, MindReset is not the right tool and we'll tell you so plainly: get therapy.",
      MINDRESET_LOCKED_PARAGRAPH,
    ],
    theyFitWhen: [
      "You're in active distress — depression, anxiety severe enough to interfere with daily life, trauma symptoms — and want clinical support",
      'You want a real human professional you can speak to and who can adjust the approach to you',
      'You may benefit from a formal diagnosis, treatment plan, or referral to additional clinical care depending on what BetterHelp offers in your region',
      "You're in or approaching crisis and need someone with clinical training in the room",
      'You can afford weekly therapy and are committed to the cadence',
    ],
    mindresetFitsWhen: [
      "You're not in crisis, not in active clinical distress, but you feel internally stuck and you want structure for the slower work",
      "You've done therapy already — sometimes years of it — and want a self-directed way to keep reflecting at your own pace",
      "You're specifically a woman in midlife and want material designed for that stage of life, not a general-population tool",
      'You want a daily companion (MiniMind) for noticing patterns, or a structured method (The Journey) for sustained inner work',
      "You'd rather think out loud at your own pace than book a weekly slot",
    ],
    honestOverlap: [
      "Less than the comparison suggests — because they solve different problems. BetterHelp is regulated clinical care; MindReset.ai is self-help reflection. The category boundary matters: therapy is for people who need clinical support, and we'd rather you have that than try to replace it with a self-help tool. If a friend asked us which to pick when they were in real distress, we'd say BetterHelp every time.",
      "Where the two touch is the everyday reality that many women have done therapy, are doing therapy, or have decided therapy isn't where they are right now — and still want somewhere to do their own work. MindReset is built for that space, not in place of therapy.",
    ],
    closing: [
      "If you think you need therapy, get therapy — BetterHelp is one route. If you're not sure, MindReset's screening check-in at the start of MiniMind asks gentle questions to help orient. And if MiniMind is the right fit, the first 50 messages are free, no card needed. Not therapy. Not a quick fix. A structured way to come home to yourself, at your own pace.",
    ],
  },
];

/** Newest-first not relevant — return registry order. */
export function getAllComparisons(): CompetitorComparison[] {
  return COMPARISONS;
}

/** Look up a single comparison by slug. Undefined if not found. */
export function getComparisonBySlug(
  slug: string,
): CompetitorComparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
