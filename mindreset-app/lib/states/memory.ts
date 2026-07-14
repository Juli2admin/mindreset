// Rolling cross-session memory for state modules.
//
// PR ψ5 (2026-07-14). Unlike Themes (one continuous ThemeSession per
// user+module), States use short one-shot sessions — the reader
// completes a fresh anxiety session, closes, and the next visit
// starts a new StateSession. Without cross-session memory, session
// #3 has no idea that in session #1 the 4-7-8 breath landed well and
// grounding-via-feet went nowhere. This module fixes that: a compact
// running summary keyed by (userId, moduleId) that carries forward
// what worked, what's still open, and any patterns the AI has
// observed. Loaded per turn, regenerated on SESSION_COMPLETE.
//
// Never regenerates on red_flag closes — the point of memory is
// continuity of the reader's arc, and a red-flag session is a safety
// event, not clinical progress. The memory row (if any) stays at its
// last stabilised value across a red-flag closure.

import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encrypt';
import { recordAiUsage } from '@/lib/ai-usage/record';
import { getStateModule } from './modules';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Haiku for the summary — cheap, structured, fast. Same choice as
// lib/themes/memory.ts.
const SUMMARY_MODEL = 'claude-haiku-4-5-20251001';
const SUMMARY_MAX_TOKENS = 400;

// Number of MOST RECENT messages (across all sessions on this module)
// fed to the summariser at each regeneration. Small — states are short.
const SUMMARY_HISTORY_WINDOW = 40;

function summarySystemPrompt(stateName: string): string {
  return `You are the clinical-notes assistant for MindReset's ${stateName} state module.

Your job is to keep a running SUMMARY of the reader's arc across
multiple short reset sessions on this ONE state module. The main
State companion (a different AI) reads your notes at the start of
every session so it can pick up where you last left off — knowing
what practice landed, what didn't, and any pattern the reader keeps
running into.

Write a compact summary (100–180 words) covering:

- Which practices you have offered on prior sessions and how each
  landed (worked / didn't / titrated).
- Activation type the reader tends to arrive in
  (hyperarousal / hypoarousal / rumination) — if a clear pattern.
- Somatic pattern the reader reports (chest, throat, shoulders,
  feet, freeze / brace / spin).
- Any real trigger the reader has named across sessions (a job,
  a person, a recurring situation) — without solving it.
- Where the arc is now — improving, holding, or still stuck.
- Any red-flag or refer-out markers that have appeared, if any.

Do NOT:
- Repeat the reader's exact words verbatim (paraphrase for privacy).
- Interpret / diagnose / analyse.
- Speak TO the reader — you are writing notes FOR the companion AI.
- Include the reader's name if present in messages.

If a previous summary is provided (marked as PRIOR SUMMARY), UPDATE
it with what has happened since. Carry forward what still matters,
drop what no longer does, add what's new.

Return ONLY the summary text. No headings, no preamble, no closing.`;
}

/**
 * Regenerate the cross-session memory for a state module.
 * Called from the turn API's waitUntil block on SESSION_COMPLETE
 * (only when reason ∈ {'stabilised', 'not_settled_close'} — not on
 * red_flag).
 *
 * Reads the most recent SUMMARY_HISTORY_WINDOW messages across all
 * sessions on this module for this user (chronologically ordered),
 * plus the prior summary if one exists, and produces an updated
 * summary. Silent on failure — the reader's turn is never blocked
 * by a summary regeneration hiccup.
 */
export async function regenerateStateModuleMemory(
  userId: string,
  moduleId: string,
): Promise<void> {
  const mod = getStateModule(moduleId);
  if (!mod) {
    console.error('[states/memory] unknown moduleId', { moduleId });
    return;
  }
  const stateName = mod.name;

  // Recent messages across ALL sessions on this (user, module). We
  // scope to the last N sessions via findMany + orderBy; the DB does
  // the heavy lifting.
  const recent = await prisma.stateMessage.findMany({
    where: {
      session: { userId, moduleId },
    },
    orderBy: { createdAt: 'desc' },
    take: SUMMARY_HISTORY_WINDOW,
    select: { role: true, contentEncrypted: true },
  });
  if (recent.length === 0) return;
  recent.reverse();

  // Total-turns-across-sessions for the light "when was this
  // refreshed" indicator.
  const totalTurns = await prisma.stateMessage.count({
    where: { session: { userId, moduleId } },
  });

  const existing = await prisma.stateModuleMemory.findUnique({
    where: { userId_moduleId: { userId, moduleId } },
    select: { memorySummaryEncrypted: true },
  });
  const priorSummary = existing?.memorySummaryEncrypted
    ? decrypt(existing.memorySummaryEncrypted)
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
      system: summarySystemPrompt(stateName),
      messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text)
      .join('')
      .trim();
    if (!text) {
      console.warn('[states/memory] empty summary from model', { userId, moduleId });
      return;
    }

    const now = new Date();
    await prisma.stateModuleMemory.upsert({
      where: { userId_moduleId: { userId, moduleId } },
      update: {
        memorySummaryEncrypted: encrypt(text),
        memorySummaryUpdatedAt: now,
        memorySummaryTurnCount: totalTurns,
      },
      create: {
        userId,
        moduleId,
        memorySummaryEncrypted: encrypt(text),
        memorySummaryUpdatedAt: now,
        memorySummaryTurnCount: totalTurns,
      },
    });

    try {
      await recordAiUsage({
        userId,
        callSite: 'states_memory_summary',
        model: SUMMARY_MODEL,
        usage: response.usage,
      });
    } catch (err) {
      console.error('[states/memory] recordAiUsage failed:', err);
    }
  } catch (err) {
    console.error('[states/memory] summary regeneration failed:', err);
  }
}

/**
 * Fetch the current cross-session memory summary for use in the turn
 * API's system prompt. Returns null when no memory has been
 * generated yet (the reader hasn't completed a session on this
 * module).
 */
export async function loadStateModuleMemory(
  userId: string,
  moduleId: string,
): Promise<string | null> {
  const row = await prisma.stateModuleMemory.findUnique({
    where: { userId_moduleId: { userId, moduleId } },
    select: { memorySummaryEncrypted: true },
  });
  if (!row?.memorySummaryEncrypted) return null;
  return decrypt(row.memorySummaryEncrypted);
}
