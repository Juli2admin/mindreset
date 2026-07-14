// /admin/pilot/responses — raw tester responses view.
//
// PR ω3a (2026-07-14). Basic admin visibility of TesterResponse rows —
// the 6 Likert scales and the JSON blob for each submission. Deeper
// analytics (Before/After deltas per scale, cross-reference with
// Journey usage, CSV export) ship in a follow-up PR.

import prisma from '@/lib/prisma';
import { currentUserIsAdmin } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const SCALE_LABELS: [keyof RowShape, string][] = [
  ['scaleUnderstand', 'understand'],
  ['scaleNotice', 'notice'],
  ['scaleChoose', 'choose'],
  ['scaleHardOnSelf', 'hardOnSelf'],
  ['scaleAffectsLife', 'affectsLife'],
  ['scaleStuck', 'stuck'],
];

type RowShape = {
  scaleUnderstand: number | null;
  scaleNotice: number | null;
  scaleChoose: number | null;
  scaleHardOnSelf: number | null;
  scaleAffectsLife: number | null;
  scaleStuck: number | null;
};

export default async function AdminPilotResponsesPage() {
  if (!(await currentUserIsAdmin())) redirect('/');

  const rows = await prisma.testerResponse.findMany({
    orderBy: [{ submittedAt: 'desc' }],
    include: {
      invitation: {
        select: {
          code: true,
          redeemedByUser: { select: { email: true } },
        },
      },
    },
  });

  return (
    <div className="max-w-5xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Pilot programme
      </div>
      <h1 className="text-[28px] mb-2 font-medium">Tester responses</h1>
      <p className="text-[13px] leading-[1.65] text-neutral-700 mb-6">
        Raw submissions from /pilot/before and /pilot/after. The six 0–10
        scales are typed columns; everything else (consent, About You,
        Your Pattern, free text) lives in the JSON blob and renders
        below unformatted.
      </p>

      {rows.length === 0 && (
        <p className="text-[13px] text-neutral-500">
          No responses yet. Once a tester submits, they will appear here.
        </p>
      )}

      <div className="space-y-6">
        {rows.map((r) => {
          const submittedAtStr = r.submittedAt.toISOString();
          const email = r.invitation.redeemedByUser?.email ?? '—';
          return (
            <div
              key={r.id}
              className="rounded-lg border border-neutral-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-baseline gap-3 mb-3">
                <span
                  className={`text-[11px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full ${
                    r.formType === 'before'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : r.formType === 'after'
                        ? 'bg-blue-50 text-blue-800 border border-blue-200'
                        : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                  }`}
                >
                  {r.formType}
                </span>
                <span className="text-[13px] font-medium">{email}</span>
                <span className="text-[12px] text-neutral-500">
                  {r.invitation.code}
                </span>
                <span className="text-[12px] text-neutral-500 ml-auto">
                  {submittedAtStr}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {SCALE_LABELS.map(([col, label]) => (
                  <div
                    key={col}
                    className="text-[13px] px-3 py-2 rounded-md bg-neutral-50 border border-neutral-200"
                  >
                    <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                      {label}
                    </div>
                    <div className="text-[15px] font-medium">
                      {r[col] ?? '—'} / 10
                    </div>
                  </div>
                ))}
              </div>

              <details>
                <summary className="text-[12px] text-neutral-600 cursor-pointer select-none">
                  Answers JSON
                </summary>
                <pre className="mt-2 text-[12px] leading-[1.5] bg-neutral-50 p-3 rounded border border-neutral-200 overflow-x-auto">
                  {JSON.stringify(r.answers, null, 2)}
                </pre>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}
