'use client';

// [DIAG-PICKER] Temporary diagnostic for Phase i18n.0 cookie-write
// investigation. Adds console logs + visible red DOM feedback line +
// inline currentLocale display so Julia can capture state on Preview
// without needing historical Vercel logs (free tier). Single-file diff;
// revert by restoring the pre-diagnostic version of this file.

import { useState, useTransition } from 'react';
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
  // [DIAG-PICKER] visible feedback so Julia can read state pre-reload
  const [lastAction, setLastAction] = useState<string | null>(null);
  const PALETTE = FULL_PALETTE[theme];

  function setLocale(next: string) {
    // [DIAG-PICKER]
    console.log('[DIAG-PICKER] click', {
      next,
      currentLocale,
      isPending,
      time: new Date().toISOString(),
    });
    if (next === currentLocale || isPending) {
      // [DIAG-PICKER]
      console.log('[DIAG-PICKER] early return', {
        reason:
          next === currentLocale
            ? 'next === currentLocale'
            : 'isPending true',
      });
      setLastAction(
        `EARLY RETURN — next=${next} currentLocale=${currentLocale} isPending=${isPending}`,
      );
      return;
    }
    const secure =
      typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? '; Secure'
        : '';
    // Cookie name follows our existing mr_* namespace (matches i18n/request.ts).
    const cookieStr = `mr_locale=${next}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
    // [DIAG-PICKER]
    console.log('[DIAG-PICKER] about to write cookie:', cookieStr);
    document.cookie = cookieStr;
    // [DIAG-PICKER] Snapshot document.cookie immediately after the write
    // so we can verify whether the browser accepted it.
    const cookieAfter =
      typeof document !== 'undefined' ? document.cookie : '(no document)';
    // [DIAG-PICKER]
    console.log('[DIAG-PICKER] cookie write done. document.cookie now:', cookieAfter);
    setLastAction(
      `WROTE: "${cookieStr}" — document.cookie length now: ${cookieAfter.length} — contains "mr_locale": ${cookieAfter.includes('mr_locale')}`,
    );
    startTransition(() => {
      // [DIAG-PICKER]
      console.log('[DIAG-PICKER] reload triggered');
      // Small delay so Julia can see the feedback line before the reload
      // wipes the page state. 1500ms is enough to read + screenshot.
      // [DIAG-PICKER] Without this delay the feedback line is invisible.
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    });
  }

  return (
    <div
      className="mt-4 flex flex-col items-center justify-center gap-2"
      aria-label={label}
    >
      {/* [DIAG-PICKER] visible red feedback line + currentLocale display */}
      <div
        style={{
          fontSize: 10,
          color: '#cc0000',
          fontFamily: 'monospace',
          maxWidth: 600,
          textAlign: 'center',
          wordBreak: 'break-all',
        }}
      >
        [DIAG-PICKER] currentLocale={String(currentLocale)} · isPending=
        {String(isPending)}
        {lastAction && <div>{lastAction}</div>}
      </div>

      <div className="flex items-center justify-center gap-3">
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
    </div>
  );
}
