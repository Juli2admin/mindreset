'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { PALETTE as FULL_PALETTE, TOKENS } from '@/lib/brand/colors';

// Phase i18n.1c/1d.2 — URL-aware picker. Two render branches:
//   1. EN active (default locale): silent globe icon only, low-contrast.
//      Russian/French/etc.-speaking UK users landing on / via
//      Accept-Language=en or direct link still need a discoverable way to
//      reach their locale — globe icon is the universal web convention.
//   2. Non-EN active: globe + native-language name + chevron, signalling
//      the active state and offering a route back to English.
//
// Placeholder-content locales (FR, DE, ES, IT, PL, PT) carry a "· en"
// suffix in the dropdown — honest signal that the routing works but
// content is English until Phase 2's DeepL pass. Removed in Phase 2.
//
// Phase 1d.2 — same component is now mounted in BOTH the new TopBar
// (top-right, universal web convention — Airbnb, Booking, Google) AND
// the Footer (industry-standard dual placement). Both write the same
// mr_locale cookie + URL navigation; clicking either has identical
// effect. Auth pages (/sign-in, /sign-up) render the TopBar in
// 'centered' mode which omits the picker — trauma-informed friction-
// point clean-up. User reaches the picker via Footer or by navigating
// back to a regular page.

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Locales with native-quality content (EN: Julia native, RU: Julia native).
// The remaining 6 ship with English placeholder bundles until Phase 2.
const NATIVE_CONTENT_LOCALES: ReadonlySet<string> = new Set(['en', 'ru']);

// Native-language self-names, displayed in the dropdown. Keep inline for
// now; extract to i18n/native-names.ts when a second consumer appears.
const NATIVE_NAMES: Record<string, string> = {
  en: 'English',
  ru: 'Русский',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  pl: 'Polski',
  pt: 'Português',
};

type Props = {
  // Accessible label for the picker. Comes from next-intl messages
  // ("Language" / "Язык" / etc.); only used as `aria-label` text since
  // the trigger itself is icon-only or icon + native name.
  label: string;
  theme?: 'day' | 'night';
};

function GlobeIcon({ size = 14, color }: { size?: number; color: string }) {
  // Inline 14px globe glyph. Keeps the bundle 0-deps and avoids a CSS
  // background-image round-trip for a single icon.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" />
      <ellipse cx="8" cy="8" rx="2.75" ry="6.5" />
      <line x1="1.5" y1="8" x2="14.5" y2="8" />
    </svg>
  );
}

export default function FooterLanguagePicker({ label, theme = 'day' }: Props) {
  const currentLocale = useLocale();
  const router = useRouter();
  const currentPath = usePathname();
  const PALETTE = FULL_PALETTE[theme];

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const isDefaultLocale = currentLocale === routing.defaultLocale;
  const currentNative = NATIVE_NAMES[currentLocale] ?? currentLocale;

  // Click-outside + Esc to close. Focus returns to the trigger on Esc so
  // keyboard users aren't stranded after dismissal.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent | TouchEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function setLocale(next: string) {
    if (next === currentLocale) {
      setOpen(false);
      return;
    }
    // Belt-and-braces cookie write. next-intl middleware will also update
    // mr_locale on the navigation response (Phase 1a Finding 1 unified
    // the cookie name); writing here covers the edge case where
    // router.replace fails mid-flight, so the choice persists for the
    // next full page-load.
    const secure =
      typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? '; Secure'
        : '';
    document.cookie = `mr_locale=${next}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
    setOpen(false);
    // router.replace (not push) so the back-button from /fr/screening
    // doesn't return to /ru/screening — locale switches shouldn't
    // accumulate in history.
    router.replace(currentPath, { locale: next });
  }

  const triggerAriaLabel = isDefaultLocale
    ? label
    : `${label}. ${currentNative}`;

  return (
    // Layout-neutral outer: only `relative` (needed to anchor the
    // absolute-positioned dropdown panel below). Parent component
    // controls placement — Footer wraps in `mt-4 flex justify-center`,
    // TopBar drops it into the right-side flex row directly.
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={triggerAriaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className="inline-flex items-center gap-1.5 px-1.5 py-1 rounded transition-opacity"
        style={{
          color: isDefaultLocale ? PALETTE.textHint : PALETTE.textMuted,
          fontFamily: TOKENS.sans,
          opacity: isDefaultLocale ? 0.7 : 1,
        }}
      >
        <GlobeIcon color={isDefaultLocale ? PALETTE.textHint : PALETTE.textMuted} />
        {!isDefaultLocale && (
          <>
            <span className="text-[12px]">{currentNative}</span>
            <span
              className="text-[10px]"
              style={{ color: PALETTE.textHint }}
              aria-hidden="true"
            >
              ▾
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute z-50 overflow-y-auto rounded-md shadow-lg"
          style={{
            // Above the trigger; footer is page-bottom so opening upward
            // is the natural direction. max-height + scroll handles
            // short-viewport mobile.
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            minWidth: '180px',
            maxHeight: '50vh',
            background: PALETTE.bgCard,
            border: `1px solid ${PALETTE.border}`,
            fontFamily: TOKENS.sans,
          }}
        >
          {routing.locales.map((code) => {
            const isActive = code === currentLocale;
            const isPlaceholder = !NATIVE_CONTENT_LOCALES.has(code);
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => setLocale(code)}
                className="flex items-center justify-between w-full px-3 py-2 text-left text-[13px] transition-colors hover:opacity-100"
                style={{
                  color: PALETTE.text,
                  background: isActive ? PALETTE.bg : 'transparent',
                  fontWeight: isActive ? 500 : 400,
                  borderBottom: `1px solid ${PALETTE.border}`,
                }}
              >
                <span>
                  {NATIVE_NAMES[code] ?? code}
                  {isPlaceholder && (
                    <span
                      className="ml-1.5 text-[11px]"
                      style={{ color: PALETTE.textHint }}
                      aria-label="content in English"
                    >
                      · en
                    </span>
                  )}
                </span>
                {isActive && (
                  <span
                    className="text-[11px]"
                    style={{ color: PALETTE.textMuted }}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
