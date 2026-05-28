'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

const MAX_STORY = 1500;
const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;

type State = 'idle' | 'sending' | 'sent' | 'error';

export default function ShareYourStoryClient() {
  const { palette: PALETTE } = useTheme();
  const t = useTranslations('ShareYourStory');
  const locale = useLocale();

  const [publicName, setPublicName] = useState('');
  const [ageRange, setAgeRange] = useState<string>('');
  const [story, setStory] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const charsLeft = MAX_STORY - story.length;
  const canSubmit =
    publicName.trim().length > 0 &&
    story.trim().length > 0 &&
    story.length <= MAX_STORY &&
    consent &&
    state !== 'sending';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setState('sending');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/testimonials/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicName: publicName.trim(),
          ageRange: ageRange || undefined,
          story: story.trim(),
          locale,
          consent,
        }),
      });
      if (!res.ok) {
        setState('error');
        setErrorMsg(t('submitError'));
        return;
      }
      setState('sent');
    } catch {
      setState('error');
      setErrorMsg(t('submitError'));
    }
  }

  if (state === 'sent') {
    return (
      <div
        className="rounded-lg p-8"
        style={{ background: PALETTE.bgCard, border: `1px solid ${PALETTE.border}` }}
      >
        <p
          className="text-[22px] mb-3"
          style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
        >
          {t('thanksTitle')}
        </p>
        <p
          className="text-[15px] leading-[1.7]"
          style={{ fontFamily: SANS, color: PALETTE.textMuted }}
        >
          {t('thanksBody')}
        </p>
      </div>
    );
  }

  const labelStyle = {
    fontFamily: SANS,
    fontSize: 13,
    fontWeight: 500,
    color: PALETTE.text,
    display: 'block',
    marginBottom: 6,
  };
  const inputStyle = {
    fontFamily: SANS,
    fontSize: 16,
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: `1px solid ${PALETTE.border}`,
    background: PALETTE.bgCard,
    color: PALETTE.text,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="publicName" style={labelStyle}>
          {t('nameLabel')}
        </label>
        <input
          id="publicName"
          type="text"
          maxLength={40}
          value={publicName}
          onChange={(e) => setPublicName(e.target.value)}
          placeholder={t('namePlaceholder')}
          style={inputStyle}
        />
        <p
          className="text-[12px] mt-1.5"
          style={{ color: PALETTE.textMuted, fontFamily: SANS, lineHeight: 1.5 }}
        >
          {t('nameHelp')}
        </p>
      </div>

      <div>
        <label htmlFor="ageRange" style={labelStyle}>
          {t('ageLabel')}
        </label>
        <select
          id="ageRange"
          value={ageRange}
          onChange={(e) => setAgeRange(e.target.value)}
          style={inputStyle}
        >
          <option value="">{t('ageOptional')}</option>
          {AGE_RANGES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="story" style={labelStyle}>
          {t('storyLabel')}
        </label>
        <textarea
          id="story"
          rows={8}
          maxLength={MAX_STORY + 1}
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder={t('storyPlaceholder')}
          style={{ ...inputStyle, fontFamily: SERIF, fontSize: 16, lineHeight: 1.6, resize: 'vertical' }}
        />
        <p
          className="text-[12px] mt-1.5 flex justify-between"
          style={{ color: PALETTE.textMuted, fontFamily: SANS }}
        >
          <span>{t('storyHelp')}</span>
          <span style={{ color: charsLeft < 0 ? '#b91c1c' : PALETTE.textMuted }}>
            {charsLeft}
          </span>
        </p>
      </div>

      <label
        className="flex items-start gap-3 cursor-pointer"
        style={{ fontFamily: SANS, fontSize: 14, color: PALETTE.text, lineHeight: 1.6 }}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          style={{ marginTop: 4, accentColor: PALETTE.accent }}
        />
        <span>{t('consentLabel')}</span>
      </label>

      <div className="pt-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-8 py-3 rounded-full text-[14px] transition-opacity"
          style={{
            background: PALETTE.accent,
            color: PALETTE.accentText,
            fontFamily: SANS,
            fontWeight: 500,
            border: 'none',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: canSubmit ? 1 : 0.5,
          }}
        >
          {state === 'sending' ? t('submitting') : t('submitCta')}
        </button>
        {errorMsg && (
          <p className="mt-3 text-[13px]" style={{ color: '#b91c1c', fontFamily: SANS }}>
            {errorMsg}
          </p>
        )}
      </div>
    </form>
  );
}
