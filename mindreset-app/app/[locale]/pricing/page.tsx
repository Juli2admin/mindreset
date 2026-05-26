import { currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import PricingClient from './PricingClient';
import Footer from '@/components/Footer';

export const dynamic = 'force-dynamic';

// /pricing is public — signed-out prospects can view plans before
// signing up. Buy buttons in PricingClient detect anonymous state via
// Clerk's useUser hook and redirect to /sign-up instead of calling the
// checkout API. Signed-in users see Active / Manage subscription state
// driven by their current tier.
export default async function PricingPage() {
  const user = await currentUser();

  let currentTier: string | null = null;
  if (user) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { currentTier: true },
    });
    currentTier = dbUser?.currentTier ?? null;
  }

  return (
    <PricingClient
      currentTier={currentTier}
      footerSlot={<Footer />}
    />
  );
}
