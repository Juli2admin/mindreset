'use client';

// State-module chat client — streaming chat UI.
//
// PR ψ2 (2026-07-13) initial; PR ψ2.2 stabilised layout + added mic.
// Kept intentionally simpler than MiniMindClient: no history sidebar,
// no last-conversation resume UI, no memory display. Fresh session per
// visit (the server component decides resume-vs-fresh); one focused
// conversation from open to close.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';
import { Link } from '@/i18n/navigation';
import {
  useVoiceInput,
  formatVoiceTime,
  type VoiceErrorCode,
} from '@/lib/voice/useVoiceInput';
import {
  isValidStateModuleId,
} from '@/lib/states/modules';
import { isValidThemeModuleId } from '@/lib/themes/modules';

// PR ψ4 / χ3 — Meta sentinel emitted at the end of the stream by
// /api/states/[moduleId]/turn. Carries session completion + optional
// suggested module (state OR theme). Client extracts + strips before
// display.
const STATE_META_RE = /\n*<<<STATE_META:(\{[^>]*\})>>>\n*/g;

type ParsedSuggestion =
  | { kind: 'state'; moduleId: string }
  | { kind: 'theme'; moduleId: string }
  | null;

function extractStateMeta(text: string): {
  cleanedText: string;
  completed: boolean;
  suggestion: ParsedSuggestion;
} {
  let completed = false;
  let suggestion: ParsedSuggestion = null;
  const cleanedText = text.replace(STATE_META_RE, (_full, jsonStr) => {
    try {
      const parsed: {
        completed?: boolean;
        suggested?: string;
        suggestedKind?: string;
      } = JSON.parse(jsonStr);
      if (parsed.completed === true) completed = true;
      if (parsed.suggested) {
        // Prefer the server's authoritative kind hint; fall back to
        // slug-based detection so older messages / hand-edited data
        // still resolve.
        if (
          parsed.suggestedKind === 'theme' &&
          isValidThemeModuleId(parsed.suggested)
        ) {
          suggestion = { kind: 'theme', moduleId: parsed.suggested };
        } else if (
          parsed.suggestedKind === 'state' &&
          isValidStateModuleId(parsed.suggested)
        ) {
          suggestion = { kind: 'state', moduleId: parsed.suggested };
        } else if (isValidStateModuleId(parsed.suggested)) {
          suggestion = { kind: 'state', moduleId: parsed.suggested };
        } else if (isValidThemeModuleId(parsed.suggested)) {
          suggestion = { kind: 'theme', moduleId: parsed.suggested };
        }
      }
    } catch {
      // Malformed sentinel — swallow and drop from visible text.
    }
    return '';
  });
  return { cleanedText, completed, suggestion };
}

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;
const TEXTAREA_MIN_HEIGHT = 48;
const TEXTAREA_MAX_HEIGHT = 168;
// Locked decision #22 — 2 minutes per push-to-talk turn.
const MAX_RECORDING_SECONDS = 120;

export type HistoryMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type UIMessage = HistoryMessage & { streaming?: boolean };

type Props = {
  moduleId: string;
  moduleName: string;
  sessionId: string;
  history: HistoryMessage[];
  locale: string;
};

