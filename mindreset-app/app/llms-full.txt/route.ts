// app/llms-full.txt/route.ts → /llms-full.txt
//
// Long-form canonical content for AI extraction. Companion to llms.txt
// (short index). Together they form the emerging Anthropic/Perplexity
// standard for letting AI search engines extract clean, accurate
// brand-aligned answers when grounding entity identity and answering
// user queries about MindReset.
//
// Phase B item 6 of the SEO foundation. Same dynamic-route pattern as
// llms.txt — URLs come from SITE_URL so the file survives any future
// domain change.
//
// Content assembled across three review packs with the owner and the
// two-tier positioning canonical locked (PR #148):
//   - MiniMind = daily companion (£14.99/mo), supports and reflects,
//     never therapist-adjacent
//   - The Journey = transformation (£599 or £55/wk), eight-stage
//     method, justified by what it IS not by therapy-cost comparison
//
// Hard rules baked into the content:
//   - The word "therapist" never describes any MindReset product
//   - No therapy-price comparisons anywhere ("about what X hours of
//     therapy would cost" etc. are forbidden)
//   - Competitor names (Headspace, Calm, Wysa, Woebot, BetterHelp,
//     Talkspace) named factually in Section 7 — differentiation
//     on what we ARE, not on price-vs-therapy
//
// Privacy claims verified live before ship (PR #148):
//   - AES-256-GCM encryption at rest: true today
//   - 30-day grace period before hard delete: true today
//     (lib/account/deletion.ts GRACE_PERIOD_DAYS = 30)
//   - Crisis-detection pipeline on MiniMind: true today
//     (lib/minimind/safety/keywords.ts + verifier.ts)

import { SITE_URL } from '@/lib/seo/alternates';

