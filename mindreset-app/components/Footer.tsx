// Phase i18n.1b — locale-aware Link from @/i18n/navigation auto-prefixes
// the active locale to internal hrefs (href="/terms" from a /ru/ page
// renders as /ru/terms). External URLs (mailto:, https://) pass through.
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { TOKENS } from '@/lib/brand/colors';
import { getServerPalette } from '@/lib/theme/server';
import LanguagePicker from './LanguagePicker';

type Props = {
  omit?: 'terms' | 'privacy' | 'faq';
};

// Server component. Translations resolve at request time via the locale
// returned by i18n/request.ts (cookie-driven in Phase 0). The palette
// is read per-request from the mr_theme cookie via getServerPalette()
// so the footer matches the page chrome whether the user is in day or
// night mode. The language picker beneath is a client island and reads
// its own palette via useTheme().
export default async function Footer({ omit }: Props) {
  const t = await getTranslations('Footer');
  const PALETTE = getServerPalette();
  return (
    <footer
      className="mt-24 pt-10 pb-4 text-center"
      style={{ borderTop: `1px solid ${PALETTE.border}` }}
    >
      {/* flex-wrap so long localised labels (e.g. DE "Datenschutzerklärung")
          wrap to a second line cleanly instead of mid-link, and dot
          separators don't end up on lines of their own. Each link gets
          py-2 to enforce a ≥44px iOS tap target. */}
      <nav
        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 text-[13px] tracking-wide"
        style={{ color: PALETTE.textMuted, fontFamily: TOKENS.sans }}
      >
        <Link
          href="/pricing"
          className="py-2 hover:underline underline-offset-2 transition-colors"
        >
          {t('pricing')}
        </Link>
        {omit !== 'terms' && (
          <Link
            href="/terms"
            className="py-2 hover:underline underline-offset-2 transition-colors"
          >
            {t('terms')}
          </Link>
        )}
        {omit !== 'privacy' && (
          <Link
            href="/privacy"
            className="py-2 hover:underline underline-offset-2 transition-colors"
          >
            {t('privacy')}
          </Link>
        )}
        {omit !== 'faq' && (
          <Link
            href="/faq"
            className="py-2 hover:underline underline-offset-2 transition-colors"
          >
            {t('faq')}
          </Link>
        )}
        <a
          href="mailto:support@mindreset.ai"
          className="py-2 hover:underline underline-offset-2 transition-colors"
        >
          {t('contact')}
        </a>
        <Link
          href="/share-your-story"
          className="py-2 hover:underline underline-offset-2 transition-colors"
        >
          {t('shareYourStory')}
        </Link>
      </nav>
      <div className="mt-4 flex items-center justify-center">
        <LanguagePicker label={t('languagePickerLabel')} />
      </div>
    </footer>
  );
}
