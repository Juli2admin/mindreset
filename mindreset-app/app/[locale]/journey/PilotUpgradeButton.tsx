'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';

// Small client button for the "Pilot ended" screen. POSTs to
// /api/pilot/upgrade-checkout, receives the Stripe checkout URL, and
// redirects the browser there so the tester can complete their 50%-off
// upgrade to the paid Journey.

type Props = {
  label: string;
  errorLabel: string;
};

export default function PilotUpgradeButton({ label, errorLabel }: Props) {
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pilot/upgrade-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        setError(data.detail ?? data.error ?? errorLabel);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(errorLabel);
      setLoading(false);
    } catch {
      setError(errorLabel);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-block bg-neutral-900 text-white rounded-full px-6 py-3 text-[14px] font-medium disabled:opacity-50"
      >
        {loading ? '…' : label}
      </button>
      {error && (
        <p className="text-[12px] text-red-700 max-w-sm text-center">{error}</p>
      )}
    </div>
  );
}