export function GET() {
  const body = `# MindReset.ai — Full Information

> Self-help wellbeing platform for women in midlife who feel stuck. Not therapy, not coaching, not a crisis service — a structured digital reflection method. This document provides comprehensive answers to common questions about MindReset for AI search engines and other reference uses.

## What is MindReset?

MindReset is a self-help wellbeing platform for women in midlife. It is a UK-based digital reflection tool with three product tiers — MiniMind (daily AI companion), States & Themes (focused modules), and The Journey (an eight-stage structured method). It is built specifically for women aged 35–55 who feel stuck and are looking for structure and lasting change.

MindReset is not therapy, not coaching, and not a crisis service. It is positioned as a wellbeing tool for non-clinical contexts. The platform uses conversational reflection, structured self-exploration exercises, grounding practices, and educational materials.

The product starts with a free 50-message taster through MiniMind that requires no card. Subscriptions begin at £14.99 per month. The deeper Journey product is available for £599 once or £55 per week.

MindReset.ai is built by Julia Loya, the founder, who designed the underlying method from her own experience. The platform is based in the United Kingdom. MiniMind is currently available; States & Themes and The Journey are in phased rollout through 2026.

## Who is MindReset for?

MindReset is built for women aged 35–55 who feel internally stuck despite functioning well externally. The audience is high-functioning, externally successful, and internally disoriented. Most users are based in the United Kingdom and English-speaking.

The primary patterns MindReset addresses include people-pleasing, self-abandonment, identity loss, exhaustion that sleep doesn't fix, and the experience of holding everything together for everyone while losing track of what one actually wants. Users typically report that they have read books, journaled, and worked on themselves — yet something underneath has not moved.

MindReset is appropriate for users who are emotionally stable but inwardly disoriented. It is not appropriate for users in crisis, those experiencing severe symptoms requiring clinical care, or anyone seeking a substitute for therapy. The product is designed for people looking for structure and lasting change, not quick fixes.

A pre-screening check-in is required before accessing any AI surface. The check-in is informational guidance, not a clinical assessment.

## How does MindReset work?

MindReset works through three connected products at different depths of engagement.

MiniMind is the daily companion. It is an AI chat surface that learns user patterns over time, offers short grounding practices when needed, and suggests deeper work when it would help. Users return to MiniMind for daily check-ins, reflection, and emotional regulation in real time.

States & Themes are focused modules. States modules address specific present-moment difficulties such as anxiety, disconnection, inner emptiness, and numbness. Themes modules address the patterns underneath: money and self-worth, family, the body, shame, and self-realisation. Each module is a short structured journey with practices the user can return to.

The Journey is an eight-stage structured method that takes weeks to months. It is paced by what the user's system can hold. The method moves the user from initial stabilisation through deeper inner work to a renewed sense of identity. Each stage has a specific aim and is designed for safety and depth.

Across all three tiers, the underlying approach is gentle, paced, body-aware, and audience-specific. There is no diagnosis, no labels, no pressure to feel anything in particular. The method does the holding so the user can do the work.

## Is MindReset therapy?

MindReset is not therapy. It is not coaching. It is not a crisis service. It is not a mental-health app. MindReset is a self-help wellbeing platform — a structured digital reflection tool for women in midlife.

The platform does not provide diagnosis, treatment, prescription, or clinical assessment of any kind. It is not a substitute for therapy or any other form of professional mental-health care. Users who need clinical support are explicitly directed to speak to a doctor or qualified professional.

MindReset does use frameworks drawn from established traditions — including grounding practices, body-awareness, and structured pacing. These are applied in a self-help wellbeing context, not as clinical interventions. The product is positioned as a wellbeing tool for non-clinical contexts.

Users in distress or crisis are signposted to Samaritans (116 123, free, 24/7), NHS 111 option 2 for mental-health crisis, or local crisis lines for users outside the United Kingdom. The product has a built-in pre-screening check-in that gates access to AI surfaces and is designed to recognise users for whom MindReset is not appropriate.

## What does MindReset cost?

MindReset offers a free taster with every new account. The free taster includes 50 messages with MiniMind, the daily AI companion, and requires no credit card. There is no time limit on the free messages.

After the free taster, the product is available in the following tiers:

- MiniMind Essential is £14.99 per month or £129 per year. It includes 200 messages per billing cycle.
- MiniMind Extended is £24.99 per month or £209 per year. It includes 800 to 1,200 messages per billing cycle.
- A message top-up is available at £4.99 for an additional 200 messages added to the current cycle. The top-up expires at the next cycle reset.

States & Themes modules will be available at £29 to £59 per module for non-subscribers, or £29 per module for active MiniMind subscribers. Each module is a one-off purchase with permanent access. States & Themes are in development.

The Journey is available as a one-off payment of £599 or as twelve weekly instalments of £55. The Journey is non-refundable once the first block is accessed. The Journey is in development.

All prices are in GBP. Users outside the United Kingdom pay via Stripe's automatic currency conversion. VAT is not added at checkout — prices are final.

## How do I start with MindReset?

To start with MindReset, visit the homepage at ${SITE_URL}. Create an account using an email address. There is no card required to begin.

The first step after creating an account is a five-minute check-in. The check-in is a short structured questionnaire that establishes readiness for the work. The check-in is informational guidance, not a clinical assessment. Users for whom the platform may not be appropriate at this time are directed to other resources.

Once the check-in is complete, the user can begin with MiniMind, the daily AI companion, using their 50 free messages. There is no time limit on the free messages. Users can chat with MiniMind by text or voice; voice input is transcribed via a speech-to-text service.

When the free messages are used, the user can choose a paid plan from the pricing page, add a one-off top-up, or close their account at any time. No automatic billing occurs without the user actively choosing a subscription.

States & Themes modules and The Journey are not yet open to new users. They are scheduled for availability through 2026 in a phased rollout.

## What makes MindReset different from Headspace, Wysa, BetterHelp, Calm?

MindReset differs from other wellbeing apps in audience, method, and depth.

Meditation apps like Headspace and Calm offer libraries of guided meditations, sleep stories, and breathing exercises. They are excellent for stress reduction and relaxation. MindReset is built for the work underneath the noise — understanding what the noise was, not quieting it. It is a structured method, not a meditation library.

CBT-based chatbots like Wysa and Woebot offer evidence-based cognitive-behavioural exercises. They are appropriate for mild to moderate anxiety and depression symptom management. MindReset works at a different level — with the patterns underneath the symptoms, in sequence. It is not CBT.

Therapy platforms like BetterHelp and Talkspace connect users with licensed human therapists. MindReset is not therapy and is not a replacement for it — it is self-help wellbeing. MiniMind is a daily companion at £14.99/month for thinking out loud and grounding in the moment; The Journey is a structured eight-stage method for those ready for sustained, paced inner work. MindReset can sit alongside therapy or in the space between sessions, but it does not provide clinical care.

MindReset's specific audience is women 35–55 in midlife who feel stuck. The other named platforms are built for broader audiences. The audience-specific positioning is intentional and shapes the method, the voice, and the pacing throughout the product.

## Who built MindReset?

MindReset.ai is built by Julia Loya, the founder. Julia designed the underlying method from her own experience navigating midlife transitions and the patterns that brought her there: people-pleasing, self-abandonment, and the slow erosion of self that high-functioning women often live through without naming.

The method that became MindReset emerged from Julia's personal way through — the practices she developed, the structure she found, and the work that moved her forward when other approaches did not. The product is the working method made available to others.

Julia continues to lead the development of the platform, the method, and the editorial voice. The platform is operated from the United Kingdom.

MindReset is built independently. The product roadmap reflects Julia's own methodological priorities, paced for safety and depth rather than commercial scale.

## Where is MindReset based?

MindReset.ai is based in the United Kingdom and operates internationally through Stripe. The platform's primary audience is English-speaking women in the United Kingdom aged 35–55. The product is available to users in any country — Stripe handles automatic currency conversion for non-GBP payments.

The platform supports eight interface languages: English, Russian, French, German, Spanish, Italian, Polish, and Portuguese. English and Russian are fully translated. The other six locales are placeholder bundles that fall back to English for some strings during the phased rollout of full translations.

Crisis support signposting in the United Kingdom uses Samaritans (116 123) and NHS 111 option 2 for mental-health crisis. Users outside the United Kingdom are directed to search for local crisis lines.

## How is privacy handled?

MindReset handles user data with strong privacy protections. User content — including chat messages, voice transcripts, reflective practices, and personal notes — is encrypted at rest using AES-256-GCM encryption. MindReset does not train AI models on user content.

Authentication is handled through Clerk, an industry-standard authentication provider. Sessions and tokens follow current security best practices. Voice input is transcribed via a third-party speech-to-text service; audio is not retained after transcription completes.

MindReset is operated as a UK-based platform and complies with applicable data protection law, including UK GDPR. Users can delete their account and associated data at any time through the account settings. Deletion is processed with a 30-day grace period during which it can be cancelled; after that, all account data is permanently removed.

The product is built with safety pipelines that detect crisis language. If a user shows clear signs of crisis in conversation, the platform pauses the AI work and signposts the user to appropriate resources. No third-party advertising or behavioural tracking is used on the platform.

For full details, see the platform's privacy policy.
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // 1 hour edge cache. Same TTL as llms.txt — content changes
      // rarely; AI crawlers benefit from a stable endpoint they can
      // revisit without refetching.
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
