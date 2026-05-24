import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { PALETTE as FULL_PALETTE, TOKENS } from '@/lib/brand/colors';
import Footer from '@/components/Footer';
import TopBar from '@/components/TopBar';

const PALETTE = FULL_PALETTE.day;
const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

// Fixed order — keys must match Faq.items.<slug> in messages/*.json.
const FAQ_SLUGS = [
  'whatIsMindReset',
  'isTherapy',
  'whatIsMiniMind',
  'howToStart',
  'isItFree',
  'afterFreeMessages',
  'essentialVsExtended',
  'whatIsTopUp',
  'willIBeCharged',
  'howToCancel',
  'isPrivate',
  'whoCanSee',
  'retention',
  'canDelete',
  'medicalAdvice',
  'crisisHelp',
  'ageRequirement',
  'languages',
  'mobileUse',
  'contact',
] as const;

export async function generateMetadata() {
  const t = await getTranslations('Faq');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

function H2({ children }: { children: ReactNode }) {
  return (
    <h2
      className="text-[36px] leading-[1.15] mb-6"
      style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
    >
      {children}
    </h2>
  );
}

function H3({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3
      id={id}
      className="text-[22px] leading-[1.3] mt-12 mb-4 scroll-mt-8"
      style={{ fontFamily: SERIF, fontWeight: 400, color: PALETTE.text }}
    >
      {children}
    </h3>
  );
}

function P({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-[16px] leading-[1.7] mb-4"
      style={{ fontFamily: SANS, color: PALETTE.text }}
    >
      {children}
    </p>
  );
}

export default async function FaqPage() {
  const t = await getTranslations('Faq');

  return (
    <main className="min-h-screen" style={{ background: PALETTE.bg }}>
      <div className="max-w-3xl mx-auto px-6 py-4">
        <TopBar />
      </div>
      <div className="max-w-3xl mx-auto px-6 pb-12 sm:pb-16">
        <article className="mb-8">
          <H2>{t('pageTitle')}</H2>

          {FAQ_SLUGS.map((slug) => (
            <section key={slug}>
              <H3 id={slug}>{t(`items.${slug}.question`)}</H3>
              <P>{t(`items.${slug}.answer`)}</P>
            </section>
          ))}
        </article>

        <Footer omit="faq" />
      </div>
    </main>
  );
}
