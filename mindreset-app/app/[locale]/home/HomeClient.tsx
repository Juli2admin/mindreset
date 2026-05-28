'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { UserButton } from '@clerk/nextjs';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';
import TopBar from '@/components/TopBar';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

type Props = {
  firstName: string | null;
  cookieToClear: boolean;
  currentTier: string;
  cycleRemaining: number;
  topUpRemaining: number;
  cycleResetAt: string | null;
  footerSlot: ReactNode;
};

export default function HomeClient({
  firstName,
  cookieToClear,
  currentTier,
  cycleRemaining,
  topUpRemaining,
  cycleResetAt,
  footerSlot,
}: Props) {
  const t = useTranslations('Home');
  const locale = useLocale();
  const { palette: PALETTE } = useTheme();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isFree = currentTier !== 'essential' && currentTier !== 'extended';
  const hasTopUp = topUpRemaining > 0;

  // Clear the screening linkage cookie once /home has successfully linked
  // it server-side (mirrors the prior /account behaviour). On linkage
  // failure the server keeps cookieToClear=false so /minimind can retry.
  useEffect(() => {
    if (cookieToClear) {
      document.cookie = 'mr_screening=; Path=/; Max-Age=0; SameSite=Lax';
    }
  }, [cookieToClear]);

  async function handleBuyTopUp() {
    setLoading('topUp');
    setError(null);
    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceKey: 'topUp', locale }),
      });
      const data: { url?: string; error?: string; detail?: string } = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.detail ?? data.error ?? 'Checkout failed');
        setLoading(null);
      }
    } catch {
      setError('Network error — please try again');
      setLoading(null);
    }
  }

  async function handlePortal() {
    setLoading('portal');
    setError(null);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      const data: { url?: string; error?: string; detail?: string } = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.detail ?? data.error ?? 'Could not open portal');
        setLoading(null);
      }
    } catch {
      setError('Network error — please try again');
      setLoading(null);
    }
  }

  const welcomeTitle = firstName
    ? t('welcomeTitleWithName', { name: firstName })
    : t('welcomeTitleNoName');

  // Date formatting respects UI locale; en uses en-GB (UK day-month order)
  // to match the brand voice locked in lib/format.ts for currency.
  const dateFormatLocale = locale === 'en' ? 'en-GB' : locale;
  const resetDateString = cycleResetAt
    ? new Intl.DateTimeFormat(dateFormatLocale, {
        day: 'numeric',
        month: 'long',
      }).format(new Date(cycleResetAt))
    : null;

  // Counter line — chooses between the with-top-up combined format and a
  // single-pool format. Top-up is the same column whether free or paid
  // because the underlying schema is one field.
  const counterLine = hasTopUp
    ? t('yourMiniMind.remainingWithTopUp', { cycle: cycleRemaining, topUp: topUpRemaining })
    : isFree
      ? t('yourMiniMind.remainingFree', { count: cycleRemaining })
      : t('yourMiniMind.remainingPaid', { count: cycleRemaining });

  return (
    <main className="min-h-screen" style={{ background: PALETTE.bg }}>
      <div className="max-w-2xl mx-auto px-6 py-4">
        <TopBar right={<UserButton />} />
      </div>
      <div className="max-w-2xl mx-auto px-6 pb-12 sm:pb-16">
        {/* Welcome section */}
        <div className="mb-12">
          <div
            className="text-[11px] uppercase tracking-[0.22em] mb-3"
            style={{ color: PALETTE.accent, fontWeight: 500, fontFamily: SANS }}
          >
            {t('welcomeKicker')}
          </div>
          <h2
            className="text-[32px] leading-[1.15] mb-4"
            style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
          >
            {welcomeTitle}
          </h2>
          <p
            className="text-[16px] leading-[1.65]"
            style={{ color: PALETTE.textMuted, fontFamily: SANS }}
          >
            {t('welcomeBody')}
          </p>
        </div>

        {/* YourMiniMind card */}
        <div className="mb-12">
          <div
            className="text-[11px] uppercase tracking-[0.22em] mb-3"
            style={{ color: PALETTE.accent, fontWeight: 500, fontFamily: SANS }}
          >
            {isFree ? t('yourMiniMind.kickerFree') : t('yourMiniMind.kickerPaid')}
          </div>
          <div
            className="rounded-lg p-6"
            style={{
              background: PALETTE.bgCard,
              border: `1px solid ${PALETTE.border}`,
            }}
          >
            <p
              className="text-[20px] mb-2"
              style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
            >
              {counterLine}
            </p>
            {isFree && !hasTopUp && (
              <p
                className="text-[13px]"
                style={{ color: PALETTE.textMuted, fontFamily: SANS }}
              >
                {t('yourMiniMind.freeNote')}
              </p>
            )}
            {!isFree && resetDateString && (
              <p
                className="text-[13px]"
                style={{ color: PALETTE.textMuted, fontFamily: SANS }}
              >
                {t('yourMiniMind.resetsOn', { date: resetDateString })}
              </p>
            )}

            <div className="flex flex-wrap gap-3 mt-5">
              <Link
                href="/minimind"
                className="px-5 py-2 rounded-full text-[13px] inline-flex items-center"
                style={{
                  background: PALETTE.accent,
                  color: PALETTE.accentText,
                  fontFamily: SANS,
                  fontWeight: 500,
                }}
              >
                {t('yourMiniMind.openMinimind')}
              </Link>

              {isFree ? (
                <Link
                  href="/pricing"
                  className="px-5 py-2 rounded-full text-[13px] inline-flex items-center"
                  style={{
                    background: 'transparent',
                    color: PALETTE.text,
                    fontFamily: SANS,
                    fontWeight: 500,
                    border: `1px solid ${PALETTE.border}`,
                  }}
                >
                  {t('yourMiniMind.seePlans')}
                </Link>
              ) : (
                <>
                  <button
                    onClick={handleBuyTopUp}
                    disabled={loading !== null}
                    className="px-5 py-2 rounded-full text-[13px] transition-opacity"
                    style={{
                      background: 'transparent',
                      color: PALETTE.text,
                      fontFamily: SANS,
                      fontWeight: 500,
                      border: `1px solid ${PALETTE.border}`,
                      opacity: loading !== null ? 0.5 : 1,
                    }}
                  >
                    {t('yourMiniMind.buyTopUp')}
                  </button>
                  <button
                    onClick={handlePortal}
                    disabled={loading !== null}
                    className="px-5 py-2 rounded-full text-[13px] transition-opacity"
                    style={{
                      background: 'transparent',
                      color: PALETTE.text,
                      fontFamily: SANS,
                      fontWeight: 500,
                      border: `1px solid ${PALETTE.border}`,
                      opacity: loading !== null ? 0.5 : 1,
                    }}
                  >
                    {t('yourMiniMind.managePlan')}
                  </button>
                </>
              )}
            </div>
            {error && (
              <p
                className="mt-4 text-[13px]"
                style={{ color: '#b91c1c', fontFamily: SANS }}
              >
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Coming soon — soft divider for Block C products. Replaced by
            real Journey + Modules cards once their content ships. */}
        <div className="mb-12">
          <hr style={{ border: 'none', borderTop: `1px dashed ${PALETTE.border}` }} />
          <div className="py-6 text-center">
            <div
              className="text-[11px] uppercase tracking-[0.22em] mb-2"
              style={{ color: PALETTE.textHint, fontWeight: 500, fontFamily: SANS }}
            >
              {t('comingSoon.label')}
            </div>
            <p
              className="text-[14px] italic"
              style={{ color: PALETTE.textMuted, fontFamily: SERIF }}
            >
              {t('comingSoon.note')}
            </p>
          </div>
          <hr style={{ border: 'none', borderTop: `1px dashed ${PALETTE.border}` }} />
        </div>

        {footerSlot}
      </div>
    </main>
  );
}
