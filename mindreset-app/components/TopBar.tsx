'use client';

// Phase i18n.1d.2 — shared top-bar component used by every page.
// Slot-prop shell pattern (same as Footer's footerSlot):
//   - Wordmark Link to / (locale-aware via @/i18n/navigation)
//   - Optional TreeMark glyph (Landing + Screening pass showTreeMark)
//   - Page-specific `right` slot content (UserButton on Account,
//     progress indicator on Screening, "Start new" on MiniMind, etc.)
//   - LanguagePicker on far right, except in 'centered' alignment mode
//
// Centered alignment mode (sign-in, sign-up) renders a centered
// wordmark with no right-slot content and no picker. This is the
// trauma-informed friction-point clean-up decision locked in 1d
// scoping: at the moment of committing to a sign-up form, we hide
// optional UI controls. User reaches the picker via Footer or by
// navigating back to a regular page.
//
// Client component. The earlier draft was server-async, but three
// pages (Landing, Screening, MiniMind) need client-state-derived
// content in the right slot (ThemeToggle reads from a ThemeContext
// provided by the client parent; Sign-in Link depends on Clerk's
// useUser hook; MiniMind's Start-new is bound to a client callback).
// Converting to client lets all 8 pages use TopBar uniformly — paying
// ~2 KB to the shared client bundle for a single source of truth
// rather than maintaining 3 local duplicate headers.

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';
import LanguagePicker from './LanguagePicker';
import ThemeToggle from './ThemeToggle';

type Props = {
  /** Page-specific right-side content. Renders BEFORE the LanguagePicker.
   *  Ignored when align='centered'. */
  right?: React.ReactNode;
  /** 'default' = wordmark left, right slot + picker on far right.
   *  'centered' = wordmark centered, no right slot, no picker. */
  align?: 'default' | 'centered';
  /** Show the brand icon (tree logo) before the wordmark text. Landing +
   *  Screening pass true; other pages keep the wordmark text-only. */
  showTreeMark?: boolean;
};

export default function TopBar({
  right,
  align = 'default',
  showTreeMark = false,
}: Props) {
  const t = useTranslations('TopBar');
  const tFooter = useTranslations('Footer');
  // Theme comes from the global ThemeProvider (mounted in [locale]/
  // layout.tsx). The wordmark colours, the brand-icon variant, and the
  // LanguagePicker theming all update in lockstep when the toggle fires.
  const { theme, palette: PALETTE } = useTheme();

  const wordmark = (
    <Link
      href="/"
      aria-label={t('wordmarkAria')}
      className="inline-flex items-center gap-2"
      style={{ color: PALETTE.text }}
    >
      {showTreeMark && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={theme === 'night' ? '/logo-dark.png' : '/logo-light.png'}
          alt=""
          width={26}
          height={26}
          style={{ display: 'block', objectFit: 'contain' }}
        />
      )}
      <span
        className="text-[20px] tracking-tight"
        style={{
          fontFamily: TOKENS.serif,
          fontWeight: 500,
          fontVariationSettings: '"opsz" 144, "SOFT" 50',
        }}
      >
        <span style={{ color: PALETTE.accent }}>Mind</span>
        <span style={{ color: PALETTE.accentSage }}>Reset</span>
        <span style={{ color: PALETTE.textHint }} className="ml-0.5">
          .ai
        </span>
      </span>
    </Link>
  );

  if (align === 'centered') {
    return (
      <header className="flex items-center justify-center py-6">
        {wordmark}
      </header>
    );
  }

  return (
    <header className="flex items-center justify-between py-6">
      <div className="flex items-center">{wordmark}</div>
      <div className="flex items-center gap-3">
        {right}
        <ThemeToggle />
        <LanguagePicker label={tFooter('languagePickerLabel')} direction="down" />
      </div>
    </header>
  );
}
