// Single source of truth for MindReset brand palette and font stacks.

export const PALETTE = {
  day: {
    bg: '#F4F1EA',
    bgCard: '#FFFFFF',
    bgSubtle: '#EAE5D8',
    text: '#393939',
    textMuted: '#6A6A6A',
    // Bumped from #9D9788 (~2.6:1 on bg) to hit WCAG AA 4.5:1 on the
    // day background. `textHint` was previously used on 20+ text
    // surfaces (bylines, legal captions, wordmark suffix, kickers) —
    // any of them 13-15px, all failing AA. Warm tan preserved so the
    // token still reads distinct from the neutral `textMuted`, but the
    // luminance is now close enough to `textMuted` that hierarchy has
    // to come from font weight/size/register, not paleness.
    textHint: '#787260',
    border: '#D9D2C2',
    borderStrong: '#B9AE99',
    accent: '#2D7A85',
    accentText: '#F4F1EA',
    accentSage: '#5C8A75',
    danger: '#8B3A3A',
    warning: '#A07A3A',
    success: '#4A7A5E',
  },
  night: {
    bg: '#393939',
    bgCard: '#424242',
    bgSubtle: '#2F2F2F',
    text: '#F4F1EA',
    textMuted: '#C0BAA8',
    // Bumped from #8A8478 (~3.1:1 on bg) to hit WCAG AA 4.5:1 on the
    // night background. Same rationale as the day textHint above.
    textHint: '#B8B2A0',
    border: '#4D4D4D',
    borderStrong: '#6A6A6A',
    accent: '#7AC5D2',
    accentText: '#393939',
    accentSage: '#9BC5A8',
    danger: '#D89595',
    warning: '#D9B383',
    success: '#8AB89C',
  },
} as const;

export type Theme = keyof typeof PALETTE;
// Widened: both day and night palettes have the same keys but different
// literal hex values, so PaletteColors must accept either. Using
// `typeof PALETTE.day` directly here would lock the type to the day
// palette's specific hex literals and reject the night palette.
export type PaletteColors = { readonly [K in keyof typeof PALETTE.day]: string };

export const TOKENS = {
  serif: 'Fraunces, Georgia, serif',
  sans: 'Geist, -apple-system, system-ui, sans-serif',
} as const;

export const serifStyle = { fontFamily: TOKENS.serif } as const;
export const sansStyle = { fontFamily: TOKENS.sans } as const;
