import type { Metadata } from 'next';
import ScreeningFlow from '@/components/Screening';
import Footer from '@/components/Footer';
import { pageAlternates } from '@/lib/seo/alternates';

export const metadata: Metadata = {
  title: 'Readiness Check',
  description:
    'A short, trauma-informed check before you begin. Helps clarify whether MindReset is appropriate for you right now.',
  alternates: pageAlternates('/screening'),
};

export default function ScreeningPage() {
  // Footer is an async server component; we render it here and pass it
  // through as a slot prop so the client ScreeningFlow can place it
  // without losing server-side translation. See components/Footer.tsx.
  return <ScreeningFlow footerSlot={<Footer />} />;
}
