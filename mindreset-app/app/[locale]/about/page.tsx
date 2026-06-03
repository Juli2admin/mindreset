import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { TOKENS } from '@/lib/brand/colors';
import { getServerPalette } from '@/lib/theme/server';
import { pageAlternates } from '@/lib/seo/alternates';
import Footer from '@/components/Footer';
import TopBar from '@/components/TopBar';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'About' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: pageAlternates('/about', params.locale),
  };
}

// /about — founder origin story + method overview. Trauma-informed,
// experience-language only (no therapeutic outcome claims), women-focused
// brand voice. Visual style matches Terms / Privacy: serif headings on
// the brand bg, sans body, italic pull quotes with accent rule. Renders
// in all 8 locales via the same translation namespace.
export default async function AboutPage() {
  const t = await getTranslations('About');
  const PALETTE = getServerPalette();

  // Typography helpers — same pattern as terms/page.tsx and privacy/page.tsx
  // so the brand voice reads consistently across all long-form pages.
  function H2({ children }: { children: ReactNode }) {
    return (
      <h2
        className="text-[34px] sm:text-[44px] leading-[1.1] mb-6"
        style={{ fontFamily: SERIF, fontWeight: 300, fontStyle: 'italic', color: PALETTE.text }}
      >
        {children}
      </h2>
    );
  }
  function SectionLabel({ children }: { children: ReactNode }) {
    return (
      <div
        className="text-[11px] uppercase tracking-[0.22em] mb-6"
        style={{ color: PALETTE.accent, fontFamily: SANS, fontWeight: 500 }}
      >
        {children}
      </div>
    );
  }
  function P({ children }: { children: ReactNode }) {
    return (
      <p
        className="text-[16px] leading-[1.9] mb-6"
        style={{ fontFamily: SANS, color: PALETTE.text }}
      >
        {children}
      </p>
    );
  }
  function PullQuote({ children }: { children: ReactNode }) {
    return (
      <blockquote
        className="my-10 pl-7 text-[22px] sm:text-[26px] leading-[1.4]"
        style={{
          fontFamily: SERIF,
          fontStyle: 'italic',
          fontWeight: 300,
          color: PALETTE.accent,
          borderLeft: `2px solid ${PALETTE.accent}`,
        }}
      >
        {children}
      </blockquote>
    );
  }
  function Divider() {
    return (
      <hr
        className="my-14 border-0 w-12"
        style={{ borderTop: `1px solid ${PALETTE.accent}` }}
      />
    );
  }

  return (
    <main className="min-h-screen" style={{ background: PALETTE.bg }}>
      <div className="max-w-3xl mx-auto px-6 py-4">
        <TopBar />
      </div>

      {/* Hero */}
      <section className="px-6 pt-12 pb-16 sm:pt-20 sm:pb-24 text-center">
        <div
          className="text-[11px] uppercase tracking-[0.32em] mb-6"
          style={{ color: PALETTE.accent, fontFamily: SANS, fontWeight: 500 }}
        >
          {t('hero.label')}
        </div>
        <h1
          className="text-[44px] sm:text-[60px] leading-[1.05] max-w-2xl mx-auto mb-6"
          style={{
            fontFamily: SERIF,
            fontWeight: 300,
            fontStyle: 'italic',
            color: PALETTE.text,
          }}
        >
          {t('hero.title')}
        </h1>
        <p
          className="text-[15px] max-w-md mx-auto"
          style={{ color: PALETTE.textMuted, fontFamily: SANS, lineHeight: 1.6 }}
        >
          {t('hero.subtitle')}
        </p>
      </section>

      {/* Story */}
      <article className="max-w-2xl mx-auto px-6 pb-12 sm:pb-16">
        <SectionLabel>{t('howItBegan.label')}</SectionLabel>
        <P>{t('howItBegan.p1')}</P>
        <PullQuote>{t('howItBegan.pullQuote')}</PullQuote>
        <P>{t('howItBegan.p2')}</P>
        <P>{t('howItBegan.p3')}</P>

        <Divider />

        <SectionLabel>{t('whyItWorks.label')}</SectionLabel>
        <P>{t('whyItWorks.p1')}</P>
        <P>{t('whyItWorks.p2')}</P>
        <PullQuote>{t('whyItWorks.pullQuote')}</PullQuote>
        <P>{t('whyItWorks.p3')}</P>
        <P>{t('whyItWorks.p4')}</P>
      </article>

      {/* Results — what women describe */}
      <section
        className="px-6 py-16 sm:py-20"
        style={{ background: PALETTE.bgSubtle }}
      >
        <div className="max-w-3xl mx-auto text-center">
          <H2>{t('results.title')}</H2>
          <p
            className="text-[14px] mb-12 max-w-md mx-auto"
            style={{ color: PALETTE.textMuted, fontFamily: SANS, lineHeight: 1.6 }}
          >
            {t('results.subtitle')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
            {(['card1', 'card2', 'card3', 'card4'] as const).map((key) => (
              <div
                key={key}
                className="rounded-2xl p-6"
                style={{ background: PALETTE.bgCard, border: `1px solid ${PALETTE.border}` }}
              >
                <p
                  className="text-[15px] leading-[1.6]"
                  style={{ color: PALETTE.text, fontFamily: SANS }}
                >
                  {t(`results.${key}`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="px-6 py-20 sm:py-24 text-center"
        style={{ background: PALETTE.text, color: PALETTE.bg }}
      >
        <h2
          className="text-[36px] sm:text-[48px] leading-[1.1] max-w-xl mx-auto mb-4"
          style={{ fontFamily: SERIF, fontWeight: 300, fontStyle: 'italic' }}
        >
          {t('cta.title')}
        </h2>
        <p
          className="text-[14px] max-w-md mx-auto mb-10"
          style={{ color: PALETTE.textHint, fontFamily: SANS, lineHeight: 1.6 }}
        >
          {t('cta.body')}
        </p>
        <Link
          href="/sign-up"
          className="inline-block rounded-full px-10 py-4 text-[13px] uppercase tracking-[0.18em]"
          style={{
            background: PALETTE.accent,
            color: PALETTE.accentText,
            fontFamily: SANS,
            fontWeight: 500,
          }}
        >
          {t('cta.button')}
        </Link>
      </section>

      <Footer />
    </main>
  );
}
