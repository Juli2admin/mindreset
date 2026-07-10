// Admin-only smoke-test endpoint for PR η Option B architecture.
//
// Fires ONE real messages.stream() call to Sonnet 4-6 with the strict
// emit_state_report tool AND forced tool_choice. No extended thinking —
// per the definitive Anthropic docs audit (2026-07-10), extended thinking
// + forced tool_choice is explicitly forbidden. Option B trades the
// architecture-level <thinking> leak guarantee for a hard, structural
// guarantee that the model MUST emit the state report every turn (which
// is the bigger clinical problem). The <thinking> leak class is defended
// by the PR ζ string-strip which Step 3 restores.
//
// This does NOT touch the DB. It does NOT persist anything. One API call
// per POST, ~$0.05. Locked behind currentUserIsAdmin so no rate limiting
// is needed at the endpoint layer beyond the natural per-user-per-click
// pace.

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { currentUserIsAdmin } from '@/lib/admin/auth';
import { emitStateReportToolDef } from '@/lib/journey/stateReport/tool-schema';

export const dynamic = 'force-dynamic';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2500;

const SYSTEM = `You are the AI clinician for MindReset's therapeutic journey. This is a smoke test — reply to the user warmly (2-3 sentences) then call the emit_state_report tool with the correct fields. The user is in Block 1 (Stabilisation), stage 1, surface depth. They just described a body sensation as a black heavy ball.`;

const USER_MESSAGE = `The speech is about maybe image even, so I can feel like something black heavy ball inside. And, well, it doesn't talk to me.`;

export async function POST() {
  if (!(await currentUserIsAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not set on this deployment' },
      { status: 500 },
    );
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const startedAt = Date.now();
  let firstByteAt: number | null = null;
  let visibleText = '';
  let thinkingChars = 0;
  let sawThinkingBlock = false;
  let sawToolUseBlock = false;
  let leakDetected = false;

  try {
    // Option B configuration: no extended thinking, forced tool_choice.
    // This is Anthropic's standard, well-documented tool-use pattern —
    // low risk of undocumented edge cases. Guarantees the model MUST
    // invoke emit_state_report on this turn, which structurally fixes
    // the empty-state-report failure mode we've been chasing.
    const streamConfig: any = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      tools: [emitStateReportToolDef],
      tool_choice: { type: 'tool', name: emitStateReportToolDef.name },
      system: SYSTEM,
      messages: [{ role: 'user', content: USER_MESSAGE }],
    };
    const stream = anthropic.messages.stream(streamConfig);

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const blockType = (event as any).content_block?.type;
        if (blockType === 'thinking') sawThinkingBlock = true;
        if (blockType === 'tool_use') sawToolUseBlock = true;
      }
      if (event.type === 'content_block_delta') {
        const delta = (event as any).delta;
        if (delta?.type === 'text_delta') {
          if (firstByteAt === null) firstByteAt = Date.now();
          visibleText += delta.text;
          // Structural leak check — any private-reasoning tag in visible
          // text is a violation of the architecture guarantee.
          if (
            delta.text.includes('<thinking>') ||
            delta.text.includes('<assessment>') ||
            delta.text.includes('<state-report>')
          ) {
            leakDetected = true;
          }
        } else if (delta?.type === 'thinking_delta') {
          thinkingChars += (delta.thinking ?? '').length;
        }
      }
    }

    const final = await stream.finalMessage();
    const endedAt = Date.now();
    const toolBlock = final.content?.find(
      (b: any) => b.type === 'tool_use',
    ) as any;
    const toolInput = toolBlock?.input ?? null;

    const ttfbMs = firstByteAt ? firstByteAt - startedAt : null;
    const totalMs = endedAt - startedAt;

    // Per-criterion pass/fail — matches the terminal script.
    const checks = [
      { label: 'Reply text streamed', value: `${visibleText.length} chars`, pass: visibleText.length > 0 },
      { label: 'Time to first byte', value: ttfbMs !== null ? `${ttfbMs} ms` : 'never arrived', pass: ttfbMs !== null && ttfbMs < 5000 },
      { label: 'Total stream duration', value: `${totalMs} ms`, pass: totalMs < 30000 },
      { label: 'Extended thinking block seen', value: sawThinkingBlock ? 'yes (unexpected — Option B has no thinking)' : 'no (expected — Option B disables thinking)', pass: !sawThinkingBlock },
      { label: 'Thinking chars streamed', value: String(thinkingChars), pass: true },
      { label: 'Tool call block seen', value: sawToolUseBlock ? 'yes' : 'NO', pass: sawToolUseBlock },
      { label: 'Tool input: intensity', value: toolInput?.intensity !== undefined ? String(toolInput.intensity) : 'missing', pass: toolInput?.intensity !== undefined },
      { label: 'Tool input: safetyFlag', value: toolInput?.safetyFlag ?? 'missing', pass: !!toolInput?.safetyFlag },
      { label: 'Tool input: channel', value: toolInput?.channel ?? 'missing', pass: !!toolInput?.channel },
      { label: 'Tool input: clinicalRead', value: toolInput?.clinicalRead ? `${String(toolInput.clinicalRead).slice(0, 80)}…` : 'missing', pass: !!toolInput?.clinicalRead },
      { label: 'Tool input: moveJustPerformed', value: Array.isArray(toolInput?.moveJustPerformed) ? JSON.stringify(toolInput.moveJustPerformed) : 'missing', pass: Array.isArray(toolInput?.moveJustPerformed) },
      { label: 'Private tags leaked into text?', value: leakDetected ? 'LEAK DETECTED' : 'no leak', pass: !leakDetected },
      { label: 'stop_reason', value: String(final.stop_reason), pass: final.stop_reason === 'tool_use' || final.stop_reason === 'end_turn' },
    ];

    const criticalPass =
      visibleText.length > 0 &&
      sawToolUseBlock &&
      toolInput?.intensity !== undefined &&
      !!toolInput?.safetyFlag &&
      !!toolInput?.channel &&
      !!toolInput?.clinicalRead &&
      Array.isArray(toolInput?.moveJustPerformed) &&
      !leakDetected;

    return NextResponse.json({
      ok: true,
      criticalPass,
      overall: criticalPass
        ? 'PASS — safe to proceed to Step 3 (implementation)'
        : 'FAIL — stop and reassess. Do NOT implement.',
      visibleReply: visibleText,
      checks,
      usage: final.usage,
      toolInput,
      timing: { startedAt, firstByteAt, endedAt, ttfbMs, totalMs },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: 'exception',
        message: err?.message ?? String(err),
        stack: err?.stack ?? null,
      },
      { status: 500 },
    );
  }
}
