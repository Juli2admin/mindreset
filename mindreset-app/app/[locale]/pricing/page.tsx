import type { Metadata } from 'next';
import { currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import PricingClient from './PricingClient';
import Footer from '@/components/Footer';
import TestimonialsSection from '@/components/TestimonialsSection';
import { pageAlternates, SITE_URL } from '@/lib/seo/alternates';
import { getApprovedTestimonials } from '@/lib/testimonials/queries';

export const dynamic = 'force-dynamic';

// Product JSON-LD for /pricing — gives Google enough structured data to
// render rich snippets (price + currency + availability) in search
// results. Three Offers cover MiniMind Essential, MiniMind Extended,
// and the message top-up. Prices are GBP, monthly recurring + one-off.
// Schema.org Product + Offer is the conventional shape Google expects.
const PRODUCT_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'MindReset MiniMind',
  description:
    'AI companion for daily reflection. Trauma-informed, self-guided, UK-based. Subscription with a free 50-message taster.',
  brand: { '@type': 'Brand', name: 'MindReset.ai' },
  url: `${SITE_URL}/pricing`,
  offers: [
    {
      '@type': 'Offer',
      name: 'MiniMind Essential — monthly',
      price: '14.99',
      priceCurrency: 'GBP',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/pricing`,
    },
    {
      '@type': 'Offer',
      name: 'MiniMind Extended — monthly',
      price: '24.99',
      priceCurrency: 'GBP',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/pricing`,
    },
    {
      '@type': 'Offer',
      name: 'Message top-up',
      price: '4.99',
      priceCurrency: 'GBP',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/pricing`,
    },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return {
    // Phase B item 4: title.absolute bypasses the layout's "%s · MindReset.ai"
    // template so the full title sits keywords-first with brand at end.
    // Exact-match for "MindReset pricing" branded commercial-intent query.
    title: {
      absolute: 'MindReset pricing — MiniMind from £14.99/month, free taster',
    },
    description:
      'Choose how to begin: MiniMind from £14.99/month, focused modules, and the eight-stage method. Free 50-message taster, no card.',
    alternates: pageAlternates('/pricing', params.locale),
  };
}

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
    <>
      {/* Product JSON-LD: Google indexes structured data from the initial
          HTML response. Rendered inline (not via next/script) so it's
          present on first crawl, no JS execution required. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(PRODUCT_JSONLD) }}
      />
      <PricingClient
        currentTier={currentTier}
        footerSlot={<Footer />}
        testimonialsSlot={<TestimonialsSection testimonials={testimonials} />}
      />
    </>
  );
}
