import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { sendMarketing } from '@/lib/email/sendMarketing';
import { currentUserIsAdmin } from '@/lib/admin/auth';
import ComposeForm from './ComposeForm';

// /admin/marketing — compose + send a marketing email to all opted-in
// users. Phase 1 of the locked plan §4.2 (Resend Audiences sync is
// Phase 2, segment selection is Phase 3, AI drafting is post-launch).
//
// Recipients are picked at send time from the User table:
//   marketingConsent = true AND deletedAt IS NULL AND email IS NOT NULL
// We don't pre-snapshot the audience because the consent picture can
// change between the admin pressing Send and the loop reaching a user
// — checking live keeps the unsubscribe surface honest (a user who
// unsubscribes mid-send won't be in the slice we just iterated, but
// any user who consents mid-send also won't accidentally get included
// for THIS campaign — they'll be picked up next time).

export const dynamic = 'force-dynamic';

async function sendCampaign(formData: FormData) {
  'use server';

  // Pre-launch audit fix B3 (2026-07-11): defence-in-depth admin gate.
  // The /admin layout blocks non-admin page-render, but server actions
  // are POST endpoints with encrypted action IDs. Belt-and-braces auth
  // check here so a signed-in non-admin cannot invoke this via network
  // replay or leaked action ID.
  if (!(await currentUserIsAdmin())) {
    throw new Error('Forbidden');
  }

  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!subject || !body) return;

  const { userId: adminUserId } = auth();

  const recipients = await prisma.user.findMany({
    where: {
      marketingConsent: true,
      deletedAt: null,
      email: { not: '' },
    },
    select: { id: true, email: true },
  });

  let successCount = 0;
  let failureCount = 0;
  for (const r of recipients) {
    const result = await sendMarketing({
      toEmail: r.email,
      userId: r.id,
      subject,
      body,
    });
    if (result.ok) successCount++;
    else failureCount++;
  }

  const campaign = await prisma.marketingSend.create({
    data: {
      subject,
      body,
      audience: 'all_consented',
      sentByAdminId: adminUserId,
      recipientCount: recipients.length,
      successCount,
      failureCount,
    },
  });

  revalidatePath('/admin/marketing');
  redirect(`/admin/marketing?sent=${campaign.id}`);
}

function formatTimestamp(d: Date): string {
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AdminMarketing({
  searchParams,
}: {
  searchParams: { sent?: string };
}) {
  const [recipientCount, recentSends] = await Promise.all([
    prisma.user.count({
      where: {
        marketingConsent: true,
        deletedAt: null,
        email: { not: '' },
      },
    }),
    prisma.marketingSend.findMany({
      orderBy: { sentAt: 'desc' },
      take: 20,
    }),
  ]);

  const justSent = searchParams.sent
    ? recentSends.find((s) => s.id === searchParams.sent)
    : null;

  return (
    <div className="max-w-4xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Marketing emails
      </div>
      <h1 className="text-[28px] mb-6 font-medium">Compose and send</h1>

      {justSent && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-900 rounded-lg px-4 py-3 text-[13px]">
          Campaign sent. {justSent.successCount} successful, {justSent.failureCount} failed
          out of {justSent.recipientCount} recipients.
        </div>
      )}

      <div className="border border-neutral-200 rounded-lg bg-white p-5 mb-8">
        <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500 mb-3">
          Audience
        </div>
        <div className="text-[20px] font-medium mb-1">{recipientCount} recipients</div>
        <p className="text-[12px] text-neutral-500">
          Users with explicit marketing consent. Deleted accounts excluded.
          Each email includes a one-click unsubscribe link + RFC 8058 header.
        </p>
      </div>

      <ComposeForm action={sendCampaign} disabled={recipientCount === 0} />

      <div className="mt-10">
        <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-3">
          Send history
        </div>
        {recentSends.length === 0 ? (
          <div className="border border-dashed border-neutral-300 rounded-lg p-8 bg-white text-center text-[13px] text-neutral-500">
            No campaigns sent yet.
          </div>
        ) : (
          <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium text-neutral-600">Subject</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Recipients</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Result</th>
                  <th className="px-4 py-3 font-medium text-neutral-600">Sent</th>
                </tr>
              </thead>
              <tbody>
                {recentSends.map((s) => (
                  <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 text-neutral-900 line-clamp-1">{s.subject}</td>
                    <td className="px-4 py-3 text-neutral-700">{s.recipientCount}</td>
                    <td className="px-4 py-3 text-neutral-700">
                      {s.successCount} ✓
                      {s.failureCount > 0 && (
                        <span className="text-red-700"> · {s.failureCount} ✗</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                      {formatTimestamp(s.sentAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-neutral-400 mt-6">
        Per-recipient delivery state (opened / bounced / etc.) lives in Resend
        Dashboard. Look up individuals there by email when needed.
      </p>
    </div>
  );
}
