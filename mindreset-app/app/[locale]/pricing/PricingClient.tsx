'use client';

import { useState, type ReactNode } from 'react';
import { UserButton, useUser } from '@clerk/nextjs';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';
import TopBar from '@/components/TopBar';
import { formatCurrency } from '@/lib/format';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

// Block B — Product tier data. Code, not content. Numeric values feed
// formatCurrency() (en-GB locked); period words are composed at render via
// ICU templates in the Pricing.price.* namespace. The 'kind' discriminator
// drives render: 'open' = Open badge + link, 'sub' = annual/monthly price
// line, 'oneOff' = single price line, 'comingSoon' = badge only, no price.
type TierData =
  | { id: 'freeTaster'; kind: 'open'; href: '/minimind' }
  | { id: 'miniMindEssential' | 'miniMindExtended'; kind: 'sub'; monthly: number; annual: number }
  | { id: 'topUp'; kind: 'oneOff'; price: number }
  | { id: 'statesThemes' | 'journey'; kind: 'comingSoon' };

const TIERS: TierData[] = [
  { id: 'freeTaster', kind: 'open', href: '/minimind' },
  { id: 'miniMindEssential', kind: 'sub', monthly: 14.99, annual: 129 },
  { id: 'miniMindExtended', kind: 'sub', monthly: 24.99, annual: 209 },
  { id: 'topUp', kind: 'oneOff', price: 4.99 },
  { id: 'statesThemes', kind: 'comingSoon' },
  { id: 'journey', kind: 'comingSoon' },
];

type Props = {
  currentTier: string | null;
  footerSlot: ReactNode;
};

