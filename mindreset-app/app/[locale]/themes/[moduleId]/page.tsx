// Theme-module session page.
//
// PR χ1 (2026-07-13). Server component. Gates on access, then finds or
// creates the one ThemeSession row for (userId, moduleId). Loads the
// full decrypted history and passes it to the client for continuous
// multi-session chat.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encrypt';
import {
  isValidThemeModuleId,
  getThemeModule,
} from '@/lib/themes/modules';
import { checkThemeModuleAccess } from '@/lib/themes/access';
import ThemeModuleClient, {
  type HistoryMessage,
} from './ThemeModuleClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: { locale: string; moduleId: string };
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  if (!isValidThemeModuleId(params.moduleId)) {
    return { title: 'MindReset' };
  }
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'Themes',
  });
  const moduleName = t(`modules.${params.moduleId}.name`);
  return {
    title: `${moduleName} — MindReset`,
    robots: { index: false, follow: false },
  };
}

export default async function ThemeModulePage({ params }: PageProps) {
  setRequestLocale(params.locale);

  if (!isValidThemeModuleId(params.moduleId)) {
    redirect(`/${params.locale}/themes`);
  }

  const { userId } = await auth();
  if (!userId) {
    redirect(`/${params.locale}/sign-in`);
  }

  const mod = getThemeModule(params.moduleId);
  if (!mod) {
    redirect(`/${params.locale}/themes`);
  }

  const access = await checkThemeModuleAccess(userId, params.moduleId);
  if (!access.allowed) {
    redirect(`/${params.locale}/themes`);
  }

  // Find-or-create the ThemeSession row (unique on userId+moduleId).
  const session = await prisma.themeSession.upsert({
    where: { userId_moduleId: { userId, moduleId: params.moduleId } },
    update: {},
    create: { userId, moduleId: params.moduleId },
    select: { id: true },
  });

  const history: HistoryMessage[] = (
    await prisma.themeMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, contentEncrypted: true },
    })
  ).map((m) => ({
    id: m.id,
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: decrypt(m.contentEncrypted),
  }));

  return (
    <ThemeModuleClient
      moduleId={params.moduleId}
      moduleName={mod.name}
      history={history}
      locale={params.locale}
    />
  );
}
