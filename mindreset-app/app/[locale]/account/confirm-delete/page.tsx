import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { getServerPalette } from '@/lib/theme/server';
import { TOKENS } from '@/lib/brand/colors';
import TopBar from '@/components/TopBar';
import ConfirmDeleteClient from './ConfirmDeleteClient';

const SERIF = TOKENS.serif;

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'ConfirmDelete',
  });
  return {
    title: t('metaTitle'),
    robots: { index: false, follow: false },
  };
}

// Lands the user from the email confirmation link. The client component
// reads the token from the URL, calls /api/account/confirm-delete, signs
// the user out via Clerk, and shows a success state with the scheduled
// deletion date.
export default function ConfirmDeletePage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { token?: string };
}) {
  setRequestLocale(params.locale);
  const PALETTE = getServerPalette();
  const t = useTranslations('ConfirmDelete');
  const token = searchParams.token ?? null;

  return (
    <main className="min-h-screen" style={{ background: PALETTE.bg }}>
      <div className="max-w-2xl mx-auto px-6 py-4">
        <TopBar />
      </div>
      <div className="max-w-2xl mx-auto px-6 pb-12 sm:pb-16">
        <h1
          className="text-[32px] sm:text-[36px] leading-[1.15] mb-6 mt-12"
          style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
        >
          {t('title')}
        </h1>
        <ConfirmDeleteClient token={token} />
      </div>
    </main>
  );
}
