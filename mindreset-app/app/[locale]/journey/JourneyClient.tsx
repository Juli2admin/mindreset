'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TopBar from '@/components/TopBar';
import { useTheme } from '@/lib/theme/useTheme';
import { TOKENS } from '@/lib/brand/colors';

// The Journey UI — mirrors MiniMind's visual structure (TopBar, message
// column, opener pseudo-message, composer at bottom). Deliberately quiet.
//
// What the user sees:
//   - TopBar (shared)
//   - On first contact: a single warm AI opener — same shape as MiniMind:
//     "Hello. Good to have you here. How are you doing today?" — and a composer.
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
  const streamErrorSuffix = t('streamErrorSuffix');

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
  const [streamError, setStreamError] = useState(false);
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

  const canSend = !frozen && !sending && composerValue.trim().length > 0;

  async function send() {
    if (!canSend) return;
    const message = composerValue.trim();
    setComposerValue('');
    setSending(true);
    setStreamError(false);

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

      if (!res.ok || !res.body) {
        setStreamError(true);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: streamErrorSuffix, streaming: false }
              : m,
          ),
        );
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
      setStreamError(true);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: streamErrorSuffix, streaming: false }
            : m,
        ),
      );
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
      <TopBar />

      <main className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-10">
            <div className="space-y-8">
              {messages.map((m) => (
                <MessageRow key={m.id} message={m} />
              ))}
              {streamError && messages.length > 0 && (
                <p style={{ color: PALETTE.textMuted }} className="text-sm italic">
                  {streamErrorSuffix}
                </p>
              )}
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
            disabled={sending || recording || transcribing}
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
      className="px-6 py-4"
      style={{
        borderTop: `1px solid ${PALETTE.border}`,
        background: PALETTE.bg,
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
              disabled={transcribing}
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
            aria-label="Send"
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
      </div>
    </div>
  );
}
