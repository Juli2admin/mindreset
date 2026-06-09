import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { checkTranscribeRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// Vercel function timeout. Groq Whisper turbo transcribes a 2-minute clip
// in ~5–15s; 60s gives comfortable headroom for slow network + cold start.
export const maxDuration = 60;

// 10MB cap. A 2-minute webm at typical mic bitrate is ~960KB; 10MB gives
// generous headroom for higher bitrates and longer clips that slipped past
// the client-side cap, without enabling abuse. Groq itself accepts up to
// 25MB but there is no benefit to letting that through to their API.
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

// Whisper variant. `turbo` prioritises speed (lower latency, slightly
// lower accuracy) — appropriate for an interactive voice-input UX where
// the user reviews the transcript before sending. Switch to
// `whisper-large-v3` if accuracy issues surface for emotional/halting
// speech in any locale (especially RU).
const GROQ_MODEL = 'whisper-large-v3-turbo';

const GROQ_TRANSCRIPTIONS_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

// POST /api/journey/transcribe
//
// Accepts multipart/form-data with a single field `audio` (a webm/mp3/m4a
// blob from the browser's MediaRecorder). Forwards to Groq Whisper. Returns
// { text: string } on success.
//
// Audio is NOT persisted anywhere on our side. Groq's own retention is
// governed by their Data Controls / ZDR setting (owner-configured in the
// Groq console). No language hint is sent; Whisper auto-detects, which is
// more flexible for users who code-switch (e.g., RU users occasionally
// speaking EN).
//
// Defence-in-depth: auth required, dual user+IP rate limit, size cap,
// error responses lean on stable codes so the client can show localised
// messages.
//
// This route mirrors /api/minimind/transcribe by design — the transcription
// step is product-agnostic (audio in, text out), but each product has its
// own endpoint so MiniMind and The Journey can evolve their rate limits,
// telemetry, and error modes independently.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  const rl = await checkTranscribeRateLimit(userId, ip);
  if (rl.limited) {
    return NextResponse.json(
      { error: 'rate-limited', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  let audio: File;
  try {
    const form = await req.formData();
    const f = form.get('audio');
    if (!(f instanceof File)) {
      return NextResponse.json(
        { error: 'audio field required (multipart/form-data)' },
        { status: 400 },
      );
    }
    audio = f;
  } catch (err) {
    console.error('[journey/transcribe] multipart parse failed:', err);
    return NextResponse.json({ error: 'invalid multipart' }, { status: 400 });
  }

  if (audio.size === 0) {
    return NextResponse.json({ error: 'empty audio' }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'audio too large' }, { status: 413 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('[journey/transcribe] GROQ_API_KEY not set');
    return NextResponse.json({ error: 'transcription unavailable' }, { status: 503 });
  }

  try {
    const groqForm = new FormData();
    groqForm.append('file', audio);
    groqForm.append('model', GROQ_MODEL);
    groqForm.append('response_format', 'json');

    const res = await fetch(GROQ_TRANSCRIPTIONS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: groqForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[journey/transcribe] Groq API error:', res.status, errText);
      return NextResponse.json({ error: 'transcription failed' }, { status: 502 });
    }

    const data = (await res.json()) as { text?: string };
    if (!data.text || data.text.trim().length === 0) {
      return NextResponse.json({ error: 'no transcript' }, { status: 502 });
    }

    return NextResponse.json({ text: data.text });
  } catch (err) {
    console.error('[journey/transcribe] error:', err);
    return NextResponse.json({ error: 'transcription failed' }, { status: 502 });
  }
}
