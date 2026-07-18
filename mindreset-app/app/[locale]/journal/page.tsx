// /journal — public index of long-form articles.
//
// Phase C content engine entry surface. Lists articles newest-first.
// Each entry links to /journal/[slug]. The page register-only — adding
// a new article to lib/journal/articles.ts is the only thing required
// to make it appear here and in the sitemap.

import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import MarketingTopBar from '@/components/MarketingTopBar';
import Footer from '@/components/Footer';
import { pageAlternates } from '@/lib/seo/alternates';
import { getArticlesNewestFirst } from '@/lib/journal/articles';
import { TOKENS } from '@/lib/brand/colors';
import { getServerPalette } from '@/lib/theme/server';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return {
    title: { absolute: 'Journal — notes on the slower work · MindReset.ai' },
    description:
      'Long-form notes on the slower work of midlife — patterns, practices, and small honest moments. From Julia Loya, founder of MindReset.',
    alternates: pageAlternates('/journal', params.locale),
  };
}

export default async function JournalIndexPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  const articles = getArticlesNewestFirst();
  // Per-request palette from the mr_theme cookie — matches every other
  // themed server surface (Terms, Privacy, FAQ, About, etc.). Audit M2:
  // this page was hardcoded #F4F1EA / #393939 / #222 / #555 / #6A6A6A /
  // #888 / #2D7A85 / #D4D0C5 and gave night-mode readers a bright-cream
  // page against an otherwise-dark app.
  const PALETTE = getServerPalette();

  return (
    <main className="min-h-screen" style={{ background: PALETTE.bg, color: PALETTE.text }}>
      <div className="max-w-2xl mx-auto px-6 py-4">
        <MarketingTopBar />
      </div>
      <div className="max-w-2xl mx-auto px-6 pb-12 sm:pb-16">
        {/* Kicker */}
        <div
          className="text-[11px] uppercase tracking-[0.22em] mb-6"
          style={{ color: PALETTE.accent, fontWeight: 500, fontFamily: SANS }}
        >
          JOURNAL
        </div>

        {/* H1 */}
        <h1
          className="text-[36px] sm:text-[44px] leading-[1.05] -tracking-[0.018em] mb-6"
          style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
        >
          Notes on the slower work.
        </h1>

        {/* Intro */}
        <p
          className="text-[16px] leading-[1.65] mb-12 max-w-[36rem]"
          style={{ color: PALETTE.textMuted, fontFamily: SANS }}
        >
          Long-form pieces from Julia Loya — patterns, practices, and small
          honest moments from the work of midlife.
        </p>

        {/* Article list */}
        <div className="space-y-8">
          {articles.map((article) => (
            <article
              key={article.slug}
              className="pt-8"
              style={{ borderTop: `1px solid ${PALETTE.border}` }}
            >
              <Link href={`/journal/${article.slug}`} className="block group">
                <h2
                  className="text-[24px] sm:text-[28px] leading-[1.2] mb-3 -tracking-[0.01em] group-hover:underline underline-offset-4"
                  style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
                >
                  {article.title}
                </h2>
                <p
                  className="text-[15px] leading-[1.6] mb-3"
                  style={{ color: PALETTE.textMuted, fontFamily: SANS }}
                >
                  {article.metaDescription}
                </p>
                <div
                  className="text-[13px]"
                  style={{ color: PALETTE.textHint, fontFamily: SANS }}
                >
                  {article.author.name} ·{' '}
                  {new Date(article.publishedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-20">
          <Footer />
        </div>
      </div>
    </main>
  );
}
