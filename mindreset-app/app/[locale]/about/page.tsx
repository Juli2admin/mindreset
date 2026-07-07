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

// /about — founder-voice essay: why The Journey exists. Structure follows
// the FINAL About-page spec: hero (opening stanzas) → search → methodology
// → technology → what it is → what people discover → welcome CTA.
// Typography helpers preserved from the previous About design so the visual
// language stays consistent with Terms / Privacy.
export default async function AboutPage() {
  const t = await getTranslations('About');
  const PALETTE = getServerPalette();

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
  function P({ children }: { children: ReactNode }) {
    return (
      <p
        className="text-[16px] leading-[1.9] mb-6"
        style={{ fontFamily: SANS, color: PALETTE.text, whiteSpace: 'pre-line' }}
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
  function BlockParagraphs({ paragraphs }: { paragraphs: string[] }) {
    return (
      <>
        {paragraphs.map((paragraph, i) => (
          <P key={i}>{paragraph}</P>
        ))}
      </>
    );
  }

  const openingStanzas = t.raw('hero.opening') as string[];
  const searchParagraphs = t.raw('search.paragraphs') as string[];
  const methodologyParagraphs = t.raw('methodology.paragraphs') as string[];
  const technologyParagraphs = t.raw('technology.paragraphs') as string[];
  const whatItIsParagraphs = t.raw('whatItIs.paragraphs') as string[];
  const discoverParagraphs = t.raw('discover.paragraphs') as string[];

  return (
    <main className="min-h-screen" style={{ background: PALETTE.bg }}>
      <div className="max-w-3xl mx-auto px-6 py-4">
        <TopBar />
      </div>

      {/* Hero — label + serif title + opening stanzas */}
      <section className="px-6 pt-12 pb-16 sm:pt-20 sm:pb-24 text-center">
        <div
          className="text-[11px] uppercase tracking-[0.32em] mb-6"
          style={{ color: PALETTE.accent, fontFamily: SANS, fontWeight: 500 }}
        >
          {t('hero.label')}
        </div>
        <h1
          className="text-[44px] sm:text-[60px] leading-[1.05] max-w-2xl mx-auto mb-10"
          style={{
            fontFamily: SERIF,
            fontWeight: 300,
            fontStyle: 'italic',
            color: PALETTE.text,
          }}
        >
          {t('hero.title')}
        </h1>
        <div className="max-w-xl mx-auto space-y-6">
          {openingStanzas.map((stanza, i) => (
            <p
              key={i}
              className="text-[16px] sm:text-[17px]"
              style={{
                color: PALETTE.textMuted,
                fontFamily: SANS,
                lineHeight: 1.75,
                whiteSpace: 'pre-line',
              }}
            >
              {stanza}
            </p>
          ))}
        </div>
      </section>

      {/* Article — 5 prose blocks with dividers */}
      <article className="max-w-2xl mx-auto px-6 pb-4 sm:pb-8">
        {/* Block 1 — The search (no heading) */}
        <BlockParagraphs paragraphs={searchParagraphs} />

        <Divider />

        {/* Block 2 — A methodology built on established knowledge */}
        <H2>{t('methodology.heading')}</H2>
        <BlockParagraphs paragraphs={methodologyParagraphs} />
        <PullQuote>{t('methodology.pullQuote')}</PullQuote>

        <Divider />

        {/* Block 3 — Why technology became part of the method */}
        <H2>{t('technology.heading')}</H2>
        <BlockParagraphs paragraphs={technologyParagraphs} />
        <PullQuote>{t('technology.pullQuote')}</PullQuote>

        <Divider />

        {/* Block 4 — What The Journey is */}
        <H2>{t('whatItIs.heading')}</H2>
        <BlockParagraphs paragraphs={whatItIsParagraphs} />

        <Divider />

        {/* Block 5 — What I hope people discover */}
        <H2>{t('discover.heading')}</H2>
        <BlockParagraphs paragraphs={discoverParagraphs} />
      </article>

      {/* Block 6 — Welcome (dark CTA panel, existing design) */}
      <section
        className="px-6 py-20 sm:py-24 text-center"
        style={{ background: PALETTE.text, color: PALETTE.bg }}
      >
        <h2
          className="text-[36px] sm:text-[48px] leading-[1.1] max-w-xl mx-auto mb-6"
          style={{ fontFamily: SERIF, fontWeight: 300, fontStyle: 'italic' }}
        >
          {t('welcome.heading')}
        </h2>
        <p
          className="text-[15px] max-w-lg mx-auto mb-10"
          style={{
            color: PALETTE.textHint,
            fontFamily: SANS,
            lineHeight: 1.75,
            whiteSpace: 'pre-line',
          }}
        >
          {t('welcome.body')}
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
          {t('welcome.button')}
        </Link>
      </section>

      <Footer />
    </main>
  );
}
