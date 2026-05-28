import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { buildExportBundle } from '@/lib/account/export';

export const dynamic = 'force-dynamic';

// GDPR Article 20 data export. Returns a JSON bundle of everything the
// user has contributed. Synchronous because (a) the data is small and
// (b) a download is a less anxious UX than "we'll email it to you when
// it's ready".
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bundle = await buildExportBundle(userId);
    const filename = `mindreset-data-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[account/export] failed', err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
