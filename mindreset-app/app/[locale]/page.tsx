import type { Metadata } from 'next';
import LandingPage from '@/components/Landing';
import Footer from '@/components/Footer';
import TestimonialsSection from '@/components/TestimonialsSection';
import { pageAlternates } from '@/lib/seo/alternates';
import { getApprovedTestimonials } from '@/lib/testimonials/queries';

// The Landing page is the SEO-most-important page. Title + OG defaults
// from [locale]/layout.tsx are already correct for this page; we only
// need to declare alternates so hreflang tags resolve to the right URLs
// for every locale variant. generateMetadata (not static metadata) is
// required so we can pass `params.locale` to pageAlternates — that
// makes the canonical URL locale-correct (/ru/, /it/, etc.), preventing
// Google from merging non-EN locales into the EN canonical.
export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return {
    alternates: pageAlternates('/', params.locale),
  };
}

// Phase i18n.1d.2 — Footer (server-async component using getTranslations)
// is pre-rendered here and passed as a slot prop, because LandingPage
// is a client component and can't render server-async components
// inline. Same slot-prop pattern Account and Sign-up use.
//
// Testimonials slot — server-fetched. Renders nothing when there are
// fewer than 3 approved testimonials in the current locale.
export default async function Home({ params }: { params: { locale: string } }) {
  const testimonials = await getApprovedTestimonials(params.locale);
  return (
    <LandingPage
      footerSlot={<Footer />}
      testimonialsSlot={<TestimonialsSection testimonials={testimonials} />}
    />
  );
}
