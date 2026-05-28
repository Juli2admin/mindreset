import type { Metadata } from 'next';
import LandingPage from '@/components/Landing';
import Footer from '@/components/Footer';
import { pageAlternates } from '@/lib/seo/alternates';

// The Landing page is the SEO-most-important page. Title + OG defaults
// from [locale]/layout.tsx are already correct for this page; we only
// need to declare alternates so hreflang tags resolve to the right URLs
// for every locale variant.
export const metadata: Metadata = {
  alternates: pageAlternates('/'),
};

// Phase i18n.1d.2 — Footer (server-async component using getTranslations)
// is pre-rendered here and passed as a slot prop, because LandingPage
// is a client component and can't render server-async components
// inline. Same slot-prop pattern Account and Sign-up use.
export default function Home() {
  return <LandingPage footerSlot={<Footer />} />;
}
