import LandingPage from '@/components/Landing';
import Footer from '@/components/Footer';

// Phase i18n.1d.2 — Footer (server-async component using getTranslations)
// is pre-rendered here and passed as a slot prop, because LandingPage
// is a client component and can't render server-async components
// inline. Same slot-prop pattern Account and Sign-up use.
export default function Home() {
  return <LandingPage footerSlot={<Footer />} />;
}
