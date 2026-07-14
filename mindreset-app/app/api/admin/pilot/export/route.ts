// CSV export of pilot tester responses.
//
// PR ω3c (2026-07-14). Admin-only. One row per pilot invitation that
// has at least one form submission. Columns: identity, dates, all six
// scales for Before and After, computed deltas, and the key free-text
// answers (pattern, hope, shifted-without-forcing, confusing/boring,
// anything-else).
//
// The output is UTF-8 CSV with a BOM so Excel opens it in the right
// encoding without prompting. Values are RFC-4180-quoted where they
// contain quotes, commas, or newlines.

import { NextResponse } from 'next/server';
import { currentUserIsAdmin } from '@/lib/admin/auth';
import { loadTesterPairs, SCALES } from '@/lib/pilot/analytics';

export const dynamic = 'force-dynamic';

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : String(v);
  // RFC-4180: wrap in double quotes and double any embedded quotes when
  // the value contains a quote, comma, or newline.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmtDate(d: Date | null): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  if (!(await currentUserIsAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const pairs = await loadTesterPairs();

  const header = [
    'invitation_code',
    'email',
    'before_submitted_at',
    'after_submitted_at',
    ...SCALES.flatMap((s) => [
      `${s.key}_before`,
      `${s.key}_after`,
      `${s.key}_delta`,
    ]),
    'before_pattern_text',
    'before_hope',
    'after_shifted_without_forcing',
    'after_confusing_boring_missing',
    'after_anything_else',
  ];

  const lines: string[] = [header.join(',')];

  for (const p of pairs) {
    const row: (string | number | null)[] = [
      p.code,
      p.email,
      fmtDate(p.beforeAt),
      fmtDate(p.afterAt),
      ...SCALES.flatMap((s) => {
        const b = p.scales[s.key].before;
        const a = p.scales[s.key].after;
        const d = b !== null && a !== null ? a - b : null;
        return [b, a, d];
      }),
      p.beforePatternText,
      p.beforeHope,
      p.afterShifted,
      p.afterConfusingBoring,
      p.afterAnythingElse,
    ];
    lines.push(row.map(csvEscape).join(','));
  }

  // UTF-8 BOM so Excel opens cyrillic + curly quotes correctly.
  const body = '﻿' + lines.join('\r\n');

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="mindreset-pilot-responses-${today}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
