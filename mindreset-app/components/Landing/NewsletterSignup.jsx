'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { TOKENS, sansStyle, serifStyle } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';

// Newsletter signup block on the Landing page. Email-only capture for
// visitors not ready to sign up. Writes to NewsletterSubscriber via
// /api/newsletter/subscribe; no Clerk involvement. Send to this audience
// is wired in a later PR (PR 3c).

export default function NewsletterSignup() {
  const t = useTranslations('Landing.newsletter');
  const locale = useLocale();
  const { palette: c } = useTheme();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState('idle'); // 'idle' | 'sending' | 'ok' | 'error'

  async function onSubmit(e) {
    e.preventDefault();
    if (!email || !consent) return;
    setState('sending');
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      });
      if (res.ok) {
        setState('ok');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  return (
    <section
      className="py-20"
      style={{ borderTop: `1px solid ${c.border}` }}
    >
      <div
        className="text-[11px] uppercase tracking-[0.18em] mb-4"
        style={{ ...sansStyle, color: c.accent, fontWeight: 500 }}
      >
        {t('kicker')}
      </div>

      <h2
        className="text-[32px] sm:text-[40px] leading-[1.1] -tracking-[0.015em] mb-6"
        style={{ ...serifStyle, color: c.text, fontWeight: 400 }}
      >
        {t('title')}
      </h2>

      <p
        className="text-[17px] leading-[1.65] mb-8 max-w-[36rem]"
        style={{ ...sansStyle, color: c.textMuted }}
      >
        {t('body')}
      </p>

      {state === 'ok' ? (
        <p
          className="text-[15px] leading-[1.65] max-w-[36rem]"
          style={{ ...sansStyle, color: c.accent, fontStyle: 'italic' }}
        >
          {t('success')}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="max-w-[28rem] space-y-4">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            disabled={state === 'sending'}
            className="w-full text-[15px] px-4 py-3 rounded-lg border focus:outline-none transition-colors disabled:opacity-60"
            style={{
              ...sansStyle,
              color: c.text,
              background: c.bgCard,
              borderColor: c.border,
            }}
          />

          <label className="flex items-start gap-3 text-[13px] leading-[1.5] cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={state === 'sending'}
              className="mt-0.5"
              style={{ accentColor: c.accent }}
            />
            <span style={{ ...sansStyle, color: c.textMuted }}>{t('consent')}</span>
          </label>

          <button
            type="submit"
            disabled={!email || !consent || state === 'sending'}
            className="inline-flex items-center gap-2.5 h-12 px-8 rounded-full text-[14px] tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              ...sansStyle,
              fontWeight: 500,
              background: c.accent,
              color: c.accentText,
            }}
          >
            {state === 'sending' ? '...' : t('submit')}
          </button>

          {state === 'error' && (
            <p
              className="text-[13px]"
              style={{ ...sansStyle, color: '#b91c1c' }}
            >
              {t('error')}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
