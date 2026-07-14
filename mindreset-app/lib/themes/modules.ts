// Theme module registry.
//
// PR χ1 (2026-07-13). Themes are deep thematic modules — the reader
// works on ONE life pattern (shame, money, family, body, self-realisation)
// across multiple sessions within their 30-day access window. Same
// AI depth as the Journey, concentrated on a single topic.
//
// Pricing: £59 one-off, 30-day access. No subscriber discount (per
// owner decision 2026-07-13). All 5 themes priced identically.
//
// Adding a new theme: append to THEME_MODULES + create Stripe product +
// env var + write the system prompt. No migration required — moduleId
// is a string in the DB.

export type ThemeModuleId =
  | 'shame'
  | 'money'
  | 'body'
  | 'family'
  | 'self_realisation';

export type ThemeModule = {
  /** URL slug + DB identifier. */
  id: ThemeModuleId;
  /** Short brand-facing name (EN). Displayed in the /themes catalogue. */
  name: string;
  /** One-line description shown on the catalogue tile. */
  tagline: string;
  /**
   * Env var holding the Stripe Price ID for this theme (£59).
   * Env-var slugs mirror the Stripe dashboard product names.
   */
  priceEnv: string;
};

export const THEME_MODULES: readonly ThemeModule[] = [
  {
    id: 'shame',
    name: 'Shame and Guilt',
    tagline: 'Ease the self-punishment. Restore a felt sense of worth.',
    priceEnv: 'STRIPE_PRICE_THEME_SHAME',
  },
  {
    id: 'money',
    name: 'Money and Abundance',
    tagline: 'Rewrite the scripts around money. Steady the body around it.',
    priceEnv: 'STRIPE_PRICE_THEME_MONEY',
  },
  {
    id: 'body',
    name: 'Body and Sexuality',
    tagline: 'Reconcile with the body. Safe pleasure. Real boundaries.',
    priceEnv: 'STRIPE_PRICE_THEME_BODY',
  },
  {
    id: 'family',
    name: 'Parents and Family Scripts',
    tagline: 'Gently rewrite what you inherited. Keep the good, return the rest.',
    priceEnv: 'STRIPE_PRICE_THEME_FAMILY',
  },
  {
    id: 'self_realisation',
    name: 'Self-Realisation',
    tagline: 'Find your strengths. Take one real step toward your talents.',
    priceEnv: 'STRIPE_PRICE_THEME_SELF_REALISATION',
  },
];

export const THEME_MODULE_IDS: readonly ThemeModuleId[] = THEME_MODULES.map(
  (m) => m.id,
);

export function getThemeModule(id: string): ThemeModule | null {
  return THEME_MODULES.find((m) => m.id === id) ?? null;
}

export function isValidThemeModuleId(id: string): id is ThemeModuleId {
  return THEME_MODULES.some((m) => m.id === id);
}

/** Access duration granted by one purchase (30 days). */
export const THEME_ACCESS_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/** Price in pence, for display only — Stripe is the source of truth. */
export const THEME_PRICE_PENCE = 5900;
