'use client';

import { useState } from 'react';
import type { InvitationStatus } from '@/lib/pilot/invitations';

type Row = {
  id: string;
  code: string;
  createdAt: string;
  notes: string | null;
  trialDays: number;
  expiresAt: string | null;
  redeemedAt: string | null;
  redeemedByEmail: string | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  beforeFormFilled: boolean;
  beforeFormFilledAt: string | null;
  beforeFormEmailSentAt: string | null;
  afterFormFilled: boolean;
  afterFormFilledAt: string | null;
  afterFormEmailSentAt: string | null;
  followUp3mSent: boolean;
  quoteApproved: boolean;
  revokedAt: string | null;
  revokedReason: string | null;
  status: InvitationStatus;
};

type Props = {
  rows: Row[];
  actionCreate: (fd: FormData) => Promise<void>;
  actionRevoke: (fd: FormData) => Promise<void>;
  actionToggleFlag: (fd: FormData) => Promise<void>;
  actionResendBeforeNudge: (fd: FormData) => Promise<void>;
  actionResendAfterNudge: (fd: FormData) => Promise<void>;
};

const STATUS_STYLE: Record<InvitationStatus, string> = {
  pending: 'bg-neutral-100 text-neutral-700',
  active: 'bg-emerald-100 text-emerald-800',
  expired_invitation: 'bg-amber-100 text-amber-800',
  expired_trial: 'bg-orange-100 text-orange-800',
  revoked: 'bg-red-100 text-red-800',
  completed: 'bg-indigo-100 text-indigo-800',
};

const STATUS_LABEL: Record<InvitationStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  expired_invitation: 'Invite expired',
  expired_trial: 'Trial ended',
  revoked: 'Revoked',
  completed: 'Completed',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Days since a stored ISO date — used to surface "27 days since Before"
// on the admin row so Julia knows when to click "Send After nudge".
// Returns null when iso is null.
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
}

function redeemLink(code: string): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://mindreset.ai';
  return `${origin}/en/redeem/${code}`;
}

