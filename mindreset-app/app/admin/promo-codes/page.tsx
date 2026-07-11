import { revalidatePath } from 'next/cache';
import { stripe } from '@/lib/stripe/client';
import { currentUserIsAdmin } from '@/lib/admin/auth';
import CreatePromoCodeForm from './CreatePromoCodeForm';

// /admin/promo-codes — list active Stripe promotion codes and create
// new ones. Pure Stripe-API-driven; no local DB cache. Each render
// fetches fresh from Stripe so we always see current redemption counts.
//
// Read-only fields (Stripe doesn't allow editing existing coupons /
// promotion codes — to "change" one you create a new one with the same
// code text after disabling/expiring the old one, which is out of scope
// here). Delete is not exposed either; expire by setting expires_at
// when creating.

export const dynamic = 'force-dynamic';

async function createPromoCode(formData: FormData) {
  'use server';

  // Pre-launch audit fix B3 (2026-07-11): defence-in-depth admin gate.
  // Layout gate blocks page-render but server-action POST is separate.
  if (!(await currentUserIsAdmin())) {
    throw new Error('Forbidden');
  }

  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  const discountType = String(formData.get('discountType') ?? '');
  const discountValueRaw = String(formData.get('discountValue') ?? '').trim();
  const maxRedemptionsRaw = String(formData.get('maxRedemptions') ?? '').trim();
  const expiresAtRaw = String(formData.get('expiresAt') ?? '').trim();
  const firstTimeOnly = formData.get('firstTimeOnly') === 'on';

  if (!code || code.length < 3) return;
  if (discountType !== 'percent_off' && discountType !== 'amount_off') return;

  const discountValue = Number(discountValueRaw);
  if (!Number.isFinite(discountValue) || discountValue <= 0) return;

  const maxRedemptions = maxRedemptionsRaw ? Number(maxRedemptionsRaw) : undefined;
  if (maxRedemptions !== undefined && (!Number.isFinite(maxRedemptions) || maxRedemptions <= 0)) {
    return;
  }

  // Convert HTML date input (YYYY-MM-DD) to unix seconds; end of UTC day.
  let expiresAt: number | undefined;
  if (expiresAtRaw) {
    const d = new Date(`${expiresAtRaw}T23:59:59Z`);
    if (!Number.isFinite(d.getTime())) return;
    expiresAt = Math.floor(d.getTime() / 1000);
  }

  // Create coupon, then attach a promotion code. Two API calls because
  // Stripe separates the discount definition (coupon) from the customer-
  // typed code (promotion code) — a coupon can have multiple codes, a
  // code points to exactly one coupon.
  try {
    const coupon = await stripe.coupons.create(
      discountType === 'percent_off'
        ? {
            name: `${code} — ${discountValue}% off`,
            duration: 'once',
            percent_off: discountValue,
          }
        : {
            name: `${code} — £${discountValue} off`,
            duration: 'once',
            amount_off: Math.round(discountValue * 100), // pence
            currency: 'gbp',
          },
    );

    await stripe.promotionCodes.create({
      coupon: coupon.id,
      code,
      ...(maxRedemptions !== undefined ? { max_redemptions: maxRedemptions } : {}),
      ...(expiresAt !== undefined ? { expires_at: expiresAt } : {}),
      ...(firstTimeOnly ? { restrictions: { first_time_transaction: true } } : {}),
    });
  } catch (err) {
    console.error('[admin/promo-codes] create failed:', err);
  }

  revalidatePath('/admin/promo-codes');
}

function formatDiscount(coupon: {
  percent_off?: number | null;
  amount_off?: number | null;
  currency?: string | null;
}): string {
  if (coupon.percent_off) return `${coupon.percent_off}% off`;
  if (coupon.amount_off && coupon.currency) {
    const major = (coupon.amount_off / 100).toFixed(2);
    const symbol = coupon.currency.toUpperCase() === 'GBP' ? '£' : `${coupon.currency.toUpperCase()} `;
    return `${symbol}${major} off`;
  }
  return '—';
}

function formatExpires(expiresAtSeconds: number | null | undefined): string {
  if (!expiresAtSeconds) return 'No expiry';
  const d = new Date(expiresAtSeconds * 1000);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatusBadge({ active, expired }: { active: boolean; expired: boolean }) {
  if (expired) {
    return (
      <span className="text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-full bg-neutral-100 text-neutral-600">
        Expired
      </span>
    );
  }
  if (!active) {
    return (
      <span className="text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-full bg-amber-100 text-amber-800">
        Disabled
      </span>
    );
  }
  return (
    <span className="text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-full bg-green-100 text-green-800">
      Active
    </span>
  );
}

export default async function AdminPromoCodes() {
  let codes: Awaited<ReturnType<typeof stripe.promotionCodes.list>>['data'] = [];
  let listError: string | null = null;
  try {
    const result = await stripe.promotionCodes.list({
      limit: 100,
      expand: ['data.coupon'],
    });
    codes = result.data;
  } catch (err) {
    listError = err instanceof Error ? err.message : String(err);
    console.error('[admin/promo-codes] list failed:', err);
  }

  const now = Math.floor(Date.now() / 1000);

  return (
    <div className="max-w-4xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Promo codes
      </div>
      <h1 className="text-[28px] mb-6 font-medium">Discount campaigns</h1>
      <p className="text-[13px] leading-[1.65] text-neutral-700 mb-6">
        Stripe-backed promotion codes. Customers enter these at checkout
        (the &ldquo;Got a promo code?&rdquo; field is enabled on every session).
        Codes you create here are immediately live in Stripe and ready to use.
      </p>

      <CreatePromoCodeForm action={createPromoCode} />

      {listError && (
        <div className="mt-6 bg-red-50 border border-red-200 text-red-900 rounded-lg px-4 py-3 text-[13px]">
          Could not load codes from Stripe: {listError}
        </div>
      )}

      {!listError && codes.length === 0 ? (
        <div className="mt-6 border border-dashed border-neutral-300 rounded-lg p-12 bg-white text-center">
          <p className="text-[14px] text-neutral-500">
            No promo codes yet. Create one above.
          </p>
        </div>
      ) : (
        <div className="mt-6 border border-neutral-200 rounded-lg bg-white overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium text-neutral-600">Code</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Discount</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Redemptions</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Expires</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((pc) => {
                const coupon = pc.coupon as typeof pc.coupon & {
                  percent_off?: number | null;
                  amount_off?: number | null;
                  currency?: string | null;
                };
                const expired = pc.expires_at ? pc.expires_at < now : false;
                return (
                  <tr
                    key={pc.id}
                    className="border-b border-neutral-100 last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-neutral-900">
                      {pc.code}
                      {pc.restrictions?.first_time_transaction && (
                        <span
                          className="ml-2 text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700"
                          title="First-time customers only"
                        >
                          First-time
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{formatDiscount(coupon)}</td>
                    <td className="px-4 py-3 text-neutral-700">
                      {pc.times_redeemed}
                      {pc.max_redemptions ? ` / ${pc.max_redemptions}` : ''}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {formatExpires(pc.expires_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={pc.active} expired={expired} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-neutral-400 mt-6">
        Codes can&apos;t be edited after creation (Stripe limitation). To
        change a code, expire the old one in Stripe Dashboard and create
        a new one here with the desired settings.
      </p>
    </div>
  );
}
