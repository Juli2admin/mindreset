import type { Metadata } from 'next';
import { getServerPalette } from '@/lib/theme/server';
import { TOKENS } from '@/lib/brand/colors';
import TopBar from '@/components/TopBar';
import ConfirmDeleteClient from './ConfirmDeleteClient';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

export const metadata: Metadata = {
  title: 'Confirm account deletion',
  robots: { index: false, follow: false },
};

// Lands the user from the email confirmation link. The client component
// reads the token from the URL, calls /api/account/confirm-delete, signs
// the user out via Clerk, and shows a success state with the scheduled
// deletion date.
export default function ConfirmDeletePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const PALETTE = getServerPalette();
  const token = searchParams.token ?? null;

  return (
    <main className="min-h-screen" style={{ background: PALETTE.bg }}>
      <div className="max-w-2xl mx-auto px-6 py-4">
        <TopBar />
      </div>
      <div className="max-w-2xl mx-auto px-6 pb-12 sm:pb-16">
        <h1
          className="text-[32px] sm:text-[36px] leading-[1.15] mb-6 mt-12"
          style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
        >
          Confirm account deletion
        </h1>
        <ConfirmDeleteClient token={token} />
      </div>
    </main>
  );
}
