import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TOKENS } from '@/lib/brand/colors';
import { getServerPalette } from '@/lib/theme/server';
import { pageAlternates } from '@/lib/seo/alternates';
import Footer from '@/components/Footer';
import MarketingTopBar from '@/components/MarketingTopBar';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

// Fixed order — keys must match Faq.items.<slug> in messages/*.json.
const FAQ_SLUGS = [
  'whatIsMindReset',
  'isTherapy',
  'whatIsMiniMind',
  'howToStart',
  'voiceInput',
  'isItFree',
  'afterFreeMessages',
  'essentialVsExtended',
  'whatIsTopUp',
  'willIBeCharged',
  'howToCancel',
  'isPrivate',
  'whoCanSee',
  'retention',
  'canDelete',
  'medicalAdvice',
  'crisisHelp',
  'ageRequirement',
  'languages',
  'mobileUse',
  'contact',
] as const;

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations('Faq');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: pageAlternates('/faq', params.locale),
  };
}

export default async function FaqPage() {
  const t = await getTranslations('Faq');
  // Per-request palette from the mr_theme cookie. Defined inside the
  // page function so the helpers below close over the current value;
  // server components can't useTheme(), so the closure pattern is the
  // mechanism that makes server pages theme-reactive.
  const PALETTE = getServerPalette();

  function H2({ children }: { children: ReactNode }) {
    return (
      <h2
        className="text-[28px] sm:text-[36px] leading-[1.15] mb-6"
        style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
      >
        {children}
      </h2>
    );
  }

  function H3({ id, children }: { id?: string; children: ReactNode }) {
    return (
      <h3
        id={id}
        className="text-[22px] leading-[1.3] mt-12 mb-4 scroll-mt-8"
        style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
      >
        {children}
      </h3>
    );
  }

  function P({ children }: { children: ReactNode }) {
    return (
      <p
        className="text-[16px] leading-[1.7] mb-4"
        style={{ fontFamily: SANS, color: PALETTE.text }}
      >
        {children}
      </p>
    );
  }

  // FAQPage structured data — Google can show our FAQ entries directly
  // in search results as expandable accordions. One Question/Answer pair
  // per FAQ slug, in the active locale.
  const faqStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_SLUGS.map((slug) => ({
      '@type': 'Question',
      name: t(`items.${slug}.question`),
      acceptedAnswer: {
        '@type': 'Answer',
        text: t(`items.${slug}.answer`),
      },
    })),
  };

  return (
    <main className="min-h-screen" style={{ background: PALETTE.bg }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      <div className="max-w-3xl mx-auto px-6 py-4">
        <MarketingTopBar />
      </div>
      <div className="max-w-3xl mx-auto px-6 pb-12 sm:pb-16">
        <article className="mb-8">
          <H2>{t('pageTitle')}</H2>

          {FAQ_SLUGS.map((slug) => (
            <section key={slug}>
              <H3 id={slug}>{t(`items.${slug}.question`)}</H3>
              <P>{t(`items.${slug}.answer`)}</P>
            </section>
          ))}
        </article>

        <Footer omit="faq" />
      </div>
    </main>
  );
}
