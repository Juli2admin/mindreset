'use client';

import { useEffect, type ReactNode } from 'react';
import { UserButton } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
// Phase i18n.1b — locale-aware Link.
import { Link } from '@/i18n/navigation';
import { PALETTE as FULL_PALETTE, TOKENS } from '@/lib/brand/colors';
// Phase i18n.1d.2 — shared TopBar (client component) imported directly.
import TopBar from '@/components/TopBar';
// Phase i18n.2a — formatCurrency for price values; period words come
// from message bundles via ICU template strings.
import { formatCurrency } from '@/lib/format';
// Footer arrives as a server-rendered slot via `footerSlot` — see
// app/account/page.tsx.

const PALETTE = FULL_PALETTE.day;
const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

// Phase i18n.2a — Product tier data. Code, not content. Numeric values
// feed formatCurrency() (en-GB locked per Phase 1c); period words are
// composed at render via ICU templates in the Account.price.* namespace.
type TierData =
  | { id: 'miniMind'; price: number; priceKey: 'perMonth'; href: '/minimind' }
  | { id: 'statesThemes'; single: number; monthly: number; priceKey: 'eachOrPerMonth' }
  | {
      id: 'journey';
      single: number;
      instalment: number;
      count: number;
      priceKey: 'oneOffOrInstalments';
    };

const TIERS: TierData[] = [
  { id: 'miniMind', price: 9.99, priceKey: 'perMonth', href: '/minimind' },
  { id: 'statesThemes', single: 199, monthly: 39, priceKey: 'eachOrPerMonth' },
  {
    id: 'journey',
    single: 1200,
    instalment: 225,
    count: 6,
    priceKey: 'oneOffOrInstalments',
  },
];

type Props = {
  firstName: string | null;
  cookieToClear: boolean;
  footerSlot: ReactNode;
};

export default function AccountClient({
  firstName,
  cookieToClear,
  footerSlot,
}: Props) {
  const t = useTranslations('Account');

  useEffect(() => {
    if (cookieToClear) {
      document.cookie = 'mr_screening=; Path=/; Max-Age=0; SameSite=Lax';
    }
  }, [cookieToClear]);

  const welcomeTitle = firstName
    ? t('welcomeTitleWithName', { name: firstName })
    : t('welcomeTitleNoName');

  function renderTierPrice(tier: TierData): string {
    if (tier.priceKey === 'perMonth') {
      return t('price.perMonth', { price: formatCurrency(tier.price) });
    }
    if (tier.priceKey === 'eachOrPerMonth') {
      return t('price.eachOrPerMonth', {
        single: formatCurrency(tier.single),
        monthly: formatCurrency(tier.monthly),
      });
    }
    return t('price.oneOffOrInstalments', {
      single: formatCurrency(tier.single),
      count: tier.count,
      instalment: formatCurrency(tier.instalment),
    });
  }

  return (
    <main className="min-h-screen" style={{ background: PALETTE.bg }}>
      <div className="max-w-2xl mx-auto px-6 py-4">
        <TopBar right={<UserButton />} />
      </div>
      <div className="max-w-2xl mx-auto px-6 pb-12 sm:pb-16">
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

        <div className="space-y-4">
          {TIERS.map((tier) => {
            const title = t(`tiers.${tier.id}.title`);
            const subtitle = t(`tiers.${tier.id}.subtitle`);
            const description = t(`tiers.${tier.id}.description`);
            const priceText = renderTierPrice(tier);
            const hasHref = 'href' in tier && tier.href;

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
                  {hasHref ? (
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
                  ) : (
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
                  )}
                </div>
                <p
                  className="text-[15px] mb-4"
                  style={{ color: PALETTE.text, lineHeight: 1.6, fontFamily: SANS }}
                >
                  {description}
                </p>
                <p
                  className="text-[14px]"
                  style={{ color: PALETTE.textMuted, fontWeight: 500, fontFamily: SANS }}
                >
                  {priceText}
                </p>
              </>
            );

            if (hasHref && 'href' in tier) {
              return (
                <Link
                  key={tier.id}
                  href={tier.href}
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
              </div>
            );
          })}
        </div>
        {footerSlot}
      </div>
    </main>
  );
}
