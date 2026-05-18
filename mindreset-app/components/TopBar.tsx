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
// Server component. Translations resolve via getTranslations against
// the active locale; the LanguagePicker leaf is a client island.

import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { PALETTE as FULL_PALETTE, TOKENS } from '@/lib/brand/colors';
import LanguagePicker from './LanguagePicker';

type Props = {
  /** Page-specific right-side content. Renders BEFORE the LanguagePicker.
   *  Ignored when align='centered'. */
  right?: React.ReactNode;
  /** 'default' = wordmark left, right slot + picker on far right.
   *  'centered' = wordmark centered, no right slot, no picker. */
  align?: 'default' | 'centered';
  /** Show TreeMark glyph before the wordmark text. Landing + Screening
   *  pass true; other pages keep the wordmark text-only. */
  showTreeMark?: boolean;
  theme?: 'day' | 'night';
};

function TreeMark({ size = 26, color }: { size?: number; color: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 11 V21" strokeWidth="1.4" />
      <path d="M16 11 Q15 6 13 2" strokeWidth="1" />
      <path d="M16 11 Q17 6 19 2" strokeWidth="1" />
      <path d="M16 12 Q11 9 7 5" strokeWidth="1" />
      <path d="M16 12 Q21 9 25 5" strokeWidth="1" />
      <path d="M16 13 Q9 13 4 11" strokeWidth="1" />
      <path d="M16 13 Q23 13 28 11" strokeWidth="1" />
      <path d="M16 21 Q15 26 13 30" strokeWidth="1" />
      <path d="M16 21 Q17 26 19 30" strokeWidth="1" />
      <path d="M16 20 Q11 23 7 27" strokeWidth="1" />
      <path d="M16 20 Q21 23 25 27" strokeWidth="1" />
      <path d="M16 19 Q9 19 4 21" strokeWidth="1" />
      <path d="M16 19 Q23 19 28 21" strokeWidth="1" />
    </svg>
  );
}

export default async function TopBar({
  right,
  align = 'default',
  showTreeMark = false,
  theme = 'day',
}: Props) {
  const t = await getTranslations('TopBar');
  const tFooter = await getTranslations('Footer');
  const PALETTE = FULL_PALETTE[theme];

  const wordmark = (
    <Link
      href="/"
      aria-label={t('wordmarkAria')}
      className="inline-flex items-center gap-2"
      style={{ color: PALETTE.text }}
    >
      {showTreeMark && <TreeMark size={26} color={PALETTE.text} />}
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
        <LanguagePicker label={tFooter('languagePickerLabel')} theme={theme} />
      </div>
    </header>
  );
}
