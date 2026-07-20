// Informed-choice page for The Journey — Platform Step 6 (2026-07-20).
//
// Reached from the "Recommended starting points" Journey card when the user
// does NOT already own the Journey: the card routes HERE, never to checkout.
//
// This is a PAGE, not a gate. No test, no questionnaire, no blocker, no
// forced routing (owner-locked Decision 2). Both choices are always present
// and equal — continue to The Journey, or explore other options — and the
// user keeps the final decision.
//
// Auth-gated by middleware (/(.*)?/journey(.*) is in the protected matcher).
// Deliberately NOT purchase-gated: there is no journey/layout.tsx, so this
// route does not inherit the /journey purchase gate — a deciding non-owner
// can reach it. Brand-language safe (payment-adjacent surface): no
// therapy/treatment/clinical/unlimited wording.

import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { TOKENS } from '@/lib/brand/colors';
import { getServerPalette } from '@/lib/theme/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Is The Journey right for you?',
  robots: { index: false, follow: false },
};

export default function JourneyChoicePage() {
  const t = useTranslations('JourneyChoice');
  const PALETTE = getServerPalette();
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-16"
      style={{ background: PALETTE.bg, color: PALETTE.text }}
    >
      <div className="max-w-xl">
        <div
          className="text-[11px] uppercase tracking-[0.22em] mb-4"
          style={{ color: PALETTE.accent, fontWeight: 500, fontFamily: TOKENS.sans }}
        >
          {t('kicker')}
        </div>
        <h1
          className="text-[28px] leading-[1.2] mb-6"
          style={{ fontFamily: TOKENS.serif, fontWeight: 400 }}
        >
          {t('title')}
        </h1>
        {(['body1', 'body2', 'body3'] as const).map((k) => (
          <p
            key={k}
            className="text-[16px] leading-[1.7] mb-4"
            style={{ color: PALETTE.textMuted, fontFamily: TOKENS.sans }}
          >
            {t(k)}
          </p>
        ))}
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          {/* Continue — the informed decision to proceed. Routes to the
              Journey purchase surface (/pricing), same as the /home card for
              non-owners. This is the only place a Journey CTA leads to
              checkout, and only by the user's explicit choice here. */}
          <Link
            href="/pricing"
            className="inline-block text-center text-[14px] rounded-full px-6 py-3"
            style={{
              background: PALETTE.accent,
              color: PALETTE.accentText,
              fontFamily: TOKENS.sans,
              fontWeight: 500,
            }}
          >
            {t('continueCta')}
          </Link>
          <Link
            href="/home"
            className="inline-block text-center text-[14px] rounded-full px-6 py-3 border"
            style={{
              borderColor: PALETTE.border,
              color: PALETTE.text,
              fontFamily: TOKENS.sans,
              fontWeight: 500,
            }}
          >
            {t('exploreCta')}
          </Link>
        </div>
      </div>
    </div>
  );
}
