'use client';

import { useState, useEffect, useRef } from 'react';
// Phase i18n.1b — locale-aware Link.
import { Link } from '@/i18n/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PALETTE as FULL_PALETTE, TOKENS } from '@/lib/brand/colors';

const PALETTE = FULL_PALETTE.day;

const HARDCODED_OPENER =
  'Hello. Good to have you here. How are you doing today?';
const PLACEHOLDER = "Say what's on your mind.";
const STREAM_ERROR_SUFFIX =
  "— *(I lost my thread for a moment. Please send again when you're ready.)*";
const SOFT_SEPARATOR = '\n\n';
const TEXTAREA_MIN_HEIGHT = 48;
const TEXTAREA_MAX_HEIGHT = 168;

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
};

type LastConvoNone = { hasLast: false };
type LastConvoWithData = {
  hasLast: true;
  conversationId: string;
  lastMessageAt: string;
  daysAgo: number;
  showSnippet: boolean;
  snippet?: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
  }>;
};
type LastConvo = LastConvoNone | LastConvoWithData;

type Props = {
  lastConvo: LastConvo;
};

function formatRelative(daysAgo: number): string {
  if (daysAgo === 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  if (daysAgo < 7) return `${daysAgo} days ago`;
  if (daysAgo < 14) return 'a week ago';
  if (daysAgo < 30) return `${Math.floor(daysAgo / 7)} weeks ago`;
  if (daysAgo < 60) return 'a month ago';
  return `${Math.floor(daysAgo / 30)} months ago`;
}

function MiniMindHeader({
  showStartNew,
  onStartNew,
}: {
  showStartNew: boolean;
  onStartNew?: () => void;
}) {
  return (
    <header
      className="flex items-center justify-between px-6 py-4"
      style={{ borderBottom: `1px solid ${PALETTE.border}` }}
    >
      <Link href="/account" className="block">
        <h1
          className="text-[22px] tracking-tight"
          style={{ fontFamily: TOKENS.serif, fontWeight: 400 }}
        >
          <span style={{ color: PALETTE.accent }}>Mind</span>
          <span style={{ color: PALETTE.accentSage }}>Reset</span>
        </h1>
      </Link>
      {showStartNew && onStartNew && (
        <button
          type="button"
          onClick={onStartNew}
          className="text-[13px] hover:underline underline-offset-2 transition-colors"
          style={{ color: PALETTE.textMuted, fontFamily: TOKENS.sans }}
        >
          Start new
        </button>
      )}
    </header>
  );
}

function TypingIndicator() {
  return (
    <div
      className="flex items-center gap-1.5 py-1"
      aria-label="MiniMind is preparing a response"
    >
      <span
        className="block w-2 h-2 rounded-full animate-pulse"
        style={{ background: PALETTE.textHint, animationDelay: '0ms' }}
      />
      <span
        className="block w-2 h-2 rounded-full animate-pulse"
        style={{ background: PALETTE.textHint, animationDelay: '200ms' }}
      />
      <span
        className="block w-2 h-2 rounded-full animate-pulse"
        style={{ background: PALETTE.textHint, animationDelay: '400ms' }}
      />
    </div>
  );
}

function MessageRow({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] text-[16px] leading-[1.6] whitespace-pre-wrap"
          style={{ color: PALETTE.text, fontFamily: TOKENS.sans }}
        >
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div
        className="max-w-[85%] text-[16px] leading-[1.6] minimind-prose"
        style={{ color: PALETTE.text, fontFamily: TOKENS.sans }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
        {message.streaming && (
          <span
            className="inline-block w-[2px] h-4 ml-0.5 align-text-bottom animate-pulse"
            style={{ background: PALETTE.textHint }}
          />
        )}
      </div>
    </div>
  );
}

function ChoosingView({
  lastConvo,
  onContinue,
  onStartNew,
}: {
  lastConvo: LastConvoWithData;
  onContinue: () => void;
  onStartNew: () => void;
}) {
  const niceWhen = formatRelative(lastConvo.daysAgo);
  return (
    <main
      className="min-h-[100dvh] flex flex-col"
      style={{ background: PALETTE.bg }}
    >
      <MiniMindHeader showStartNew={false} />
      <div className="flex-1 flex items-center">
        <div className="w-full max-w-[640px] mx-auto px-6 py-12">
          <h2
            className="text-[28px] leading-[1.2] mb-4"
            style={{
              fontFamily: TOKENS.serif,
              fontWeight: 400,
              color: PALETTE.text,
            }}
          >
            Welcome back.
          </h2>
          <p
            className="text-[16px] leading-[1.65] mb-8"
            style={{ color: PALETTE.textMuted, fontFamily: TOKENS.sans }}
          >
            You have a conversation in progress.
          </p>
          <div
            className="rounded-lg p-5 mb-8"
            style={{
              background: PALETTE.bgCard,
              border: `1px solid ${PALETTE.border}`,
            }}
          >
            <p
              className="text-[11px] uppercase tracking-[0.18em] mb-2"
              style={{
                color: PALETTE.textHint,
                fontFamily: TOKENS.sans,
                fontWeight: 500,
              }}
            >
              Last conversation · {niceWhen}
            </p>
            {lastConvo.showSnippet && lastConvo.snippet && (
              <p
                className="text-[15px] leading-[1.6] italic"
                style={{
                  color: PALETTE.textMuted,
                  fontFamily: TOKENS.sans,
                }}
              >
                &ldquo;{lastConvo.snippet}&rdquo;
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center justify-center h-12 px-7 rounded-full text-[14px] tracking-wide transition-all"
              style={{
                background: PALETTE.accent,
                color: PALETTE.accentText,
                fontWeight: 500,
                fontFamily: TOKENS.sans,
              }}
            >
              Continue
            </button>
            <button
              type="button"
              onClick={onStartNew}
              className="inline-flex items-center justify-center h-12 px-7 rounded-full text-[14px] tracking-wide transition-colors"
              style={{
                background: 'transparent',
                color: PALETTE.text,
                border: `1px solid ${PALETTE.border}`,
                fontWeight: 500,
                fontFamily: TOKENS.sans,
              }}
            >
              Start new
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function ChattingView({
  messages,
  input,
  setInput,
  sending,
  awaitingFirstToken,
  onSend,
  onStartNew,
}: {
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  sending: boolean;
  awaitingFirstToken: boolean;
  onSend: () => void;
  onStartNew: () => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initial-mount scroll: jump to bottom immediately (no animation) so a
  // Continue with 50 loaded messages opens at the newest, not the oldest.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Smooth scroll on subsequent message changes (new sends, streaming).
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-grow the textarea up to TEXTAREA_MAX_HEIGHT.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT) + 'px';
  }, [input]);

  return (
    <main
      className="min-h-[100dvh] flex flex-col"
      style={{ background: PALETTE.bg }}
    >
      <MiniMindHeader showStartNew onStartNew={onStartNew} />

      <div className="flex-1 overflow-y-auto px-6">
        <div className="max-w-[700px] mx-auto py-8 space-y-6">
          {messages.map((m) => (
            <MessageRow key={m.id} message={m} />
          ))}
          {awaitingFirstToken && (
            <div className="flex justify-start">
              <TypingIndicator />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
        className="sticky bottom-0 px-6 py-4"
        style={{
          background: PALETTE.bg,
          borderTop: `1px solid ${PALETTE.border}`,
        }}
      >
        <div className="max-w-[700px] mx-auto flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={PLACEHOLDER}
            rows={1}
            disabled={sending}
            className="flex-1 resize-none rounded-lg px-4 py-3 text-[15px] leading-[1.5] transition-colors focus:outline-none"
            style={{
              background: sending ? PALETTE.bgSubtle : PALETTE.bgCard,
              color: PALETTE.text,
              border: `1px solid ${PALETTE.border}`,
              fontFamily: TOKENS.sans,
              opacity: sending ? 0.6 : 1,
              minHeight: TEXTAREA_MIN_HEIGHT,
              maxHeight: TEXTAREA_MAX_HEIGHT,
            }}
          />
          <button
            type="submit"
            disabled={sending || input.trim().length === 0}
            className="h-12 px-6 rounded-full text-[14px] tracking-wide transition-all disabled:cursor-not-allowed"
            style={{
              background: PALETTE.accent,
              color: PALETTE.accentText,
              fontWeight: 500,
              fontFamily: TOKENS.sans,
              opacity: sending || input.trim().length === 0 ? 0.5 : 1,
            }}
          >
            Send
          </button>
        </div>
      </form>
    </main>
  );
}

export default function MiniMindClient({ lastConvo }: Props) {
  const [phase, setPhase] = useState<'choosing' | 'chatting'>(
    lastConvo.hasLast ? 'choosing' : 'chatting',
  );
  const [conversationId, setConversationId] = useState<string | undefined>(
    undefined,
  );
  const [messages, setMessages] = useState<Message[]>(() =>
    lastConvo.hasLast
      ? []
      : [
          {
            id: 'opener',
            role: 'assistant',
            content: HARDCODED_OPENER,
          },
        ],
  );
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);

  const onContinue = () => {
    if (!lastConvo.hasLast) return;
    setConversationId(lastConvo.conversationId);
    setMessages(
      lastConvo.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      })),
    );
    setPhase('chatting');
  };

  const onStartNew = () => {
    if (sending) return;
    setConversationId(undefined);
    setMessages([
      {
        id: 'opener',
        role: 'assistant',
        content: HARDCODED_OPENER,
      },
    ]);
    setPhase('chatting');
  };

  const onSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: text },
    ]);
    setInput('');
    setSending(true);
    setAwaitingFirstToken(true);

    try {
      const res = await fetch('/api/minimind/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[MiniMind] chat error:', res.status, errText);
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: STREAM_ERROR_SUFFIX,
          },
        ]);
        return;
      }

      const returnedConvoId = res.headers.get('X-Conversation-Id');
      if (returnedConvoId) setConversationId(returnedConvoId);

      if (!res.body) {
        throw new Error('no response body');
      }

      // Insert streaming placeholder
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: 'assistant', content: '', streaming: true },
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let receivedAny = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk.length > 0 && !receivedAny) {
          receivedAny = true;
          setAwaitingFirstToken(false);
        }
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
    } catch (err) {
      console.error('[MiniMind] send failed:', err);
      setMessages((prev) => {
        const hasPlaceholder = prev.some((m) => m.id === assistantMsgId);
        if (hasPlaceholder) {
          return prev.map((m) => {
            if (m.id !== assistantMsgId) return m;
            const hasText = m.content.length > 0;
            return {
              ...m,
              streaming: false,
              content: hasText
                ? m.content + SOFT_SEPARATOR + STREAM_ERROR_SUFFIX
                : STREAM_ERROR_SUFFIX,
            };
          });
        }
        return [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: STREAM_ERROR_SUFFIX,
          },
        ];
      });
    } finally {
      setSending(false);
      setAwaitingFirstToken(false);
    }
  };

  if (phase === 'choosing' && lastConvo.hasLast) {
    return (
      <ChoosingView
        lastConvo={lastConvo}
        onContinue={onContinue}
        onStartNew={onStartNew}
      />
    );
  }

  return (
    <ChattingView
      messages={messages}
      input={input}
      setInput={setInput}
      sending={sending}
      awaitingFirstToken={awaitingFirstToken}
      onSend={onSend}
      onStartNew={onStartNew}
    />
  );
}
