'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TopBar from '@/components/TopBar';
import { useTheme } from '@/lib/theme/useTheme';
import { TOKENS } from '@/lib/brand/colors';
import {
  classifyTurnError,
  canSendTurn,
  monthlyCapView,
  resolveAssistantBubbleOnError,
  type TurnError,
} from '@/lib/journey/turn-error';

// The Journey UI — mirrors MiniMind's visual structure (TopBar, message
// column, opener pseudo-message, composer at bottom). Deliberately quiet.
//
// What the user sees:
//   - TopBar (shared)
//   - On first contact: a welcome message that frames The Journey for the
//     user — what this is, how it works, what their part is, safety lines,
//     soft invitation to begin. Rendered as a single opener pseudo-message
//     (not persisted) above the composer. Markdown-rendered.
//   - On return: the recent conversation history, then the composer.
//   - When frozenForReview is true: composer replaced by a calm holding
//     view (history above stays visible — continuity preserved).
//
// What the user NEVER sees:
//   - stage names, numbers, transitions, depth labels
//   - progress indicators or completion criteria
//   - the Personal Anchor as a UI element (internal method only; the AI
//     recalls it in conversation, code stores it, the user knows their own
//     anchor because they spoke it — it does not get displayed)
//   - any clinical scaffolding

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
};

type Props = {
  initialMessages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>;
  frozen: boolean;
};

const TEXTAREA_MIN_HEIGHT = 56;
const TEXTAREA_MAX_HEIGHT = 200;
// Voice input — push-to-talk cap. Mirrors MiniMind's 120s. Protects against
// runaway sessions and bounds upload payload + Groq transcription latency.
const MAX_RECORDING_SECONDS = 120;

