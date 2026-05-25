import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ ok: true }); // anonymous — cookie is sufficient
  }

  try {
    await prisma.user.updateMany({
      where: { id: user.id },
      data: { disclaimerAcknowledgedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[disclaimer] db update failed:', err);
    return NextResponse.json({ error: 'db error' }, { status: 500 });
  }
}
