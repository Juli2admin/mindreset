// /vs/[slug] — head-to-head competitor comparison page.
//
// Phase E step 3. Dynamic route serving each entry in
// lib/competitors/index.ts. Static-generated via generateStaticParams
// so every locale × every competitor slug is built at deploy time.
//
// Disambiguation strategy — "MindReset" is a common phrase and other
// sites use the name. To pin search + AI engines to OUR MindReset:
//   1. The .ai TLD is the distinguishing mark — used in H1, title tag,
//      and every first reference in the prose.
//   2. A human-visible byline under the H1 names the founder + UK
//      geography, reinforcing the Organization JSON-LD in the layout.
//   3. The per-page WebPage JSON-LD lists both Organizations with
//      canonical @id URLs, so AI retrievers can pin entity identity.
//
// House style mirrors /alternatives and /journal/[slug]:
//   - Serif H1, kicker above
//   - Sans body, generous line-height
//   - Section H2 in serif mid-weight
//   - "Fits when" bullets in sans
//   - Brand-accent CTA + secondary outline CTA

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import TopBar from '@/components/TopBar';
import Footer from '@/components/Footer';
import { pageAlternates, SITE_URL } from '@/lib/seo/alternates';
import {
  getComparisonBySlug,
  getAllComparisons,
  type CompetitorComparison,
} from '@/lib/competitors';
import { TOKENS } from '@/lib/brand/colors';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

export async function generateStaticParams() {
  return getAllComparisons().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  const comparison = getComparisonBySlug(params.slug);
  if (!comparison) return {};
  return {
    title: { absolute: comparison.metaTitle },
    description: comparison.metaDescription,
    alternates: pageAlternates(`/vs/${comparison.slug}`, params.locale),
    openGraph: {
      type: 'article',
      title: `MindReset.ai vs ${comparison.name}`,
      description: comparison.metaDescription,
    },
  };
}

/**
 * WebPage + ComparisonReview-style JSON-LD that names both
 * Organizations by canonical @id. This is the entity-disambiguation
 * signal AI retrievers (Perplexity, ChatGPT search, Bing Copilot) use
 * to pin "which MindReset?" to our brand specifically. The MindReset
 * Organization block here matches the layout-level Organization
 * JSON-LD by @id so engines don't see two competing definitions.
 */
function buildJsonLd(c: CompetitorComparison): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE_URL}/vs/${c.slug}`,
    url: `${SITE_URL}/vs/${c.slug}`,
    name: `MindReset.ai vs ${c.name}`,
    description: c.metaDescription,
    isPartOf: {
      '@type': 'WebSite',
      name: 'MindReset.ai',
      url: SITE_URL,
    },
    about: [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#org`,
        name: 'MindReset.ai',
        url: SITE_URL,
        founder: {
          '@type': 'Person',
          name: 'Julia Loya',
          url: `${SITE_URL}/about`,
        },
      },
      {
        '@type': 'Organization',
        '@id': `${c.homepage}#org`,
        name: c.name,
        url: c.homepage,
      },
    ],
  });
}

