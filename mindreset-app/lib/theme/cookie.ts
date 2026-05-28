// Single source of truth for the theme-persistence cookie.
//
// Used by:
//   - lib/theme/server.ts (server components read this via next/headers)
//   - lib/theme/ThemeProvider.tsx (client writes this via document.cookie
//     on toggle)
//
// Same-origin only (no Domain attribute); 1-year expiry covers the
// realistic "I set my preference once and forgot" lifetime.
import type { Theme } from '@/lib/brand/colors';

export const THEME_COOKIE_NAME = 'mr_theme';
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

export function isValidTheme(value: string | undefined): value is Theme {
  return value === 'day' || value === 'night';
}
