// Support email categoriser. Single Anthropic call that detects locale,
// category, urgency, and drafts a reply in the sender's locale + brand
// voice. Result is returned to the caller for persistence; this module
// does not touch the database.
//
// Why one call: per-email AI cost stays low (~1-2k tokens), prompt
// engineering stays in one place, and we don't pay round-trip latency
// for sequential calls.
//
// Failure mode: throws. Caller decides whether to persist a fallback
// ("uncategorised") or surface the error to the admin.

import Anthropic from '@anthropic-ai/sdk';
import { recordAiUsage } from '@/lib/ai-usage/record';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1500;
const TIMEOUT_MS = 30_000;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export type SupportLocale = 'en' | 'ru' | 'fr' | 'de' | 'es' | 'it' | 'pl' | 'pt';
export type SupportCategory = 'billing' | 'emotional' | 'methodology' | 'crisis' | 'other';
export type SupportUrgency = 'normal' | 'elevated' | 'crisis';

export type CategoriserResult = {
  locale: SupportLocale;
  category: SupportCategory;
  urgency: SupportUrgency;
  draftReply: string;
  draftLocale: SupportLocale;
};

const VALID_LOCALES: SupportLocale[] = ['en', 'ru', 'fr', 'de', 'es', 'it', 'pl', 'pt'];
const VALID_CATEGORIES: SupportCategory[] = ['billing', 'emotional', 'methodology', 'crisis', 'other'];
const VALID_URGENCIES: SupportUrgency[] = ['normal', 'elevated', 'crisis'];

const SYSTEM_PROMPT = `You are the support-email categoriser for MindReset.ai — a UK-based trauma-informed self-help platform. MindReset is NOT therapy, NOT medical, NOT a crisis service. It is a self-guided emotional wellbeing tool.

Your job: classify an incoming support email and draft a reply.

OUTPUT FORMAT
Return ONLY a single JSON object. No markdown fences, no preamble, no commentary.

{
  "locale": "en|ru|fr|de|es|it|pl|pt",
  "category": "billing|emotional|methodology|crisis|other",
  "urgency": "normal|elevated|crisis",
  "draftReply": "<the reply text>",
  "draftLocale": "<same as locale>"
}

LOCALE
Detect the dominant language of the email body. If unclear or mixed, default to 'en'.

CATEGORY
- billing — payment, refund, subscription, pricing, charge, invoice, top-up
- emotional — user expressing feelings, hard time, struggle, wanting to talk
- methodology — how MindReset works, what it is, modules, MiniMind, screening, the approach
- crisis — explicit self-harm, suicidal ideation, active danger to self or others
- other — technical issues, account access, general inquiries, anything else

URGENCY
- crisis — explicit suicidal/self-harm content, plan + intent, active immediate danger
- elevated — strong distress, refund disputes, account locked, time-sensitive issues
- normal — regular questions, routine support requests

DRAFT REPLY RULES

Tone: trauma-informed, warm, calm, NOT pushy or commercial. Concise — typically 3-6 sentences. Sign off with "— The MindReset team" (translated appropriately for non-EN locales).

Language: write in the detected locale.
- RU: use formal Вы (capital В), feminine grammatical forms if gender is unclear.
- FR/DE/ES/IT/PL/PT: informal register (tu/du/tú/tu/ty/tu) for warmth.

Per-category guidance:

BILLING:
- If you can confidently answer (e.g. how to cancel: "manage from your account page"), do so.
- Specific refund / charge disputes: acknowledge, say "we'll look into your specific case and reply with details within 2 working days."
- Pricing questions: reference the /pricing page.

EMOTIONAL:
- Brief warm acknowledgement.
- Gently redirect to MiniMind chat (in-app, 24/7).
- Remind that we are a self-help platform, not therapy or crisis support.
- Do NOT attempt to provide emotional/therapeutic guidance in the email itself.

METHODOLOGY:
- Brief honest answer.
- Reference the FAQ page if relevant.
- Do not oversell — describe what MindReset is, not what it might become.

CRISIS:
- Do NOT attempt to handle.
- Be warm but redirect immediately to appropriate help.
- For UK senders or if uncertain: "Samaritans: call 116 123 (free, 24/7), or text SHOUT to 85258."
- For other regions: ask them to contact their local emergency services or a crisis line.
- Say honestly: "MindReset is a self-help tool — we are not equipped to support crisis through email. Your wellbeing matters; please reach out to one of the lines above today."

OTHER:
- Acknowledge, offer to look into it, set expectation: "we'll reply within 2 working days."

FORBIDDEN WORDS in the draft reply (Stripe-surface brand-voice rules also apply to outbound emails): therapy, therapeutic, treatment, medical, clinical intervention, diagnosis, mental illness, counselling, counseling, unlimited.

OUTPUT JSON ONLY.`;

function isValidLocale(s: unknown): s is SupportLocale {
  return typeof s === 'string' && (VALID_LOCALES as string[]).includes(s);
}
function isValidCategory(s: unknown): s is SupportCategory {
  return typeof s === 'string' && (VALID_CATEGORIES as string[]).includes(s);
}
function isValidUrgency(s: unknown): s is SupportUrgency {
  return typeof s === 'string' && (VALID_URGENCIES as string[]).includes(s);
}

export async function categoriseSupport(input: {
  subject: string;
  bodyText: string;
}): Promise<CategoriserResult> {
  const userMessage = `Subject: ${input.subject}\n\nBody:\n${input.bodyText}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      },
      { signal: controller.signal },
    );
    // Fire-and-forget AI-usage row (PR δ, 2026-07-10). Support tickets
    // aren't attributable to a single user in this codepath, so userId
    // stays null.
    recordAiUsage({
      userId: null,
      callSite: 'support_categorise',
      model: response.model ?? MODEL,
      usage: response.usage,
    }).catch((err) => console.error('[support/categorise] usage record failed:', err));
  } finally {
    clearTimeout(timeout);
  }

  // Extract text content (filter out non-text blocks).
  const text = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('');

  let parsed: unknown;
  try {
    // Tolerate accidental markdown fences if the model ever wraps the JSON.
    const cleaned = text.trim().replace(/^```(?:json)?\s*/, '').replace(/```$/, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Categoriser returned non-JSON: ${text.slice(0, 200)}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Categoriser returned non-object JSON');
  }
  const p = parsed as Record<string, unknown>;

  if (!isValidLocale(p.locale)) throw new Error(`Invalid locale: ${String(p.locale)}`);
  if (!isValidCategory(p.category)) throw new Error(`Invalid category: ${String(p.category)}`);
  if (!isValidUrgency(p.urgency)) throw new Error(`Invalid urgency: ${String(p.urgency)}`);
  if (typeof p.draftReply !== 'string' || p.draftReply.length === 0) {
    throw new Error('Missing draftReply');
  }
  if (!isValidLocale(p.draftLocale)) throw new Error(`Invalid draftLocale: ${String(p.draftLocale)}`);

  return {
    locale: p.locale,
    category: p.category,
    urgency: p.urgency,
    draftReply: p.draftReply,
    draftLocale: p.draftLocale,
  };
}
