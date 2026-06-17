import type { Metadata } from 'next';
import LandingPage from '@/components/Landing';
import Footer from '@/components/Footer';
import TestimonialsSection from '@/components/TestimonialsSection';
import { pageAlternates } from '@/lib/seo/alternates';
import { getApprovedTestimonials } from '@/lib/testimonials/queries';

// The Landing page is the SEO-most-important page. Phase B item 3
// override:
//   - title.absolute bypasses the layout's `%s · MindReset.ai` template
//     so the full title sits keywords-first, brand at end. Keywords-
//     first is the right play for a low-domain-authority brand: Google
//     ranks on what's most-relevant in the title's leftmost portion.
//   - description targets real search queries from women in midlife
//     (the "feel stuck" + "self-help wellbeing" search clusters).
//     Mentions all three products generically + the free taster CTA.
//   - alternates stays — hreflang tags resolve to the right URLs per
//     locale variant. generateMetadata (not static metadata) is
//     required so we can pass params.locale to pageAlternates,
//     locale-correcting the canonical URL.
export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return {
    title: {
      absolute: 'Self-help wellbeing for women in midlife · MindReset.ai',
    },
    description:
      "A self-help wellbeing companion for women in midlife who feel stuck. Daily check-ins, focused modules, and an eight-stage method. Free 50-message taster.",
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
