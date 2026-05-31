'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';

// Passive marketing-consent toggle in the Settings section on /home.
// Always visible (whether or not the banner was shown), so the user
// can change their mind any time after the banner has been answered
// or dismissed.

const SANS = TOKENS.sans;

type Props = {
  initialConsent: boolean;
};

export default function MarketingConsentToggle({ initialConsent }: Props) {
  const t = useTranslations('Home.marketingConsent');
  const { palette: PALETTE } = useTheme();
  const [consent, setConsent] = useState(initialConsent);
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    const next = !consent;
    try {
      const res = await fetch('/api/account/marketing-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: next }),
      });
      if (!res.ok) throw new Error('toggle failed');
      setConsent(next);
    } catch {
      // Leave state as-is on failure.
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 pr-4">
        <div
          className="text-[14px] mb-1"
          style={{ color: PALETTE.text, fontFamily: SANS, fontWeight: 500 }}
        >
          {t('toggleLabel')}
        </div>
        <div className="text-[12px]" style={{ color: PALETTE.textMuted, fontFamily: SANS }}>
          {consent ? t('toggleOn') : t('toggleOff')}
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={consent}
        className="relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50"
        style={{
          background: consent ? PALETTE.accent : PALETTE.border,
        }}
      >
        <span
          className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm"
          style={{
            transform: consent ? 'translateX(22px)' : 'translateX(2px)',
            marginTop: 2,
          }}
        />
      </button>
    </div>
  );
}
