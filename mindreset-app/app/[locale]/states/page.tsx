// States & Themes — catalogue.
//
// Public page. Signed-out visitors see the tiles + tap-to-sign-up.
// Signed-in visitors see per-module status: "Open" if they have active
// access, "Buy £29" (flat, 30-day) if not.
//
// PR χ0 (2026-07-13): dropped the isSubscriber branch — everyone pays
// £29. See lib/states/modules.ts for the price constant.

import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { STATE_MODULES } from '@/lib/states/modules';
import { checkStateModuleAccess } from '@/lib/states/access';
import TopBar from '@/components/TopBar';
import Footer from '@/components/Footer';
import StatesCatalogueClient from './StatesCatalogueClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'States',
  });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    robots: { index: true, follow: true },
  };
}

export default async function StatesCataloguePage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  const { userId } = await auth();
  const accessMap: Record<string, boolean> = {};

  if (userId) {
    // Check per-module access. Parallelised — cheap read.
    await Promise.all(
      STATE_MODULES.map(async (m) => {
        const check = await checkStateModuleAccess(userId, m.id);
        accessMap[m.id] = check.allowed;
      }),
    );
  }

  return (
    <>
      <TopBar sticky />
      <StatesCatalogueClient
        isSignedIn={!!userId}
        accessMap={accessMap}
        locale={params.locale}
      />
      <Footer />
    </>
  );
}
