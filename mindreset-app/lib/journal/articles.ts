// lib/journal/articles.ts
//
// Phase C — content engine. Typed registry of long-form journal
// articles. Each entry is self-contained: routing slug, SEO metadata,
// author, datePublished, plus a structured body the renderer can
// transform into the literary house style with proper sectioning.
//
// House style for the renderer:
//   - Intro paragraphs: large serif lead-in, sans body
//   - Section heading: serif H2
//   - Section paragraphs: sans body, generous spacing
//   - Mid-paragraph "advice" lead-ins: bolded lead phrase inline
//   - Closing: same as body — MiniMind link wrapped in component
//
// New articles are appended to ARTICLES. The /journal index sorts
// newest-first by publishedAt and the [slug] route generates static
// pages for each entry via generateStaticParams.

export type AdviceParagraph = {
  /** Bold lead-in phrase (e.g. "Catch the moment, not the lifetime."). */
  lead: string;
  /** Body of the advice paragraph. */
  body: string;
};

export type ArticleSection = {
  heading: string;
  /**
   * Either plain prose paragraphs (string) or structured advice
   * paragraphs ({lead, body}). The renderer treats them differently.
   */
  paragraphs: (string | AdviceParagraph)[];
};

export type ArticleAuthor = {
  name: string;
  url?: string;
};

export type Article = {
  slug: string;
  /** H1 on the article page + headline in JSON-LD. */
  title: string;
  /** <title> tag — Article.title can be longer; metaTitle should be SEO-tuned. */
  metaTitle: string;
  /** <meta name="description"> tag. */
  metaDescription: string;
  author: ArticleAuthor;
  /** ISO date (YYYY-MM-DD). Used as datePublished + sort key. */
  publishedAt: string;
  /** Optional ISO date for an update — surfaces as dateModified in JSON-LD. */
  modifiedAt?: string;
  /**
   * Lead paragraphs above the first section heading. The first paragraph
   * gets a slightly larger lead-in serif treatment.
   */
  intro: string[];
  /** Body sections, in order. */
  sections: ArticleSection[];
  /**
   * Closing paragraphs after the last section. The MiniMind CTA paragraph
   * is rendered with a Link wrapping the word "MiniMind" — the renderer
   * looks for the exact token in this prose.
   */
  closing: string[];
};

