import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DEBUG_KEY = 'a7c41f9e8b3d2056af19c4b8e7f63d2c';

function inspect(envName: string) {
  const raw = process.env[envName];
  if (!raw) {
    return { present: false as const };
  }

  const stripped = raw.replace(/^["']|["']$/g, '');
  const had_quotes = stripped !== raw;

  const schemeIdx = stripped.indexOf('://');
  if (schemeIdx < 0) {
    return { present: true as const, raw_length: raw.length, had_quotes, parse_error: 'no scheme separator' };
  }
  const scheme = stripped.slice(0, schemeIdx);
  const rest = stripped.slice(schemeIdx + 3);

  const slashIdx = rest.indexOf('/');
  const authority = slashIdx >= 0 ? rest.slice(0, slashIdx) : rest;
  const pathAndQuery = slashIdx >= 0 ? rest.slice(slashIdx) : '';

  const lastAt = authority.lastIndexOf('@');
  if (lastAt < 0) {
    return { present: true as const, raw_length: raw.length, had_quotes, scheme, parse_error: 'no userinfo' };
  }
  const userinfo = authority.slice(0, lastAt);
  const hostport = authority.slice(lastAt + 1);

  const colonIdx = userinfo.indexOf(':');
  const username = colonIdx >= 0 ? userinfo.slice(0, colonIdx) : userinfo;
  const password = colonIdx >= 0 ? userinfo.slice(colonIdx + 1) : '';

  const portColonIdx = hostport.lastIndexOf(':');
  const host = portColonIdx >= 0 ? hostport.slice(0, portColonIdx) : hostport;
  const port = portColonIdx >= 0 ? hostport.slice(portColonIdx + 1) : '';

  const qIdx = pathAndQuery.indexOf('?');
  const database = qIdx >= 0 ? pathAndQuery.slice(1, qIdx) : pathAndQuery.slice(1);
  const search = qIdx >= 0 ? pathAndQuery.slice(qIdx) : '';

  let decodes_cleanly = false;
  try {
    decodeURIComponent(password);
    decodes_cleanly = true;
  } catch {
    decodes_cleanly = false;
  }

  return {
    present: true as const,
    raw_length: raw.length,
    had_quotes,
    scheme,
    username,
    username_has_dot_suffix: username.includes('.'),
    host,
    port,
    database,
    search,
    password_metadata:
      password.length === 0
        ? null
        : {
            length: password.length,
            first_char: password[0],
            last_char: password[password.length - 1],
            contains_at: password.includes('@'),
            contains_percent: password.includes('%'),
            contains_pct_40: password.includes('%40'),
            contains_hash: password.includes('#'),
            contains_question_mark: password.includes('?'),
            contains_slash: password.includes('/'),
            contains_space: password.includes(' '),
            contains_ampersand: password.includes('&'),
            contains_plus: password.includes('+'),
            decodes_cleanly,
          },
  };
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (key !== DEBUG_KEY) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const database = inspect('DATABASE_URL');
  const direct = inspect('DIRECT_URL');

  let queryResult:
    | { ok: true; count: number; ms: number }
    | { ok: false; error_name: string; error_code: string | null; error_first_line: string };

  const t0 = Date.now();
  try {
    const count = await prisma.user.count();
    queryResult = { ok: true, count, ms: Date.now() - t0 };
  } catch (err) {
    const e = err as { name?: string; code?: string; message?: string };
    const msg = (e.message ?? String(err)).split('\n').filter(Boolean)[0] ?? '';
    queryResult = {
      ok: false,
      error_name: e.name ?? 'unknown',
      error_code: e.code ?? null,
      error_first_line: msg.slice(0, 240),
    };
  }

  return NextResponse.json({
    query: queryResult,
    database,
    direct,
    note: 'Password is never returned. Only structural metadata.',
  });
}
