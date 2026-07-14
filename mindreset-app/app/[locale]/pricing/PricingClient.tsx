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

// Block B — MiniMind tier data. Code, not content. Numeric values feed
// formatCurrency() (en-GB locked); period words are composed at render via
// ICU templates in the Pricing.price.* namespace. The 'kind' discriminator
// drives render: 'open' = Open badge + link, 'sub' = annual/monthly price
// line, 'oneOff' = single price line.
//
// The Journey is rendered as its own section beneath the MiniMind tier
// grid with a two-button buy row (one-off / installment). States and
// Themes each get a single catalogue card that points at the dedicated
// /states and /themes pages where the per-module buy flow lives — the
// grid used to live here too, but it duplicated the catalogues and made
// copy edits land in two places.
type TierData =
  | { id: 'freeTaster'; kind: 'open'; href: '/minimind' }
  | { id: 'miniMindEssential' | 'miniMindExtended'; kind: 'sub'; monthly: number; annual: number }
  | { id: 'topUp'; kind: 'oneOff'; price: number };

const TIERS: TierData[] = [
  { id: 'freeTaster', kind: 'open', href: '/minimind' },
  { id: 'miniMindEssential', kind: 'sub', monthly: 14.99, annual: 129 },
  { id: 'miniMindExtended', kind: 'sub', monthly: 24.99, annual: 209 },
  { id: 'topUp', kind: 'oneOff', price: 4.99 },
];

type Props = {
  currentTier: string | null;
  journeyPurchased: boolean;
  footerSlot: ReactNode;
  testimonialsSlot: ReactNode;
};

