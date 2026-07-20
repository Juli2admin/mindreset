'use client';

// Dashboard v1 — Platform Step 5 (2026-07-20, owner-approved copy).
//
// Two blocks above the product cards on /home:
//   1. "Why you're here" — the user's own onboarding answers (their
//      tapped labels), with a change link back to /onboarding; or the
//      invitation when onboarding was skipped.
//   2. "Suggested for you" — at most ONE open recommendation, reason
//      localised from its ruleKey ("you said" framing — never "we
//      noticed"). "Take a look" records accepted and navigates;
//      "Not now" records declined (30-day cool-off) and removes the card.
//
// Reads only the user-facing projection — hidden diagnostics cannot
// appear here by construction (see lib/platform/types.ts).

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useTheme } from '@/lib/theme/useTheme';

type Onboarding = {
  why: string | null;
  area: string | null;
  style: string | null;
  goal: string | null;
  completed: boolean;
};

type Recommendation = {
  id: string;
  product: string;
  ruleKey: string | null;
  reason: string | null;
};

const SANS = 'var(--font-sans, ui-sans-serif)';

function productHref(product: string): string {
  if (product === 'minimind') return '/minimind';
  if (product === 'journey') return '/journey';
  const [kind, moduleId] = product.split(':');
  return kind === 'state' ? `/states/${moduleId}` : `/themes/${moduleId}`;
}

export default function DashboardSection({
  onboarding,
  recommendation,
}: {
  onboarding: Onboarding | null;
  recommendation: Recommendation | null;
}) {
  const t = useTranslations('Dashboard');
  const tOnb = useTranslations('Onboarding');
  const tStates = useTranslations('States');
  const tThemes = useTranslations('Themes');
  const router = useRouter();
  const { palette: PALETTE } = useTheme();
  const [rec, setRec] = useState<Recommendation | null>(recommendation);
  const [busy, setBusy] = useState(false);

  function productName(product: string): string {
    if (product === 'minimind') return t('productMinimind');
    if (product === 'journey') return t('productJourney');
    const [kind, moduleId] = product.split(':');
    return kind === 'state'
      ? tStates(`modules.${moduleId}.name`)
      : tThemes(`modules.${moduleId}.name`);
  }

  function reasonText(r: Recommendation): string | null {
    if (r.reason) return r.reason;
    if (r.ruleKey) {
      try {
        return t(`reason_${r.ruleKey}`);
      } catch {
        return null;
      }
    }
    return null;
  }

  async function respond(response: 'accepted' | 'declined') {
    if (!rec || busy) return;
    setBusy(true);
    const target = productHref(rec.product);
    try {
      await fetch('/api/platform/recommendation/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rec.id, response }),
      });
    } catch {
      // Best-effort — never trap the user behind a failed log write.
    }
    setBusy(false);
    if (response === 'accepted') {
      router.push(target);
    } else {
      setRec(null);
    }
  }

  const answers = onboarding?.completed
    ? [
        onboarding.why && tOnb(`why_${onboarding.why}`),
        onboarding.area && tOnb(`area_${onboarding.area}`),
        onboarding.style && tOnb(`style_${onboarding.style}`),
        onboarding.goal && tOnb(`goal_${onboarding.goal}`),
      ].filter((s): s is string => Boolean(s))
    : [];

  return (
    <div className="mb-12">
      {/* Why you're here */}
      <div
        className="rounded-xl border p-5 mb-4"
        style={{ borderColor: PALETTE.border, background: PALETTE.bg }}
      >
        <div
          className="text-[11px] uppercase tracking-[0.22em] mb-3"
          style={{ color: PALETTE.accent, fontWeight: 500, fontFamily: SANS }}
        >
          {t('whyTitle')}
        </div>
        {answers.length > 0 ? (
          <>
            <ul className="flex flex-col gap-1.5 mb-3">
              {answers.map((a) => (
                <li
                  key={a}
                  className="text-[14px] leading-[1.5]"
                  style={{ color: PALETTE.text, fontFamily: SANS }}
                >
                  {a}
                </li>
              ))}
            </ul>
            <Link
              href="/onboarding"
              className="text-[13px] underline underline-offset-2"
              style={{ color: PALETTE.textMuted, fontFamily: SANS }}
            >
              {t('whyEdit')}
            </Link>
          </>
        ) : (
          <>
            <p
              className="text-[14px] leading-[1.6] mb-3"
              style={{ color: PALETTE.textMuted, fontFamily: SANS }}
            >
              {t('skippedInvite')}
            </p>
            <Link
              href="/onboarding"
              className="inline-block text-[13px] border rounded-lg px-4 py-2"
              style={{
                borderColor: PALETTE.border,
                color: PALETTE.text,
                fontFamily: SANS,
              }}
            >
              {t('skippedCta')}
            </Link>
          </>
        )}
      </div>

      {/* Suggested for you — at most one, only when open */}
      {rec && reasonText(rec) && (
        <div
          className="rounded-xl border p-5"
          style={{ borderColor: PALETTE.border, background: PALETTE.bg }}
        >
          <div
            className="text-[11px] uppercase tracking-[0.22em] mb-3"
            style={{ color: PALETTE.accent, fontWeight: 500, fontFamily: SANS }}
          >
            {t('suggestedTitle')}
          </div>
          <p
            className="text-[14px] leading-[1.6] mb-1"
            style={{ color: PALETTE.text, fontFamily: SANS }}
          >
            {reasonText(rec)}
          </p>
          <p
            className="text-[15px] mb-4"
            style={{ color: PALETTE.text, fontFamily: SANS, fontWeight: 600 }}
          >
            → {productName(rec.product)}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => respond('accepted')}
              className="text-[13px] border rounded-lg px-4 py-2"
              style={{
                borderColor: PALETTE.text,
                color: PALETTE.text,
                fontFamily: SANS,
              }}
            >
              {t('accept')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => respond('declined')}
              className="text-[13px] underline underline-offset-2"
              style={{ color: PALETTE.textMuted, fontFamily: SANS }}
            >
              {t('decline')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
