// Phase i18n.1b — locale-aware Link from @/i18n/navigation auto-prefixes
// the active locale to internal hrefs (href="/terms" from a /ru/ page
// renders as /ru/terms). External URLs (mailto:, https://) pass through.
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { PALETTE as FULL_PALETTE, TOKENS } from '@/lib/brand/colors';
import FooterLanguagePicker from './FooterLanguagePicker';

type Props = {
  omit?: 'terms' | 'privacy';
  theme?: 'day' | 'night';
};

// Server component. Translations resolve at request time via the locale
// returned by i18n/request.ts (cookie-driven in Phase 0). The language
// picker beneath is a client island and handles cookie writes itself.
export default async function Footer({ omit, theme = 'day' }: Props) {
  const t = await getTranslations('Footer');
  const PALETTE = FULL_PALETTE[theme];
  return (
    <footer
      className="mt-24 pt-10 pb-4 text-center"
      style={{ borderTop: `1px solid ${PALETTE.border}` }}
    >
      <p
        className="text-[12px] tracking-wide px-4"
        style={{ color: PALETTE.textMuted, fontFamily: TOKENS.sans }}
      >
        {omit !== 'terms' && (
          <>
            <Link
              href="/terms"
              className="hover:underline underline-offset-2 transition-colors"
            >
              {t('terms')}
            </Link>
            {' · '}
          </>
        )}
        {omit !== 'privacy' && (
          <>
            <Link
              href="/privacy"
              className="hover:underline underline-offset-2 transition-colors"
            >
              {t('privacy')}
            </Link>
            {' · '}
          </>
        )}
        <a
          href="mailto:support@mindreset.ai"
          className="hover:underline underline-offset-2 transition-colors"
        >
          {t('contact')}
        </a>
      </p>
      <FooterLanguagePicker label={t('languagePickerLabel')} theme={theme} />
    </footer>
  );
}
