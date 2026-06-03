import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';

// /admin/testimonials — moderation queue.
//
// User submissions arrive via /api/testimonials/submit with status='pending'.
// This page lets the admin (Julia) review each one and approve or reject.
// Approved testimonials show on the matching-locale Landing + Pricing
// pages (gated on min 3 per locale by lib/testimonials/queries.ts).
//
// Edits before approval: publicName and story are editable inline so
// typo fixes / minor tone clean-ups can happen without sending it back.
// Original submission is preserved in moderationNotes if edited.

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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    pending: { bg: 'bg-amber-100', fg: 'text-amber-800', label: 'Pending' },
    approved: { bg: 'bg-green-100', fg: 'text-green-800', label: 'Approved' },
    rejected: { bg: 'bg-neutral-100', fg: 'text-neutral-600', label: 'Rejected' },
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

async function approveTestimonial(formData: FormData) {
  'use server';
  const id = String(formData.get('id') ?? '');
  const publicName = String(formData.get('publicName') ?? '').trim();
  const story = String(formData.get('story') ?? '').trim();
  if (!id || !publicName || !story) return;
  await prisma.testimonial.update({
    where: { id },
    data: {
      publicName,
      story,
      status: 'approved',
      approvedAt: new Date(),
      rejectedAt: null,
    },
  });
  revalidatePath('/admin/testimonials');
}

