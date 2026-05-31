export const dynamic = 'force-dynamic';

// /admin/subscriptions — out of scope for soft launch. The owner decided
// (2026-05-31) that pause/refund admin actions are not worth building
// as a launch deliverable: refunds happen ~1 in 100 transactions and
// take 30 seconds in Stripe Dashboard, and Stripe's pause_collection
// doesn't pause access (it only pauses billing), so an honest "pause"
// would require gating chat access during the pause window — extra
// surface for marginal benefit.
//
// This page stays as a navigation breadcrumb so the section exists in
// the sidebar; revisit after the first month of real customer ops if
// volume justifies an in-app surface.

export default function AdminSubscriptions() {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Subscriptions
      </div>
      <h1 className="text-[28px] mb-6 font-medium">Handled in Stripe</h1>

      <div className="border border-neutral-200 rounded-lg p-6 bg-white">
        <p className="text-[14px] leading-[1.65] text-neutral-700 mb-4">
          Subscription operations — refunds, pauses, plan changes, customer
          search — are handled directly in your Stripe Dashboard for now.
          Stripe&apos;s native tooling is faster and more accurate than building
          a parallel UI in the admin panel for low-volume ops.
        </p>
        <a
          href="https://dashboard.stripe.com/customers"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-neutral-900 text-white px-5 py-2 rounded-full text-[13px] hover:bg-neutral-700"
        >
          Open Stripe Dashboard →
        </a>
      </div>

      <p className="text-[12px] text-neutral-500 mt-6 leading-[1.6]">
        When monthly support load justifies it, this section will gain
        customer search by email, a per-customer view of tier / cycle reset /
        message usage, and one-click refund flows. Until then, keep the
        operational state in one place: Stripe.
      </p>
    </div>
  );
}
