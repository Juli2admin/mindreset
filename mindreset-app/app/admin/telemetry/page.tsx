import Link from 'next/link';

export const dynamic = 'force-dynamic';

// /admin/telemetry — the live numbers (signups, active users, MRR, Sev-5
// counts) moved to the Overview page (admin/page.tsx) when PR 4 shipped.
// This page exists as a sidebar breadcrumb that points to where things
// actually live now (Overview tile + Vercel Analytics dashboard for
// traffic). When deeper telemetry features land (Sentry, time-series
// charts, per-cohort breakdowns) they'll live here.

export default function AdminTelemetry() {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Telemetry
      </div>
      <h1 className="text-[28px] mb-6 font-medium">Where the numbers live</h1>

      <div className="space-y-4">
        <div className="border border-neutral-200 rounded-lg p-5 bg-white">
          <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-2">
            App-specific metrics
          </div>
          <p className="text-[14px] leading-[1.6] text-neutral-700 mb-3">
            Live signups, active users, subscription counts, MRR estimate,
            and Sev-5 safety events are on the Overview tile.
          </p>
          <Link
            href="/admin"
            className="inline-block text-[13px] text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
          >
            Go to Overview →
          </Link>
        </div>

        <div className="border border-neutral-200 rounded-lg p-5 bg-white">
          <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-2">
            Traffic + page views
          </div>
          <p className="text-[14px] leading-[1.6] text-neutral-700 mb-3">
            Visitor counts, top routes, referrers, geography — these flow
            from Vercel Analytics. Enable from the Vercel project dashboard
            if you haven&apos;t already (free tier, 100k events/month).
          </p>
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-[13px] text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
          >
            Open Vercel Dashboard →
          </a>
        </div>

        <div className="border border-dashed border-neutral-300 rounded-lg p-5 bg-white">
          <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-2">
            Coming
          </div>
          <p className="text-[13px] leading-[1.6] text-neutral-500">
            Sentry error monitoring (production errors are otherwise invisible).
            Time-series charts for signups + revenue. Per-locale and per-tier
            cohort breakdowns. All post-launch additions.
          </p>
        </div>
      </div>
    </div>
  );
}
