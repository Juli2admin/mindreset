export const dynamic = 'force-dynamic';

export default function AdminOverview() {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Overview
      </div>
      <h1 className="text-[28px] mb-6 font-medium">Welcome back, Julia.</h1>
      <p className="text-[14px] leading-[1.65] text-neutral-700 mb-8">
        This panel is the control surface for everything outside the customer
        app. Use the sidebar to navigate. Each section ships in its own PR,
        wired progressively — the shell exists first so the structure is real
        and you can see the plan.
      </p>

      <div className="border border-neutral-200 rounded-lg p-5 bg-white">
        <div className="text-[11px] uppercase tracking-[0.15em] text-neutral-500 mb-3">
          Soft-launch checklist
        </div>
        <ul className="space-y-2 text-[14px]">
          <li className="flex justify-between">
            <span>Support email queue (inbound + AI draft replies)</span>
            <span className="text-neutral-400">PR 2</span>
          </li>
          <li className="flex justify-between">
            <span>Marketing email infrastructure (Resend Audiences)</span>
            <span className="text-neutral-400">PR 3</span>
          </li>
          <li className="flex justify-between">
            <span>Telemetry (signups, MRR, Sev-5 events)</span>
            <span className="text-neutral-400">PR 4</span>
          </li>
          <li className="flex justify-between">
            <span>Subscription controls (pause, refund)</span>
            <span className="text-neutral-400">PR 5</span>
          </li>
          <li className="flex justify-between">
            <span>Promo code management</span>
            <span className="text-neutral-400">PR 6</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
