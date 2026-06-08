'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TopBar from '@/components/TopBar';
import { useTheme } from '@/lib/theme/useTheme';
import { TOKENS } from '@/lib/brand/colors';

// The Journey UI — deliberately quiet.
//
// What the user sees:
//   - TopBar (shared with the rest of the app)
//   - A column of message bubbles, slow line height, serif AI / sans user
//   - A soft anchor badge (top-right) once an anchor exists, in their words
//   - A simple composer at the bottom
//
// What the user does NOT see:
//   - Stage names, numbers, or transitions
//   - Depth labels (surface / middle / deep)
//   - Progress indicators
//   - Completion criteria
//   - Any clinical scaffolding
//
// When frozenForReview is true, the chat is replaced with a calm holding
// view showing the crisis resources (Shared Core §7). The user can still
// see the conversation history above the holding view so they don't lose
// continuity — they simply can't send a new message.

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
};

type Props = {
  initialMessages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>;
  anchorText: string | null;
  frozen: boolean;
};

const TEXTAREA_MIN_HEIGHT = 56;
const TEXTAREA_MAX_HEIGHT = 200;

export default function JourneyClient({ initialMessages, anchorText, frozen }: Props) {
  const t = useTranslations('Journey');
  const { palette: PALETTE } = useTheme();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [composerValue, setComposerValue] = useState('');
  const [sending, setSending] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-grow the textarea up to TEXTAREA_MAX_HEIGHT.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = `${TEXTAREA_MIN_HEIGHT}px`;
    const next = Math.min(ta.scrollHeight, TEXTAREA_MAX_HEIGHT);
    ta.style.height = `${next}px`;
  }, [composerValue]);

  const isFirstContact = messages.length === 0;
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
        body: JSON.stringify({ message }),
      });

      if (!res.ok || !res.body) {
        setStreamError(true);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: t('streamErrorSuffix'), streaming: false }
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
      // Final flush.
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
            ? { ...m, content: t('streamErrorSuffix'), streaming: false }
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
          <div className="max-w-2xl mx-auto px-6 py-10 relative">
            {anchorText && <AnchorBadge anchorText={anchorText} />}

            {isFirstContact && (
              <FirstContactSpace />
            )}

            <div className="space-y-8">
              {messages.map((m) => (
                <MessageRow key={m.id} message={m} />
              ))}
              {streamError && messages.length > 0 && (
                <p style={{ color: PALETTE.textMuted }} className="text-sm italic">
                  {t('streamErrorSuffix')}
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
            disabled={sending}
            textareaRef={textareaRef}
            placeholder={isFirstContact ? t('firstContactPlaceholder') : t('placeholder')}
            sending={sending}
          />
        )}
      </main>
    </div>
  );
}

// ===========================================================================
// Sub-components — kept colocated for Slice 3 simplicity.
// ===========================================================================

function FirstContactSpace() {
  // Deliberately blank. No "Hi I'm your AI guide". The user opens the page
  // and is invited by the placeholder to say whatever is there. The AI's
  // first reply does the welcoming.
  return <div className="h-16" />;
}

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

function AnchorBadge({ anchorText }: { anchorText: string }) {
  const t = useTranslations('Journey.anchorBadge');
  const { palette: PALETTE } = useTheme();
  return (
    <div
      className="absolute top-4 right-4 max-w-xs px-4 py-3 rounded-xl text-xs"
      style={{
        background: PALETTE.bgCard,
        border: `1px solid ${PALETTE.border}`,
        color: PALETTE.textMuted,
        fontFamily: TOKENS.sans,
      }}
    >
      <div className="mb-1 uppercase tracking-wider" style={{ fontSize: '0.65rem' }}>
        {t('label')}
      </div>
      <div
        className="italic"
        style={{
          fontFamily: TOKENS.serif,
          color: PALETTE.text,
          fontSize: '0.85rem',
          lineHeight: '1.4',
        }}
      >
        {anchorText}
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
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  placeholder: string;
  sending: boolean;
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
        <div className="flex items-end gap-3">
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
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className="rounded-full px-4 py-2 text-sm transition-opacity disabled:opacity-30"
            style={{
              background: PALETTE.accent,
              color: PALETTE.accentText,
              fontFamily: TOKENS.sans,
              minHeight: 44,
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