export default function PricingClient({ currentTier, footerSlot }: Props) {
  const t = useTranslations('Pricing');
  const locale = useLocale();
  const { isSignedIn } = useUser();
  const { palette: PALETTE } = useTheme();
  const [loading, setLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const userIsSubscribed = currentTier === 'essential' || currentTier === 'extended';

  async function handleCheckout(priceKey: string) {
    if (!isSignedIn) {
      // /pricing is public; an anonymous click on Buy redirects to sign-up.
      // After sign-up the user lands on /home and can revisit /pricing.
      window.location.href = `/${locale}/sign-up`;
      return;
    }
    setLoading(priceKey);
    setCheckoutError(null);
    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceKey, locale }),
      });
      const data: { url?: string; error?: string; detail?: string } = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(data.detail ?? data.error ?? 'Checkout failed');
        setLoading(null);
      }
    } catch {
      setCheckoutError('Network error — please try again');
      setLoading(null);
    }
  }

  async function handlePortal() {
    setLoading('portal');
    setCheckoutError(null);
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
        setCheckoutError(data.detail ?? data.error ?? 'Could not open portal');
        setLoading(null);
      }
    } catch {
      setCheckoutError('Network error — please try again');
      setLoading(null);
    }
  }

  function renderTierPrice(tier: TierData): string | null {
    if (tier.kind === 'sub') {
      return t('price.perYearOrMonth', {
        annual: formatCurrency(tier.annual),
        monthly: formatCurrency(tier.monthly),
      });
    }
    if (tier.kind === 'oneOff') {
      return t('price.oneOff', { price: formatCurrency(tier.price) });
    }
    return null;
  }

  return (
    <main className="min-h-screen" style={{ background: PALETTE.bg }}>
      <div className="max-w-2xl mx-auto px-6 py-4">
        <TopBar right={isSignedIn ? <UserButton /> : null} />
      </div>
      <div className="max-w-2xl mx-auto px-6 pb-12 sm:pb-16">
        <div className="space-y-4">
          {TIERS.map((tier) => {
            const title = t(`tiers.${tier.id}.title`);
            const subtitle = t(`tiers.${tier.id}.subtitle`);
            const description = t(`tiers.${tier.id}.description`);
            const priceText = renderTierPrice(tier);

            const inner = (
              <>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <h3
                      className="text-[20px] mb-1"
                      style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
                    >
                      {title}
                    </h3>
                    <p
                      className="text-[13px]"
                      style={{ color: PALETTE.textMuted, fontFamily: SANS }}
                    >
                      {subtitle}
                    </p>
                  </div>
                  {tier.kind === 'open' ? (
                    <span
                      className="text-[10px] uppercase tracking-[0.15em] h-6 px-3 rounded-full inline-flex items-center whitespace-nowrap shrink-0"
                      style={{
                        background: PALETTE.accent,
                        color: PALETTE.accentText,
                        fontFamily: SANS,
                        fontWeight: 500,
                      }}
                    >
                      {t('tierOpen')}
                    </span>
                  ) : tier.kind === 'comingSoon' ? (
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
                      {t('comingSoon')}
                    </span>
                  ) : (currentTier === 'essential' && tier.id === 'miniMindEssential') ||
                      (currentTier === 'extended'  && tier.id === 'miniMindExtended') ? (
                    <span
                      className="text-[10px] uppercase tracking-[0.15em] h-6 px-3 rounded-full inline-flex items-center whitespace-nowrap shrink-0"
                      style={{
                        background: PALETTE.accent,
                        color: PALETTE.accentText,
                        fontFamily: SANS,
                        fontWeight: 500,
                      }}
                    >
                      {t('tierActive')}
                    </span>
                  ) : null}
                </div>
                <p
                  className="text-[15px] mb-4"
                  style={{ color: PALETTE.text, lineHeight: 1.6, fontFamily: SANS }}
                >
                  {description}
                </p>
                {priceText && (
                  <p
                    className="text-[14px]"
                    style={{ color: PALETTE.textMuted, fontWeight: 500, fontFamily: SANS }}
                  >
                    {priceText}
                  </p>
                )}
              </>
            );

            if (tier.kind === 'open') {
              // Free taster card links into /minimind directly for signed-in
              // users; for anonymous, send to /sign-up so they create an
              // account before reaching the chat surface.
              return (
                <Link
                  key={tier.id}
                  href={isSignedIn ? tier.href : '/sign-up'}
                  className="block rounded-lg p-6 transition-all"
                  style={{
                    background: PALETTE.bgCard,
                    border: `1px solid ${PALETTE.border}`,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = PALETTE.borderStrong)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = PALETTE.border)
                  }
                >
                  {inner}
                </Link>
              );
            }

            const monthlyKey = tier.id === 'miniMindEssential' ? 'essentialMonthly' : 'extendedMonthly';
            const annualKey  = tier.id === 'miniMindEssential' ? 'essentialAnnual'  : 'extendedAnnual';

            return (
              <div
                key={tier.id}
                className="rounded-lg p-6 transition-all"
                style={{
                  background: PALETTE.bgCard,
                  border: `1px solid ${PALETTE.border}`,
                }}
              >
                {inner}
                {tier.kind === 'sub' && (
                  <div className="flex flex-wrap gap-3 mt-5">
                    {userIsSubscribed ? (
                      ((currentTier === 'essential' && tier.id === 'miniMindEssential') ||
                        (currentTier === 'extended' && tier.id === 'miniMindExtended')) && (
                        <button
                          onClick={handlePortal}
                          disabled={loading !== null}
                          className="px-5 py-2 rounded-full text-[13px] transition-opacity"
                          style={{
                            background: PALETTE.accent,
                            color: PALETTE.accentText,
                            fontFamily: SANS,
                            fontWeight: 500,
                            opacity: loading !== null ? 0.5 : 1,
                          }}
                        >
                          {loading === 'portal'
                            ? t('cta.processing')
                            : t('cta.managePlan')}
                        </button>
                      )
                    ) : (
                      <>
                        <button
                          onClick={() => handleCheckout(monthlyKey)}
                          disabled={loading !== null}
                          className="px-5 py-2 rounded-full text-[13px] transition-opacity"
                          style={{
                            background: PALETTE.accent,
                            color: PALETTE.accentText,
                            fontFamily: SANS,
                            fontWeight: 500,
                            opacity: loading !== null ? 0.5 : 1,
                          }}
                        >
                          {loading === monthlyKey
                            ? t('cta.processing')
                            : t('cta.subscribeMonthly')}
                        </button>
                        <button
                          onClick={() => handleCheckout(annualKey)}
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
                          {loading === annualKey
                            ? t('cta.processing')
                            : t('cta.subscribeAnnual')}
                        </button>
                      </>
                    )}
                  </div>
                )}
                {tier.kind === 'oneOff' && tier.id === 'topUp' && (
                  <div className="mt-5">
                    <button
                      onClick={() => handleCheckout('topUp')}
                      disabled={loading !== null}
                      className="px-5 py-2 rounded-full text-[13px] transition-opacity"
                      style={{
                        background: PALETTE.accent,
                        color: PALETTE.accentText,
                        fontFamily: SANS,
                        fontWeight: 500,
                        opacity: loading !== null ? 0.5 : 1,
                      }}
                    >
                      {loading === 'topUp'
                        ? t('cta.processing')
                        : t('cta.buyTopUp')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {checkoutError && (
          <p
            className="mt-4 text-[13px]"
            style={{ color: '#b91c1c', fontFamily: SANS }}
          >
            {checkoutError}
          </p>
        )}
        {footerSlot}
      </div>
    </main>
  );
}
