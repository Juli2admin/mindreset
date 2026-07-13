'use client';

// State-module chat client — streaming chat UI.
//
// PR ψ2 (2026-07-13). Kept intentionally simpler than MiniMindClient:
// no history sidebar, no last-conversation resume UI, no memory
// display. Fresh session per visit (the server component decides
// resume-vs-fresh); one focused conversation from open to close.

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';
import { Link } from '@/i18n/navigation';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

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
  const tErr = useTranslations('Errors');
  const { palette: PALETTE } = useTheme();

  const [messages, setMessages] = useState<UIMessage[]>(history);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, sessionComplete]);

  const isFreshSession = history.length === 0;

  async function send() {
    const text = input.trim();
    if (!text || sending || sessionComplete) return;

    setInput('');
    setSending(true);
    setError(null);

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
        // Session was completed on the prior turn — server rejects new
        // messages. Flip to the "session complete" UI.
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

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: m.content + chunk }
              : m,
          ),
        );
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, streaming: false } : m,
        ),
      );
      if (willBeComplete) setSessionComplete(true);
    } catch (err) {
      console.error('[states] send failed:', err);
      setError(tErr('networkError'));
    } finally {
      setSending(false);
    }
  }

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: PALETTE.bg, color: PALETTE.text }}
    >
      <div className="max-w-2xl mx-auto w-full px-6 pt-6 pb-4">
        <p
          className="text-[11px] uppercase tracking-[0.22em] mb-2"
          style={{ color: PALETTE.textMuted, fontFamily: SANS }}
        >
          {t('kicker')}
        </p>
        <h1
          className="text-[28px] leading-[1.2]"
          style={{ fontFamily: SERIF, fontWeight: 400 }}
        >
          {moduleName}
        </h1>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="max-w-2xl mx-auto w-full px-6 py-4 space-y-6">
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
          )}
        </div>
      </div>

      {!sessionComplete && (
        <div
          className="border-t"
          style={{ borderColor: PALETTE.border, background: PALETTE.bg }}
        >
          <div className="max-w-2xl mx-auto w-full px-6 py-4">
            <div className="flex items-end gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={t('inputPlaceholder')}
                disabled={sending}
                rows={2}
                className="flex-1 rounded-2xl px-4 py-3 text-[15px] leading-[1.6] resize-none focus:outline-none disabled:opacity-50"
                style={{
                  background: PALETTE.bgCard,
                  color: PALETTE.text,
                  border: `1px solid ${PALETTE.border}`,
                  fontFamily: SANS,
                }}
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || input.trim().length === 0}
                className="rounded-full px-5 py-3 text-[14px] font-medium disabled:opacity-40"
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
                className="mt-3 text-[13px]"
                style={{ color: '#b91c1c', fontFamily: SANS }}
              >
                {error}
              </p>
            )}
            <p
              className="mt-3 text-[11px] leading-[1.6] text-center"
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
