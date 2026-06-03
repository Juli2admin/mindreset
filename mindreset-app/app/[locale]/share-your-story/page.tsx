import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TOKENS } from '@/lib/brand/colors';
import { getServerPalette } from '@/lib/theme/server';
import { pageAlternates } from '@/lib/seo/alternates';
import Footer from '@/components/Footer';
import TopBar from '@/components/TopBar';
import ShareYourStoryClient from './ShareYourStoryClient';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations('ShareYourStory');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: pageAlternates('/share-your-story', params.locale),
  };
}

export default async function ShareYourStoryPage() {
  const t = await getTranslations('ShareYourStory');
  const PALETTE = getServerPalette();

  return (
    <main className="min-h-screen" style={{ background: PALETTE.bg }}>
      <div className="max-w-2xl mx-auto px-6 py-4">
        <TopBar />
      </div>
      <div className="max-w-2xl mx-auto px-6 pb-12 sm:pb-16">
        <div className="mt-8 mb-10">
          <div
            className="text-[11px] uppercase tracking-[0.22em] mb-3"
            style={{ color: PALETTE.accent, fontFamily: SANS, fontWeight: 500 }}
          >
            {t('kicker')}
          </div>
          <h1
            className="text-[32px] sm:text-[40px] leading-[1.15] mb-5"
            style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
          >
            {t('title')}
          </h1>
          <p
            className="text-[16px] leading-[1.7] mb-3"
            style={{ color: PALETTE.textMuted, fontFamily: SANS }}
          >
            {t('intro1')}
          </p>
          <p
            className="text-[16px] leading-[1.7]"
            style={{ color: PALETTE.textMuted, fontFamily: SANS }}
          >
            {t('intro2')}
          </p>
        </div>

        <ShareYourStoryClient />

        <div className="mt-16">
          <Footer />
        </div>
      </div>
    </main>
  );
}