export default function PilotAdminClient({
  rows,
  actionCreate,
  actionRevoke,
  actionToggleFlag,
  actionResendBeforeNudge,
  actionResendAfterNudge,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');

  const filtered = rows.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'active') return r.status === 'active';
    if (filter === 'pending') return r.status === 'pending';
    if (filter === 'completed') return r.status === 'completed';
    return true;
  });

  return (
    <>
      <form
        action={actionCreate}
        className="mb-8 bg-white rounded-lg border border-neutral-200 p-5"
      >
        <div className="text-[13px] font-medium text-neutral-800 mb-4">
          Create invitations
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500">
              Count
            </span>
            <input
              type="number"
              name="count"
              defaultValue={1}
              min={1}
              max={50}
              required
              className="mt-1 w-full text-[14px] px-3 py-2 rounded-md border border-neutral-300 bg-white"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500">
              Trial days
            </span>
            <input
              type="number"
              name="trialDays"
              defaultValue={30}
              min={1}
              max={365}
              required
              className="mt-1 w-full text-[14px] px-3 py-2 rounded-md border border-neutral-300 bg-white"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500">
              Invite expires (optional)
            </span>
            <input
              type="date"
              name="expiresAt"
              className="mt-1 w-full text-[14px] px-3 py-2 rounded-md border border-neutral-300 bg-white"
            />
          </label>
          <label className="block sm:col-span-2 lg:col-span-4">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500">
              Notes (private — free text)
            </span>
            <input
              type="text"
              name="notes"
              placeholder="e.g. Sofia, RU, referred by Petya"
              className="mt-1 w-full text-[14px] px-3 py-2 rounded-md border border-neutral-300 bg-white"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="bg-neutral-900 text-white rounded-full px-6 py-2 text-[13px] font-medium"
          >
            Create
          </button>
        </div>
      </form>

      <div className="flex gap-1 mb-3 text-[12px]">
        {(['all', 'pending', 'active', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full ${
              filter === f
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-[13px] text-neutral-500">
            No invitations match the filter.
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Code / Link</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Tester</th>
                <th className="px-3 py-2 font-medium">Trial ends</th>
                <th className="px-3 py-2 font-medium">Tracking</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <RowView
                  key={r.id}
                  row={r}
                  actionRevoke={actionRevoke}
                  actionToggleFlag={actionToggleFlag}
                  actionResendBeforeNudge={actionResendBeforeNudge}
                  actionResendAfterNudge={actionResendAfterNudge}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function RowView({
  row,
  actionRevoke,
  actionToggleFlag,
  actionResendBeforeNudge,
  actionResendAfterNudge,
}: {
  row: Row;
  actionRevoke: (fd: FormData) => Promise<void>;
  actionToggleFlag: (fd: FormData) => Promise<void>;
  actionResendBeforeNudge: (fd: FormData) => Promise<void>;
  actionResendAfterNudge: (fd: FormData) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const link = redeemLink(row.code);
  const hasBeenRedeemed = !!row.redeemedAt && !!row.redeemedByEmail;
  const canResendBeforeNudge = hasBeenRedeemed && !row.beforeFormFilled;
  const canResendAfterNudge =
    hasBeenRedeemed && row.beforeFormFilled && !row.afterFormFilled;
  const daysSinceBefore = daysSince(row.beforeFormFilledAt);
  // 30 days is the standard After-nudge trigger point (four weeks of
  // Journey work, per Julia's method). Highlight rows past that so the
  // admin can spot at a glance who's ready for the After nudge.
  const isAfterReady = daysSinceBefore !== null && daysSinceBefore >= 30;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <tr className="border-b border-neutral-100 last:border-0 align-top">
      <td className="px-3 py-3">
        <div className="font-mono text-[12px] text-neutral-900">{row.code}</div>
        <button
          type="button"
          onClick={copy}
          className="text-[11px] text-blue-700 hover:underline mt-1"
        >
          {copied ? 'Copied ✓' : 'Copy redeem link'}
        </button>
      </td>
      <td className="px-3 py-3 text-neutral-700 max-w-[240px]">
        <div className="whitespace-normal">{row.notes ?? '—'}</div>
        <div className="text-[10px] text-neutral-400 mt-1">
          {row.trialDays}-day trial · Created {formatDate(row.createdAt)}
        </div>
      </td>
      <td className="px-3 py-3">
        <span
          className={`inline-block text-[10px] uppercase tracking-[0.1em] px-2 py-1 rounded-full ${STATUS_STYLE[row.status]}`}
        >
          {STATUS_LABEL[row.status]}
        </span>
        {row.revokedReason && (
          <div className="text-[10px] text-neutral-500 mt-1">Reason: {row.revokedReason}</div>
        )}
      </td>
      <td className="px-3 py-3 text-neutral-700">
        {row.redeemedByEmail ?? '—'}
        {row.redeemedAt && (
          <div className="text-[10px] text-neutral-400 mt-0.5">
            Claimed {formatDate(row.redeemedAt)}
          </div>
        )}
        {(row.beforeFormFilled || row.afterFormFilled) && (
          <a
            href={`/admin/pilot/responses?invitationId=${row.id}`}
            className="inline-block text-[11px] text-blue-700 hover:underline mt-1"
          >
            View responses →
          </a>
        )}
      </td>
      <td className="px-3 py-3 text-neutral-700">{formatDate(row.trialEndsAt)}</td>
      <td className="px-3 py-3">
        <div className="grid grid-cols-1 gap-1 text-[11px]">
          <FlagToggle
            id={row.id}
            flag="beforeFormFilled"
            label="Before form"
            value={row.beforeFormFilled}
            actionToggleFlag={actionToggleFlag}
          />
          {row.beforeFormFilled && daysSinceBefore !== null && !row.afterFormFilled && (
            <div
              className={`text-[10px] pl-5 ${
                isAfterReady ? 'font-medium text-emerald-700' : 'text-neutral-500'
              }`}
              title={`Before submitted ${formatDate(row.beforeFormFilledAt)} · ${daysSinceBefore}d ago`}
            >
              {isAfterReady
                ? `${daysSinceBefore}d — ready for After`
                : `${daysSinceBefore}d since Before`}
            </div>
          )}
          <FlagToggle
            id={row.id}
            flag="afterFormFilled"
            label="After form"
            value={row.afterFormFilled}
            actionToggleFlag={actionToggleFlag}
          />
          <FlagToggle
            id={row.id}
            flag="followUp3mSent"
            label="3-month follow-up"
            value={row.followUp3mSent}
            actionToggleFlag={actionToggleFlag}
          />
          <FlagToggle
            id={row.id}
            flag="quoteApproved"
            label="Quote approved"
            value={row.quoteApproved}
            actionToggleFlag={actionToggleFlag}
          />
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        <div className="flex flex-col items-end gap-1">
          {canResendBeforeNudge && (
            <form action={actionResendBeforeNudge}>
              <input type="hidden" name="id" value={row.id} />
              <button
                type="submit"
                onClick={(e) => {
                  const msg = row.beforeFormEmailSentAt
                    ? 'Re-send the Before-form nudge to this tester? The previous email was already sent.'
                    : 'Send the Before-form nudge to this tester now?';
                  if (!confirm(msg)) e.preventDefault();
                }}
                title={
                  row.beforeFormEmailSentAt
                    ? `Previously sent ${formatDate(row.beforeFormEmailSentAt)} — click to re-send.`
                    : 'Send the Before-form nudge now (before the tester opens Journey).'
                }
                className="text-[11px] text-blue-700 hover:underline"
              >
                {row.beforeFormEmailSentAt ? 'Re-send Before nudge' : 'Send Before nudge'}
              </button>
            </form>
          )}
          {canResendAfterNudge && (
            <form action={actionResendAfterNudge}>
              <input type="hidden" name="id" value={row.id} />
              <button
                type="submit"
                onClick={(e) => {
                  const msg = row.afterFormEmailSentAt
                    ? 'Re-send the After-form nudge to this tester? The previous email was already sent.'
                    : 'Send the After-form nudge to this tester now? (Bypasses the 30-day cron gate.)';
                  if (!confirm(msg)) e.preventDefault();
                }}
                title={
                  row.afterFormEmailSentAt
                    ? `Previously sent ${formatDate(row.afterFormEmailSentAt)} — click to re-send.`
                    : "Send the After-form nudge now, ahead of the 30-day cron."
                }
                className="text-[11px] text-blue-700 hover:underline"
              >
                {row.afterFormEmailSentAt ? 'Re-send After nudge' : 'Send After nudge'}
              </button>
            </form>
          )}
          {row.status !== 'revoked' && row.status !== 'expired_invitation' && (
            <form action={actionRevoke}>
              <input type="hidden" name="id" value={row.id} />
              <input type="hidden" name="reason" value="revoked from admin" />
              <button
                type="submit"
                onClick={(e) => {
                  if (!confirm('Revoke this pilot? The tester will lose access immediately.')) {
                    e.preventDefault();
                  }
                }}
                className="text-[11px] text-red-700 hover:underline"
              >
                Revoke
              </button>
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}

function FlagToggle({
  id,
  flag,
  label,
  value,
  actionToggleFlag,
}: {
  id: string;
  flag: string;
  label: string;
  value: boolean;
  actionToggleFlag: (fd: FormData) => Promise<void>;
}) {
  return (
    <form action={actionToggleFlag} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="flag" value={flag} />
      <input type="hidden" name="value" value={value ? 'false' : 'true'} />
      <button
        type="submit"
        className={`w-3.5 h-3.5 rounded border ${
          value
            ? 'bg-emerald-600 border-emerald-600'
            : 'bg-white border-neutral-300 hover:border-neutral-500'
        }`}
        aria-label={`Toggle ${label}`}
      >
        {value && (
          <svg viewBox="0 0 12 12" className="w-full h-full text-white p-0.5">
            <path
              d="M2 6l3 3 5-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
      <span className="text-neutral-600">{label}</span>
    </form>
  );
}