export default function JourneyClient({ initialMessages, frozen }: Props) {
  const t = useTranslations('Journey');
  const locale = useLocale();
  const { palette: PALETTE } = useTheme();

  const opener = t('opener');

  // If the user has no prior history, render a single opener pseudo-message
  // (not persisted to the DB — purely UI scaffolding to warm the first turn,
  // same pattern as MiniMind).
  const [messages, setMessages] = useState<Message[]>(() =>
    initialMessages.length > 0
      ? initialMessages
      : [{ id: 'opener', role: 'assistant', content: opener }],
  );
  const [composerValue, setComposerValue] = useState('');
  const [sending, setSending] = useState(false);
  // Exactly one active turn error at a time (or none). Replaces the old
  // `streamError` boolean that collapsed every failure into one message.
  const [turnError, setTurnError] = useState<TurnError | null>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice input state — mirrors MiniMind. Push-to-talk, audio sent to Groq
  // Whisper via /api/journey/transcribe, transcript fills the textarea.
  // Audio is never persisted by us.
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Feature detection in an effect so the first render is SSR-stable.
  useEffect(() => {
    setVoiceSupported(
      typeof MediaRecorder !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia,
    );
  }, []);

  // Cleanup on unmount: stop any active recording and release the mic tracks.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = `${TEXTAREA_MIN_HEIGHT}px`;
    const next = Math.min(ta.scrollHeight, TEXTAREA_MAX_HEIGHT);
    ta.style.height = `${next}px`;
  }, [composerValue]);

  async function startRecording() {
    setVoiceError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = (err as Error).name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setVoiceError(t('voice.errors.permissionDenied'));
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setVoiceError(t('voice.errors.noMic'));
      } else {
        setVoiceError(t('voice.errors.startFailed'));
      }
      return;
    }

    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecording(false);
      setRecordingSeconds(0);

      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      if (blob.size === 0) {
        setVoiceError(t('voice.errors.emptyAudio'));
        return;
      }

      const ext = recorder.mimeType.includes('mp4')
        ? 'm4a'
        : recorder.mimeType.includes('ogg')
          ? 'ogg'
          : 'webm';

      setTranscribing(true);
      try {
        const form = new FormData();
        form.append('audio', blob, `voice.${ext}`);
        const res = await fetch('/api/journey/transcribe', {
          method: 'POST',
          body: form,
        });
        if (!res.ok) {
          if (res.status === 429) setVoiceError(t('voice.errors.rateLimited'));
          else if (res.status === 503) setVoiceError(t('voice.errors.unavailable'));
          else setVoiceError(t('voice.errors.transcriptionFailed'));
          return;
        }
        const data: { text?: string } = await res.json();
        if (data.text && data.text.trim().length > 0) {
          // Append rather than replace so a user mid-typing doesn't lose
          // their text when they tap mic.
          setComposerValue((prev) => (prev.length > 0 ? `${prev} ${data.text}` : data.text!));
          textareaRef.current?.focus();
        } else {
          setVoiceError(t('voice.errors.emptyAudio'));
        }
      } catch {
        setVoiceError(t('voice.errors.networkError'));
      } finally {
        setTranscribing(false);
      }
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecording(true);
    setRecordingSeconds(0);

    // Tick once a second and auto-stop at the cap.
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => {
        const next = prev + 1;
        if (next >= MAX_RECORDING_SECONDS) {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
          if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
          }
        }
        return next;
      });
    }, 1000);
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }

  function handleMicClick() {
    if (transcribing) return;
    if (recording) stopRecording();
    else startRecording();
  }

  function formatRecordingTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // A hard monthly-cap block keeps the composer disabled until the view is
  // reopened; rate-limit / technical / access / screening do NOT permanently
  // disable it (the user may edit and retry).
  const hardCapActive = turnError?.kind === 'monthly_cap';
  const canSend = canSendTurn({
    frozen,
    sending,
    hardCapActive,
    value: composerValue,
  });

  // A turn failed: keep any partial streamed text once (drop an empty
  // placeholder), then surface exactly ONE error via `turnError`. Never writes
  // the error into a message bubble — that was the old triple-render bug.
  function failTurn(error: TurnError, assistantId: string) {
    setMessages((prev) =>
      prev.flatMap((m) => {
        if (m.id !== assistantId) return [m];
        return resolveAssistantBubbleOnError(m.content).keep
          ? [{ ...m, streaming: false }]
          : [];
      }),
    );
    setTurnError(error);
  }

  async function send() {
    if (!canSend) return;
    const message = composerValue.trim();
    setComposerValue('');
    setSending(true);
    setTurnError(null);

    const userMsg: Message = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: message,
    };
    const assistantMsg: Message = {
      id: `temp-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      streaming: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      const res = await fetch('/api/journey/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, locale }),
      });

      if (!res.ok) {
        // Read the structured JSON so we can render the right, status-aware
        // panel (monthly cap / rate limit / access / screening / technical).
        let body: unknown = null;
        try {
          body = await res.json();
        } catch {
          body = null;
        }
        failTurn(
          classifyTurnError({
            transport: 'http',
            status: res.status,
            body,
            retryAfterHeader: res.headers.get('Retry-After'),
          }),
          assistantMsg.id,
        );
        return;
      }
      if (!res.body) {
        failTurn({ kind: 'technical' }, assistantMsg.id);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: accumulated } : m,
          ),
        );
      }
      accumulated += decoder.decode();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: accumulated.trim(), streaming: false }
            : m,
        ),
      );
    } catch {
      // Network drop or mid-stream interruption: a genuine technical failure.
      // Any partial text already streamed into the bubble is kept (once) by
      // failTurn; we do not claim the AI "lost its thread".
      failTurn({ kind: 'technical' }, assistantMsg.id);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: PALETTE.bg, color: PALETTE.text }}
    >
      <TopBar sticky />

      <main className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-10">
            <div className="space-y-8">
              {messages.map((m) => (
                <MessageRow key={m.id} message={m} />
              ))}
              {/* Single error site — exactly one panel per failure. */}
              {turnError && <TurnErrorView error={turnError} locale={locale} />}
              <div ref={scrollEndRef} />
            </div>
          </div>
        </div>

        {frozen ? (
          <FrozenView />
        ) : (
          <Composer
            value={composerValue}
            onChange={setComposerValue}
            onSend={send}
            onKeyDown={onKeyDown}
            disabled={sending || recording || transcribing || hardCapActive}
            blocked={hardCapActive}
            textareaRef={textareaRef}
            placeholder={t('placeholder')}
            sending={sending}
            voiceSupported={voiceSupported}
            recording={recording}
            transcribing={transcribing}
            recordingSeconds={recordingSeconds}
            voiceError={voiceError}
            onMicClick={handleMicClick}
            formatRecordingTime={formatRecordingTime}
          />
        )}
      </main>
    </div>
  );
}

// ===========================================================================
// Sub-components — kept colocated for Slice 3 simplicity.
// ===========================================================================

function MessageRow({ message }: { message: Message }) {
  const { palette: PALETTE } = useTheme();
  const isUser = message.role === 'user';
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className="max-w-[85%] px-5 py-4 rounded-2xl"
        style={
          isUser
            ? {
                background: PALETTE.bgSubtle,
                color: PALETTE.text,
                fontFamily: TOKENS.sans,
                fontSize: '0.95rem',
                lineHeight: '1.6',
              }
            : {
                background: PALETTE.bgCard,
                color: PALETTE.text,
                border: `1px solid ${PALETTE.border}`,
                fontFamily: TOKENS.serif,
                fontSize: '1rem',
                lineHeight: '1.75',
              }
        }
      >
        {message.role === 'assistant' ? (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content || (message.streaming ? '…' : '')}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="whitespace-pre-wrap">{message.content}</div>
        )}
      </div>
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSend,
  onKeyDown,
  disabled,
  blocked,
  textareaRef,
  placeholder,
  sending,
  voiceSupported,
  recording,
  transcribing,
  recordingSeconds,
  voiceError,
  onMicClick,
  formatRecordingTime,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled: boolean;
  blocked: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  placeholder: string;
  sending: boolean;
  voiceSupported: boolean;
  recording: boolean;
  transcribing: boolean;
  recordingSeconds: number;
  voiceError: string | null;
  onMicClick: () => void;
  formatRecordingTime: (s: number) => string;
}) {
  const { palette: PALETTE } = useTheme();
  const t = useTranslations('Journey');
  const canSend = value.trim().length > 0 && !disabled;
  return (
    <div
      className="px-6 pt-4"
      style={{
        borderTop: `1px solid ${PALETTE.border}`,
        background: PALETTE.bg,
        // iOS safe-area padding so the send button + composer aren't hidden
        // behind the home-indicator bar on iPhones. Testers on mobile
        // reported the composer as "almost half visible only".
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="max-w-2xl mx-auto">
        {sending && (
          <div
            className="mb-2 text-xs italic"
            style={{ color: PALETTE.textMuted, fontFamily: TOKENS.serif }}
          >
            {t('preparingResponse')}…
          </div>
        )}
        {recording && (
          <div
            className="mb-2 text-xs"
            style={{ color: PALETTE.accent, fontFamily: TOKENS.sans }}
            aria-live="polite"
          >
            ● {formatRecordingTime(recordingSeconds)}
          </div>
        )}
        {transcribing && (
          <div
            className="mb-2 text-xs italic"
            style={{ color: PALETTE.textMuted, fontFamily: TOKENS.sans }}
            aria-live="polite"
          >
            {t('voice.transcribing')}
          </div>
        )}
        {voiceError && (
          <div
            className="mb-2 text-xs"
            style={{ color: PALETTE.danger, fontFamily: TOKENS.sans }}
            role="alert"
          >
            {voiceError}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none rounded-xl px-4 py-3 outline-none focus:ring-2"
            style={{
              minHeight: TEXTAREA_MIN_HEIGHT,
              maxHeight: TEXTAREA_MAX_HEIGHT,
              background: PALETTE.bgCard,
              border: `1px solid ${PALETTE.border}`,
              color: PALETTE.text,
              fontFamily: TOKENS.sans,
              fontSize: '0.95rem',
              lineHeight: '1.5',
            }}
          />
          {voiceSupported && (
            <button
              type="button"
              onClick={onMicClick}
              disabled={transcribing || blocked}
              className="rounded-full transition-opacity disabled:opacity-30"
              style={{
                background: recording ? PALETTE.danger : PALETTE.bgCard,
                color: recording ? PALETTE.accentText : PALETTE.text,
                border: `1px solid ${recording ? PALETTE.danger : PALETTE.border}`,
                fontFamily: TOKENS.sans,
                width: 44,
                height: 44,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
              }}
              aria-label={recording ? t('voice.stopAria') : t('voice.startAria')}
            >
              {recording ? '■' : '🎙'}
            </button>
          )}
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="rounded-full px-4 transition-opacity disabled:opacity-30"
            style={{
              background: PALETTE.accent,
              color: PALETTE.accentText,
              fontFamily: TOKENS.sans,
              minHeight: 44,
              height: 44,
            }}
            aria-label={t('sendAria')}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}

function FrozenView() {
  const t = useTranslations('Journey.frozen');
  const { palette: PALETTE } = useTheme();
  // Day 1 audit fix item 4.3 — Request Review affordance. Lets a
  // paying user who tripped a false positive ask for a human review
  // instead of being permanently locked out. State machine:
  //   idle -> sending -> sent | error -> (stays sent or returns to idle on retry)
  const [reviewState, setReviewState] = useState<
    'idle' | 'sending' | 'sent' | 'error'
  >('idle');

  async function handleRequestReview() {
    setReviewState('sending');
    try {
      const res = await fetch('/api/journey/request-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setReviewState('sent');
        return;
      }
      // 429 from rate limiter still counts as "we got your request" UX-wise
      if (res.status === 429) {
        setReviewState('sent');
        return;
      }
      setReviewState('error');
    } catch {
      setReviewState('error');
    }
  }

  return (
    <div
      className="px-6 py-8"
      style={{
        borderTop: `1px solid ${PALETTE.border}`,
        background: PALETTE.bgSubtle,
      }}
    >
      <div className="max-w-2xl mx-auto">
        <h2
          className="mb-3 text-lg"
          style={{ fontFamily: TOKENS.serif, color: PALETTE.text }}
        >
          {t('title')}
        </h2>
        <p
          className="mb-4 leading-relaxed"
          style={{ color: PALETTE.textMuted, fontSize: '0.95rem' }}
        >
          {t('body')}
        </p>
        <ul
          className="space-y-1 text-sm"
          style={{ color: PALETTE.text, fontFamily: TOKENS.sans }}
        >
          <li>· {t('samaritans')}</li>
          <li>· {t('nhs')}</li>
          <li>· {t('gp')}</li>
        </ul>
        <p
          className="mt-4 text-sm"
          style={{ color: PALETTE.text }}
        >
          {t('emergency')}
        </p>

        {/* Review-request affordance — sits below the crisis lines so
            the safety information is read first, and the "this might
            be a mistake" option is offered second. */}
        <div
          className="mt-6 pt-6"
          style={{ borderTop: `1px solid ${PALETTE.border}` }}
        >
          {reviewState === 'sent' ? (
            <p
              className="text-sm"
              style={{ color: PALETTE.textMuted, fontFamily: TOKENS.sans }}
            >
              {t('reviewSent')}
            </p>
          ) : (
            <>
              <p
                className="mb-3 text-sm"
                style={{ color: PALETTE.textMuted, fontFamily: TOKENS.sans }}
              >
                {t('reviewIntro')}
              </p>
              <button
                onClick={handleRequestReview}
                disabled={reviewState === 'sending'}
                className="px-4 py-2 rounded-md text-sm disabled:opacity-50"
                style={{
                  background: PALETTE.accent,
                  color: PALETTE.accentText,
                  fontFamily: TOKENS.sans,
                }}
              >
                {reviewState === 'sending' ? t('reviewSending') : t('reviewButton')}
              </button>
              {reviewState === 'error' && (
                <p
                  className="mt-2 text-sm"
                  style={{ color: '#B45454', fontFamily: TOKENS.sans }}
                >
                  {t('reviewError')}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Turn-error rendering — exactly ONE panel per failure (PR 3, 2026-07-24).
// Replaces the old triple-render of streamErrorSuffix. Switches on the typed
// TurnError so each failure gets clear, status-aware copy. No internal AI cost
// (spentUsd / capUsd) is ever shown.
// ===========================================================================

function TurnErrorView({
  error,
  locale,
}: {
  error: TurnError;
  locale: string;
}) {
  const { palette: PALETTE } = useTheme();
  const t = useTranslations('Journey');

  if (error.kind === 'monthly_cap') {
    return <MonthlyCapPanel info={error.info} locale={locale} />;
  }

  // Temporary notes — composer stays enabled; the user may retry.
  if (error.kind === 'rate_limit' || error.kind === 'technical') {
    const msg =
      error.kind === 'technical'
        ? t('turnErrors.technical')
        : error.retryAfterSec != null
          ? t('turnErrors.rateLimitSeconds', { seconds: error.retryAfterSec })
          : t('turnErrors.rateLimit');
    return (
      <p
        className="text-sm italic"
        style={{ color: PALETTE.textMuted, fontFamily: TOKENS.serif }}
        role="status"
      >
        {msg}
      </p>
    );
  }

  // access | screening — distinct restricted panels with a reload back to the
  // server-gated view (page.tsx NoAccessView / the frozen gate).
  const title =
    error.kind === 'access'
      ? t('turnErrors.accessTitle')
      : t('turnErrors.screeningTitle');
  const body =
    error.kind === 'access'
      ? t('turnErrors.accessBody')
      : t('turnErrors.screeningBody');
  return (
    <div
      className="px-5 py-4"
      style={{
        background: PALETTE.bgCard,
        border: `1px solid ${PALETTE.border}`,
        borderRadius: '1rem',
      }}
      role="alert"
    >
      <h3
        className="mb-2 text-base"
        style={{ fontFamily: TOKENS.serif, color: PALETTE.text }}
      >
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: PALETTE.textMuted }}>
        {body}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-3 px-4 py-2 rounded-md text-sm"
        style={{
          background: PALETTE.accent,
          color: PALETTE.accentText,
          fontFamily: TOKENS.sans,
        }}
      >
        {t('turnErrors.reload')}
      </button>
    </div>
  );
}

function MonthlyCapPanel({
  info,
  locale,
}: {
  info: Extract<TurnError, { kind: 'monthly_cap' }>['info'];
  locale: string;
}) {
  const { palette: PALETTE } = useTheme();
  const t = useTranslations('Journey');
  // Browser-local timezone: omit timeZone so Intl uses the viewer's zone; the
  // raw UTC instant stays the source of truth. This panel only ever renders
  // client-side (after a failed turn), so there is no SSR/local-zone mismatch.
  const view = monthlyCapView(info, locale);

  return (
    <div
      className="px-5 py-4"
      style={{
        background: PALETTE.bgCard,
        border: `1px solid ${PALETTE.border}`,
        borderRadius: '1rem',
      }}
      role="status"
    >
      <h3
        className="mb-2 text-base"
        style={{ fontFamily: TOKENS.serif, color: PALETTE.text }}
      >
        {t('monthlyCap.title')}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: PALETTE.textMuted }}>
        {view.resetAtLocal
          ? t('monthlyCap.body', { resetAt: view.resetAtLocal })
          : t('monthlyCap.bodyNoReset')}
      </p>
    </div>
  );
}