export default async function VsPage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  setRequestLocale(params.locale);
  const comparison = getComparisonBySlug(params.slug);
  if (!comparison) {
    notFound();
  }
  const t = await getTranslations('Vs');

  return (
    <main className="min-h-screen" style={{ background: '#F4F1EA', color: '#393939' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(comparison) }}
      />

      <div className="max-w-2xl mx-auto px-6 py-4">
        <TopBar />
      </div>

      <article className="max-w-2xl mx-auto px-6 pb-12 sm:pb-16">
        {/* Back link to /alternatives index */}
        <Link
          href="/alternatives"
          className="inline-block text-[13px] mb-8 hover:underline underline-offset-4"
          style={{ color: '#6A6A6A', fontFamily: SANS }}
        >
          ← {t('backToAlternatives')}
        </Link>

        {/* Kicker */}
        <div
          className="text-[11px] uppercase tracking-[0.22em] mb-5"
          style={{ color: '#2D7A85', fontWeight: 500, fontFamily: SANS }}
        >
          {t('kicker')}
        </div>

        {/* H1 — uses .ai TLD for disambiguation */}
        <h1
          className="text-[32px] sm:text-[40px] leading-[1.1] -tracking-[0.02em] mb-3"
          style={{ fontFamily: SERIF, fontWeight: 400, color: '#222' }}
        >
          {t('h1Pattern', { competitor: comparison.name })}
        </h1>

        {/* Byline — locks founder + geography for entity-grounding */}
        <p
          className="text-[13px] mb-12"
          style={{ color: '#888', fontFamily: SANS }}
        >
          {t('byline')}
        </p>

        {/* Intro paragraphs */}
        <div className="mb-12">
          {comparison.intro.map((p, i) => (
            <p
              key={i}
              className={
                i === 0
                  ? 'text-[20px] sm:text-[22px] leading-[1.55] mb-6'
                  : 'text-[17px] leading-[1.7] mb-5'
              }
              style={{
                color: '#393939',
                fontFamily: i === 0 ? SERIF : SANS,
                fontWeight: 400,
              }}
            >
              {p}
            </p>
          ))}
        </div>

        {/* What [Competitor] is */}
        <section className="mb-12">
          <h2
            className="text-[24px] sm:text-[26px] leading-[1.25] -tracking-[0.01em] mb-5"
            style={{ fontFamily: SERIF, fontWeight: 500, color: '#222' }}
          >
            {t('whatTheyAreHeading', { competitor: comparison.name })}
          </h2>
          <p
            className="text-[17px] leading-[1.7]"
            style={{ color: '#393939', fontFamily: SANS }}
          >
            {comparison.whatTheyAre}
          </p>
        </section>

        {/* What MindReset.ai is */}
        <section className="mb-12">
          <h2
            className="text-[24px] sm:text-[26px] leading-[1.25] -tracking-[0.01em] mb-5"
            style={{ fontFamily: SERIF, fontWeight: 500, color: '#222' }}
          >
            {t('whatMindResetIsHeading')}
          </h2>
          {comparison.whatMindResetIs.map((p, i) => (
            <p
              key={i}
              className="text-[17px] leading-[1.7] mb-5"
              style={{ color: '#393939', fontFamily: SANS }}
            >
              {p}
            </p>
          ))}
        </section>

        {/* [Competitor] fits when */}
        <section className="mb-10">
          <h2
            className="text-[20px] sm:text-[22px] leading-[1.25] mb-4"
            style={{ fontFamily: SERIF, fontWeight: 500, color: '#222' }}
          >
            {t('theyFitWhenHeading', { competitor: comparison.name })}
          </h2>
          <ul className="space-y-3 pl-5 list-disc">
            {comparison.theyFitWhen.map((item, i) => (
              <li
                key={i}
                className="text-[16px] leading-[1.65]"
                style={{ color: '#393939', fontFamily: SANS }}
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* MindReset.ai fits when */}
        <section className="mb-12">
          <h2
            className="text-[20px] sm:text-[22px] leading-[1.25] mb-4"
            style={{ fontFamily: SERIF, fontWeight: 500, color: '#222' }}
          >
            {t('mindresetFitsWhenHeading')}
          </h2>
          <ul className="space-y-3 pl-5 list-disc">
            {comparison.mindresetFitsWhen.map((item, i) => (
              <li
                key={i}
                className="text-[16px] leading-[1.65]"
                style={{ color: '#393939', fontFamily: SANS }}
              >
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Honest overlap */}
        <section className="mb-12">
          <h2
            className="text-[24px] sm:text-[26px] leading-[1.25] -tracking-[0.01em] mb-5"
            style={{ fontFamily: SERIF, fontWeight: 500, color: '#222' }}
          >
            {t('honestOverlapHeading')}
          </h2>
          {comparison.honestOverlap.map((p, i) => (
            <p
              key={i}
              className="text-[17px] leading-[1.7] mb-5"
              style={{ color: '#393939', fontFamily: SANS }}
            >
              {p}
            </p>
          ))}
        </section>

        {/* Closing + CTAs */}
        <section
          className="pt-10 mt-6 mb-10"
          style={{ borderTop: `2px solid #2D7A85` }}
        >
          {comparison.closing.map((p, i) => (
            <p
              key={i}
              className="text-[17px] leading-[1.7] mb-6"
              style={{ color: '#393939', fontFamily: SANS }}
            >
              {p}
            </p>
          ))}
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
      </article>
    </main>
  );
}
