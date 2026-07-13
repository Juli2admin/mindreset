// States & Themes — catalogue.
//
// Public page. Signed-out visitors see the tiles + tap-to-sign-up.
// Signed-in visitors see per-module status: "Open" if they have active
// access, "Buy £29 / £59" if not.

import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
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
  let isSubscriber = false;
  const accessMap: Record<string, boolean> = {};

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { currentTier: true },
    });
    isSubscriber =
      user?.currentTier === 'essential' || user?.currentTier === 'extended';

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
        isSubscriber={isSubscriber}
        accessMap={accessMap}
        locale={params.locale}
      />
      <Footer />
    </>
  );
}
