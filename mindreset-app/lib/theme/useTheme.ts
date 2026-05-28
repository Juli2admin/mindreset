'use client';

// Client hook for accessing the global theme. Returns the current
// palette object (so callers can read e.g. palette.text directly), the
// theme name ('day' | 'night'), and a toggle function.
//
// Server components must use getServerPalette() from lib/theme/server
// instead — this hook depends on the React Context provided by
// ThemeProvider mounted in [locale]/layout.tsx.

import { useContext } from 'react';
import { ThemeContext, type ThemeContextValue } from './ThemeProvider';

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error(
      'useTheme() must be called inside a <ThemeProvider>. Check that ' +
        '[locale]/layout.tsx renders <ThemeProvider> wrapping {children}.',
    );
  }
  return ctx;
}
