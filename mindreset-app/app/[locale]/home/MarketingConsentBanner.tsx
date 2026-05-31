'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';

// Marketing-consent opt-in banner. Shows once on /home — server decides
// visibility by checking marketingConsentPromptedAt. Both buttons here
// stamp the prompted timestamp server-side so the banner disappears
// after this interaction regardless of which one the user clicks.
//
// Trauma-informed brand voice: no pressure, "Not now" is equally
// visually weighted, and the body promises infrequent emails.

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

type Props = {
  initialVisible: boolean;
};

export default function MarketingConsentBanner({ initialVisible }: Props) {
  const t = useTranslations('Home.marketingConsent');
  const { palette: PALETTE } = useTheme();
  const [visible, setVisible] = useState(initialVisible);
  const [pending, setPending] = useState(false);

  async function submit(consent: boolean) {
    setPending(true);
    try {
      await fetch('/api/account/marketing-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent, dismissBanner: !consent }),
      });
      setVisible(false);
    } catch {
      // Best-effort. If the request fails, leave the banner up so the
      // user can try again. The server-side gate will hide it on next
      // page load anyway once the request eventually succeeds.
      setPending(false);
    }
  }

  if (!visible) return null;

  return (
    <div
      className="rounded-lg p-5 mb-8"
      style={{
        background: PALETTE.bgCard,
        border: `1px solid ${PALETTE.border}`,
      }}
    >
      <h3
        className="text-[18px] mb-2"
        style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
      >
        {t('title')}
      </h3>
      <p
        className="text-[14px] leading-[1.6] mb-4"
        style={{ color: PALETTE.textMuted, fontFamily: SANS }}
      >
        {t('body')}
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => submit(true)}
          disabled={pending}
          className="px-5 py-2 rounded-full text-[13px] transition-opacity"
          style={{
            background: PALETTE.accent,
            color: PALETTE.accentText,
            fontFamily: SANS,
            fontWeight: 500,
            opacity: pending ? 0.5 : 1,
          }}
        >
          {t('yes')}
        </button>
        <button
          onClick={() => submit(false)}
          disabled={pending}
          className="px-5 py-2 rounded-full text-[13px] transition-opacity"
          style={{
            background: 'transparent',
            color: PALETTE.text,
            fontFamily: SANS,
            fontWeight: 500,
            border: `1px solid ${PALETTE.border}`,
            opacity: pending ? 0.5 : 1,
          }}
        >
          {t('notNow')}
        </button>
      </div>
    </div>
  );
}
