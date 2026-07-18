// /journal/[slug] — long-form article page.
//
// Dynamic route serving each registered article from
// lib/journal/articles.ts. Static-generated via generateStaticParams so
// every locale × every article slug is built at deploy time.
//
// House style:
//   - Serif H1 large, lead serif lead-in paragraph
//   - Sans body, generous line height
//   - Section H2 in serif, mid-weight
//   - Advice paragraphs render the lead phrase in inline <strong>
//   - Closing paragraph wraps the word "MiniMind" in a Link to /minimind
//   - BlogPosting JSON-LD embedded for AI search + Google rich results

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import MarketingTopBar from '@/components/MarketingTopBar';
import Footer from '@/components/Footer';
import { pageAlternates, SITE_URL } from '@/lib/seo/alternates';
import {
  getArticleBySlug,
  ARTICLES,
  isAdviceParagraph,
  DEFAULT_PRODUCT_LINKS,
  type Article,
  type ProductLink,
} from '@/lib/journal/articles';
import { TOKENS, type PaletteColors } from '@/lib/brand/colors';
import { getServerPalette } from '@/lib/theme/server';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

export async function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  const article = getArticleBySlug(params.slug);
  if (!article) return {};
  return {
    title: { absolute: article.metaTitle },
    description: article.metaDescription,
    alternates: pageAlternates(`/journal/${article.slug}`, params.locale),
    authors: [{ name: article.author.name }],
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.metaDescription,
      publishedTime: article.publishedAt,
      modifiedTime: article.modifiedAt ?? article.publishedAt,
      authors: [article.author.name],
    },
  };
}

function buildJsonLd(article: Article): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.metaDescription,
    author: {
      '@type': 'Person',
      name: article.author.name,
      ...(article.author.url ? { url: `${SITE_URL}${article.author.url}` } : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: 'MindReset.ai',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo-light.png`,
      },
    },
    datePublished: article.publishedAt,
    dateModified: article.modifiedAt ?? article.publishedAt,
    url: `${SITE_URL}/journal/${article.slug}`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/journal/${article.slug}`,
    },
  });
}

/**
 * Walk `text` and wrap every occurrence of any product-link token in an
 * inline Link to the configured href. Earliest match wins; tokens are
 * sorted by length descending so multi-word tokens (e.g. "The Journey")
 * match before any single-word substring overlap. Returns a fragment
 * array suitable for embedding in a <p>.
 */
function renderTextWithLinks(
  text: string,
  links: ProductLink[],
  palette: PaletteColors,
): React.ReactNode[] {
  if (links.length === 0) return [text];
  // Sort once so the inner loop always picks the longest-token match
  // first if multiple tokens start at the same position.
  const sortedLinks = [...links].sort(
    (a, b) => b.token.length - a.token.length,
  );
  const out: React.ReactNode[] = [];
  let remaining = text;
  let keyCounter = 0;
  while (remaining.length > 0) {
    let earliestIdx = -1;
    let matched: ProductLink | undefined;
    for (const link of sortedLinks) {
      const idx = remaining.indexOf(link.token);
      if (idx >= 0 && (earliestIdx === -1 || idx < earliestIdx)) {
        earliestIdx = idx;
        matched = link;
      }
    }
    if (!matched || earliestIdx < 0) {
      out.push(remaining);
      break;
    }
    if (earliestIdx > 0) {
      out.push(remaining.slice(0, earliestIdx));
    }
    out.push(
      <Link
        key={`pl-${keyCounter++}`}
        href={matched.href}
        className="underline underline-offset-4 hover:no-underline"
        style={{ color: palette.accent, fontWeight: 500 }}
      >
        {matched.token}
      </Link>,
    );
    remaining = remaining.slice(earliestIdx + matched.token.length);
  }
  return out;
}

/**
 * Render a single closing paragraph with product-token Links woven in
 * where they appear in the prose.
 */
function ClosingParagraph({
  text,
  links,
  palette,
}: {
  text: string;
  links: ProductLink[];
  palette: PaletteColors;
}) {
  return (
    <p
      className="text-[17px] leading-[1.7]"
      style={{ color: palette.text, fontFamily: SANS }}
    >
      {renderTextWithLinks(text, links, palette)}
    </p>
  );
}

