'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';

// Phase i18n.2a — Phase 0 oversight (modal was hardcoded EN only)
// resolved. Content moved into DisclaimerModal namespace in message
// bundles. The crisis-line paragraph uses t.rich() to handle inline
// <b> markup around hotline numbers without splitting the prose into
// many small translatable strings.

const OVERLAY = 'rgba(57, 57, 57, 0.55)';

type Props = { onAcknowledge: () => void };

export default function DisclaimerModal({ onAcknowledge }: Props) {
  const t = useTranslations('DisclaimerModal');
  const { palette: PALETTE } = useTheme();
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
        // max-h + overflow-y-auto so the Acknowledge button stays reachable
        // on short viewports (iPhone SE landscape, in-app browsers with
        // small inner height).
        className="w-full max-w-[480px] max-h-[90dvh] overflow-y-auto rounded-2xl p-8 sm:p-10"
        style={{ background: PALETTE.bg, color: PALETTE.text }}
      >
        <h2 id="disclaimer-modal-title" className="sr-only">
          {t('title')}
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
          {t('primary')}
        </p>
        <p className="text-[15px] leading-[1.7] mb-5" style={{ color: PALETTE.textMuted }}>
          {t('secondary')}
        </p>
        <p className="text-[15px] leading-[1.7] mb-8" style={{ color: PALETTE.textMuted }}>
          {t.rich('crisisLine', {
            b: (chunks) => (
              <strong style={{ color: PALETTE.text, fontWeight: 500 }}>{chunks}</strong>
            ),
          })}
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
          {t('acknowledge')}
        </button>
      </div>
    </div>
  );
}
