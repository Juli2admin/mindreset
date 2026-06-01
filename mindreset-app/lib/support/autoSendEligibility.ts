// Phase 2 support auto-send eligibility.
//
// Decides whether an inbound support email, after AI categorisation, is
// safe to auto-send the drafted reply without admin review. The
// whitelist is deliberately narrow: methodology questions only, normal
// urgency only, native-quality locales only (EN + RU), no
// suspicious-subject keywords, under the per-sender daily cap.
//
// All other categories — billing, emotional, crisis, other — stay on
// the manual-review queue forever. Auto-send is a labour-saver for the
// most predictable category, not a "let AI run support" feature.
//
// Kill switch: AUTO_SEND_SUPPORT_ENABLED env var must be the string
// "true". Default off so the system is dormant until explicitly
// switched on.

import prisma from '@/lib/prisma';

export const AUTO_SEND_HOLD_SECONDS = 60;
export const AUTO_SEND_PER_SENDER_DAILY_CAP = 3;

// Subject patterns that bypass auto-send regardless of category. These
// are topics where a wrong AI reply causes outsized harm (legal /
// regulatory exposure, sensitive personal data, refund disputes).
// Case-insensitive substring matches.
const SUBJECT_BLACKLIST = [
  'unsubscribe',
  'opt out',
  'opt-out',
  'gdpr',
  'data request',
  'data deletion',
  'delete my data',
  'delete account',
  'close account',
  'refund',
  'complaint',
  'legal',
  'lawyer',
  'solicitor',
  'ico',
  'отписаться',
  'удалить аккаунт',
  'возврат',
  'жалоба',
];

// Locales where the categoriser draft has been verified to brand voice
// + grammar quality. Native (EN) and hand-curated (RU). Other 6 locales
// rely on AI-only quality and stay manual-review for auto-send.
const AUTO_SEND_LOCALES = new Set(['en', 'ru']);

// Categories eligible for auto-send. Methodology only at launch.
const AUTO_SEND_CATEGORIES = new Set(['methodology']);

export type AutoSendDecision =
  | { eligible: true; sendAt: Date }
  | { eligible: false; reason: string };

type EligibilityInput = {
  fromEmail: string;
  subject: string;
  category: string | null;
  urgency: string;
  locale: string | null;
  draftReply: string | null;
};

function isEnabled(): boolean {
  return process.env.AUTO_SEND_SUPPORT_ENABLED === 'true';
}

function subjectIsBlacklisted(subject: string): boolean {
  const s = subject.toLowerCase();
  return SUBJECT_BLACKLIST.some((kw) => s.includes(kw));
}

async function exceedsDailyCap(fromEmail: string): Promise<boolean> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await prisma.supportEmailReply.count({
    where: {
      toEmail: fromEmail,
      autoSent: true,
      sentAt: { gte: dayAgo },
    },
  });
  return count >= AUTO_SEND_PER_SENDER_DAILY_CAP;
}

export async function evaluateAutoSend(
  input: EligibilityInput,
): Promise<AutoSendDecision> {
  if (!isEnabled()) {
    return { eligible: false, reason: 'auto-send disabled' };
  }
  if (input.category && !AUTO_SEND_CATEGORIES.has(input.category)) {
    return { eligible: false, reason: `category=${input.category}` };
  }
  if (input.urgency !== 'normal') {
    return { eligible: false, reason: `urgency=${input.urgency}` };
  }
  if (!input.locale || !AUTO_SEND_LOCALES.has(input.locale)) {
    return { eligible: false, reason: `locale=${input.locale ?? 'unknown'}` };
  }
  if (!input.draftReply || input.draftReply.trim().length < 50) {
    return { eligible: false, reason: 'draft too short' };
  }
  if (input.draftReply.length > 2000) {
    return { eligible: false, reason: 'draft too long' };
  }
  if (subjectIsBlacklisted(input.subject)) {
    return { eligible: false, reason: 'subject blacklisted' };
  }
  if (await exceedsDailyCap(input.fromEmail)) {
    return { eligible: false, reason: 'sender daily cap exceeded' };
  }

  return {
    eligible: true,
    sendAt: new Date(Date.now() + AUTO_SEND_HOLD_SECONDS * 1000),
  };
}