export default async function ArticlePage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  setRequestLocale(params.locale);
  const article = getArticleBySlug(params.slug);
  if (!article) {
    notFound();
  }

  const publishedDisplay = new Date(article.publishedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  // Per-request palette from the mr_theme cookie — matches every other
  // themed server surface. Audit M2: this whole page was hardcoded to
  // day-mode cream/dark values and gave night-mode readers a jarring
  // bright page against an otherwise-dark app.
  const PALETTE = getServerPalette();

  return (
    <main className="min-h-screen" style={{ background: PALETTE.bg, color: PALETTE.text }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(article) }}
      />

      <div className="max-w-2xl mx-auto px-6 py-4">
        <MarketingTopBar />
      </div>

      <article className="max-w-2xl mx-auto px-6 pb-12 sm:pb-16">
        {/* Back link to /journal index */}
        <Link
          href="/journal"
          className="inline-block text-[13px] mb-8 hover:underline underline-offset-4"
          style={{ color: PALETTE.textMuted, fontFamily: SANS }}
        >
          ← Journal
        </Link>

        {/* H1 */}
        <h1
          className="text-[32px] sm:text-[40px] leading-[1.1] -tracking-[0.02em] mb-5"
          style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
        >
          {article.title}
        </h1>

        {/* Byline */}
        <div
          className="text-[13px] mb-12"
          style={{ color: PALETTE.textHint, fontFamily: SANS }}
        >
          {article.author.name} · {publishedDisplay}
        </div>

        {/* Intro paragraphs — first gets a slightly larger serif lead-in */}
        <div className="mb-12">
          {article.intro.map((p, i) => (
            <p
              key={i}
              className={
                i === 0
                  ? 'text-[20px] sm:text-[22px] leading-[1.55] mb-6'
                  : 'text-[17px] leading-[1.7] mb-5'
              }
              style={{
                color: PALETTE.text,
                fontFamily: i === 0 ? SERIF : SANS,
                fontWeight: i === 0 ? 400 : 400,
              }}
            >
              {p}
            </p>
          ))}
        </div>

        {/* Sections */}
        {article.sections.map((section, si) => (
          <section key={si} className="mb-12">
            <h2
              className="text-[24px] sm:text-[26px] leading-[1.25] -tracking-[0.01em] mb-5 mt-2"
              style={{ fontFamily: SERIF, fontWeight: 500, color: PALETTE.text }}
            >
              {section.heading}
            </h2>
            {section.paragraphs.map((para, pi) => {
              if (isAdviceParagraph(para)) {
                return (
                  <p
                    key={pi}
                    className="text-[17px] leading-[1.7] mb-5"
                    style={{ color: PALETTE.text, fontFamily: SANS }}
                  >
                    <strong style={{ color: PALETTE.text, fontWeight: 600 }}>
                      {para.lead}
                    </strong>{' '}
                    {para.body}
                  </p>
                );
              }
              return (
                <p
                  key={pi}
                  className="text-[17px] leading-[1.7] mb-5"
                  style={{ color: PALETTE.text, fontFamily: SANS }}
                >
                  {para}
                </p>
              );
            })}
          </section>
        ))}

        {/* Closing — optional H2 + paragraphs with product-token links
            wrapped in inline Links. Each article supplies its own
            productLinks map; falls back to the MiniMind → /minimind
            default for articles that don't override. */}
        <section
          className="pt-10 mt-6 mb-10"
          style={{ borderTop: `1px solid ${PALETTE.border}` }}
        >
          {article.closingHeading && (
            <h2
              className="text-[24px] sm:text-[26px] leading-[1.25] -tracking-[0.01em] mb-5"
              style={{ fontFamily: SERIF, fontWeight: 500, color: PALETTE.text }}
            >
              {article.closingHeading}
            </h2>
          )}
          {article.closing.map((p, i) => (
            <div key={i} className="mb-5">
              <ClosingParagraph
                text={p}
                links={article.productLinks ?? DEFAULT_PRODUCT_LINKS}
                palette={PALETTE}
              />
            </div>
          ))}
        </section>

        <Footer />
      </article>
    </main>
  );
}
