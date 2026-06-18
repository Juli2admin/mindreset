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
//
// PHASE C STATUS (2026-06-22):
// Three articles published; Phase C article-writing PAUSED. Articles
// 4–10 from the SEO commercial plan are DEFERRED (not cancelled).
// 2-per-month cadence will resume later. When we resume, the
// candidate next topics are:
//   - "Burnout vs exhaustion: which do you actually have?" (preferred
//     — ladders off Article 2 "Why Am I So Tired All the Time?")
//   - "Why nothing feels meaningful anymore"
// "When therapy didn't help" is ON HOLD pending careful ASA-safe
// review before it's written. The three live articles below must
// stay exactly as published — do not edit.

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

/**
 * In-prose product link. When `token` (case-sensitive substring) appears
 * in any closing paragraph, the renderer wraps that exact substring in
 * a Link to `href`. Used so each article can route its product mentions
 * to wherever is most useful at the time of writing — MiniMind to
 * /minimind for direct sign-up; The Journey to / (homepage) while the
 * product is still in phased rollout and not yet purchasable.
 *
 * Default if Article.productLinks is unspecified: a single entry
 * mapping "MiniMind" to "/minimind". Articles that want different
 * behaviour set the field explicitly.
 */
export type ProductLink = {
  /** Exact substring to match in closing prose. Case-sensitive. */
  token: string;
  /** Target href for the wrapped Link. */
  href: string;
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
   * Optional H2 heading rendered above the closing paragraphs. Useful
   * when the closing call-to-action wants its own labelled section
   * (e.g. "Where to begin") rather than reading as an unlabelled coda.
   */
  closingHeading?: string;
  /**
   * Closing paragraphs after the last section. Product tokens listed in
   * `productLinks` are wrapped in inline Links by the renderer.
   */
  closing: string[];
  /**
   * Optional per-article product-link map. If unspecified, the renderer
   * uses a default of [{ token: "MiniMind", href: "/minimind" }].
   */
  productLinks?: ProductLink[];
};

/**
 * Default product-link map used when an article omits `productLinks`.
 * Articles 1 and 2 (people-pleasing, tired) rely on this default.
 */
export const DEFAULT_PRODUCT_LINKS: ProductLink[] = [
  { token: 'MiniMind', href: '/minimind' },
];

