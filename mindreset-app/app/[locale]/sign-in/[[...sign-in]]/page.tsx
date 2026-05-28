import { SignIn } from '@clerk/nextjs';
import { TOKENS } from '@/lib/brand/colors';
import { getServerPalette } from '@/lib/theme/server';
import Footer from '@/components/Footer';
import TopBar from '@/components/TopBar';

export default function SignInPage() {
  const PALETTE = getServerPalette();
  return (
    <main className="min-h-screen flex flex-col items-center" style={{ background: PALETTE.bg }}>
      <div className="w-full max-w-md px-6 py-12 sm:py-20">
        {/* Phase 1d.2 — TopBar centered: wordmark only, no picker.
            Locked decision: trauma-informed friction-point clean-up at
            the sign-up/sign-in step. User reaches the picker via Footer
            or by navigating back to a regular page. */}
        <TopBar align="centered" />
        <div className="mt-10">
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
        </div>
        <Footer />
      </div>
    </main>
  );
}
