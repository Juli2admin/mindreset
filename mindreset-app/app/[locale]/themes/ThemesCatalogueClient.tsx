'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';
import {
  THEME_MODULES,
  THEME_PRICE_PENCE,
  type ThemeModuleId,
} from '@/lib/themes/modules';

type Props = {
  isSignedIn: boolean;
  accessMap: Record<string, boolean>;
  locale: string;
};

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

// PR χ2 (2026-07-14) — all 5 Themes ship with working AI prompts.
// Kept as an explicit list so a future prompt in progress can be
// tagged "roadmap" without shipping half-baked to buyers.
const LIVE_THEME_IDS: readonly ThemeModuleId[] = [
  'shame',
  'money',
  'body',
  'family',
  'self_realisation',
];

function formatPricePence(pence: number): string {
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
}

export default function ThemesCatalogueClient({
  isSignedIn,
  accessMap,
  locale,
}: Props) {
  const t = useTranslations('Themes');
  const tErr = useTranslations('Errors');
  const { palette: PALETTE } = useTheme();
  const [loadingModuleId, setLoadingModuleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy(moduleId: ThemeModuleId) {
    setLoadingModuleId(moduleId);
    setError(null);
    try {
      const res = await fetch('/api/themes/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, locale }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        setError(data.detail ?? data.error ?? tErr('checkoutFailed'));
        setLoadingModuleId(null);
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(tErr('checkoutFailed'));
      setLoadingModuleId(null);
    } catch {
      setError(tErr('networkError'));
      setLoadingModuleId(null);
    }
  }

  return (
    <main
      className="min-h-screen"
      style={{ background: PALETTE.bg, color: PALETTE.text }}
    >
      <div className="max-w-4xl mx-auto px-6 pt-12 pb-16">
        <p
          className="text-[11px] uppercase tracking-[0.22em] mb-4"
          style={{ color: PALETTE.textMuted, fontFamily: SANS }}
        >
          {t('kicker')}
        </p>
        <h1
          className="text-[32px] sm:text-[40px] leading-[1.15] mb-4"
          style={{ fontFamily: SERIF, fontWeight: 400 }}
        >
          {t('h1Title')}
        </h1>
        <p
          className="text-[16px] leading-[1.7] mb-10 max-w-2xl"
          style={{ color: PALETTE.textMuted, fontFamily: SANS }}
        >
          {t('h1Subtitle')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {THEME_MODULES.map((mod) => {
            const hasAccess = !!accessMap[mod.id];
            const isLoading = loadingModuleId === mod.id;
            const isLive = LIVE_THEME_IDS.includes(mod.id);
            return (
              <div
                key={mod.id}
                className="rounded-xl p-6 flex flex-col"
                style={{
                  border: `1px solid ${PALETTE.border}`,
                  background: PALETTE.bgCard,
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h2
                    className="text-[22px]"
                    style={{ fontFamily: SERIF, fontWeight: 400 }}
                  >
                    {t(`modules.${mod.id}.name`)}
                  </h2>
                  {!isLive && (
                    <span
                      className="text-[10px] uppercase tracking-[0.15em] h-6 px-3 rounded-full inline-flex items-center whitespace-nowrap shrink-0"
                      style={{
                        background: PALETTE.bgSubtle,
                        color: PALETTE.textHint,
                        border: `1px solid ${PALETTE.border}`,
                        fontFamily: SANS,
                        fontWeight: 500,
                      }}
                    >
                      {t('roadmapBadge')}
                    </span>
                  )}
                </div>
                <p
                  className="text-[14px] leading-[1.6] mb-6 flex-1"
                  style={{ color: PALETTE.textMuted, fontFamily: SANS }}
                >
                  {t(`modules.${mod.id}.tagline`)}
                </p>

                {hasAccess ? (
                  <Link
                    href={`/themes/${mod.id}`}
                    className="inline-block text-center rounded-full py-3 text-[14px] font-medium"
                    style={{
                      background: PALETTE.accent,
                      color: PALETTE.accentText,
                      fontFamily: SANS,
                    }}
                  >
                    {t('openCta')}
                  </Link>
                ) : !isSignedIn ? (
                  <Link
                    href="/sign-up"
                    className="inline-block text-center rounded-full py-3 text-[14px] font-medium"
                    style={{
                      background: PALETTE.accent,
                      color: PALETTE.accentText,
                      fontFamily: SANS,
                    }}
                  >
                    {t('signUpToBuy')}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleBuy(mod.id)}
                    disabled={isLoading}
                    className="rounded-full py-3 text-[14px] font-medium disabled:opacity-50"
                    style={{
                      background: PALETTE.accent,
                      color: PALETTE.accentText,
                      fontFamily: SANS,
                    }}
                  >
                    {isLoading
                      ? t('opening')
                      : t('buyCta', {
                          price: formatPricePence(THEME_PRICE_PENCE),
                        })}
                  </button>
                )}
                <p
                  className="text-[11px] mt-3 text-center"
                  style={{ color: PALETTE.textHint, fontFamily: SANS }}
                >
                  {t('accessNote')}
                </p>
              </div>
            );
          })}
        </div>

        {error && (
          <p
            className="mt-6 text-[13px] text-center"
            style={{ color: '#b91c1c', fontFamily: SANS }}
          >
            {error}
          </p>
        )}

        <p
          className="mt-12 text-[12px] leading-[1.7] text-center max-w-2xl mx-auto"
          style={{ color: PALETTE.textMuted, fontFamily: SANS }}
        >
          {t('safetyNote')}
        </p>
      </div>
    </main>
  );
}
