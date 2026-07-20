// Recommendation response endpoint — Platform Step 5 (2026-07-20).
//
// POST { id, response: 'accepted' | 'declined' }
//
// Ownership-checked: the recommendation must belong to the caller and
// still be open (respondToRecommendationOwned). A decline sets the
// 30-day cool-off enforced by the rule guards ("never pushed").

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { respondToRecommendationOwned } from '@/lib/platform/profile';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { id?: string; response?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { id, response } = body;
  if (!id || (response !== 'accepted' && response !== 'declined')) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  try {
    const ok = await respondToRecommendationOwned(userId, id, response);
    if (!ok) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[platform/recommendation] respond failed', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
