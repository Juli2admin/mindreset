'use client';

import { useState, type ReactNode } from 'react';
import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { PALETTE as FULL_PALETTE, TOKENS } from '@/lib/brand/colors';
import Footer from '@/components/Footer';

const PALETTE = FULL_PALETTE.day;

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 py-2.5 cursor-pointer">
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
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className="leading-[1.55] text-[15px]"
        style={{ fontFamily: TOKENS.sans, color: PALETTE.text }}
      >
        {children}
      </span>
    </label>
  );
}

export default function SignUpClient() {
  const [tcAccepted, setTcAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const ready = tcAccepted && privacyAccepted;

  return (
    <main
      className="min-h-screen flex flex-col items-center"
      style={{ background: PALETTE.bg }}
    >
      <div className="w-full max-w-md px-6 py-12 sm:py-20">
        <Link href="/" className="block mb-10 text-center">
          <h1
            className="text-[28px] tracking-tight"
            style={{ fontFamily: TOKENS.serif, fontWeight: 400 }}
          >
            <span style={{ color: PALETTE.accent }}>Mind</span>
            <span style={{ color: PALETTE.accentSage }}>Reset</span>
          </h1>
        </Link>

        <div className="mb-8">
          <Checkbox checked={tcAccepted} onChange={setTcAccepted}>
            I agree to the{' '}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
              style={{ color: PALETTE.accent }}
            >
              Terms of Service
            </Link>
          </Checkbox>
          <Checkbox checked={privacyAccepted} onChange={setPrivacyAccepted}>
            I agree to the{' '}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
              style={{ color: PALETTE.accent }}
            >
              Privacy Policy
            </Link>
          </Checkbox>
        </div>

        {ready ? (
          <SignUp
            appearance={{
              variables: {
                colorPrimary: PALETTE.accent,
                colorBackground: PALETTE.bgCard,
                colorText: PALETTE.text,
                colorTextSecondary: PALETTE.textMuted,
                colorInputBackground: '#FFFFFF',
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
            Please accept both the Terms of Service and the Privacy Policy to continue.
          </p>
        )}

        <Footer />
      </div>
    </main>
  );
}
