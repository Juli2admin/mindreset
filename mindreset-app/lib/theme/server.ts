// Server-side theme helpers. For SERVER components only — the cookies()
// API from next/headers is server-only.
//
// Usage pattern in a server page:
//   import { getServerTheme, getServerPalette } from '@/lib/theme/server';
//   const PALETTE = await getServerPalette();
//   ...
//
// Server pages don't react to client-side theme toggles automatically.
// The ThemeProvider on the client side calls router.refresh() after
// toggling, which makes Next.js re-render server components against
// the freshly-written cookie. So a single toggle propagates to every
// page on the next paint.

import { cookies } from 'next/headers';
import { PALETTE, type PaletteColors, type Theme } from '@/lib/brand/colors';
import { THEME_COOKIE_NAME, isValidTheme } from './cookie';

export function getServerTheme(): Theme {
  const cookieStore = cookies();
  const value = cookieStore.get(THEME_COOKIE_NAME)?.value;
  return isValidTheme(value) ? value : 'day';
}

export function getServerPalette(): PaletteColors {
  const theme = getServerTheme();
  return PALETTE[theme];
}