export const ARTICLES: Article[] = [
  {
    slug: 'how-to-find-yourself-again',
    title:
      'How to Find Yourself Again After Years of Putting Everyone Else First',
    metaTitle:
      'How to Find Yourself Again After Years of Putting Everyone Else First · MindReset',
    metaDescription:
      "How to find yourself again in midlife after years of putting everyone else first — why it's not a single moment but a journey back to the parts of you that got lost.",
    author: { name: 'Julia Loya', url: '/about' },
    publishedAt: '2026-06-22',
    intro: [
      'There comes a point — often somewhere in midlife — when a quiet, frightening question surfaces. Who am I, underneath all of this?',
      "You've spent years, maybe decades, being what everyone needed. The dependable one. The one who held it together, who put herself last so often it stopped feeling like a choice and started feeling like who you were. And now the question arrives, usually at an ordinary moment, and you realise you genuinely don't know the answer anymore. You don't know what you'd do with a free afternoon that was truly your own. You can't remember what you used to love. Somewhere along the way, you lost yourself — and you're not even sure when.",
      "If you're trying to work out how to find yourself again, this is for you. But I want to be honest with you from the start about what that actually takes, because most of what's written about it isn't.",
    ],
    sections: [
      {
        heading: "Finding yourself isn't a moment. It's a return journey.",
        paragraphs: [
          "Here's the thing nobody tells you. You will not wake up one morning suddenly restored to yourself. There is no single afternoon where you light a candle, write in a journal, and emerge whole. That fantasy is everywhere, and it sets women up to feel like failures when one good day of self-care doesn't fix a lifetime of self-abandonment.",
          "The truth is slower, and far more real. You didn't lose yourself all at once, so you don't find yourself all at once either. You lost yourself in pieces — a little in childhood, when you learned which parts of you were welcome and which were not. A little more as a teenager, shaping yourself to be accepted. More again in your relationships, your marriages, your years of raising and providing and keeping everyone afloat. Each time, you left a small piece of yourself behind to be what the moment required.",
          "So finding yourself again is not a moment of arrival. It's a journey back — through your own life — to the places where you left those pieces, to pick them up and bring them home. It's real work. And it's exactly because it's real work that it actually lasts.",
        ],
      },
      {
        heading: 'Why you can’t just "choose yourself" overnight',
        paragraphs: [
          "The popular advice says: put yourself first, rediscover your passions, do what makes you happy. Good intentions, useless in practice. Because if you've spent thirty years not knowing what you want, you can't simply decide to want things on a Tuesday. The wanting muscle has wasted away. The voice that knew what you loved has been quiet so long you can't hear it.",
          "You can't choose yourself when you've lost track of who that self even is. First you have to go and find her. And she isn't in the future, in some reinvented version of you — she's in your past, in the moments you had to leave her behind. The talents you abandoned. The dreams you called unrealistic. The version of you that existed before you learned to make yourself small. She's still there. She's just waiting in the places you stopped looking.",
        ],
      },
      {
        heading: 'What the journey back actually looks like',
        paragraphs: [
          'This is the slower work, and here is roughly how it unfolds.',
          {
            lead: 'You go back to where you lost yourself.',
            body: "Not to wallow, and not to blame — but to look honestly at the turning points. The moment you learned love had conditions. The relationship where you slowly disappeared. The decade you gave to everyone but yourself. You revisit them not as wounds but as places where pieces of you were left.",
          },
          {
            lead: 'You meet the parts you left behind.',
            body: "This is the heart of it. The bold child. The creative teenager. The young woman who had plans. They didn't die — they went quiet. When you go back and actually meet them, something extraordinary happens: they come back. The talents return. The feelings you'd numbed start working again. You begin to recognise yourself.",
          },
          {
            lead: 'You gather the pieces together.',
            body: "Slowly, the fragments you've collected start to form a whole again — and the whole is not the worn-out role you'd been playing. It's the real you, the one who was there all along underneath the function. And almost always, there's a quiet shock in it: I was designed for a different life than the one I've been living.",
          },
          {
            lead: 'You start living as her, not as the role.',
            body: "This is where it becomes real. You begin making choices as the person you actually are, not the person everyone got used to. It's not loud. It's a hundred small moments of choosing yourself, until one day you realise the choosing has become natural.",
          },
        ],
      },
      {
        heading: 'The moment of truth',
        paragraphs: [
          "For most women who do this work, there's no fireworks — but there is a moment of truth, and it tends to arrive after the work, not instead of it. A quiet morning when you realise the person making the decisions is finally you. That the talents and feelings and wants that came back are yours. That you are not, and never were, the diminished version you'd been living as — you were simply someone who lost herself, and has now, piece by piece, come home.",
          "That's what finding yourself again actually means. Not a reinvention. A recovery. The return of someone who was there the whole time.",
        ],
      },
    ],
    closingHeading: 'Where to begin',
    closing: [
      "You begin by noticing — gently, daily — the small moments where you still abandon yourself, and by letting your own wants start to speak again. That's the work MiniMind supports: a daily companion you can think out loud with, to start hearing your own voice again underneath the noise of everyone else's needs. The first 50 messages are free, no card needed.",
      "And when you're ready for the deeper work — the real journey back through where you lost yourself, structured and paced so you can do it safely — that's what The Journey is built for: an eight-stage method that takes you, step by step, from where you are now to the self you'd left behind. Not therapy. Not a quick fix. A structured way to actually come home to yourself — at your own pace, when you're ready.",
    ],
    // Both product mentions route to the homepage for now — The Journey
    // is still in phased rollout and not yet purchasable, and MiniMind
    // links to / for consistency with the dual-product mention.
    productLinks: [
      { token: 'MiniMind', href: '/' },
      { token: 'The Journey', href: '/' },
    ],
  },
  {
    slug: 'why-am-i-so-tired-all-the-time',
    title: 'Why Am I So Tired All the Time? The Exhaustion No Test Can Find',
    metaTitle:
      'Why Am I So Tired All the Time? The Exhaustion No Test Can Find · MindReset',
    metaDescription:
      "Tired all the time even after sleeping, but your tests are normal? For women in midlife, the cause is often the mental load no test can find. Here's how to rest.",
    author: { name: 'Julia Loya', url: '/about' },
    publishedAt: '2026-06-20',
    intro: [
      'You did the sensible thing. You went to the doctor. They checked your iron, your thyroid, your vitamin D, asked about your sleep. And the results came back — normal. Nothing wrong. Try to rest more, they said.',
      "And yet here you are, tired all the time. You sleep, and you wake up exhausted anyway — not sleepy-tired, but empty-tired, drained before the day has even begun. If you're a woman in midlife who feels tired all the time even after a full night's sleep, and every test says you're fine, please hear this first: it's real, and you're not imagining it.",
      "There's a kind of exhaustion that no standard test is designed to find — because it doesn't live in your blood. It lives in your mind, in everything your mind has been carrying, silently and without a break, for years.",
    ],
    sections: [
      {
        heading: 'First, the honest bit',
        paragraphs: [
          "Let's be responsible about this. Genuine fatigue can have physical causes — low iron, an underactive thyroid, sleep problems, perimenopause, and others — and several are common in women aged 35 to 55. So if you haven't had it properly checked, do. Rule the physical things out first. That matters.",
          "But if you've done that — if they've run the tests, told you you're fine, and you're still dragging yourself through every day on empty — then the thing draining you probably isn't physical at all. No amount of early nights will fix it, because you were never short on sleep. You're short on something else.",
        ],
      },
      {
        heading: 'The exhaustion of a mind that never switches off',
        paragraphs: [
          "Here's what mental exhaustion actually looks like in midlife.",
          "It's eleven at night. Your body is finally still. Your mind is not. It's already running tomorrow — who needs to be where, what you forgot, the thing you should have said differently, the appointment to book, what's for dinner three days from now, the thing you mustn't forget next week. You're lying perfectly still, and your mind is doing everything, the way it always does, the way it never stops. This is why so many women say they can't switch their brain off at night.",
          "This is the part nobody can see. The people around you see a woman who's finished for the day, sitting down, apparently resting. What they can't see is that you never actually clock off — because you're the one holding it all: the schedules, the needs, the what-comes-next for everyone in your life. You remember, anticipate, plan, notice, smooth, manage. All day. In the background. Even when your eyes are closed.",
          "It has a name now — researchers call it the mental load — and the studies are clear on two things. It falls overwhelmingly on women. And it doesn't get lighter when you're successful: women with demanding careers and good incomes hand off some of the physical chores, but the invisible thinking-work stays exactly where it was. You can have help with the cleaning and still be the only person who knows when the school shoes need replacing.",
          'That is the tiredness no test can find — the exhaustion of carrying so much, every waking hour, that your mind never once gets to be empty.',
        ],
      },
      {
        heading: 'Why exhaustion hits so hard for women in midlife',
        paragraphs: [
          "You can carry the mental load for years before it catches up with you. In your twenties and thirties there's enough momentum — building, proving, small children, the sheer pace — that you don't notice the weight. You just carry it.",
          "Then midlife arrives, the noise drops a little, and you finally feel what you've been holding. You lift your head one ordinary evening and realise you can't remember the last time your mind was simply, genuinely off. Not distracted. Not numbed in front of the telly. Off. At peace. Yours.",
          "That's not weakness, and it's not a character flaw. It's the entirely predictable result of being the one who plans, tracks and holds everything — for a decade or two — with a mind that was never taught how to stop.",
        ],
      },
      {
        heading: "How to stop feeling tired when sleep isn't the problem",
        paragraphs: [
          "Here's the heart of it. If the exhaustion comes from a mind that never switches off, then the answer was never more sleep or more discipline. It's learning, slowly, how to stop — how to finish the thinking instead of carrying it into the night, and how to finally put yourself somewhere on the list. That's slower work, but it's the real fix, and it does work.",
          {
            lead: 'Name it for what it is.',
            body: "Half the weight of the mental load is that it's invisible — even to you. You just feel vaguely, permanently frazzled. The moment you can say I'm not lazy and I'm not ill — I'm carrying an enormous invisible load and no one can see it, something eases. You stop blaming yourself for being tired. That's where it begins.",
          },
          {
            lead: 'Learn how to finish the thinking.',
            body: "Most of what keeps you awake isn't being solved — it's just circling. The mind picks the same worries up again and again because they were never properly set down. Learning to close the loop — to decide there is nothing more I can usefully do about this tonight and actually put it down until morning — is a skill. It feels impossible at first. It gets easier every time you practise it.",
          },
          {
            lead: "Question what's actually yours to carry.",
            body: "Some of what you hold, you hold out of love. Some of it you hold purely out of habit — because you've always done it, because you're good at it, because no one else picked it up so you did. Not all of it is genuinely yours. Ask, gently, of each thing: does this really have to live in my head?",
          },
          {
            lead: 'Put yourself back on the list — and be kinder to yourself there.',
            body: "You organise rest, treats and care for everyone around you, and almost never extend the same to yourself; when you do, you call it selfish. It isn't. A mind that is appreciated, spoken to gently, and allowed its own small comforts recovers. A mind that is endlessly criticised and never thanked simply runs until it's empty. Learning to be on your own side isn't a luxury — for you, it's the medicine.",
          },
          {
            lead: 'Reclaim one quiet that belongs to no one but you.',
            body: "Not a spa day. Something small and real — ten minutes where your mind is off-duty and you're not tracking anyone or anything. You'll be astonished how foreign it feels at first, and how much it gives back.",
          },
        ],
      },
      {
        heading: "You're not tired. Your mind has never been allowed to rest.",
        paragraphs: [
          "That's the real reason you're exhausted all the time — the one the blood test wasn't looking for. You're not failing at being rested. You've been thinking for everyone, holding everything, in the one place no one can see it, for years — and never once being told that you're allowed to stop.",
          "Coming back from it isn't dramatic. It's quiet. It starts the first time you let your mind put something down and discover the world doesn't fall apart. Then again. Then a little more — until one evening you notice your mind has gone quiet on its own, and that the quiet, finally, is yours.",
        ],
      },
    ],
    closing: [
      "If you want somewhere to set the load down and hear yourself think, that's what MiniMind is for — a daily companion for women in midlife to think out loud with, to empty out what your mind has been carrying, finish the thoughts that keep circling, and slowly learn to let it rest. The first 50 messages are free, no card needed. Not therapy. Not a quick fix. Just a quiet place to put it down — when you're ready, and at your own pace.",
    ],
  },
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