export default function StateModuleClient({
  moduleId,
  moduleName,
  sessionId,
  history,
  locale,
}: Props) {
  const t = useTranslations('States');
  const tThemes = useTranslations('Themes');
  const tErr = useTranslations('Errors');
  const { palette: PALETTE } = useTheme();

  const [messages, setMessages] = useState<UIMessage[]>(history);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [suggestion, setSuggestion] = useState<ParsedSuggestion>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const voice = useVoiceInput({
    endpoint: '/api/minimind/transcribe',
    maxSeconds: MAX_RECORDING_SECONDS,
    hintLocale: locale,
    onTranscript: (text) => {
      setInput((prev) => (prev.length > 0 ? `${prev} ${text}` : text));
      textareaRef.current?.focus();
    },
  });

  const isFreshSession = history.length === 0;

  // Initial mount: jump-scroll (no animation) to bottom so a resumed
  // session opens at the newest message, not the oldest.
  useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Smooth-scroll on ADD (new message inserted), NOT on every content
  // update. Watching messages.length instead of messages avoids
  // per-token scroll jitter during streaming — the page was jumping
  // constantly in PR ψ2 v1 because every streaming chunk triggered a
  // smooth-scroll animation.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sessionComplete]);

  // Auto-grow the textarea within min/max bounds.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height =
      Math.min(Math.max(el.scrollHeight, TEXTAREA_MIN_HEIGHT), TEXTAREA_MAX_HEIGHT) +
      'px';
  }, [input]);

  const voiceErrorText = voice.error ? translateVoiceError(voice.error, t) : null;

  async function send() {
    const text = input.trim();
    if (!text || sending || sessionComplete || voice.recording || voice.transcribing) {
      return;
    }

    setInput('');
    setSending(true);
    setError(null);
    voice.clearError();

    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: text },
    ]);

    try {
      const res = await fetch(`/api/states/${moduleId}/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId, locale }),
      });

      if (res.status === 409) {
        setSessionComplete(true);
        return;
      }
      if (!res.ok) {
        console.error('[states] turn error', res.status);
        setError(tErr('networkError'));
        return;
      }

      const completeReason = res.headers.get('X-Session-Complete');
      const willBeComplete = completeReason === 'red_flag';

      if (!res.body) {
        setError(tErr('networkError'));
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          streaming: true,
        },
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let streamCompletedByMeta = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantMsgId) return m;
            // Extract the STATE_META sentinel from the growing content
            // on every update — the sentinel may be split across
            // chunks so we always run the regex on the accumulated
            // text. Match strips it from what the reader sees.
            const combined = m.content + chunk;
            const meta = extractStateMeta(combined);
            if (meta.suggestion) setSuggestion(meta.suggestion);
            if (meta.completed) streamCompletedByMeta = true;
            return { ...m, content: meta.cleanedText };
          }),
        );
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, streaming: false } : m,
        ),
      );
      if (willBeComplete || streamCompletedByMeta) setSessionComplete(true);
    } catch (err) {
      console.error('[states] send failed:', err);
      setError(tErr('networkError'));
    } finally {
      setSending(false);
    }
  }

  const composerBusy = sending || voice.recording || voice.transcribing;

  return (
    <main
      className="h-[100dvh] flex flex-col"
      style={{ background: PALETTE.bg, color: PALETTE.text }}
    >
      <div
        className="max-w-2xl mx-auto w-full px-6 pt-4 pb-3 shrink-0"
        style={{ borderBottom: `1px solid ${PALETTE.border}` }}
      >
        <Link
          href="/states"
          className="inline-flex items-center gap-1 text-[12px] mb-2"
          style={{ color: PALETTE.textMuted, fontFamily: SANS }}
        >
          <span aria-hidden="true">←</span>
          <span>{t('backToStates')}</span>
        </Link>
        <h1
          className="text-[22px] leading-[1.2]"
          style={{ fontFamily: SERIF, fontWeight: 400 }}
        >
          {moduleName}
        </h1>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        style={{ overflowAnchor: 'none' }}
      >
        <div className="max-w-2xl mx-auto w-full px-6 py-4 space-y-5">
          {isFreshSession && (
            <div
              className="rounded-2xl p-5"
              style={{
                background: PALETTE.bgCard,
                border: `1px solid ${PALETTE.border}`,
              }}
            >
              <p
                className="text-[15px] leading-[1.7] whitespace-pre-wrap"
                style={{ fontFamily: SANS, color: PALETTE.text }}
              >
                {t(`prompts.${moduleId}.greeting`)}
              </p>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              role={m.role}
              content={m.content}
              streaming={m.streaming}
              palette={PALETTE}
            />
          ))}

          {sessionComplete && (
            <>
              <div
                className="rounded-2xl p-5 text-center"
                style={{
                  background: PALETTE.bgSubtle,
                  border: `1px solid ${PALETTE.border}`,
                }}
              >
                <p
                  className="text-[14px] leading-[1.6] mb-4"
                  style={{ color: PALETTE.textMuted, fontFamily: SANS }}
                >
                  {t('sessionComplete')}
                </p>
                <Link
                  href={`/states/${moduleId}`}
                  className="inline-block text-[14px] font-medium py-2 px-6 rounded-full"
                  style={{
                    background: PALETTE.accent,
                    color: PALETTE.accentText,
                    fontFamily: SANS,
                  }}
                >
                  {t('startAgain')}
                </Link>
              </div>
              {suggestion &&
                !(
                  suggestion.kind === 'state' &&
                  suggestion.moduleId === moduleId
                ) && (
                  <SuggestionCard
                    suggestion={suggestion}
                    t={t}
                    tThemes={tThemes}
                    palette={PALETTE}
                  />
                )}
            </>
          )}

          <div ref={messagesEndRef} aria-hidden="true" />
        </div>
      </div>

      {!sessionComplete && (
        <div
          className="border-t shrink-0"
          style={{ borderColor: PALETTE.border, background: PALETTE.bg }}
        >
          <div className="max-w-2xl mx-auto w-full px-6 py-3">
            {voiceErrorText && (
              <p
                className="mb-2 text-[13px]"
                style={{ color: '#b91c1c', fontFamily: SANS }}
                role="alert"
              >
                {voiceErrorText}
              </p>
            )}
            {voice.recording && (
              <div
                className="mb-2 text-[13px] flex items-center gap-2"
                style={{ color: '#b91c1c', fontFamily: SANS }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full animate-pulse"
                  style={{ background: '#b91c1c' }}
                  aria-hidden
                />
                <span>
                  {formatVoiceTime(voice.recordingSeconds)} /{' '}
                  {formatVoiceTime(MAX_RECORDING_SECONDS)}
                </span>
              </div>
            )}
            <div className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={t('inputPlaceholder')}
                disabled={composerBusy}
                rows={1}
                className="flex-1 rounded-2xl px-4 py-3 text-[15px] leading-[1.6] resize-none focus:outline-none disabled:opacity-50"
                style={{
                  background: PALETTE.bgCard,
                  color: PALETTE.text,
                  border: `1px solid ${PALETTE.border}`,
                  fontFamily: SANS,
                  minHeight: TEXTAREA_MIN_HEIGHT,
                  maxHeight: TEXTAREA_MAX_HEIGHT,
                }}
              />
              {voice.supported && (
                <button
                  type="button"
                  onClick={voice.toggle}
                  disabled={sending || voice.transcribing}
                  aria-label={
                    voice.recording
                      ? t('voice.stopAria')
                      : t('voice.startAria')
                  }
                  className="h-12 w-12 shrink-0 rounded-full flex items-center justify-center disabled:cursor-not-allowed"
                  style={{
                    background: voice.recording ? '#b91c1c' : 'transparent',
                    color: voice.recording ? '#fff' : PALETTE.textMuted,
                    border: `1px solid ${voice.recording ? '#b91c1c' : PALETTE.border}`,
                    opacity: sending || voice.transcribing ? 0.5 : 1,
                  }}
                >
                  {voice.transcribing ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="animate-spin"
                      aria-hidden
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        strokeDasharray="42"
                        strokeDashoffset="14"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : voice.recording ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden
                    >
                      <rect x="6" y="6" width="12" height="12" rx="1.5" />
                    </svg>
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <rect x="9" y="2" width="6" height="11" rx="3" />
                      <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                      <line x1="8" y1="22" x2="16" y2="22" />
                    </svg>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => void send()}
                disabled={composerBusy || input.trim().length === 0}
                className="rounded-full px-5 h-12 shrink-0 text-[14px] font-medium disabled:opacity-40"
                style={{
                  background: PALETTE.accent,
                  color: PALETTE.accentText,
                  fontFamily: SANS,
                }}
              >
                {sending ? t('sending') : t('send')}
              </button>
            </div>
            {error && (
              <p
                className="mt-2 text-[13px]"
                style={{ color: '#b91c1c', fontFamily: SANS }}
              >
                {error}
              </p>
            )}
            <p
              className="mt-2 text-[11px] leading-[1.5] text-center"
              style={{ color: PALETTE.textHint, fontFamily: SANS }}
            >
              {t('safetyFooter')}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

function SuggestionCard({
  suggestion,
  t,
  tThemes,
  palette,
}: {
  suggestion: NonNullable<ParsedSuggestion>;
  t: ReturnType<typeof useTranslations<'States'>>;
  tThemes: ReturnType<typeof useTranslations<'Themes'>>;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  const isState = suggestion.kind === 'state';
  const href = isState
    ? (`/states/${suggestion.moduleId}` as const)
    : (`/themes/${suggestion.moduleId}` as const);
  const moduleName = isState
    ? t(`modules.${suggestion.moduleId}.name` as
        | 'modules.anxiety.name'
        | 'modules.apathy.name'
        | 'modules.loss_of_self.name'
        | 'modules.inner_emptiness.name')
    : tThemes(`modules.${suggestion.moduleId}.name` as
        | 'modules.shame.name'
        | 'modules.money.name'
        | 'modules.body.name'
        | 'modules.family.name'
        | 'modules.self_realisation.name');
  const intro = isState
    ? t(`suggestedIntro.${suggestion.moduleId}` as
        | 'suggestedIntro.anxiety'
        | 'suggestedIntro.apathy'
        | 'suggestedIntro.loss_of_self'
        | 'suggestedIntro.inner_emptiness')
    : t('suggestedThemeIntro', { moduleName });
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: palette.bgCard,
        border: `1px solid ${palette.border}`,
      }}
    >
      <p
        className="text-[11px] uppercase tracking-[0.22em] mb-2"
        style={{ color: palette.textMuted, fontFamily: SANS }}
      >
        {t('suggestedKicker')}
      </p>
      <p
        className="text-[14px] leading-[1.6] mb-3"
        style={{ color: palette.text, fontFamily: SANS }}
      >
        {intro}
      </p>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-[13px] font-medium"
        style={{ color: palette.accent, fontFamily: SANS }}
      >
        <span>{moduleName}</span>
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  streaming,
  palette,
}: {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  palette: ReturnType<typeof useTheme>['palette'];
}) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[85%] rounded-2xl px-4 py-3"
        style={{
          background: isUser ? palette.accent : palette.bgCard,
          color: isUser ? palette.accentText : palette.text,
          border: isUser ? 'none' : `1px solid ${palette.border}`,
          fontFamily: SANS,
        }}
      >
        <p className="text-[15px] leading-[1.7] whitespace-pre-wrap">
          {content}
          {streaming && content.length === 0 && (
            <span style={{ color: palette.textMuted }}>…</span>
          )}
        </p>
      </div>
    </div>
  );
}

function translateVoiceError(
  code: VoiceErrorCode,
  t: (key: string) => string,
): string {
  switch (code) {
    case 'permission_denied':
      return t('voice.errors.permissionDenied');
    case 'no_mic':
      return t('voice.errors.noMic');
    case 'start_failed':
      return t('voice.errors.startFailed');
    case 'empty_audio':
      return t('voice.errors.emptyAudio');
    case 'rate_limited':
      return t('voice.errors.rateLimited');
    case 'unavailable':
      return t('voice.errors.unavailable');
    case 'transcription_failed':
      return t('voice.errors.transcriptionFailed');
    case 'network_error':
      return t('voice.errors.networkError');
  }
}