export default function PricingClient({
  currentTier,
  journeyPurchased,
  footerSlot,
  testimonialsSlot,
}: Props) {
  const t = useTranslations('Pricing');
  // Home namespace owns module titles + section copy. Pricing reuses the
  // same strings to keep the catalogue single-sourced; /home and /pricing
  // show the same product names without duplicate translations.
  const tHome = useTranslations('Home');
  const tJourney = useTranslations('Journey');
  const tErr = useTranslations('Errors');
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
        setCheckoutError(data.detail ?? data.error ?? tErr('checkoutFailed'));
        setLoading(null);
      }
    } catch {
      setCheckoutError(tErr('networkError'));
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
        setCheckoutError(data.detail ?? data.error ?? tErr('portalFailed'));
        setLoading(null);
      }
    } catch {
      setCheckoutError(tErr('networkError'));
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
        <TopBar showMarketingNav right={isSignedIn ? <UserButton /> : null} />
      </div>
      <div className="max-w-2xl mx-auto px-6 pb-12 sm:pb-16">
        {/* Phase B item 4 — Pricing H1 + subtitle. The page previously
            had NO H1 (first heading was an H3 inside a tier card), a real
            SEO weakness flagged in the Phase 2 audit. H1 is brand-voice
            consistent with the rewritten landing sections. Subtitle is
            accuracy-corrected — the free 50-message taster is MiniMind-
            only, NOT all plans (States & Themes and Journey have no
            taster), so the subtitle is explicit about which product
            carries it. Misleading-offer risk eliminated. */}
        <header className="mb-10 sm:mb-12">
          <h1
            className="text-[36px] sm:text-[44px] leading-[1.05] -tracking-[0.018em] mb-3"
            style={{ ...{ fontFamily: SERIF }, color: PALETTE.text, fontWeight: 400 }}
          >
            {t('h1Title')}
          </h1>
          <p
            className="text-[15px] leading-[1.6]"
            style={{ color: PALETTE.textMuted, fontFamily: SANS }}
          >
            {t('h1Subtitle')}
          </p>
        </header>

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

        {/* Your Journey — moved OUT of the "Coming soon" wrapper on
            2026-07-03 to make it visually clear that The Journey is
            open for purchase. States & Themes remain inside the wrapper
            below because their content delivery is still Block C. */}
        <div className="mt-16 mb-2">
          <div
            className="text-[11px] uppercase tracking-[0.22em] mb-3"
            style={{ color: PALETTE.accent, fontWeight: 500, fontFamily: SANS }}
          >
            {tHome('journey.kicker')}
          </div>
          <p
            className="text-[14px] leading-[1.65] mb-6"
            style={{ color: PALETTE.textMuted, fontFamily: SANS }}
          >
            {tHome('journey.intro')}
          </p>
          <div
            className="rounded-lg p-6"
            style={{
              background: PALETTE.bgCard,
              border: `1px solid ${PALETTE.border}`,
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3
                className="text-[20px]"
                style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
              >
                {tHome('journey.title')}
              </h3>
              {journeyPurchased && (
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
              )}
            </div>
            {journeyPurchased ? (
              // Owner already bought The Journey — hide the buy buttons
              // entirely and offer a Continue → link into /journey. Server
              // /api/checkout/create also refuses with 409 for the same
              // purchase state; this is the client-side complement so the
              // buttons never appear. Mirrors HomeClient's journeyPurchased
              // handling (HomeClient.tsx:443).
              <Link
                href="/journey"
                className="inline-block text-[13px] mt-1"
                style={{
                  color: PALETTE.accent,
                  fontFamily: SANS,
                  fontWeight: 500,
                }}
              >
                {tJourney('homeCardCta')}
              </Link>
            ) : (
              <>
                <p
                  className="text-[13px] mb-5"
                  style={{ color: PALETTE.textMuted, fontFamily: SANS }}
                >
                  {tHome('journey.priceFormat')}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleCheckout('journeyFull')}
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
                    {loading === 'journeyFull'
                      ? t('cta.processing')
                      : tHome('journey.buyOneOffCta')}
                  </button>
                  <button
                    onClick={() => handleCheckout('journeyInstallment')}
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
                    {loading === 'journeyInstallment'
                      ? t('cta.processing')
                      : tHome('journey.buyInstallmentCta')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* States & Themes — both catalogues are live (Block B webhooks +
            per-module chat pages ship). The old "Coming soon" wrapper was
            removed in PR χ3 (2026-07-14) once every module became buyable.
            /pricing now points at the dedicated catalogues where the buy
            flow lives — one card per section instead of duplicating the
            grid, so a copy edit only lands in one place. */}
        <div className="mt-24 pt-10" style={{ borderTop: `1px solid ${PALETTE.border}` }}>
          {/* States catalogue card */}
          <div className="mb-6">
            <div
              className="text-[11px] uppercase tracking-[0.22em] mb-3"
              style={{ color: PALETTE.accent, fontWeight: 500, fontFamily: SANS }}
            >
              {tHome('states.kicker')}
            </div>
            <div
              className="rounded-lg p-6"
              style={{
                background: PALETTE.bgCard,
                border: `1px solid ${PALETTE.border}`,
              }}
            >
              <h3
                className="text-[20px] leading-[1.25] mb-2"
                style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
              >
                {t('states.cardTitle')}
              </h3>
              <p
                className="text-[13px] leading-[1.65] mb-4"
                style={{ color: PALETTE.textMuted, fontFamily: SANS }}
              >
                {t('states.cardBody')}
              </p>
              <Link
                href="/states"
                className="inline-block text-[13px]"
                style={{
                  color: PALETTE.accent,
                  fontFamily: SANS,
                  fontWeight: 500,
                }}
              >
                {t('states.cardCta')}
              </Link>
            </div>
          </div>

          {/* Themes catalogue card */}
          <div className="mb-6">
            <div
              className="text-[11px] uppercase tracking-[0.22em] mb-3"
              style={{ color: PALETTE.accent, fontWeight: 500, fontFamily: SANS }}
            >
              {tHome('themes.kicker')}
            </div>
            <div
              className="rounded-lg p-6"
              style={{
                background: PALETTE.bgCard,
                border: `1px solid ${PALETTE.border}`,
              }}
            >
              <h3
                className="text-[20px] leading-[1.25] mb-2"
                style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
              >
                {t('themes.cardTitle')}
              </h3>
              <p
                className="text-[13px] leading-[1.65] mb-4"
                style={{ color: PALETTE.textMuted, fontFamily: SANS }}
              >
                {t('themes.cardBody')}
              </p>
              <Link
                href="/themes"
                className="inline-block text-[13px]"
                style={{
                  color: PALETTE.accent,
                  fontFamily: SANS,
                  fontWeight: 500,
                }}
              >
                {t('themes.cardCta')}
              </Link>
            </div>
          </div>
        </div>

        {checkoutError && (
          <p
            className="mt-4 text-[13px]"
            style={{ color: '#b91c1c', fontFamily: SANS }}
          >
            {checkoutError}
          </p>
        )}
        {testimonialsSlot}
        {footerSlot}
      </div>
    </main>
  );
}
