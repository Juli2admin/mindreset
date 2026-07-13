// State-module session page.
//
// PR ψ2 (2026-07-13). Server component. Gates on access, then either
// resumes the user's active session for this module (if one exists
// and hasn't been completed) or creates a fresh one. Passes the
// session id + decrypted history to the client.
//
// "Each session fresh" (Julia's rule) is interpreted as: no state is
// carried BETWEEN sessions. Within a session, refreshing the page
// resumes so the reader doesn't lose their in-progress reset if their
// browser hiccups or they navigated away.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encrypt';
import {
  isValidStateModuleId,
  getStateModule,
} from '@/lib/states/modules';
import { checkStateModuleAccess } from '@/lib/states/access';
import StateModuleClient, {
  type HistoryMessage,
} from './StateModuleClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: { locale: string; moduleId: string };
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  if (!isValidStateModuleId(params.moduleId)) {
    return { title: 'MindReset' };
  }
  const t = await getTranslations({
    locale: params.locale,
    namespace: 'States',
  });
  const moduleName = t(`modules.${params.moduleId}.name`);
  return {
    title: `${moduleName} — MindReset`,
    // The module pages are gated behind a purchase; no upside to
    // Google indexing a page that redirects unauthenticated users.
    robots: { index: false, follow: false },
  };
}

export default async function StateModulePage({ params }: PageProps) {
  setRequestLocale(params.locale);

  if (!isValidStateModuleId(params.moduleId)) {
    redirect(`/${params.locale}/states`);
  }

  const { userId } = await auth();
  if (!userId) {
    redirect(`/${params.locale}/sign-in`);
  }

  const mod = getStateModule(params.moduleId);
  if (!mod) {
    redirect(`/${params.locale}/states`);
  }

  const access = await checkStateModuleAccess(userId, params.moduleId);
  if (!access.allowed) {
    // Access denied — send them back to the catalogue so they can
    // buy or renew. No error UI here; the catalogue tile already
    // shows the buy CTA.
    redirect(`/${params.locale}/states`);
  }

  // Resume or start. `findFirst` keyed on `(userId, moduleId, completedAt=null)`.
  let session = await prisma.stateSession.findFirst({
    where: { userId, moduleId: params.moduleId, completedAt: null },
    orderBy: { startedAt: 'desc' },
    select: { id: true, startedAt: true, turnCount: true },
  });
  if (!session) {
    session = await prisma.stateSession.create({
      data: { userId, moduleId: params.moduleId },
      select: { id: true, startedAt: true, turnCount: true },
    });
  }

  const history: HistoryMessage[] = (
    await prisma.stateMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, contentEncrypted: true },
    })
  ).map((m) => ({
    id: m.id,
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: decrypt(m.contentEncrypted),
  }));

  // Deliberately no TopBar on the module page. This is a focused-session
  // surface — the reader is in the middle of an anxiety reset — and the
  // full app navigation is a distraction. The client renders a minimal
  // "← States" back-link in its own header instead.
  return (
    <StateModuleClient
      moduleId={params.moduleId}
      moduleName={mod.name}
      sessionId={session.id}
      history={history}
      locale={params.locale}
    />
  );
}
