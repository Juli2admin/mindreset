import { getAdminStats } from '@/lib/admin/stats';

export const dynamic = 'force-dynamic';

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
  const stats = await getAdminStats();

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
          <li className="flex justify-between">
            <span>Marketing email infrastructure (Resend Audiences)</span>
            <span className="text-neutral-400">PR 3</span>
          </li>
          <li className="flex justify-between">
            <span>Subscription controls (pause, refund, search)</span>
            <span className="text-neutral-400">PR 5</span>
          </li>
          <li className="flex justify-between">
            <span>Promo code management</span>
            <span className="text-neutral-400">PR 6</span>
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
