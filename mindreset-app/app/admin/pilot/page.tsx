import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { currentUserIsAdmin } from '@/lib/admin/auth';
import {
  createInvitationBulk,
  revokeInvitation,
  setTrackingFlag,
  deriveStatus,
  type TrackingFlag,
} from '@/lib/pilot/invitations';
import PilotAdminClient from './PilotAdminClient';

// /admin/pilot — the tester pipeline console.
//
// Julia creates invitation codes, sends the redeem link to each tester
// manually (email / Whatsapp / whatever fits), and comes back here to
// see who signed up, when their trial ends, and to tick the clinical
// evidence checkboxes as forms come in.
//
// All state lives on PilotInvitation rows. Redemption stamps User too
// (see lib/pilot/invitations.ts).

export const dynamic = 'force-dynamic';

async function actionCreate(formData: FormData) {
  'use server';
  if (!(await currentUserIsAdmin())) throw new Error('Forbidden');

  const notes = String(formData.get('notes') ?? '').trim() || null;
  const countRaw = String(formData.get('count') ?? '1').trim();
  const trialDaysRaw = String(formData.get('trialDays') ?? '30').trim();
  const expiresAtRaw = String(formData.get('expiresAt') ?? '').trim();

  const count = Math.max(1, Math.min(50, Number(countRaw) || 1));
  const trialDays = Math.max(1, Math.min(365, Number(trialDaysRaw) || 30));

  let expiresAt: Date | null = null;
  if (expiresAtRaw) {
    const d = new Date(`${expiresAtRaw}T23:59:59Z`);
    if (Number.isFinite(d.getTime())) expiresAt = d;
  }

  const { userId } = await auth();
  const admin = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      })
    : null;

  await createInvitationBulk(count, {
    createdByEmail: admin?.email ?? 'unknown',
    notes,
    trialDays,
    expiresAt,
  });

  revalidatePath('/admin/pilot');
}

async function actionRevoke(formData: FormData) {
  'use server';
  if (!(await currentUserIsAdmin())) throw new Error('Forbidden');
  const id = String(formData.get('id') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim() || 'admin revoke';
  if (!id) return;
  await revokeInvitation(id, reason);
  revalidatePath('/admin/pilot');
}

async function actionToggleFlag(formData: FormData) {
  'use server';
  if (!(await currentUserIsAdmin())) throw new Error('Forbidden');
  const id = String(formData.get('id') ?? '').trim();
  const flag = String(formData.get('flag') ?? '').trim() as TrackingFlag;
  const value = formData.get('value') === 'true';
  if (!id) return;
  if (
    flag !== 'beforeFormFilled' &&
    flag !== 'afterFormFilled' &&
    flag !== 'followUp3mSent' &&
    flag !== 'quoteApproved'
  ) {
    return;
  }
  await setTrackingFlag(id, flag, value);
  revalidatePath('/admin/pilot');
}

export default async function AdminPilotPage() {
  const rows = await prisma.pilotInvitation.findMany({
    orderBy: [{ redeemedAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      redeemedByUser: {
        select: {
          id: true,
          email: true,
          pilotTrialStartedAt: true,
          pilotTrialEndsAt: true,
        },
      },
    },
  });

  const total = rows.length;
  const active = rows.filter(
    (r) => deriveStatus(r) === 'active',
  ).length;
  const pending = rows.filter((r) => deriveStatus(r) === 'pending').length;

  // Serialise into the shape the client component wants. Dates → ISO strings.
  const clientRows = rows.map((r) => ({
    id: r.id,
    code: r.code,
    createdAt: r.createdAt.toISOString(),
    notes: r.notes,
    trialDays: r.trialDays,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    redeemedAt: r.redeemedAt?.toISOString() ?? null,
    redeemedByEmail: r.redeemedByUser?.email ?? null,
    trialStartedAt: r.redeemedByUser?.pilotTrialStartedAt?.toISOString() ?? null,
    trialEndsAt: r.redeemedByUser?.pilotTrialEndsAt?.toISOString() ?? null,
    beforeFormFilled: r.beforeFormFilled,
    afterFormFilled: r.afterFormFilled,
    followUp3mSent: r.followUp3mSent,
    quoteApproved: r.quoteApproved,
    revokedAt: r.revokedAt?.toISOString() ?? null,
    revokedReason: r.revokedReason,
    status: deriveStatus(r),
  }));

  return (
    <div className="max-w-6xl">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">
        Pilot programme
      </div>
      <h1 className="text-[28px] mb-2 font-medium">Tester invitations</h1>
      <p className="text-[13px] leading-[1.65] text-neutral-700 mb-6">
        Create a code, copy the redeem link, email it to your tester. When they claim it,
        they get 30-day free Journey access. MiniMind stays on its normal 50-message free
        tier. Post-trial, testers see a &ldquo;Continue with 50% off&rdquo; CTA.
      </p>

      <div className="flex gap-4 mb-6">
        <StatChip label="Total invites" value={total} />
        <StatChip label="Active pilots" value={active} accent />
        <StatChip label="Unredeemed" value={pending} />
      </div>

      <PilotAdminClient
        rows={clientRows}
        actionCreate={actionCreate}
        actionRevoke={actionRevoke}
        actionToggleFlag={actionToggleFlag}
      />
    </div>
  );
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 min-w-[140px] ${
        accent
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-neutral-200 bg-white'
      }`}
    >
      <div className="text-[24px] font-medium leading-none">{value}</div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 mt-1">
        {label}
      </div>
    </div>
  );
}
