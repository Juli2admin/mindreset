import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';

const PALETTE = {
  bg: '#F4F1EA',
  bgCard: '#FFFFFF',
  text: '#393939',
  textMuted: '#6A6A6A',
  border: '#D9D2C2',
  accent: '#2D7A85',
  accentSage: '#5C8A75',
};

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex flex-col items-center" style={{ background: PALETTE.bg }}>
      <div className="w-full max-w-md px-6 py-12 sm:py-20">
        <Link href="/" className="block mb-10 text-center">
          <h1
            className="text-[28px] tracking-tight"
            style={{ fontFamily: '"Fraunces", serif', fontWeight: 400 }}
          >
            <span style={{ color: PALETTE.accent }}>Mind</span>
            <span style={{ color: PALETTE.accentSage }}>Reset</span>
          </h1>
        </Link>
        <SignUp
          appearance={{
            variables: {
              colorPrimary: PALETTE.accent,
              colorBackground: PALETTE.bgCard,
              colorText: PALETTE.text,
              colorTextSecondary: PALETTE.textMuted,
              colorInputBackground: '#FFFFFF',
              colorInputText: PALETTE.text,
              fontFamily: '"Geist", -apple-system, system-ui, sans-serif',
              borderRadius: '10px',
            },
            elements: {
              card: {
                boxShadow: 'none',
                border: `1px solid ${PALETTE.border}`,
                background: PALETTE.bgCard,
              },
              headerTitle: { fontFamily: '"Fraunces", serif', fontWeight: 400 },
              formButtonPrimary: { fontWeight: 500 },
              footerActionLink: { color: PALETTE.accent },
            },
          }}
        />
      </div>
    </main>
  );
}
