import { PALETTE as FULL_PALETTE, TOKENS } from '@/lib/brand/colors';
import { Link } from '@/i18n/navigation';
import TopBar from '@/components/TopBar';
import Footer from '@/components/Footer';

const PALETTE = FULL_PALETTE.day;
const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

export const metadata = {
  title: 'Payment successful — MindReset',
};

export default function CheckoutSuccessPage() {
  return (
    <main className="min-h-screen" style={{ background: PALETTE.bg }}>
      <div className="max-w-2xl mx-auto px-6 py-4">
        <TopBar />
      </div>
      <div className="max-w-2xl mx-auto px-6 pb-12 sm:pb-16">
        <div className="mt-20 mb-16">
          <p
            className="text-[11px] uppercase tracking-[0.22em] mb-6"
            style={{ color: PALETTE.accent, fontFamily: SANS, fontWeight: 500 }}
          >
            Payment complete
          </p>
          <h1
            className="text-[36px] leading-[1.15] mb-6"
            style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
          >
            You&rsquo;re all set.
          </h1>
          <p
            className="text-[16px] leading-[1.7] mb-10"
            style={{ color: PALETTE.textMuted, fontFamily: SANS }}
          >
            Your purchase is confirmed. Subscription access activates within a
            few seconds — head to your account to get started.
          </p>
          <Link
            href="/account"
            className="inline-block px-8 py-3 rounded-full text-[14px]"
            style={{
              background: PALETTE.accent,
              color: PALETTE.accentText,
              fontFamily: SANS,
              fontWeight: 500,
            }}
          >
            Go to your account →
          </Link>
        </div>
        <Footer />
      </div>
    </main>
  );
}
