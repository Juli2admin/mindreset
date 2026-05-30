import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import AddTestEmailForm from './AddTestEmailForm';

// /admin/support — inbound queue. Lists every SupportEmail row, newest
// first. PR 2a renders the queue + a manual "add test email" form so the
// UI can be driven without real Resend Inbound (DNS for support@mindreset.ai
// is pending). PR 2b will fill AI categoriser fields; PR 2c removes the
// test form and wires the real Resend Inbound webhook.

export const dynamic = 'force-dynamic';

async function addTestEmail(formData: FormData) {
  'use server';
  const fromEmail = String(formData.get('fromEmail') ?? '').trim();
  const fromName = String(formData.get('fromName') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim();
  const bodyText = String(formData.get('bodyText') ?? '').trim();

  if (!fromEmail || !subject || !bodyText) return;

  const created = await prisma.supportEmail.create({
    data: {
      fromEmail,
      fromName: fromName || null,
      subject,
      bodyText,
      receivedAt: new Date(),
    },
  });

  revalidatePath('/admin/support');
  redirect(`/admin/support/${created.id}`);
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    pending: { bg: 'bg-amber-100', fg: 'text-amber-800', label: 'Pending' },
    drafted: { bg: 'bg-blue-100', fg: 'text-blue-800', label: 'Drafted' },
    replied: { bg: 'bg-green-100', fg: 'text-green-800', label: 'Replied' },
    escalated: { bg: 'bg-red-100', fg: 'text-red-800', label: 'Escalated' },
  };
  const s = styles[status] ?? styles.pending;
  return (
    <span
      className={`text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-full ${s.bg} ${s.fg}`}
    >
      {s.label}
    </span>
  );
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  if (urgency === 'normal') return null;
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    elevated: { bg: 'bg-orange-100', fg: 'text-orange-800', label: 'Elevated' },
    crisis: { bg: 'bg-red-200', fg: 'text-red-900', label: 'Crisis' },
  };
  const s = styles[urgency];
  if (!s) return null;
  return (
    <span
      className={`text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-full font-medium ${s.bg} ${s.fg}`}
    >
      {s.label}
    </span>
  );
}

function formatReceived(d: Date): string {
  const now = Date.now();
  const diffMs = now - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default async function AdminSupportQueue() {
  const emails = await prisma.supportEmail.findMany({
    orderBy: [{ status: 'asc' }, { receivedAt: 'desc' }],
    take: 100,
  });

  return (
    <div className="max-w-4xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Support emails
      </div>
      <h1 className="text-[28px] mb-6 font-medium">Inbound queue</h1>

      <AddTestEmailForm action={addTestEmail} />

      {emails.length === 0 ? (
        <div className="border border-dashed border-neutral-300 rounded-lg p-12 bg-white text-center mt-6">
          <p className="text-[14px] text-neutral-500">
            No emails in the queue. Use the form above to add a test email.
          </p>
          <p className="text-[12px] text-neutral-400 mt-2">
            PR 2c will wire Resend Inbound so real emails to{' '}
            <code className="font-mono">support@mindreset.ai</code> land here automatically.
          </p>
        </div>
      ) : (
        <div className="mt-6 border border-neutral-200 rounded-lg bg-white overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium text-neutral-600">From</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Subject</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Status</th>
                <th className="px-4 py-3 font-medium text-neutral-600">Received</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => (
                <tr key={e.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <a href={`/admin/support/${e.id}`} className="block">
                      <div className="font-medium text-neutral-900">{e.fromName ?? e.fromEmail}</div>
                      {e.fromName && (
                        <div className="text-[12px] text-neutral-500">{e.fromEmail}</div>
                      )}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/admin/support/${e.id}`} className="text-neutral-700 line-clamp-1">
                      {e.subject}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <StatusBadge status={e.status} />
                      <UrgencyBadge urgency={e.urgency} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                    {formatReceived(e.receivedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
