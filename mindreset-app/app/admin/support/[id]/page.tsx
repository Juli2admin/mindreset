import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { categoriseSupport } from '@/lib/support/categorise';
import { sendSupportReply } from '@/lib/email/sendSupportReply';
import SendReplyForm from './SendReplyForm';

// /admin/support/[id] — single inbound email view + reply workflow.
// PR 2b additions over PR 2a's view-only stub: AI categoriser fields
// rendered as badges, editable draft textarea, "Run AI" re-trigger, and
// Send via Resend (creates a SupportEmailReply row + marks the inbound
// as 'replied'). PR 2c will swap the test-mode banner for production
// inbound-state indicators.

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

async function runAi(formData: FormData) {
  'use server';
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const email = await prisma.supportEmail.findUnique({ where: { id } });
  if (!email) return;

  try {
    const result = await categoriseSupport({
      subject: email.subject,
      bodyText: email.bodyText,
    });
    await prisma.supportEmail.update({
      where: { id },
      data: {
        locale: result.locale,
        category: result.category,
        urgency: result.urgency,
        draftReply: result.draftReply,
        draftLocale: result.draftLocale,
        // Preserve 'replied' / 'escalated' if already past 'drafted'.
        status: email.status === 'pending' ? 'drafted' : email.status,
      },
    });
  } catch (err) {
    console.error('[admin/support] runAi failed:', err);
  }

  revalidatePath(`/admin/support/${id}`);
}

async function sendReply(formData: FormData) {
  'use server';
  const id = String(formData.get('id') ?? '');
  const draft = String(formData.get('draft') ?? '').trim();
  if (!id || !draft) return;

  const email = await prisma.supportEmail.findUnique({
    where: { id },
    select: {
      id: true,
      fromEmail: true,
      fromName: true,
      subject: true,
    },
  });
  if (!email) return;

  const { userId } = auth();

  const send = await sendSupportReply({
    toEmail: email.fromEmail,
    toName: email.fromName,
    subject: email.subject,
    body: draft,
    inboundSubject: email.subject,
  });

  if (send.ok === false) {
    console.error('[admin/support] sendReply failed:', send.error);
    // Surface to admin via a query param on next render.
    revalidatePath(`/admin/support/${id}`);
    redirect(`/admin/support/${id}?sendError=${encodeURIComponent(send.error)}`);
  }

  await prisma.$transaction([
    prisma.supportEmailReply.create({
      data: {
        supportEmailId: email.id,
        toEmail: email.fromEmail,
        subject: `Re: ${email.subject}`,
        body: draft,
        sentByAdminId: userId ?? null,
        resendId: send.resendId,
        autoSent: false,
      },
    }),
    prisma.supportEmail.update({
      where: { id },
      data: {
        draftReply: draft,
        status: 'replied',
      },
    }),
  ]);

  revalidatePath(`/admin/support/${id}`);
  redirect(`/admin/support/${id}?sent=1`);
}

function MetaBadge({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-500 mb-1">
        {label}
      </div>
      <div className="text-neutral-900 capitalize">{value}</div>
    </div>
  );
}

export default async function SupportEmailDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { sent?: string; sendError?: string };
}) {
  const email = await prisma.supportEmail.findUnique({
    where: { id: params.id },
    include: { replies: { orderBy: { sentAt: 'desc' } } },
  });

  if (!email) notFound();

  const sendError = searchParams.sendError ?? null;
  const sentJustNow = searchParams.sent === '1';

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

      {sentJustNow && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-900 rounded-lg px-4 py-3 text-[13px]">
          Reply sent.
        </div>
      )}
      {sendError && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-900 rounded-lg px-4 py-3 text-[13px]">
          Send failed: {sendError}
        </div>
      )}

      <div className="border border-neutral-200 rounded-lg bg-white">
        <div className="px-5 py-4 border-b border-neutral-200 grid grid-cols-3 gap-x-6 gap-y-3 text-[13px]">
          <div className="col-span-2">
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
          <MetaBadge label="Status" value={email.status} />
          <MetaBadge label="Category" value={email.category} />
          <MetaBadge label="Urgency" value={email.urgency} />
          <MetaBadge label="Locale" value={email.locale} />
        </div>

        <div className="px-5 py-5">
          <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-500 mb-2">Body</div>
          <pre className="text-[13px] text-neutral-800 whitespace-pre-wrap font-sans leading-[1.6]">
            {email.bodyText}
          </pre>
        </div>
      </div>

      {/* AI draft + Send block. If no draft yet → just a Run AI button.
          If draft present → editable textarea + Send + Re-run AI. */}
      <div className="mt-6 border border-neutral-200 rounded-lg bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">
            AI draft reply
          </div>
          <form action={runAi}>
            <input type="hidden" name="id" value={email.id} />
            <button
              type="submit"
              className="text-[12px] text-neutral-600 hover:text-neutral-900 underline underline-offset-2"
            >
              {email.draftReply ? 'Re-run AI' : 'Run AI'}
            </button>
          </form>
        </div>

        {email.draftReply ? (
          <SendReplyForm
            id={email.id}
            initialDraft={email.draftReply}
            action={sendReply}
            disabled={email.status === 'replied'}
          />
        ) : (
          <p className="text-[13px] text-neutral-500 italic">
            No draft yet — click &ldquo;Run AI&rdquo; to categorise this email and
            generate a draft reply in the sender&apos;s locale.
          </p>
        )}
      </div>

      {email.replies.length > 0 && (
        <div className="mt-6">
          <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-3">
            Reply history ({email.replies.length})
          </div>
          {email.replies.map((r) => (
            <div key={r.id} className="border border-neutral-200 rounded-lg bg-white mb-3">
              <div className="px-4 py-2 border-b border-neutral-200 text-[12px] text-neutral-500 flex justify-between">
                <span>Sent {formatTimestamp(r.sentAt)} {r.autoSent ? '· auto-sent' : ''}</span>
                {r.resendId && <code className="text-[10px] font-mono text-neutral-400">{r.resendId}</code>}
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
