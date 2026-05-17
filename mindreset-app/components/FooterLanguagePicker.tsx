'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { PALETTE as FULL_PALETTE, TOKENS } from '@/lib/brand/colors';

// 1-year persistence — matches mr_disclaimer_acknowledged convention.
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Phase i18n.0: EN + RU only. Phase i18n.1 expands to all 8 locales.
const OPTIONS: ReadonlyArray<{ code: string; native: string }> = [
  { code: 'en', native: 'English' },
  { code: 'ru', native: 'Русский' },
];

type Props = {
  label: string;
  theme?: 'day' | 'night';
};

export default function FooterLanguagePicker({ label, theme = 'day' }: Props) {
  const currentLocale = useLocale();
  const [isPending, startTransition] = useTransition();
  const PALETTE = FULL_PALETTE[theme];

  function setLocale(next: string) {
    if (next === currentLocale || isPending) return;
    const secure =
      typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? '; Secure'
        : '';
    // Cookie name follows our existing mr_* namespace (matches i18n/request.ts).
    document.cookie = `mr_locale=${next}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
    startTransition(() => {
      // Full reload so the server-rendered Footer + any other server
      // components re-resolve the locale from the new cookie. Phase i18n.1
      // can switch to client-side routing once the [locale] segment exists.
      window.location.reload();
    });
  }

  return (
    <div
      className="mt-4 flex items-center justify-center gap-3"
      aria-label={label}
    >
      <span
        className="text-[11px] tracking-wide"
        style={{
          color: PALETTE.textHint,
          fontFamily: TOKENS.sans,
        }}
      >
        {label}:
      </span>
      {OPTIONS.map((opt, i) => (
        <span key={opt.code} className="flex items-center gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => setLocale(opt.code)}
            className="text-[12px] hover:underline underline-offset-2 transition-opacity disabled:opacity-50"
            style={{
              color: PALETTE.textMuted,
              fontFamily: TOKENS.sans,
              fontWeight: currentLocale === opt.code ? 500 : 400,
              opacity: currentLocale === opt.code ? 1 : 0.7,
            }}
          >
            {opt.native}
          </button>
          {i < OPTIONS.length - 1 && (
            <span
              className="text-[11px]"
              style={{ color: PALETTE.textHint }}
              aria-hidden="true"
            >
              ·
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
