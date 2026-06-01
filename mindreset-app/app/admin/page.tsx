import { getAdminStats, getSafetyByLocale } from '@/lib/admin/stats';

export const dynamic = 'force-dynamic';

// Locales with native safety-scanner keyword phrases. Users on other
// locales rely on the AI verifier alone — track them here so the
// owner can decide when to author keyword phrases for new locales.
const NATIVE_SAFETY_LOCALES = new Set(['en', 'ru']);

function localeLabel(locale: string): string {
  const labels: Record<string, string> = {
    en: 'English',
    ru: 'Russian',
    fr: 'French',
    de: 'German',
    es: 'Spanish',
    it: 'Italian',
    pl: 'Polish',
    pt: 'Portuguese',
  };
  return labels[locale] ?? locale;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function StatTile({
  kicker,
  primary,
  secondary,
  emphasis,
}: {
  kicker: string;
  primary: string;
  secondary?: string;
  emphasis?: 'normal' | 'warn' | 'alert';
}) {
  const primaryColor =
    emphasis === 'alert'
      ? 'text-red-700'
      : emphasis === 'warn'
        ? 'text-orange-700'
        : 'text-neutral-900';
  return (
    <div className="border border-neutral-200 rounded-lg p-5 bg-white">
      <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 mb-2">
        {kicker}
      </div>
      <div className={`text-[26px] leading-none mb-1 font-medium ${primaryColor}`}>
        {primary}
      </div>
      {secondary && (
        <div className="text-[12px] text-neutral-500">{secondary}</div>
      )}
    </div>
  );
}

export default async function AdminOverview() {
  const [stats, safetyByLocale] = await Promise.all([
    getAdminStats(),
    getSafetyByLocale(),
  ]);

  return (
    <div className="max-w-4xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Overview
      </div>
      <h1 className="text-[28px] mb-6 font-medium">Welcome back, Julia.</h1>
      <p className="text-[14px] leading-[1.65] text-neutral-700 mb-8">
        Snapshot of the platform at this moment. All counts are live —
        refresh for fresh numbers. Vercel Analytics handles page-view traffic
        separately; check the Vercel dashboard for those.
      </p>

      <div className="text-[11px] uppercase tracking-[0.15em] text-neutral-500 mb-3">
        Last 24 hours / 7 days
      </div>
      <div className="grid grid-cols-2 gap-3 mb-8">
        <StatTile
          kicker="New signups"
          primary={`${stats.signupsToday} today`}
          secondary={`${stats.signupsThisWeek} this week`}
        />
        <StatTile
          kicker="Active users"
          primary={`${stats.activeThisWeek}`}
          secondary="sent a MiniMind message in 7 days"
        />
        <StatTile
          kicker="Subscriptions"
          primary={`${stats.essentialCount} · ${stats.extendedCount}`}
          secondary={`Essential · Extended  /  ${formatCurrency(stats.estimatedMRR)} MRR estimate`}
        />
        <StatTile
          kicker="Safety events"
          primary={stats.sev5ThisWeek > 0 ? `${stats.sev5ThisWeek} Sev-5` : '0 Sev-5'}
          secondary={`${stats.sev3to4ThisWeek} Sev-3/4 this week`}
          emphasis={
            stats.sev5ThisWeek > 0 ? 'alert' : stats.sev3to4ThisWeek > 0 ? 'warn' : 'normal'
          }
        />
      </div>

      {/* Safety events by locale — only render when there's anything to
          show. Tracks whether non-EN/RU users are hitting safety events
          (the keyword scanner ships native phrases for EN+RU only; other
          locales rely on the AI verifier). A non-native locale row with
          Sev 3/4/5 hits is the signal to author keyword phrases for that
          locale next. */}
      {safetyByLocale.length > 0 && (
        <div className="border border-neutral-200 rounded-lg p-5 bg-white mb-8">
          <div className="text-[11px] uppercase tracking-[0.15em] text-neutral-500 mb-3">
            Safety events by locale (last 7 days)
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-neutral-500 border-b border-neutral-100">
                <th className="py-2 pr-4 font-medium">Locale</th>
                <th className="py-2 pr-4 font-medium">Sev 5</th>
                <th className="py-2 pr-4 font-medium">Sev 3/4</th>
                <th className="py-2 pr-4 font-medium">Sev 2</th>
                <th className="py-2 font-medium">Keyword coverage</th>
              </tr>
            </thead>
            <tbody>
              {safetyByLocale.map((row) => {
                const isNative = NATIVE_SAFETY_LOCALES.has(row.locale);
                return (
                  <tr key={row.locale} className="border-b border-neutral-100 last:border-0">
                    <td className="py-2 pr-4 text-neutral-900">{localeLabel(row.locale)}</td>
                    <td className={`py-2 pr-4 ${row.sev5 > 0 ? 'text-red-700 font-medium' : 'text-neutral-500'}`}>
                      {row.sev5}
                    </td>
                    <td className={`py-2 pr-4 ${row.sev3to4 > 0 ? 'text-orange-700' : 'text-neutral-500'}`}>
                      {row.sev3to4}
                    </td>
                    <td className="py-2 pr-4 text-neutral-500">{row.sev2}</td>
                    <td className="py-2 text-[12px]">
                      {isNative ? (
                        <span className="text-green-700">native</span>
                      ) : (
                        <span className="text-orange-700">verifier-only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[11px] text-neutral-500 mt-3 leading-[1.5]">
            Native keyword phrases ship for EN + RU. Other locales rely on
            the AI verifier alone (3s vs 5ms). A non-native locale with
            Sev 3+ hits is the signal to author keyword phrases for that
            locale.
          </p>
        </div>
      )}

      <div className="border border-neutral-200 rounded-lg p-5 bg-white">
        <div className="text-[11px] uppercase tracking-[0.15em] text-neutral-500 mb-3">
          Soft-launch checklist
        </div>
        <ul className="space-y-2 text-[14px]">
          <li className="flex justify-between text-neutral-500 line-through">
            <span>Support email queue (foundation + AI draft + Resend send)</span>
            <span>PRs 2a, 2b ✓</span>
          </li>
          <li className="flex justify-between">
            <span>Support emails — automated inbound (Resend Inbound)</span>
            <span className="text-neutral-400">PR 2c · waiting on Resend access</span>
          </li>
          <li className="flex justify-between text-neutral-500 line-through">
            <span>Telemetry (Vercel Analytics + Admin overview tile)</span>
            <span>PR 4 ✓</span>
          </li>
          <li className="flex justify-between text-neutral-500 line-through">
            <span>Marketing email infrastructure (consent + send + audit)</span>
            <span>PRs 3a, 3b ✓</span>
          </li>
          <li className="flex justify-between">
            <span>Sign-up marketing-consent UI (so the send list has recipients)</span>
            <span className="text-neutral-400">next</span>
          </li>
          <li className="flex justify-between text-neutral-500 line-through">
            <span>Promo code management</span>
            <span>PR 6 ✓</span>
          </li>
          <li className="flex justify-between text-neutral-400">
            <span>Subscription pause / refund admin UI</span>
            <span>dropped — handled in Stripe Dashboard</span>
          </li>
          <li className="flex justify-between">
            <span>Sev-5 safety alert email to owner</span>
            <span className="text-neutral-400">next</span>
          </li>
          <li className="flex justify-between">
            <span>Subscription lifecycle emails (confirmed / cancelled / payment-failed)</span>
            <span className="text-neutral-400">next</span>
          </li>
        </ul>
      </div>

      <p className="text-[11px] text-neutral-400 mt-6">
        MRR estimate assumes everyone is on monthly billing. Annual subscribers
        are slightly under-counted (annual is cheaper per month). Precise revenue
        lives in Stripe Dashboard.
      </p>
    </div>
  );
}
