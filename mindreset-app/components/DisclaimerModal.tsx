'use client';

import { useEffect, useRef } from 'react';
import { PALETTE as FULL_PALETTE, TOKENS } from '@/lib/brand/colors';

const PALETTE = FULL_PALETTE.day;
const OVERLAY = 'rgba(57, 57, 57, 0.55)';

type Props = { onAcknowledge: () => void };

export default function DisclaimerModal({ onAcknowledge }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key === 'Tab' && cardRef.current) {
        e.preventDefault();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: OVERLAY, fontFamily: TOKENS.sans }}
    >
      <div
        ref={cardRef}
        className="w-full max-w-[480px] rounded-2xl p-8 sm:p-10"
        style={{ background: PALETTE.bg, color: PALETTE.text }}
      >
        <h2 id="disclaimer-modal-title" className="sr-only">
          Important — before you continue
        </h2>

        <div
          className="text-[22px] tracking-tight mb-6"
          style={{ fontFamily: TOKENS.serif, fontWeight: 400 }}
          aria-hidden="true"
        >
          <span style={{ color: PALETTE.accent }}>Mind</span>
          <span style={{ color: PALETTE.accentSage }}>Reset</span>
        </div>

        <p
          className="text-[18px] leading-[1.5] mb-5"
          style={{ fontFamily: TOKENS.serif, fontWeight: 400, color: PALETTE.text }}
        >
          MindReset is a wellbeing tool — not therapy, not a medical device, not a
          crisis service.
        </p>
        <p className="text-[15px] leading-[1.7] mb-5" style={{ color: PALETTE.textMuted }}>
          The AI here cannot diagnose, treat, or replace a clinician. If you are in
          crisis, in danger, or experiencing severe psychological symptoms — please
          reach out to professional support.
        </p>
        <p className="text-[15px] leading-[1.7] mb-8" style={{ color: PALETTE.textMuted }}>
          <strong style={{ color: PALETTE.text, fontWeight: 500 }}>UK:</strong>{' '}
          Samaritans{' '}
          <strong style={{ color: PALETTE.text, fontWeight: 500 }}>116 123</strong>{' '}
          (24/7). NHS{' '}
          <strong style={{ color: PALETTE.text, fontWeight: 500 }}>111</strong> option
          2. Your GP. In an emergency:{' '}
          <strong style={{ color: PALETTE.text, fontWeight: 500 }}>999</strong> or
          A&amp;E.
        </p>

        <button
          ref={buttonRef}
          type="button"
          onClick={onAcknowledge}
          className="w-full h-12 rounded-full text-[14px] tracking-wide transition-opacity hover:opacity-90"
          style={{
            background: PALETTE.accent,
            color: PALETTE.accentText,
            fontWeight: 500,
          }}
        >
          I understand — continue
        </button>
      </div>
    </div>
  );
}
