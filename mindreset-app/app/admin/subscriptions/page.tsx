export const dynamic = 'force-dynamic';

export default function AdminSubscriptions() {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Subscriptions
      </div>
      <h1 className="text-[28px] mb-6 font-medium">Customer subscription controls</h1>

      <div className="border border-dashed border-neutral-300 rounded-lg p-8 bg-white text-center">
        <p className="text-[14px] text-neutral-500 mb-2">Wired in PR 5.</p>
        <p className="text-[13px] text-neutral-400 leading-[1.6] max-w-md mx-auto">
          Search customers by email, see their tier and billing state, and
          take action — pause subscription (trauma-informed UX), issue refund,
          extend cycle. Pauses use Stripe&apos;s pause_collection.
        </p>
      </div>

      <div className="mt-8 text-[13px] text-neutral-600 leading-[1.65]">
        <p className="font-medium mb-2">What this section will show when live:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Customer search by email or Stripe customer ID</li>
          <li>Per-customer view: tier, cycle reset, message usage, top-up balance</li>
          <li>Pause subscription for N weeks (no cancel friction)</li>
          <li>Refund Top-up or Module purchases</li>
          <li>Manual cycle reset (rare edge case)</li>
          <li>Audit log of every action taken (who / when / what)</li>
        </ul>
      </div>
    </div>
  );
}
