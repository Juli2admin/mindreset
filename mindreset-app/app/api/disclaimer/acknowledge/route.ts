import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { disclaimerAcknowledgedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[disclaimer] db update failed:', err);
    return NextResponse.json({ error: 'db error' }, { status: 500 });
  }
}
