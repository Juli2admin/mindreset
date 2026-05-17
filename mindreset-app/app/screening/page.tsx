import ScreeningFlow from '@/components/Screening';
import Footer from '@/components/Footer';

export default function ScreeningPage() {
  // Footer is an async server component; we render it here and pass it
  // through as a slot prop so the client ScreeningFlow can place it
  // without losing server-side translation. See components/Footer.tsx.
  return <ScreeningFlow footerSlot={<Footer />} />;
}
