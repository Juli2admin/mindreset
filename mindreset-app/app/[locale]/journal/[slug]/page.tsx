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
import TopBar from '@/components/TopBar';
import Footer from '@/components/Footer';
import { pageAlternates, SITE_URL } from '@/lib/seo/alternates';
import {
  getArticleBySlug,
  ARTICLES,
  isAdviceParagraph,
  type Article,
} from '@/lib/journal/articles';
import { TOKENS } from '@/lib/brand/colors';

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
 * Render the closing paragraph with the word "MiniMind" wrapped in a Link
 * to /minimind. The article copy refers to MiniMind once in the closing
 * paragraph — we transform that single token to a styled link. If the
 * token doesn't appear, the paragraph renders unchanged.
 */
function ClosingParagraph({ text }: { text: string }) {
  const token = 'MiniMind';
  const idx = text.indexOf(token);
  if (idx < 0) {
    return (
      <p
        className="text-[17px] leading-[1.7]"
        style={{ color: '#393939', fontFamily: SANS }}
      >
        {text}
      </p>
    );
  }
  const before = text.slice(0, idx);
  const after = text.slice(idx + token.length);
  return (
    <p
      className="text-[17px] leading-[1.7]"
      style={{ color: '#393939', fontFamily: SANS }}
    >
      {before}
      <Link
        href="/minimind"
        className="underline underline-offset-4 hover:no-underline"
        style={{ color: '#2D7A85', fontWeight: 500 }}
      >
        {token}
      </Link>
      {after}
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

  return (
    <main className="min-h-screen" style={{ background: '#F4F1EA', color: '#393939' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(article) }}
      />

      <div className="max-w-2xl mx-auto px-6 py-4">
        <TopBar />
      </div>

      <article className="max-w-2xl mx-auto px-6 pb-12 sm:pb-16">
        {/* Back link to /journal index */}
        <Link
          href="/journal"
          className="inline-block text-[13px] mb-8 hover:underline underline-offset-4"
          style={{ color: '#6A6A6A', fontFamily: SANS }}
        >
          ← Journal
        </Link>

        {/* H1 */}
        <h1
          className="text-[32px] sm:text-[40px] leading-[1.1] -tracking-[0.02em] mb-5"
          style={{ fontFamily: SERIF, fontWeight: 400, color: '#222' }}
        >
          {article.title}
        </h1>

        {/* Byline */}
        <div
          className="text-[13px] mb-12"
          style={{ color: '#888', fontFamily: SANS }}
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
                color: '#393939',
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
              style={{ fontFamily: SERIF, fontWeight: 500, color: '#222' }}
            >
              {section.heading}
            </h2>
            {section.paragraphs.map((para, pi) => {
              if (isAdviceParagraph(para)) {
                return (
                  <p
                    key={pi}
                    className="text-[17px] leading-[1.7] mb-5"
                    style={{ color: '#393939', fontFamily: SANS }}
                  >
                    <strong style={{ color: '#222', fontWeight: 600 }}>
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
                  style={{ color: '#393939', fontFamily: SANS }}
                >
                  {para}
                </p>
              );
            })}
          </section>
        ))}

        {/* Closing — last paragraph(s); MiniMind link inlined */}
        <section
          className="pt-10 mt-6 mb-10"
          style={{ borderTop: `1px solid #D4D0C5` }}
        >
          {article.closing.map((p, i) => (
            <div key={i} className="mb-5">
              <ClosingParagraph text={p} />
            </div>
          ))}
        </section>

        <Footer />
      </article>
    </main>
  );
}
