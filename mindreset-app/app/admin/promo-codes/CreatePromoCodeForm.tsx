'use client';

import { useState } from 'react';

// Collapsible create-promo-code form. Client component so we can have
// a discount-type toggle that swaps the value-field unit (% vs £). The
// server action that handles submission lives in the parent server
// component (page.tsx).

type Props = {
  action: (formData: FormData) => Promise<void>;
};

export default function CreatePromoCodeForm({ action }: Props) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent_off' | 'amount_off'>('percent_off');

  return (
    <div className="border border-neutral-200 rounded-lg bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 text-[13px] text-neutral-600 hover:text-neutral-900 flex items-center justify-between"
      >
        <span>{open ? '−' : '+'} Create new promo code</span>
      </button>
      {open && (
        <form action={action} className="border-t border-neutral-200 p-4 space-y-3">
          <div>
            <label className="block text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-1">
              Code (customers type this at checkout)
            </label>
            <input
              name="code"
              type="text"
              required
              minLength={3}
              maxLength={50}
              placeholder="LAUNCH25"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              className="w-full text-[13px] font-mono border border-neutral-300 rounded px-3 py-2 focus:outline-none focus:border-neutral-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-1">
                Discount type
              </label>
              <select
                name="discountType"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'percent_off' | 'amount_off')}
                className="w-full text-[13px] border border-neutral-300 rounded px-3 py-2 focus:outline-none focus:border-neutral-500"
              >
                <option value="percent_off">Percent off</option>
                <option value="amount_off">Amount off (£)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-1">
                {discountType === 'percent_off' ? 'Percent (1-100)' : 'Amount in £'}
              </label>
              <input
                name="discountValue"
                type="number"
                required
                min={discountType === 'percent_off' ? 1 : 0.01}
                max={discountType === 'percent_off' ? 100 : undefined}
                step={discountType === 'percent_off' ? 1 : 0.01}
                placeholder={discountType === 'percent_off' ? '25' : '10.00'}
                className="w-full text-[13px] border border-neutral-300 rounded px-3 py-2 focus:outline-none focus:border-neutral-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-1">
                Max redemptions (optional)
              </label>
              <input
                name="maxRedemptions"
                type="number"
                min={1}
                placeholder="100"
                className="w-full text-[13px] border border-neutral-300 rounded px-3 py-2 focus:outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-1">
                Expires (optional)
              </label>
              <input
                name="expiresAt"
                type="date"
                className="w-full text-[13px] border border-neutral-300 rounded px-3 py-2 focus:outline-none focus:border-neutral-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-[13px] text-neutral-700">
            <input
              name="firstTimeOnly"
              type="checkbox"
              className="rounded border-neutral-300"
            />
            First-time customers only
          </label>

          <button
            type="submit"
            disabled={code.length < 3}
            className="bg-neutral-900 text-white px-5 py-2 rounded-full text-[13px] hover:bg-neutral-700 disabled:bg-neutral-300 disabled:cursor-not-allowed"
          >
            Create code
          </button>
        </form>
      )}
    </div>
  );
}
