import { SignIn } from '@clerk/nextjs';
// Phase i18n.1b — locale-aware Link.
import { Link } from '@/i18n/navigation';
import { PALETTE as FULL_PALETTE, TOKENS } from '@/lib/brand/colors';
import Footer from '@/components/Footer';

const PALETTE = FULL_PALETTE.day;

export default function SignInPage() {
  return (
    <main className="min-h-screen flex flex-col items-center" style={{ background: PALETTE.bg }}>
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
        <SignIn
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
        <Footer />
      </div>
    </main>
  );
}
