export const dynamic = 'force-dynamic';

export default function AdminPromoCodes() {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Promo codes
      </div>
      <h1 className="text-[28px] mb-6 font-medium">Discount campaigns</h1>

      <div className="border border-dashed border-neutral-300 rounded-lg p-8 bg-white text-center">
        <p className="text-[14px] text-neutral-500 mb-2">Wired in PR 6.</p>
        <p className="text-[13px] text-neutral-400 leading-[1.6] max-w-md mx-auto">
          You can already create promo codes in Stripe Dashboard directly —
          this surface gives you the same capability inside the admin panel
          with an audit trail and a view of which codes are converting.
        </p>
      </div>

      <div className="mt-8 text-[13px] text-neutral-600 leading-[1.65]">
        <p className="font-medium mb-2">What this section will show when live:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>List of active promo codes — text, discount, expiry, usage count</li>
          <li>Create new code — coupon, max uses, restrict to first-time customers</li>
          <li>Per-code conversion stats (uses, revenue impact)</li>
          <li>Quick &quot;compassionate pricing&quot; presets for hardship cases</li>
        </ul>
      </div>
    </div>
  );
}
