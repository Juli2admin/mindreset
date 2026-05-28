'use client';

import { useState } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

type Stage = 'idle' | 'pending' | 'done' | 'error';

export default function ConfirmDeleteClient({ token }: { token: string | null }) {
  const { palette: PALETTE } = useTheme();
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();
  const locale = useLocale();
  const t = useTranslations('AccountDeletion');

  const [stage, setStage] = useState<Stage>('idle');
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!token) {
    return (
      <p style={{ color: PALETTE.text, fontFamily: SANS, fontSize: 16 }}>
        {t('missingToken')}
      </p>
    );
  }

  if (isSignedIn === false) {
    return (
      <div style={{ color: PALETTE.text, fontFamily: SANS, fontSize: 16, lineHeight: 1.7 }}>
        <p style={{ marginBottom: 16 }}>{t('signInToConfirm')}</p>
        <Link
          href={`/sign-in?redirect_url=${encodeURIComponent(`/account/confirm-delete?token=${token}`)}`}
          style={{
            display: 'inline-block',
            background: PALETTE.accent,
            color: PALETTE.accentText,
            padding: '12px 28px',
            borderRadius: 999,
            fontFamily: SANS,
            fontWeight: 500,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          {t('signInCta')}
        </Link>
      </div>
    );
  }

  async function handleConfirm() {
    setStage('pending');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/account/confirm-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, locale }),
      });
      const data: { ok?: boolean; scheduledAt?: string; error?: string } = await res.json();
      if (!res.ok || !data.ok) {
        setStage('error');
        setErrorMsg(data.error === 'invalid_token' ? t('tokenExpired') : t('genericError'));
        return;
      }
      if (data.scheduledAt) {
        const dateFmtLocale = locale === 'en' ? 'en-GB' : locale;
        setScheduledDate(
          new Intl.DateTimeFormat(dateFmtLocale, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(new Date(data.scheduledAt)),
        );
      }
      setStage('done');
      // Sign the user out so the soft-deleted account isn't still active in
      // their browser. They can sign back in to cancel within the grace
      // window if they change their mind.
      await signOut({ redirectUrl: `/${locale === 'en' ? '' : locale}` });
    } catch {
      setStage('error');
      setErrorMsg(t('genericError'));
    }
  }

  if (stage === 'done') {
    return (
      <div style={{ color: PALETTE.text, fontFamily: SANS, fontSize: 16, lineHeight: 1.7 }}>
        <p style={{ marginBottom: 12, fontFamily: SERIF, fontSize: 20 }}>
          {t('doneTitle')}
        </p>
        <p style={{ marginBottom: 16 }}>
          {scheduledDate ? t('doneBody', { date: scheduledDate }) : t('doneBodyNoDate')}
        </p>
      </div>
    );
  }

  return (
    <div style={{ color: PALETTE.text, fontFamily: SANS, fontSize: 16, lineHeight: 1.7 }}>
      <p style={{ marginBottom: 20 }}>{t('confirmBody1')}</p>
      <p style={{ marginBottom: 28, color: PALETTE.textMuted }}>{t('confirmBody2')}</p>
      <button
        onClick={handleConfirm}
        disabled={stage === 'pending'}
        style={{
          background: '#b91c1c',
          color: '#FFFFFF',
          padding: '12px 28px',
          borderRadius: 999,
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: 14,
          border: 'none',
          cursor: stage === 'pending' ? 'wait' : 'pointer',
          opacity: stage === 'pending' ? 0.6 : 1,
        }}
      >
        {stage === 'pending' ? t('confirming') : t('confirmCta')}
      </button>
      {errorMsg && (
        <p style={{ marginTop: 16, color: '#b91c1c', fontSize: 14 }}>{errorMsg}</p>
      )}
    </div>
  );
}
