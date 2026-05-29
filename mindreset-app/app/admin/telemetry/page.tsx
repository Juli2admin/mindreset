export const dynamic = 'force-dynamic';

export default function AdminTelemetry() {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Telemetry
      </div>
      <h1 className="text-[28px] mb-6 font-medium">App health and usage</h1>

      <div className="border border-dashed border-neutral-300 rounded-lg p-8 bg-white text-center">
        <p className="text-[14px] text-neutral-500 mb-2">Wired in PR 4.</p>
        <p className="text-[13px] text-neutral-400 leading-[1.6] max-w-md mx-auto">
          Vercel Analytics for traffic, Sentry for errors, and a custom tile
          for app-specific metrics (signups today, active users this week,
          Sev-5 safety events, MRR snapshot).
        </p>
      </div>

      <div className="mt-8 text-[13px] text-neutral-600 leading-[1.65]">
        <p className="font-medium mb-2">What this section will show when live:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Signups today / this week / this month</li>
          <li>Active users — chat sessions, screening completions</li>
          <li>MRR snapshot — by tier, churn rate, top-up revenue</li>
          <li>Sev-5 safety events from MiniMind scanner (count + recent list)</li>
          <li>Error rate from Sentry</li>
          <li>Anthropic API spend estimate</li>
        </ul>
      </div>
    </div>
  );
}
