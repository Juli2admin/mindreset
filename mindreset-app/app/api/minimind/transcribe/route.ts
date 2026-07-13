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
// 25MB but there's no benefit to letting that through to their API.
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

// Whisper variant. `turbo` prioritises speed (lower latency, slightly
// lower accuracy) — appropriate for an interactive voice-input UX where
// the user reviews the transcript before sending. Switch to
// `whisper-large-v3` if accuracy issues surface for emotional/halting
// speech in any locale (especially RU per locked decision #22).
const GROQ_MODEL = 'whisper-large-v3-turbo';

const GROQ_TRANSCRIPTIONS_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

// Allowlist of ISO-639-1 codes we accept as language hints. Mirrors
// i18n/routing.ts::locales — anything outside this set falls through
// to Whisper auto-detect (unhinted behaviour).
const VALID_LANGUAGE_HINTS = new Set([
  'en',
  'ru',
  'fr',
  'de',
  'es',
  'it',
  'pl',
  'pt',
]);

// POST /api/minimind/transcribe
//
// Accepts multipart/form-data with a single field `audio` (a webm/mp3/m4a
// blob from the browser's MediaRecorder). Forwards to Groq Whisper. Returns
// { text: string } on success.
//
// Audio is NOT persisted anywhere on our side — see locked decision #22.
// Groq's own retention is governed by their Data Controls / ZDR setting
// (owner-configured in the Groq console).
//
// Language hint. PR ψ2.3 (2026-07-13). Optional form field `locale`
// (ISO-639-1). When present + on the allowlist, forwarded to Whisper as
// `language` — improves accuracy and latency on the app's active locale
// and prevents mid-session drift into a wrong language (owner testing
// hit this in EN on 2026-07-13: mid-chat Whisper decided one utterance
// was Spanish and neither the reader nor the AI could parse the mirrored
// reply). Unset or unknown locales fall through to auto-detect (the
// prior behaviour, still useful for callers with no locale context).
//
// Defence-in-depth: auth required, dual user+IP rate limit (paid path),
// size cap, error responses lean on stable codes so the client can show
// localised messages.
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
  let localeHint: string | null = null;
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
    const rawLocale = form.get('locale');
    if (typeof rawLocale === 'string' && VALID_LANGUAGE_HINTS.has(rawLocale)) {
      localeHint = rawLocale;
    }
  } catch (err) {
    console.error('[transcribe] multipart parse failed:', err);
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
    console.error('[transcribe] GROQ_API_KEY not set');
    return NextResponse.json({ error: 'transcription unavailable' }, { status: 503 });
  }

  try {
    const groqForm = new FormData();
    groqForm.append('file', audio);
    groqForm.append('model', GROQ_MODEL);
    groqForm.append('response_format', 'json');
    if (localeHint) {
      // Whisper's `language` param is ISO-639-1 — improves accuracy for
      // the specified language. A user who code-switches briefly (e.g.
      // "OK" in an RU sentence) will still parse reasonably; a hard
      // wrong-language flip (Spanish for English input) is the failure
      // this hint prevents.
      groqForm.append('language', localeHint);
    }

    const res = await fetch(GROQ_TRANSCRIPTIONS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: groqForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[transcribe] Groq API error:', res.status, errText);
      return NextResponse.json({ error: 'transcription failed' }, { status: 502 });
    }

    const data = (await res.json()) as { text?: string };
    if (!data.text || data.text.trim().length === 0) {
      return NextResponse.json({ error: 'no transcript' }, { status: 502 });
    }

    return NextResponse.json({ text: data.text });
  } catch (err) {
    console.error('[transcribe] error:', err);
    return NextResponse.json({ error: 'transcription failed' }, { status: 502 });
  }
}
