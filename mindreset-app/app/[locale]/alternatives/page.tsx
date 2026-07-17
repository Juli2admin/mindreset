// /alternatives — public, comparison-shopper capture surface.
//
// Phase B item 7 of the SEO foundation. Visitors who search
// "MindReset alternatives" or "wellbeing app for midlife women" land
// here. Honestly lists the named tools in the space, what each is
// best for, and where MindReset fits — so the SEO juice doesn't
// route to third-party "Best Headspace alternatives" roundups.
//
// All competitor descriptions follow the two-tier positioning
// canonical locked in PR #148:
//   - No therapy-price comparisons anywhere
//   - "Therapist" word never describes any MindReset product
//   - Wysa/Woebot framed as THEIR claims, not stated as fact
//   - Competitor prices vague ("Premium subscription")
//   - Brand names (Headspace, Calm, Wysa, Woebot, BetterHelp,
//     Talkspace, Insight Timer, Ten Percent Happier) named
//     factually for AI-search keyword surface

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { setRequestLocale } from 'next-intl/server';
import MarketingTopBar from '@/components/MarketingTopBar';
import Footer from '@/components/Footer';
import { Link } from '@/i18n/navigation';
import { pageAlternates } from '@/lib/seo/alternates';
import { TOKENS } from '@/lib/brand/colors';
import { COMPARISONS } from '@/lib/competitors';

/**
 * Returns the /vs slug for a competitor name if a comparison page
 * exists; undefined otherwise. Match is case-insensitive on the name
 * because the alternatives copy uses display names ("Wysa") and the
 * registry uses lowercase slugs ("wysa").
 */
function comparisonSlugForCompetitor(name: string): string | undefined {
  const lc = name.toLowerCase();
  return COMPARISONS.find((c) => c.name.toLowerCase() === lc)?.slug;
}

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'Alternatives' });
  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
    alternates: pageAlternates('/alternatives', params.locale),
  };
}

type Competitor = {
  name: string;
  bestFor: string;
  description: string;
};

export default async function AlternativesPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('Alternatives');
  const introParagraphs = t.raw('introParagraphs') as string[];
  const competitors = t.raw('competitors') as Competitor[];
  const mindreset = t.raw('mindresetBlock') as Omit<Competitor, 'name'> & { name: string };

  return (
    <main className="min-h-screen" style={{ background: '#F4F1EA', color: '#393939' }}>
      <div className="max-w-2xl mx-auto px-6 py-4">
        <MarketingTopBar />
      </div>
      <div className="max-w-2xl mx-auto px-6 pb-12 sm:pb-16">
        {/* Kicker */}
        <div
          className="text-[11px] uppercase tracking-[0.22em] mb-6"
          style={{ color: '#2D7A85', fontWeight: 500, fontFamily: SANS }}
        >
          {t('kicker')}
        </div>

        {/* H1 */}
        <h1
          className="text-[36px] sm:text-[44px] leading-[1.05] -tracking-[0.018em] mb-10"
          style={{ fontFamily: SERIF, fontWeight: 400, color: '#222' }}
        >
          {t('pageTitle')}
        </h1>

        {/* Intro */}
        <div className="space-y-4 mb-12 max-w-[36rem]">
          {introParagraphs.map((p, i) => (
            <p
              key={i}
              className="text-[16px] leading-[1.65]"
              style={{ color: '#555', fontFamily: SANS }}
            >
              {p}
            </p>
          ))}
        </div>

        {/* MindReset's own block at top — Best for + MiniMind+Journey line + CTA */}
        <section
          className="mb-16 pt-8"
          style={{ borderTop: `2px solid #2D7A85` }}
        >
          <h2
            className="text-[24px] sm:text-[28px] mb-3 -tracking-[0.01em]"
            style={{ fontFamily: SERIF, fontWeight: 500, color: '#222' }}
          >
            {mindreset.name}
          </h2>
          <p
            className="text-[15px] leading-[1.6] mb-3"
            style={{ color: '#2D7A85', fontFamily: SANS, fontWeight: 500 }}
          >
            {mindreset.bestFor}
          </p>
          <p
            className="text-[16px] leading-[1.65] mb-6 max-w-[36rem]"
            style={{ color: '#393939', fontFamily: SANS }}
          >
            {mindreset.description}
          </p>
          <Link
            href="/minimind"
            className="inline-flex items-center gap-2 h-12 px-6 rounded-full text-[14px] tracking-wide"
            style={{
              fontFamily: SANS,
              fontWeight: 500,
              background: '#2D7A85',
              color: '#F4F1EA',
            }}
          >
            {t('ctaTryFree')}
          </Link>
        </section>

        {/* Listing header */}
        <h2
          className="text-[24px] sm:text-[28px] mb-8 -tracking-[0.01em]"
          style={{ fontFamily: SERIF, fontWeight: 400, color: '#222' }}
        >
          {t('listingHeader')}
        </h2>

        {/* Competitor list — same row treatment as MindReset, lighter visual.
            When a /vs/{slug} comparison page exists for the competitor, a
            small "Read full comparison →" link appears below the
            description routing to the deeper page. The link only renders
            for competitors that have been written up — most rows stay
            link-free until their dedicated page ships. */}
        <div className="space-y-10 mb-16">
          {competitors.map((c) => {
            const compareSlug = comparisonSlugForCompetitor(c.name);
            return (
              <div
                key={c.name}
                className="pt-8"
                style={{ borderTop: `1px solid #D4D0C5` }}
              >
                <h3
                  className="text-[20px] sm:text-[22px] mb-3"
                  style={{ fontFamily: SERIF, fontWeight: 500, color: '#222' }}
                >
                  {c.name}
                </h3>
                <p
                  className="text-[14px] leading-[1.6] mb-3"
                  style={{ color: '#6A6A6A', fontFamily: SANS }}
                >
                  {c.bestFor}
                </p>
                <p
                  className="text-[15px] leading-[1.65] mb-3"
                  style={{ color: '#555', fontFamily: SANS }}
                >
                  {c.description}
                </p>
                {compareSlug && (
                  <Link
                    href={`/vs/${compareSlug}`}
                    className="inline-block text-[14px] hover:no-underline underline underline-offset-4"
                    style={{ color: '#2D7A85', fontFamily: SANS, fontWeight: 500 }}
                  >
                    {t('readFullComparison', { competitor: c.name })}
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Closing block */}
        <section
          className="pt-10 pb-6"
          style={{ borderTop: `2px solid #2D7A85` }}
        >
          <h2
            className="text-[28px] sm:text-[32px] leading-[1.15] mb-5 -tracking-[0.01em]"
            style={{ fontFamily: SERIF, fontWeight: 400, color: '#222' }}
          >
            {t('closingTitle')}
          </h2>
          <p
            className="text-[16px] leading-[1.65] mb-8 max-w-[36rem]"
            style={{ color: '#393939', fontFamily: SANS }}
          >
            {t('closingBody')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/minimind"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full text-[14px] tracking-wide"
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                background: '#2D7A85',
                color: '#F4F1EA',
              }}
            >
              {t('ctaTryFree')}
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full text-[14px] tracking-wide"
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                background: 'transparent',
                color: '#2D7A85',
                border: '1px solid #2D7A85',
              }}
            >
              {t('ctaReadMore')}
            </Link>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}
