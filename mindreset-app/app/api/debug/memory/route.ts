// TEMPORARY DIAGNOSTIC — revert after Test 3 verification.
// See claude/carry-forward-user-fields branch history.
//
// Purpose: pinpoint why MiniMind doesn't see preferredName despite the
// User row being populated. Julia hits GET <preview>/api/debug/memory
// in her browser while signed in; the JSON response shows exactly what
// the loader returns AND what's actually in the User row, so we can
// distinguish Prisma-client-mismatch, missing-row, null-value, and
// loader-bug failure modes without needing Vercel CLI access.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { loadUserMemoryContext } from '@/lib/minimind/memory/loader';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // (1) Direct User read with the SAME select shape the loader uses.
    // Lets us distinguish:
    //   - Prisma rejected the select (unknown field) → userResult.error set
    //   - User row not in DB at all → userResult.found === false
    //   - DB value is null → userResult.preferredName === null
    //   - DB value present → userResult.preferredName === "Julia" (or whatever)
    let userResult: {
      found: boolean;
      preferredName: string | null;
      locale: string | null;
      screeningResult: string | null;
      error?: string;
    };
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          preferredName: true,
          locale: true,
          screeningResult: true,
        },
      });
      userResult = user
        ? {
            found: true,
            preferredName: user.preferredName,
            locale: user.locale,
            screeningResult: user.screeningResult,
          }
        : {
            found: false,
            preferredName: null,
            locale: null,
            screeningResult: null,
          };
    } catch (err) {
      userResult = {
        found: false,
        preferredName: null,
        locale: null,
        screeningResult: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    // (2) Loader call — mirrors exactly what the chat route does.
    // Loader has its own internal try/catch that swallows errors and
    // returns empty formattedBlock; if that happens, userResult above
    // tells us whether the underlying read worked or not.
    const memory = await loadUserMemoryContext(userId);

    return NextResponse.json({
      userId,
      user: userResult,
      memory: {
        hasMemory: memory.hasMemory,
        formattedBlock: memory.formattedBlock,
        formattedBlockLength: memory.formattedBlock.length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'debug endpoint failed',
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : undefined,
      },
      { status: 500 },
    );
  }
}
