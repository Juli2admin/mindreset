'use client';

// Theme-toggle button. Sun/moon icon swap depending on current theme;
// click toggles between day and night.
//
// Reads/writes the global theme via useTheme(). Mount anywhere inside
// the ThemeProvider tree (i.e., anywhere under [locale]/layout.tsx).
// TopBar drops this into its default right slot so the toggle is
// available on every page that uses TopBar in align='default' mode.

import { useTheme } from '@/lib/theme/useTheme';

function SunIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function ThemeToggle() {
  const { theme, palette, toggle } = useTheme();
  const Icon = theme === 'day' ? MoonIcon : SunIcon;
  return (
    <button
      type="button"
      onClick={toggle}
      // min-h/w-9 = 36px tap target. Stays balanced with the wordmark
      // and LanguagePicker beside it in the TopBar without bloating the
      // header. Borderless to match the LanguagePicker trigger style.
      className="inline-flex items-center justify-center min-w-9 min-h-9 rounded-full transition-colors"
      style={{ color: palette.textMuted, border: `1px solid ${palette.border}` }}
      aria-label={theme === 'day' ? 'Switch to night mode' : 'Switch to day mode'}
    >
      <Icon size={14} />
    </button>
  );
}
