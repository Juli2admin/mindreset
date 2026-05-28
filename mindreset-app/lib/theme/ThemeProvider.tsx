'use client';

// Global theme provider mounted in [locale]/layout.tsx. Renders a
// React Context that client pages and components consume via
// useTheme() (from lib/theme/useTheme).
//
// SSR strategy:
//   1. Server reads the mr_theme cookie via getServerTheme() in the
//      layout and passes the result as initialTheme.
//   2. This provider initialises useState with that value, so the
//      first client render exactly matches what the server painted.
//      No hydration mismatch.
//   3. After mount, if no cookie was set AND the user's OS prefers
//      dark, switch to night and persist (so subsequent server renders
//      also see the cookie). This preserves the previous Landing
//      behaviour of auto-following system preference on first visit.
//
// Toggle flow:
//   1. Local state flips → client components re-render with the new
//      palette immediately.
//   2. Cookie is written via document.cookie so next server render
//      sees the new value.
//   3. router.refresh() asks Next.js to re-render server components
//      against the new cookie. Server-rendered pages (Terms, Privacy,
//      FAQ) update without a full reload.

import { createContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PALETTE, type Theme, type PaletteColors } from '@/lib/brand/colors';
import { THEME_COOKIE_NAME, THEME_COOKIE_MAX_AGE } from './cookie';

export type ThemeContextValue = {
  theme: Theme;
  palette: PaletteColors;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function writeThemeCookie(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${THEME_COOKIE_NAME}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function ThemeProvider({
  initialTheme,
  cookieWasSet,
  children,
}: {
  initialTheme: Theme;
  /** True if the server saw a mr_theme cookie. False means this is a
   *  first visit (or the cookie was cleared) — in which case we may
   *  switch to night based on OS preference after mount. */
  cookieWasSet: boolean;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const router = useRouter();

  // First-visit OS-preference detection. Only runs when no cookie was
  // present on the server — i.e., the user hasn't expressed a preference
  // yet. After this fires once, the cookie is set and subsequent visits
  // skip this branch (the server will read the cookie and pass it as
  // initialTheme).
  useEffect(() => {
    if (cookieWasSet) return;
    try {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark && theme !== 'night') {
        setThemeState('night');
        writeThemeCookie('night');
        router.refresh();
      } else {
        // Even if we stay on day, write the cookie so we don't re-run
        // this detection on every page load.
        writeThemeCookie(theme);
      }
    } catch {
      // matchMedia may be unavailable in some embedded webviews. Fall
      // back to the initial theme silently.
    }
    // Only run on mount. We intentionally don't react to later state
    // changes — those go through setTheme/toggle which handle the
    // cookie themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      writeThemeCookie(next);
      router.refresh();
    },
    [router],
  );

  const toggle = useCallback(() => {
    const next: Theme = theme === 'day' ? 'night' : 'day';
    setTheme(next);
  }, [theme, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, palette: PALETTE[theme], toggle, setTheme }),
    [theme, toggle, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
