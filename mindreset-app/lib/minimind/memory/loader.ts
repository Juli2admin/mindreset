// Phase 3d memory loader.
//
// Reads User + WellbeingSnapshot and composes a plain-text "USER CONTEXT FOR
// THIS SESSION" block injected into MiniMind's system prompt on every chat
// turn (see Piece 5 route integration). Plain text — not JSON — so Sonnet
// can reference observations naturally without confusing them for tool data.
//
// MEMORY HYGIENE: the block contains light analytical observations only.
// No raw message content, no SafetyEvent details, no PII beyond locale. The
// "no surveillance" principle in v2.1 prompt's MEMORY ACROSS SESSIONS
// section is preserved by keeping the block minimal and observation-flavoured
// (not transcript-flavoured).
//
// FAILURE MODE: loader failure must NEVER break chat. On any exception we
// log [memory] loader failed and return an empty formattedBlock + hasMemory:
// false. Piece 5 treats empty string as "no injection".
//
// INJECTION GATE: Piece 5 gates injection on formattedBlock.length > 0
// (Option B per Phase 3d architect decision), not on hasMemory. This means
// new users still get their language + screening surfaced to MiniMind on
// turn 1 — the empty-block variant below carries genuinely useful context
// even without a WellbeingSnapshot row.

import prisma from '@/lib/prisma';

const STATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const ENGINE_NOTES_DISPLAY_MAX = 2000;

export type UserMemoryContext = {
  hasMemory: boolean; // true iff a WellbeingSnapshot row exists for this user
  formattedBlock: string; // ready-to-inject text; empty string only on loader failure
};

type StateOccurrence = { state: string; detectedAt: string };
type ActiveTheme = { name: string; weight?: number };

function formatLocale(locale: string | null | undefined): string {
  return locale && typeof locale === 'string' ? locale : 'en';
}

function formatScreeningResult(result: string | null | undefined): string {
  if (!result) return 'none';
  // Schema stores lowercase ('green' | 'yellow' | 'red'); v2.1 prompt voice
  // uses uppercase (GREEN | YELLOW | RED). Verified against lib/screening/
  // classify.ts return shape.
  return result.toUpperCase();
}

// Returns counts per state for entries with detectedAt within the trailing
// 7-day window. Tolerant: unknown shapes, bad timestamps, and future-dated
// entries are silently skipped (never counted, never thrown).
function countRecentStates(
  occurrences: unknown,
  now: number = Date.now(),
): Map<string, number> {
  const counts = new Map<string, number>();
  if (!Array.isArray(occurrences)) return counts;
  for (const entry of occurrences) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof (entry as StateOccurrence).state !== 'string' ||
      typeof (entry as StateOccurrence).detectedAt !== 'string'
    ) {
      continue;
    }
    const e = entry as StateOccurrence;
    const ts = Date.parse(e.detectedAt);
    if (!Number.isFinite(ts)) continue;
    const delta = now - ts;
    if (delta < 0 || delta > STATE_WINDOW_MS) continue;
    counts.set(e.state, (counts.get(e.state) ?? 0) + 1);
  }
  return counts;
}

function formatActiveThemes(themes: unknown): string {
  if (!Array.isArray(themes) || themes.length === 0) return '(none observed)';
  const names: string[] = [];
  for (const t of themes) {
    if (
      t &&
      typeof t === 'object' &&
      typeof (t as ActiveTheme).name === 'string'
    ) {
      names.push((t as ActiveTheme).name);
    }
  }
  return names.length > 0 ? names.join(', ') : '(none observed)';
}

function formatStatePatterns(counts: Map<string, number>): string {
  if (counts.size === 0) return '(no patterns yet)';
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([state, n]) => `${state}: ${n} mention${n === 1 ? '' : 's'}`)
    .join('\n');
}

function formatNotes(notes: string | null | undefined): string {
  if (!notes) return '(none yet)';
  if (notes.length <= ENGINE_NOTES_DISPLAY_MAX) return notes;
  // Keep the most recent characters — engineNotes is append-with-cap, so the
  // tail is the freshest observation.
  return (
    '...(older notes truncated)...\n' +
    notes.slice(-ENGINE_NOTES_DISPLAY_MAX)
  );
}

function emptyBlock(locale: string, screeningResult: string | null): string {
  return `---
USER CONTEXT FOR THIS SESSION

Preferred name: not given
Preferred language: ${formatLocale(locale)}
Section 0 screening result: ${formatScreeningResult(screeningResult)}

(No prior session observations yet — this is a new user or pre-memory user.)
---`;
}

export async function loadUserMemoryContext(
  userId: string,
): Promise<UserMemoryContext> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true, screeningResult: true },
    });
    if (!user) {
      // Auth gate would normally prevent this. Fail-safe to empty.
      return { hasMemory: false, formattedBlock: '' };
    }

    const profile = await prisma.wellbeingSnapshot.findUnique({
      where: { userId },
    });

    if (!profile) {
      return {
        hasMemory: false,
        formattedBlock: emptyBlock(user.locale, user.screeningResult),
      };
    }

    const stateCounts = countRecentStates(profile.recentStateOccurrences);

    const block = `---
USER CONTEXT FOR THIS SESSION

Preferred name: not given
Preferred language: ${formatLocale(user.locale)}
Section 0 screening result: ${formatScreeningResult(user.screeningResult)}

[Diagnostic profile observations from prior sessions]
Predominant state observed: ${profile.predominantState ?? '(not yet observed)'}
State intensity (1-5): ${profile.stateIntensity ?? '(not yet observed)'}
Processing channel: ${profile.channelPreference ?? '(not yet observed)'}
Active themes: ${formatActiveThemes(profile.activeThemes)}

[Recent state patterns - last 7 days]
${formatStatePatterns(stateCounts)}

[Narrative observations]
${formatNotes(profile.engineNotes)}
---`;

    return { hasMemory: true, formattedBlock: block };
  } catch (err) {
    console.error('[memory] loader failed', {
      userId,
      error: err instanceof Error ? err.message : String(err),
      errorName: err instanceof Error ? err.name : undefined,
    });
    return { hasMemory: false, formattedBlock: '' };
  }
}