export const ARTICLES: Article[] = [
  {
    slug: 'how-to-stop-people-pleasing-in-midlife',
    title: 'How to Stop People-Pleasing in Midlife',
    metaTitle: 'How to Stop People-Pleasing in Midlife · MindReset',
    metaDescription:
      "People-pleasing isn't about being too nice — it's learning to disappear and calling it being good. A founder's honest take on how the pattern turns, in midlife.",
    author: { name: 'Julia Loya', url: '/about' },
    publishedAt: '2026-06-18',
    intro: [
      'For about fifteen years, I never let my coffee machine finish its beep.',
      "I'm a morning person. What I wanted — what I really wanted — was to get up early, make a proper coffee, and sit outside with it while the sun came up and the garden was still quiet. Simple. Mine.",
      "But the machine beeped when the coffee was ready. Loud. And my husband slept late. So every morning I'd stand there, poised, ready to lunge and kill the sound the second it started — sometimes before it started — so it wouldn't wake him. I'd trained myself to it like a dog waiting for a bell. My morning, my quiet, my one small pleasure, and I spent it braced around someone else's sleep.",
      "I didn't think of it as people-pleasing. I thought of it as being considerate. That's the trick of it. You don't notice you've disappeared, because you call it being good.",
      'If any of that lands somewhere true for you, this is for you. Not because something is wrong with you. Because something might finally be ready to change.',
    ],
    sections: [
      {
        heading: "People-pleasing isn't about being nice",
        paragraphs: [
          "Let's clear this up first, because it matters.",
          "People-pleasing gets talked about as if it's a sweetness problem — too kind, too giving, too soft. It isn't. Underneath, it's a safety strategy. Somewhere early on, you learned that keeping other people comfortable was how you stayed safe, stayed loved, stayed out of trouble. You read the room before you read yourself. You got very, very good at it.",
          "And here's the thing: it worked. For a long time, it worked. That's why it's so hard to put down — it's not a bad habit, it's an old survival skill that did its job so well you stopped noticing you were using it.",
          "The problem isn't that you're too nice. It's that you learned to disappear, and called it being good.",
        ],
      },
      {
        heading: 'Why it gets heavier in midlife',
        paragraphs: [
          "You can run the pattern for decades before it catches up with you. In your twenties and thirties there's so much momentum — building, proving, caring for small children, holding down the job, being everything to everyone — that there's no quiet space in which to notice the cost.",
          "Then midlife arrives, and something shifts. The noise drops, just slightly. The children need you differently, or the marriage looks different, or you simply lift your head one ordinary morning and feel the strangest thing: you've given everyone access to you except yourself.",
          'This is the moment so many women describe as feeling "stuck." Not depressed, exactly. Not in crisis. Just — disoriented. Successful on paper and lost underneath. You\'ve read the books. You\'ve journaled. You\'ve worked on yourself. And still the same pattern runs, quietly, every day.',
          "That's not failure. That's the pattern showing you it's ready to be looked at properly.",
        ],
      },
      {
        heading: 'Why "just set boundaries" doesn\'t work',
        paragraphs: [
          'Every article tells you the same thing. Say no. Set boundaries. Put yourself first.',
          "It's good advice that completely misses the point.",
          "Because the real problem isn't that you can't say no. It's that, in the moment, you genuinely don't know what you want badly enough to say it. The wanting itself has gone quiet. You've spent so long tuned to everyone else's frequency that your own signal barely registers. You can't set a boundary around a need you can't even feel.",
          'So "just say no" fails — not because you\'re weak, but because you\'re being told to defend a border you can\'t locate yet. The work isn\'t louder boundaries. The work is further back than that. It\'s relearning to notice what you want, in the small moments, before you can ever protect it.',
        ],
      },
      {
        heading: 'What actually begins to shift it',
        paragraphs: [
          "This is slower work, and honestly, that's the good news. There's no five-step fix, because the thing that broke wasn't simple and the thing that heals won't be either. But it does move. Here's where it starts.",
          {
            lead: 'Catch the moment, not the lifetime.',
            body: "You don't undo fifteen years of a pattern by deciding to. You start by noticing one moment as it happens — the small lurch where you brace around someone else and go quiet on yourself. You don't have to change it. Just see it. Naming it is the whole beginning.",
          },
          {
            lead: 'Get curious instead of cross with yourself.',
            body: "When you catch it, the instinct is to be annoyed — why do I always do this? That's just the pattern wearing a different coat. Try the gentler question instead: what was I keeping safe just then? There's almost always a real answer, and it's usually tender.",
          },
          {
            lead: 'Let the wanting come back slowly.',
            body: "You don't go from self-erased to fierce overnight. You start ridiculously small. What do I actually want for breakfast — not what's easiest, what do I want? Which way do I want to walk home? The muscle is tiny and out of use. You rebuild it in low-stakes moments long before you use it on the big ones.",
          },
          {
            lead: 'Stop doing it alone in your head.',
            body: 'Patterns this old are slippery — they hide from you precisely because they kept you safe. It helps enormously to have something outside your own head to reflect it back, gently, day by day, so you can actually see the shape of what you keep doing.',
          },
        ],
      },
      {
        heading: 'This is the slower work',
        paragraphs: [
          "None of this is dramatic. There's no breakthrough scene, no single morning you wake up free. It's quieter than that, and more durable.",
          "For me, it was the coffee machine. One morning, I just — didn't run to it. I let it beep. I stood there with my heart going, braced for him to wake up, and the sound rang out into the kitchen and nothing happened. He didn't stir. The world didn't end. And I stood there and realised I'd spent fifteen years killing that beep for a calm that was never even at risk.",
          'And then a sentence arrived, fully formed, the way true things do. I deserve this too. I deserve to be heard. I deserve my own comfort, in my own morning. I\'d never once let myself think it. And the moment I did, something closed behind me — I knew I couldn\'t go back to not knowing it.',
          "That was the morning it turned. Not a decision. A noticing, and then a sentence I finally let myself believe.",
          "That's what coming back to yourself actually looks like. Not loud. Not fast. Just yours — one small honest moment at a time, until one day you answer a question without scanning the room first.",
        ],
      },
    ],
    closing: [
      "If you want company in that noticing, that's what MiniMind is for — a daily companion you can think out loud with, that helps you catch those small moments of self-abandonment as they happen and slowly find your own signal again. The first 50 messages are free, no card needed. Not therapy. Not a quick fix. Just a quiet place to start the slower work — when you're ready, and at your own pace.",
    ],
  },
];

/** Newest-first list for the /journal index page. */
export function getArticlesNewestFirst(): Article[] {
  return [...ARTICLES].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Look up a single article by slug. Returns undefined if not found. */
export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

/**
 * Type guard for the AdviceParagraph union. Used by the article renderer
 * to switch between plain prose <p> and the bold-lead inline treatment.
 */
export function isAdviceParagraph(p: string | AdviceParagraph): p is AdviceParagraph {
  return typeof p === 'object' && 'lead' in p && 'body' in p;
}
