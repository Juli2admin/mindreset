// Themes — catalogue.
//
// PR χ1 (2026-07-13). Public page. Signed-out visitors see the 5 tiles
// with a Sign-up CTA. Signed-in visitors see per-module status: "Open"
// if they have active access, "Buy — £59" if not.

import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { THEME_MODULES } from '@/lib/themes/modules';
import { checkThemeModuleAccess } from '@/lib/themes/access';
import TopBar from '@/components/TopBar';
import Footer from '@/components/Footer';
import ThemesCatalogueClient from './ThemesCatalogueClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'Themes',
  });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    robots: { index: true, follow: true },
  };
}

export default async function ThemesCataloguePage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  const { userId } = await auth();
  const accessMap: Record<string, boolean> = {};

  if (userId) {
    await Promise.all(
      THEME_MODULES.map(async (m) => {
        const check = await checkThemeModuleAccess(userId, m.id);
        accessMap[m.id] = check.allowed;
      }),
    );
  }

  return (
    <>
      <TopBar sticky />
      <ThemesCatalogueClient
        isSignedIn={!!userId}
        accessMap={accessMap}
        locale={params.locale}
      />
      <Footer />
    </>
  );
}
