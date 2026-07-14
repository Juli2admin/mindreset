// Rolling arc-summary for Theme sessions.
//
// PR χ1 (2026-07-13). Themes are multi-session; arcs can span weeks
// and hundreds of turns. Loading full history every turn dilutes the
// AI's attention and gets expensive. Instead we keep a running summary
// of what has come up — updated periodically via a lightweight Haiku
// call — and prepend it to the system prompt as "prior arc notes".
//
// Update cadence: every SUMMARY_INTERVAL_TURNS (currently 15). The
// first summary fires as soon as the arc crosses that threshold; every
// subsequent update reads the last summary + the messages that arrived
// since, and returns an updated summary.
//
// The summary is encrypted at rest, same enc:v1: format as the
// message bodies.

import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encrypt';
import { recordAiUsage } from '@/lib/ai-usage/record';
import { getThemeModule, type ThemeModuleId } from './modules';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Haiku 4.5 for the summary — cheap, fast, structured enough for a
// clinical-notes-style summary.
const SUMMARY_MODEL = 'claude-haiku-4-5-20251001';
const SUMMARY_MAX_TOKENS = 500;

/** How many turns pass between successive summary regenerations. */
export const SUMMARY_INTERVAL_TURNS = 15;

/** How many recent messages to feed the summariser at each update. */
const SUMMARY_HISTORY_WINDOW = 30;

function summarySystemPrompt(themeName: string): string {
  return `You are the clinical-notes assistant for MindReset's ${themeName} module.

Your job is to keep a running SUMMARY of the reader's arc so far — the
kind of concise notes a clinician keeps between sessions. The main
Theme companion (a different AI) will read your notes to remember
what came up in previous sessions without needing to re-read every
message.

Write a compact summary (150–250 words) covering:

- Whose voices / scripts have surfaced (parental, religious, cultural,
  own inherited). Name them by role, not by protected identifiers.
- Specific memories or events the reader has named that carry weight.
- Somatic patterns the reader has reported (chest, throat, shoulders,
  hot / cold, collapse / freeze).
- Practices you have worked on together and how they landed.
- Where the arc is currently — what has softened, what is still open,
  what is unfinished.
- Any red-flag or refer-out markers that have appeared, if any.

Do NOT:
- Repeat the reader's exact words verbatim (paraphrase for privacy).
- Interpret / diagnose / analyse.
- Speak TO the reader — you are writing notes FOR the companion AI.
- Include the reader's name if present in messages.

If a previous summary is provided (marked as PRIOR SUMMARY), your
job is to UPDATE it with what has happened since — carry forward
what still matters, drop what no longer does, add what's new.

Return ONLY the summary text. No headings, no preamble, no closing.`;
}

/**
 * Regenerate (or create) the memory summary for a Theme session.
 * Reads the most recent SUMMARY_HISTORY_WINDOW messages plus the
 * existing summary (if any) and produces an updated summary.
 * Fire-and-forget from the turn API — failures are logged and swallowed
 * so the reader's turn is never blocked by a summary regeneration
 * hiccup.
 */
export async function regenerateThemeMemorySummary(
  sessionId: string,
  userId: string,
  moduleId: string,
): Promise<void> {
  const mod = getThemeModule(moduleId);
  if (!mod) {
    console.error('[themes/memory] unknown moduleId', { moduleId });
    return;
  }
  const themeName = mod.name;

  const session = await prisma.themeSession.findUnique({
    where: { id: sessionId },
    select: {
      turnCount: true,
      memorySummaryEncrypted: true,
      memorySummaryTurnCount: true,
    },
  });
  if (!session) {
    console.warn('[themes/memory] session not found', { sessionId });
    return;
  }

  const recent = await prisma.themeMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: SUMMARY_HISTORY_WINDOW,
    select: { role: true, contentEncrypted: true },
  });
  recent.reverse();

  if (recent.length === 0) return;

  const priorSummary = session.memorySummaryEncrypted
    ? decrypt(session.memorySummaryEncrypted)
    : null;

  const historyText = recent
    .map((m) => {
      const role = m.role === 'assistant' ? 'Companion' : 'Reader';
      return `${role}: ${decrypt(m.contentEncrypted)}`;
    })
    .join('\n\n');

  const userContent = priorSummary
    ? `PRIOR SUMMARY:\n${priorSummary}\n\nRECENT MESSAGES:\n${historyText}\n\nProduce the UPDATED summary.`
    : `MESSAGES SO FAR:\n${historyText}\n\nProduce the summary.`;

  try {
    const response = await anthropic.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: SUMMARY_MAX_TOKENS,
      system: summarySystemPrompt(themeName),
      messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text)
      .join('')
      .trim();

    if (!text) {
      console.warn('[themes/memory] empty summary from model', { sessionId });
      return;
    }

    await prisma.themeSession.update({
      where: { id: sessionId },
      data: {
        memorySummaryEncrypted: encrypt(text),
        memorySummaryUpdatedAt: new Date(),
        memorySummaryTurnCount: session.turnCount,
      },
    });

    try {
      await recordAiUsage({
        userId,
        callSite: 'themes_memory_summary',
        model: SUMMARY_MODEL,
        usage: response.usage,
      });
    } catch (err) {
      console.error('[themes/memory] recordAiUsage failed:', err);
    }
  } catch (err) {
    console.error('[themes/memory] summary regeneration failed:', err);
  }
}

/**
 * Should we regenerate the summary this turn?
 * Fires on the boundary — the first turn that crosses each SUMMARY_INTERVAL_TURNS
 * threshold after the last summary was taken.
 */
export function shouldRegenerateSummary(
  currentTurnCount: number,
  lastSummaryTurnCount: number,
): boolean {
  if (currentTurnCount < SUMMARY_INTERVAL_TURNS) return false;
  return currentTurnCount - lastSummaryTurnCount >= SUMMARY_INTERVAL_TURNS;
}

/**
 * Decrypt the current memory summary for use in the system prompt.
 * Returns null when the session has no summary yet (first ~15 turns).
 */
export async function loadThemeMemorySummary(
  sessionId: string,
): Promise<string | null> {
  const row = await prisma.themeSession.findUnique({
    where: { id: sessionId },
    select: { memorySummaryEncrypted: true },
  });
  if (!row?.memorySummaryEncrypted) return null;
  return decrypt(row.memorySummaryEncrypted);
}
