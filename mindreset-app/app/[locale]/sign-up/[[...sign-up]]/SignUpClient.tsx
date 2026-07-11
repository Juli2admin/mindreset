'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SignUp } from '@clerk/nextjs';
// Phase i18n.1b — locale-aware Link.
import { Link } from '@/i18n/navigation';
import { TOKENS } from '@/lib/brand/colors';
import { useTheme } from '@/lib/theme/useTheme';
// Phase i18n.1d.2 — shared TopBar (client component) imported directly.
import TopBar from '@/components/TopBar';
// Footer arrives as a server-rendered slot via `footerSlot` — see
// app/sign-up/[[...sign-up]]/page.tsx. Phase i18n.0
// server-component-with-client-slot pattern.

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
}) {
  const { palette: PALETTE } = useTheme();
  // ARIA checkbox pattern (role="checkbox" + aria-checked + explicit onClick)
  // instead of the standard <label><input type="checkbox" className="sr-only" />
  // pattern — same fix as Screening.jsx's Check (PR #262). On iOS Safari,
  // clicking a <label> that wraps a visually-hidden checkbox is known to
  // silently fail to fire the input's onChange, and here that failure blocks
  // the entire sign-up flow (both boxes gate the Clerk widget below). Direct
  // onClick avoids the label→input delegation entirely and works uniformly
  // on every browser. Keyboard support (space / enter) preserved. Screen
  // readers announce "checkbox, checked/not, [label]" via role + aria-checked.
  // No <form> submission of these values is needed — they drive the Clerk
  // widget's mount condition (`ready` above) directly from React state.
  const toggle = () => onChange(!checked);
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggle();
        }
      }}
      className="flex items-start gap-3 py-2.5 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-sm"
      style={{
        // Focus ring uses the accent so it's visible on both themes. Only
        // shown on keyboard focus (focus-visible), not on click.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        '--tw-ring-color': PALETTE.accent,
      } as React.CSSProperties}
    >
      <span
        className="mt-[3px] shrink-0 w-[18px] h-[18px] rounded border-[1.5px] flex items-center justify-center transition-colors"
        style={{
          background: checked ? PALETTE.accent : PALETTE.bgCard,
          borderColor: checked ? PALETTE.accent : PALETTE.borderStrong,
        }}
      >
        {checked && (
          <svg
            viewBox="0 0 16 16"
            width="11"
            height="11"
            fill="none"
            stroke={PALETTE.accentText}
            strokeWidth="2.5"
          >
            <path d="M3 8.5L6.5 12L13 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span
        className="leading-[1.55] text-[15px]"
        style={{ fontFamily: TOKENS.sans, color: PALETTE.text }}
      >
        {children}
      </span>
    </div>
  );
}

type SignUpClientProps = {
  footerSlot: ReactNode;
};

export default function SignUpClient({ footerSlot }: SignUpClientProps) {
  const t = useTranslations('SignUp');
  const { palette: PALETTE } = useTheme();
  const [tcAccepted, setTcAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const ready = tcAccepted && privacyAccepted;

  // The Clerk catch-all serves both /sign-up (initial step) and sub-paths
  // like /sign-up/verify-email-address. React re-mounts this component on
  // route change, resetting the checkbox state — so on sub-paths we skip
  // the checkbox gate entirely and render the Clerk widget directly. The
  // user has already agreed on the initial step; there is nothing to re-
  // capture, and any sub-path means an in-progress Clerk sign-up session.
  const pathname = usePathname();
  const isInitialStep = pathname.endsWith('/sign-up');

  return (
    <main
      className="min-h-screen flex flex-col items-center"
      style={{ background: PALETTE.bg }}
    >
      <div className="w-full max-w-md px-6 py-12 sm:py-20">
        {/* Phase 1d.2 — shared TopBar in centered mode (no picker visible).
            Trauma-informed friction-point clean-up. */}
        <TopBar align="centered" />

        {isInitialStep && (
          <div className="mt-10 mb-8">
            <Checkbox checked={tcAccepted} onChange={setTcAccepted}>
              {t.rich('agreeToTerms', {
                link: (chunks) => (
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                    style={{ color: PALETTE.accent }}
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </Checkbox>
            <Checkbox checked={privacyAccepted} onChange={setPrivacyAccepted}>
              {t.rich('agreeToPrivacy', {
                link: (chunks) => (
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                    style={{ color: PALETTE.accent }}
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </Checkbox>
          </div>
        )}

        {(!isInitialStep || ready) ? (
          <SignUp
            appearance={{
              variables: {
                colorPrimary: PALETTE.accent,
                colorBackground: PALETTE.bgCard,
                colorText: PALETTE.text,
                colorTextSecondary: PALETTE.textMuted,
                colorInputBackground: PALETTE.bgCard,
                colorInputText: PALETTE.text,
                fontFamily: TOKENS.sans,
                borderRadius: '10px',
              },
              elements: {
                card: {
                  boxShadow: 'none',
                  border: `1px solid ${PALETTE.border}`,
                  background: PALETTE.bgCard,
                },
                headerTitle: { fontFamily: TOKENS.serif, fontWeight: 400 },
                formButtonPrimary: { fontWeight: 500 },
                footerActionLink: { color: PALETTE.accent },
              },
            }}
          />
        ) : (
          <p
            className="text-[14px] leading-[1.65] italic"
            style={{ fontFamily: TOKENS.sans, color: PALETTE.textMuted }}
          >
            {t('acceptBothHint')}
          </p>
        )}

        {footerSlot}
      </div>
    </main>
  );
}
