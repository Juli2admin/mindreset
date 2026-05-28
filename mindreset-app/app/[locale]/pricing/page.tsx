import type { Metadata } from 'next';
import { currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import PricingClient from './PricingClient';
import Footer from '@/components/Footer';
import TestimonialsSection from '@/components/TestimonialsSection';
import { pageAlternates } from '@/lib/seo/alternates';
import { getApprovedTestimonials } from '@/lib/testimonials/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'MiniMind Essential and Extended subscriptions. Message top-up. Free 50-message taster with every new account — no card required.',
  alternates: pageAlternates('/pricing'),
};

// /pricing is public — signed-out prospects can view plans before
// signing up. Buy buttons in PricingClient detect anonymous state via
// Clerk's useUser hook and redirect to /sign-up instead of calling the
// checkout API. Signed-in users see Active / Manage subscription state
// driven by their current tier.
export default async function PricingPage({ params }: { params: { locale: string } }) {
  const user = await currentUser();

  let currentTier: string | null = null;
  if (user) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { currentTier: true },
    });
    currentTier = dbUser?.currentTier ?? null;
  }

  const testimonials = await getApprovedTestimonials(params.locale);

  return (
    <PricingClient
      currentTier={currentTier}
      footerSlot={<Footer />}
      testimonialsSlot={<TestimonialsSection testimonials={testimonials} />}
    />
  );
}
