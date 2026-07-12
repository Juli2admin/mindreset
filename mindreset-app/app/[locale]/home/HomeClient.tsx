'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { UserButton } from '@clerk/nextjs';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';
import TopBar from '@/components/TopBar';
import MarketingConsentBanner from './MarketingConsentBanner';
import MarketingConsentToggle from './MarketingConsentToggle';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

// Module catalogue rendered in the States and Themes sections of /home.
// Each ID resolves a title via `Home.states.modules.<id>` / `Home.themes.modules.<id>`.
// Buy buttons route to /pricing today; PR3 wires real checkout per module.
const STATE_IDS = ['anxiety', 'lowEnergy', 'comeBack', 'empty'] as const;
const THEME_IDS = ['money', 'body', 'family', 'shame', 'selfRealisation'] as const;

type Props = {
  firstName: string | null;
  cookieToClear: boolean;
  currentTier: string;
  cycleRemaining: number;
  topUpRemaining: number;
  cycleResetAt: string | null;
  deletionScheduledAt: string | null;
  marketingConsent: boolean;
  marketingPrompted: boolean;
  journeyPurchased: boolean;
  hasActiveSubscription: boolean;
  footerSlot: ReactNode;
};

export default function HomeClient({
  firstName,
  cookieToClear,
  currentTier,
  cycleRemaining,
  topUpRemaining,
  cycleResetAt,
  deletionScheduledAt,
  marketingConsent,
  marketingPrompted,
  journeyPurchased,
  hasActiveSubscription,
  footerSlot,
}: Props) {
  const t = useTranslations('Home');
  const tDel = useTranslations('AccountDeletion');
  const tJourney = useTranslations('Journey');
  const tErr = useTranslations('Errors');
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
        setError(data.detail ?? data.error ?? tErr('checkoutFailed'));
        setLoading(null);
      }
    } catch {
      setError(tErr('networkError'));
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
        setError(data.detail ?? data.error ?? tErr('portalFailed'));
        setLoading(null);
      }
    } catch {
      setError(tErr('networkError'));
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

        {/* Marketing-consent opt-in banner. Server-side gate: only renders
            when the user hasn't been prompted yet AND isn't already opted
            in. The component itself hides after either button is clicked. */}
        {!marketingPrompted && !marketingConsent && (
          <MarketingConsentBanner initialVisible={true} />
        )}

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
                    {t('yourMiniMind.browsePlans')}
                  </Link>
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

        {/* Deletion-pending banner — shown when the user has confirmed
            account deletion. Stays visible the entire grace window with a
            single-click "Cancel deletion" button. */}
        {deletionScheduledAt && (
          <DeletionPendingBanner scheduledAt={deletionScheduledAt} t={tDel} />
        )}

        {/* Settings — marketing toggle, export data, delete account.
            Hidden once deletion is scheduled (the banner above takes over). */}
        {!deletionScheduledAt && (
          <SettingsSection
            t={tDel}
            tHome={t}
            locale={locale}
            marketingConsent={marketingConsent}
            hasActiveSubscription={hasActiveSubscription}
          />
        )}

        {/* Your States — 4 individually-priced modules. Cards are
            informational until PR3 wires per-module Stripe checkout;
            the "available soon" badge swaps for a real Buy button then. */}
        <div className="mb-12">
          <div
            className="text-[11px] uppercase tracking-[0.22em] mb-3"
            style={{ color: PALETTE.accent, fontWeight: 500, fontFamily: SANS }}
          >
            {t('states.kicker')}
          </div>
          <p
            className="text-[14px] leading-[1.65] mb-6"
            style={{ color: PALETTE.textMuted, fontFamily: SANS }}
          >
            {t('states.intro')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {STATE_IDS.map((id) => (
              <div
                key={id}
                className="rounded-lg p-5"
                style={{
                  background: PALETTE.bgCard,
                  border: `1px solid ${PALETTE.border}`,
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3
                    className="text-[16px] leading-[1.3]"
                    style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
                  >
                    {t(`states.modules.${id}` as 'states.modules.anxiety')}
                  </h3>
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
                    {t('availableSoon')}
                  </span>
                </div>
                <p
                  className="text-[12px]"
                  style={{ color: PALETTE.textMuted, fontFamily: SANS }}
                >
                  {t('modulePriceFormat')}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Your Themes — 5 individually-priced modules. */}
        <div className="mb-12">
          <div
            className="text-[11px] uppercase tracking-[0.22em] mb-3"
            style={{ color: PALETTE.accent, fontWeight: 500, fontFamily: SANS }}
          >
            {t('themes.kicker')}
          </div>
          <p
            className="text-[14px] leading-[1.65] mb-6"
            style={{ color: PALETTE.textMuted, fontFamily: SANS }}
          >
            {t('themes.intro')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {THEME_IDS.map((id) => (
              <div
                key={id}
                className="rounded-lg p-5"
                style={{
                  background: PALETTE.bgCard,
                  border: `1px solid ${PALETTE.border}`,
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3
                    className="text-[16px] leading-[1.3]"
                    style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
                  >
                    {t(`themes.modules.${id}` as 'themes.modules.money')}
                  </h3>
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
                    {t('availableSoon')}
                  </span>
                </div>
                <p
                  className="text-[12px]"
                  style={{ color: PALETTE.textMuted, fontFamily: SANS }}
                >
                  {t('modulePriceFormat')}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Your Journey — single card, two purchase options. */}
        <div className="mb-12">
          <div
            className="text-[11px] uppercase tracking-[0.22em] mb-3"
            style={{ color: PALETTE.accent, fontWeight: 500, fontFamily: SANS }}
          >
            {t('journey.kicker')}
          </div>
          <p
            className="text-[14px] leading-[1.65] mb-6"
            style={{ color: PALETTE.textMuted, fontFamily: SANS }}
          >
            {t('journey.intro')}
          </p>
          {journeyPurchased ? (
            <Link
              href="/journey"
              className="block rounded-lg p-6 transition-colors hover:bg-[color:var(--journey-hover-bg)]"
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
                  {t('journey.title')}
                </h3>
                <span
                  className="text-[12px] inline-flex items-center whitespace-nowrap shrink-0"
                  style={{
                    color: PALETTE.accent,
                    fontFamily: SANS,
                    fontWeight: 500,
                  }}
                >
                  {tJourney('homeCardCta')}
                </span>
              </div>
            </Link>
          ) : (
            // Not-yet-purchased state. Journey is buyable now (2026-07-03
            // launch push, PRs #207/#208/#209) — flip this card from the
            // old "Available soon" badge to a Link into /pricing with the
            // canonical Buy CTA. Buying happens on /pricing, not here, to
            // keep the /home dashboard focused on ongoing use rather than
            // acquisition.
            <Link
              href="/pricing"
              className="block rounded-lg p-6 transition-colors hover:bg-[color:var(--journey-hover-bg)]"
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
                  {t('journey.title')}
                </h3>
                <span
                  className="text-[12px] inline-flex items-center whitespace-nowrap shrink-0"
                  style={{
                    color: PALETTE.accent,
                    fontFamily: SANS,
                    fontWeight: 500,
                  }}
                >
                  {t('journey.buyButton')}
                </span>
              </div>
              <p
                className="text-[13px]"
                style={{ color: PALETTE.textMuted, fontFamily: SANS }}
              >
                {t('journey.priceFormat')}
              </p>
            </Link>
          )}
        </div>

        {footerSlot}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Settings — Export data + Delete account.
// ---------------------------------------------------------------------------

type TFn = (key: string, vars?: Record<string, string | number | Date>) => string;

function SettingsSection({
  t,
  tHome,
  locale,
  marketingConsent,
  hasActiveSubscription,
}: {
  t: TFn;
  tHome: TFn;
  locale: string;
  marketingConsent: boolean;
  hasActiveSubscription: boolean;
}) {
  const { palette: PALETTE } = useTheme();
  const [exportLoading, setExportLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [deleteState, setDeleteState] = useState<'idle' | 'confirming' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleManageSubscription() {
    setPortalLoading(true);
    setErrorMsg(null);
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
        setErrorMsg(data.detail ?? data.error ?? 'Could not open portal');
        setPortalLoading(false);
      }
    } catch {
      setErrorMsg('Network error — please try again');
      setPortalLoading(false);
    }
  }

  async function handleExport() {
    setExportLoading(true);
    try {
      const res = await fetch('/api/account/export', { method: 'POST' });
      if (!res.ok) throw new Error('export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mindreset-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMsg(t('exportError'));
    } finally {
      setExportLoading(false);
    }
  }

  async function handleDeleteRequest() {
    setDeleteState('sending');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/account/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) {
        setDeleteState('error');
        setErrorMsg(t('deleteRequestError'));
        return;
      }
      setDeleteState('sent');
    } catch {
      setDeleteState('error');
      setErrorMsg(t('deleteRequestError'));
    }
  }

  return (
    <div className="mb-12">
      <div
        className="text-[11px] uppercase tracking-[0.22em] mb-3"
        style={{ color: PALETTE.accent, fontWeight: 500, fontFamily: SANS }}
      >
        {t('settingsKicker')}
      </div>
      <div
        className="rounded-lg p-6"
        style={{
          background: PALETTE.bgCard,
          border: `1px solid ${PALETTE.border}`,
        }}
      >
        {/* Marketing-consent passive toggle. Always visible (whether or
            not the prompt banner was shown above) — lets the user change
            their mind any time. */}
        <MarketingConsentToggle initialConsent={marketingConsent} />

        {/* Manage subscription — shown for any user with an active
            Stripe subscription (MiniMind Essential/Extended OR Journey
            installment). MiniMind subscribers ALSO see a "Manage plan"
            button on their MiniMind card, so this is somewhat
            redundant for them but harmless. Journey installment
            subscribers need this — their currentTier stays 'free' by
            design, so the tier-based gating on the MiniMind card
            never renders anything for them. */}
        {hasActiveSubscription && (
          <>
            <hr style={{ border: 'none', borderTop: `1px solid ${PALETTE.border}`, margin: '20px 0' }} />
            <div className="mb-6">
              <p
                className="text-[16px] mb-1"
                style={{ fontFamily: SERIF, color: PALETTE.text }}
              >
                {tHome('yourMiniMind.managePlan')}
              </p>
              <p
                className="text-[13px] mb-3"
                style={{ color: PALETTE.textMuted, fontFamily: SANS, lineHeight: 1.6 }}
              >
                {tHome('yourMiniMind.managePlanBody')}
              </p>
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="px-5 py-2 rounded-full text-[13px] transition-opacity"
                style={{
                  background: 'transparent',
                  color: PALETTE.text,
                  fontFamily: SANS,
                  fontWeight: 500,
                  border: `1px solid ${PALETTE.border}`,
                  opacity: portalLoading ? 0.5 : 1,
                }}
              >
                {portalLoading ? '…' : tHome('yourMiniMind.managePlan')}
              </button>
            </div>
          </>
        )}

        <hr style={{ border: 'none', borderTop: `1px solid ${PALETTE.border}`, margin: '20px 0' }} />

        {/* Export */}
        <div className="mb-6">
          <p
            className="text-[16px] mb-1"
            style={{ fontFamily: SERIF, color: PALETTE.text }}
          >
            {t('exportTitle')}
          </p>
          <p
            className="text-[13px] mb-3"
            style={{ color: PALETTE.textMuted, fontFamily: SANS, lineHeight: 1.6 }}
          >
            {t('exportBody')}
          </p>
          <button
            onClick={handleExport}
            disabled={exportLoading}
            className="px-5 py-2 rounded-full text-[13px] transition-opacity"
            style={{
              background: 'transparent',
              color: PALETTE.text,
              fontFamily: SANS,
              fontWeight: 500,
              border: `1px solid ${PALETTE.border}`,
              opacity: exportLoading ? 0.5 : 1,
            }}
          >
            {exportLoading ? t('exporting') : t('exportCta')}
          </button>
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${PALETTE.border}`, margin: '20px 0' }} />

        {/* Delete */}
        <div>
          <p
            className="text-[16px] mb-1"
            style={{ fontFamily: SERIF, color: PALETTE.text }}
          >
            {t('deleteTitle')}
          </p>
          <p
            className="text-[13px] mb-3"
            style={{ color: PALETTE.textMuted, fontFamily: SANS, lineHeight: 1.6 }}
          >
            {t('deleteBody')}
          </p>

          {deleteState === 'sent' ? (
            <p
              className="text-[14px]"
              style={{ color: PALETTE.text, fontFamily: SANS, lineHeight: 1.6 }}
            >
              {t('deleteEmailSent')}
            </p>
          ) : deleteState === 'confirming' ? (
            <div className="flex flex-wrap gap-3 items-center">
              <button
                onClick={handleDeleteRequest}
                disabled={(deleteState as string) === 'sending'}
                className="px-5 py-2 rounded-full text-[13px] transition-opacity"
                style={{
                  background: '#b91c1c',
                  color: '#FFFFFF',
                  fontFamily: SANS,
                  fontWeight: 500,
                  border: 'none',
                  opacity: (deleteState as string) === 'sending' ? 0.5 : 1,
                }}
              >
                {(deleteState as string) === 'sending' ? t('deleteSending') : t('deleteConfirmCta')}
              </button>
              <button
                onClick={() => setDeleteState('idle')}
                disabled={(deleteState as string) === 'sending'}
                className="px-5 py-2 rounded-full text-[13px]"
                style={{
                  background: 'transparent',
                  color: PALETTE.text,
                  fontFamily: SANS,
                  fontWeight: 500,
                  border: `1px solid ${PALETTE.border}`,
                }}
              >
                {t('deleteCancel')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDeleteState('confirming')}
              className="px-5 py-2 rounded-full text-[13px]"
              style={{
                background: 'transparent',
                color: '#b91c1c',
                fontFamily: SANS,
                fontWeight: 500,
                border: '1px solid #b91c1c',
              }}
            >
              {t('deleteCta')}
            </button>
          )}
          {errorMsg && (
            <p className="mt-3 text-[13px]" style={{ color: '#b91c1c', fontFamily: SANS }}>
              {errorMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeletionPendingBanner — shown during grace window.
// ---------------------------------------------------------------------------

function DeletionPendingBanner({ scheduledAt, t }: { scheduledAt: string; t: TFn }) {
  const { palette: PALETTE } = useTheme();
  const locale = useLocale();
  const [cancelling, setCancelling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dateFmtLocale = locale === 'en' ? 'en-GB' : locale;
  const dateStr = new Intl.DateTimeFormat(dateFmtLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(scheduledAt));

  async function handleCancel() {
    setCancelling(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/account/cancel-deletion', { method: 'POST' });
      if (!res.ok) {
        setErrorMsg(t('cancelError'));
        setCancelling(false);
        return;
      }
      window.location.reload();
    } catch {
      setErrorMsg(t('cancelError'));
      setCancelling(false);
    }
  }

  return (
    <div className="mb-12">
      <div
        className="rounded-lg p-6"
        style={{
          background: PALETTE.bgCard,
          border: '1px solid #b91c1c',
        }}
      >
        <p
          className="text-[16px] mb-2"
          style={{ fontFamily: SERIF, color: PALETTE.text }}
        >
          {t('pendingTitle', { date: dateStr })}
        </p>
        <p
          className="text-[13px] mb-4"
          style={{ color: PALETTE.textMuted, fontFamily: SANS, lineHeight: 1.6 }}
        >
          {t('pendingBody')}
        </p>
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="px-5 py-2 rounded-full text-[13px] transition-opacity"
          style={{
            background: PALETTE.accent,
            color: PALETTE.accentText,
            fontFamily: SANS,
            fontWeight: 500,
            border: 'none',
            opacity: cancelling ? 0.5 : 1,
          }}
        >
          {cancelling ? t('cancelling') : t('cancelCta')}
        </button>
        {errorMsg && (
          <p className="mt-3 text-[13px]" style={{ color: '#b91c1c', fontFamily: SANS }}>
            {errorMsg}
          </p>
        )}
      </div>
    </div>
  );
}