async function rejectTestimonial(formData: FormData) {
  'use server';
  const id = String(formData.get('id') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();
  if (!id) return;
  await prisma.testimonial.update({
    where: { id },
    data: {
      status: 'rejected',
      rejectedAt: new Date(),
      approvedAt: null,
      moderationNotes: notes || null,
    },
  });
  revalidatePath('/admin/testimonials');
}

async function unapproveTestimonial(formData: FormData) {
  'use server';
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await prisma.testimonial.update({
    where: { id },
    data: { status: 'pending', approvedAt: null },
  });
  revalidatePath('/admin/testimonials');
}

export default async function AdminTestimonialsPage() {
  // Group by status: pending first (needs attention), then approved,
  // then rejected (for revisit). Cap each group so a runaway submission
  // queue doesn't break the page render.
  const [pending, approved, rejected] = await Promise.all([
    prisma.testimonial.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.testimonial.findMany({
      where: { status: 'approved' },
      orderBy: { approvedAt: 'desc' },
      take: 100,
    }),
    prisma.testimonial.findMany({
      where: { status: 'rejected' },
      orderBy: { rejectedAt: 'desc' },
      take: 50,
    }),
  ]);

  // Approved count by locale — used to surface which locales are below
  // the min-3 threshold so Julia knows where the public block is hidden.
  const approvedByLocale = new Map<string, number>();
  for (const t of approved) {
    approvedByLocale.set(t.locale, (approvedByLocale.get(t.locale) ?? 0) + 1);
  }

  return (
    <div className="max-w-4xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Testimonials
      </div>
      <h1 className="text-[28px] mb-6 font-medium">Moderation queue</h1>

      <div className="mb-8 p-4 rounded-lg bg-blue-50 border border-blue-200 text-[13px] text-blue-900">
        <div className="font-medium mb-1">Display rule</div>
        <div>
          Approved testimonials show on Landing + Pricing on <strong>every locale</strong>
          once there are at least <strong>3 approved entries globally</strong>.
          Matching-locale testimonials are preferred (shown first); approved
          testimonials from other locales fill the remaining slots if the
          current-locale pool is small.
        </div>
        {approvedByLocale.size > 0 && (
          <div className="mt-2 flex gap-2 flex-wrap">
            {Array.from(approvedByLocale.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([locale, count]) => (
                <span
                  key={locale}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800"
                >
                  {locale}: {count}
                </span>
              ))}
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-800">
              total: {approved.length}
              {approved.length >= 3 ? ' ✓ visible' : ' (need 3+ to render)'}
            </span>
          </div>
        )}
      </div>

      {pending.length === 0 && approved.length === 0 && rejected.length === 0 ? (
        <div className="border border-dashed border-neutral-300 rounded-lg p-12 bg-white text-center">
          <p className="text-[14px] text-neutral-500">No testimonial submissions yet.</p>
          <p className="text-[12px] text-neutral-400 mt-2">
            Users can submit via the public <code className="font-mono">/share-your-story</code> page.
          </p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="mb-10">
              <h2 className="text-[15px] font-medium mb-3 text-neutral-700">
                Pending ({pending.length})
              </h2>
              <div className="space-y-4">
                {pending.map((t) => (
                  <article
                    key={t.id}
                    className="border border-amber-200 rounded-lg bg-white"
                  >
                    <div className="px-5 py-3 border-b border-neutral-200 bg-amber-50 flex items-center justify-between text-[12px] text-neutral-600">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={t.status} />
                        <span>locale: {t.locale}</span>
                        {t.ageRange && <span>age: {t.ageRange}</span>}
                      </div>
                      <span>{formatTimestamp(t.createdAt)}</span>
                    </div>
                    <form action={approveTestimonial} className="p-5 space-y-3">
                      <input type="hidden" name="id" value={t.id} />
                      <div>
                        <label className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                          Display name (editable)
                        </label>
                        <input
                          name="publicName"
                          defaultValue={t.publicName}
                          className="mt-1 w-full px-3 py-2 text-[14px] border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                          maxLength={40}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                          Story (editable — fix typos before approving)
                        </label>
                        <textarea
                          name="story"
                          defaultValue={t.story}
                          rows={5}
                          maxLength={1500}
                          className="mt-1 w-full px-3 py-2 text-[14px] border border-neutral-300 rounded-md font-sans leading-[1.6] focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                      <div className="flex gap-2 items-center">
                        <button
                          type="submit"
                          className="px-4 py-2 text-[13px] bg-green-600 text-white rounded-md hover:bg-green-700"
                        >
                          Approve
                        </button>
                      </div>
                    </form>
                    <form
                      action={rejectTestimonial}
                      className="px-5 pb-5 pt-2 border-t border-neutral-100 flex items-center gap-3"
                    >
                      <input type="hidden" name="id" value={t.id} />
                      <input
                        name="notes"
                        placeholder="Reason for rejection (private — not shown to user)"
                        className="flex-1 px-3 py-2 text-[13px] border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 text-[13px] text-neutral-700 border border-neutral-300 rounded-md hover:bg-neutral-50"
                      >
                        Reject
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            </section>
          )}

          {approved.length > 0 && (
            <section className="mb-10">
              <h2 className="text-[15px] font-medium mb-3 text-neutral-700">
                Approved ({approved.length}) — currently visible on Landing + Pricing
              </h2>
              <div className="space-y-3">
                {approved.map((t) => (
                  <article
                    key={t.id}
                    className="border border-neutral-200 rounded-lg bg-white p-4"
                  >
                    <div className="flex items-center justify-between mb-2 text-[12px] text-neutral-500">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={t.status} />
                        <span className="font-medium text-neutral-900">
                          {t.publicName}
                        </span>
                        <span>locale: {t.locale}</span>
                        {t.ageRange && <span>age: {t.ageRange}</span>}
                      </div>
                      <span>
                        Approved {t.approvedAt && formatTimestamp(t.approvedAt)}
                      </span>
                    </div>
                    <p className="text-[14px] text-neutral-800 leading-[1.6] whitespace-pre-wrap">
                      {t.story}
                    </p>
                    <form action={unapproveTestimonial} className="mt-3">
                      <input type="hidden" name="id" value={t.id} />
                      <button
                        type="submit"
                        className="text-[12px] text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
                      >
                        Move back to pending
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            </section>
          )}

          {rejected.length > 0 && (
            <section>
              <h2 className="text-[15px] font-medium mb-3 text-neutral-700">
                Rejected ({rejected.length})
              </h2>
              <div className="space-y-2">
                {rejected.map((t) => (
                  <article
                    key={t.id}
                    className="border border-neutral-200 rounded-lg bg-white p-4 opacity-75"
                  >
                    <div className="flex items-center justify-between mb-2 text-[12px] text-neutral-500">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={t.status} />
                        <span className="font-medium text-neutral-700">
                          {t.publicName}
                        </span>
                        <span>locale: {t.locale}</span>
                      </div>
                      <span>
                        Rejected {t.rejectedAt && formatTimestamp(t.rejectedAt)}
                      </span>
                    </div>
                    <p className="text-[13px] text-neutral-600 leading-[1.5] line-clamp-3">
                      {t.story}
                    </p>
                    {t.moderationNotes && (
                      <p className="mt-2 text-[12px] text-neutral-500 italic">
                        Note: {t.moderationNotes}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
