import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';

// /admin/support/[id] — single inbound email view. PR 2a renders the
// email content only. PR 2b adds: AI category/urgency/locale badges,
// editable draft reply, "Run AI" button. PR 2c removes any test-mode
// indicators and adds the Send button + reply log.

export const dynamic = 'force-dynamic';

function formatTimestamp(d: Date): string {
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function SupportEmailDetail({
  params,
}: {
  params: { id: string };
}) {
  const email = await prisma.supportEmail.findUnique({
    where: { id: params.id },
    include: { replies: { orderBy: { sentAt: 'desc' } } },
  });

  if (!email) notFound();

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/support"
        className="text-[12px] text-neutral-500 hover:text-neutral-900 inline-flex items-center gap-1 mb-4"
      >
        ← Back to queue
      </Link>

      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Support email
      </div>
      <h1 className="text-[24px] mb-6 font-medium leading-tight">{email.subject}</h1>

      <div className="border border-neutral-200 rounded-lg bg-white">
        <div className="px-5 py-4 border-b border-neutral-200 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-500 mb-1">From</div>
            <div className="text-neutral-900">
              {email.fromName && <span className="font-medium">{email.fromName} · </span>}
              <span className="text-neutral-700">{email.fromEmail}</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-500 mb-1">Received</div>
            <div className="text-neutral-900">{formatTimestamp(email.receivedAt)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-500 mb-1">Status</div>
            <div className="text-neutral-900 capitalize">{email.status}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-500 mb-1">Urgency</div>
            <div className="text-neutral-900 capitalize">{email.urgency}</div>
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-500 mb-2">Body</div>
          <pre className="text-[13px] text-neutral-800 whitespace-pre-wrap font-sans leading-[1.6]">
            {email.bodyText}
          </pre>
        </div>
      </div>

      <div className="mt-6 border border-dashed border-neutral-300 rounded-lg bg-white p-5 text-[13px] text-neutral-500">
        <div className="font-medium text-neutral-700 mb-1">AI categoriser + draft reply</div>
        Wired in PR 2b. Will populate the email&apos;s detected locale, category,
        urgency, and a draft reply you can edit before sending.
      </div>

      <div className="mt-4 border border-dashed border-neutral-300 rounded-lg bg-white p-5 text-[13px] text-neutral-500">
        <div className="font-medium text-neutral-700 mb-1">Reply + Send</div>
        Wired in PR 2b. Sends via Resend from{' '}
        <code className="font-mono">support@mindreset.ai</code> and records a
        SupportEmailReply row.
      </div>

      {email.replies.length > 0 && (
        <div className="mt-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-3">
            Reply history ({email.replies.length})
          </div>
          {email.replies.map((r) => (
            <div key={r.id} className="border border-neutral-200 rounded-lg bg-white mb-3">
              <div className="px-4 py-2 border-b border-neutral-200 text-[12px] text-neutral-500">
                Sent {formatTimestamp(r.sentAt)} {r.autoSent ? '· auto-sent' : ''}
              </div>
              <pre className="px-4 py-3 text-[13px] text-neutral-800 whitespace-pre-wrap font-sans leading-[1.6]">
                {r.body}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
