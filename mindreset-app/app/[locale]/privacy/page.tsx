import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TOKENS } from '@/lib/brand/colors';
import { getServerPalette } from '@/lib/theme/server';
import { pageAlternates } from '@/lib/seo/alternates';
import Footer from '@/components/Footer';
import TopBar from '@/components/TopBar';

const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

const LAST_UPDATED = '26 May 2026';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy Policy for the MindReset AI self-help platform — what data we collect, how we use it, and your rights under UK GDPR.',
  alternates: pageAlternates('/privacy'),
};

export default async function PrivacyPage() {
  const t = await getTranslations('Privacy');
  // Per-request palette from the mr_theme cookie. The typography
  // helpers below are defined inside the page function so they close
  // over PALETTE; server components can't useTheme(), so the closure
  // pattern is the mechanism that makes this page theme-reactive.
  const PALETTE = getServerPalette();

  // Typography helpers — keep the legal text below uncluttered.
  function H2({ children }: { children: ReactNode }) {
    return (
      <h2
        className="text-[28px] sm:text-[36px] leading-[1.15] mb-6"
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
  function Note({ inline, children }: { inline?: boolean; children: ReactNode }) {
    if (inline) {
      return (
        <span className="italic" style={{ color: PALETTE.textMuted }}>
          {children}
        </span>
      );
    }
    return (
      <p
        className="my-4 italic text-[15px] leading-[1.65]"
        style={{ fontFamily: SANS, color: PALETTE.textMuted }}
      >
        {children}
      </p>
    );
  }
  function UL({ children }: { children: ReactNode }) {
    return (
      <ul
        className="space-y-2 my-4 pl-6 list-disc text-[16px] leading-[1.7]"
        style={{ fontFamily: SANS, color: PALETTE.text }}
      >
        {children}
      </ul>
    );
  }
  function Strong({ children }: { children: ReactNode }) {
    return <strong style={{ fontWeight: 500, color: PALETTE.text }}>{children}</strong>;
  }
  function MailLink({ to }: { to: string }) {
    return (
      <a
        href={`mailto:${to}`}
        className="underline underline-offset-2"
        style={{ color: PALETTE.accent }}
      >
        {to}
      </a>
    );
  }
  function ExtLink({ href, children }: { href: string; children: ReactNode }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
        style={{ color: PALETTE.accent }}
      >
        {children}
      </a>
    );
  }

  // Table family — used for Section 2 (Data We Collect) and Section 7 (Retention).
  function Table({ children }: { children: ReactNode }) {
    return (
      <div className="my-6 overflow-x-auto">
        <table
          // min-w-[640px] forces horizontal scroll on mobile when the table
          // is wider than the viewport (§2 has 4 narrow columns of prose);
          // md:min-w-full restores fill-to-parent on tablet/desktop.
          className="min-w-[640px] md:min-w-full text-[14px] leading-[1.55]"
          style={{ borderCollapse: 'collapse', fontFamily: SANS, color: PALETTE.text }}
        >
          {children}
        </table>
      </div>
    );
  }
  function THead({ children }: { children: ReactNode }) {
    return (
      <thead
        style={{
          background: PALETTE.bgSubtle,
          borderBottom: `1px solid ${PALETTE.border}`,
        }}
      >
        {children}
      </thead>
    );
  }
  function TH({ children }: { children: ReactNode }) {
    return (
      <th
        className="text-left py-3 px-4 align-bottom"
        style={{ fontFamily: SANS, fontWeight: 500, color: PALETTE.text }}
      >
        {children}
      </th>
    );
  }
  function TR({ children }: { children: ReactNode }) {
    return (
      <tr style={{ borderBottom: `1px solid ${PALETTE.border}` }}>{children}</tr>
    );
  }
  function TD({ children }: { children: ReactNode }) {
    return (
      <td className="py-3 px-4 align-top" style={{ color: PALETTE.text }}>
        {children}
      </td>
    );
  }
  const strongRich = { strong: (c: ReactNode) => <Strong>{c}</Strong> };
  const mailRich = { mail: () => <MailLink to="support@mindreset.ai" /> };
  const strongMailRich = { ...strongRich, ...mailRich };

  return (
    <main className="min-h-screen" style={{ background: PALETTE.bg }}>
      <div className="max-w-3xl mx-auto px-6 py-4">
        <TopBar />
      </div>
      <div className="max-w-3xl mx-auto px-6 pb-12 sm:pb-16">
        {/* ─── Document metadata ───────────────────────────────── */}
        <p
          className="text-[11px] uppercase tracking-[0.22em] mb-16"
          style={{ color: PALETTE.textHint, fontFamily: SANS, fontWeight: 500 }}
        >
          {t('lastUpdated', { date: LAST_UPDATED })}
        </p>

        {/* ─── Privacy Policy ─────────────────────────────────── */}
        <article className="mb-8">
          <H2>{t('title')}</H2>

          <P>
            <Strong>{t('preamble.controllerLabel')}</Strong>{' '}
            {t.rich('preamble.controllerBody', strongMailRich)}
          </P>
          <Note>{t('preamble.note')}</Note>

          <H3 id="privacy-section-1">{t('section1.title')}</H3>
          <P>{t('section1.body')}</P>

          <H3 id="privacy-section-2">{t('section2.title')}</H3>
          <Table>
            <THead>
              <TR>
                <TH>{t('section2.table.headerCategory')}</TH>
                <TH>{t('section2.table.headerExamples')}</TH>
                <TH>{t('section2.table.headerPurpose')}</TH>
                <TH>{t('section2.table.headerLawfulBasis')}</TH>
              </TR>
            </THead>
            <tbody>
              <TR>
                <TD><Strong>{t('section2.table.account.category')}</Strong></TD>
                <TD>{t('section2.table.account.examples')}</TD>
                <TD>{t('section2.table.account.purpose')}</TD>
                <TD>{t('section2.table.account.lawfulBasis')}</TD>
              </TR>
              <TR>
                <TD><Strong>{t('section2.table.screening.category')}</Strong></TD>
                <TD>{t('section2.table.screening.examples')}</TD>
                <TD>{t('section2.table.screening.purpose')}</TD>
                <TD>{t('section2.table.screening.lawfulBasis')}</TD>
              </TR>
              <TR>
                <TD><Strong>{t('section2.table.conversation.category')}</Strong></TD>
                <TD>{t('section2.table.conversation.examples')}</TD>
                <TD>{t('section2.table.conversation.purpose')}</TD>
                <TD>{t('section2.table.conversation.lawfulBasis')}</TD>
              </TR>
              <TR>
                <TD><Strong>{t('section2.table.wellbeing.category')}</Strong></TD>
                <TD>{t('section2.table.wellbeing.examples')}</TD>
                <TD>{t('section2.table.wellbeing.purpose')}</TD>
                <TD>{t('section2.table.wellbeing.lawfulBasis')}</TD>
              </TR>
              <TR>
                <TD><Strong>{t('section2.table.safety.category')}</Strong></TD>
                <TD>{t('section2.table.safety.examples')}</TD>
                <TD>{t('section2.table.safety.purpose')}</TD>
                <TD>{t('section2.table.safety.lawfulBasis')}</TD>
              </TR>
              <TR>
                <TD><Strong>{t('section2.table.usage.category')}</Strong></TD>
                <TD>{t('section2.table.usage.examples')}</TD>
                <TD>{t('section2.table.usage.purpose')}</TD>
                <TD>{t('section2.table.usage.lawfulBasis')}</TD>
              </TR>
              <TR>
                <TD><Strong>{t('section2.table.payment.category')}</Strong></TD>
                <TD>{t('section2.table.payment.examples')}</TD>
                <TD>{t('section2.table.payment.purpose')}</TD>
                <TD>{t('section2.table.payment.lawfulBasis')}</TD>
              </TR>
              <TR>
                <TD><Strong>{t('section2.table.support.category')}</Strong></TD>
                <TD>{t.rich('section2.table.support.examples', mailRich)}</TD>
                <TD>{t('section2.table.support.purpose')}</TD>
                <TD>{t('section2.table.support.lawfulBasis')}</TD>
              </TR>
            </tbody>
          </Table>
          <P>{t('section2.closing')}</P>

          <H3 id="privacy-section-3">{t('section3.title')}</H3>
          <P>{t('section3.intro')}</P>
          <UL>
            <li>{t('section3.observationsItem')}</li>
            <li>{t('section3.noDiagnosisItem')}</li>
            <li>{t('section3.noLegalItem')}</li>
            <li>{t.rich('section3.contactItem', mailRich)}</li>
          </UL>
          <P>{t('section3.article22')}</P>

          <H3 id="privacy-section-4">{t('section4.title')}</H3>
          <P>{t.rich('section4.intro', strongRich)}</P>
          <UL>
            <li>{t('section4.cloudItem')}</li>
            <li>{t('section4.aiItem')}</li>
            <li>{t('section4.speechItem')}</li>
            <li>{t('section4.authItem')}</li>
            <li>{t('section4.paymentItem')}</li>
            <li>{t('section4.emailItem')}</li>
            <li>{t('section4.hostingItem')}</li>
          </UL>
          <P>{t.rich('section4.voiceInput', strongRich)}</P>
          <P>{t.rich('section4.providersList', mailRich)}</P>
          <P>{t('section4.legalDisclosure')}</P>
          <P>{t.rich('section4.sccs', strongRich)}</P>

          <H3 id="privacy-section-5">{t('section5.title')}</H3>
          <P>{t('section5.intro')}</P>
          <UL>
            <li>{t('section5.adequacyItem')}</li>
            <li>{t('section5.sccsItem')}</li>
            <li>{t('section5.safeguardsItem')}</li>
          </UL>
          <P>{t.rich('section5.requestDetails', mailRich)}</P>

          <H3 id="privacy-section-6">{t('section6.title')}</H3>
          <P>{t('section6.intro')}</P>
          <UL>
            <li>{t.rich('section6.tlsItem', strongRich)}</li>
            <li>{t.rich('section6.encryptionItem', strongRich)}</li>
            <li>{t.rich('section6.hashedItem', strongRich)}</li>
            <li>{t.rich('section6.accessItem', strongRich)}</li>
            <li>{t.rich('section6.confidentialityItem', strongRich)}</li>
            <li>{t.rich('section6.reviewsItem', strongRich)}</li>
            <li>{t.rich('section6.backupsItem', strongRich)}</li>
          </UL>
          <P>{t('section6.breach')}</P>

          <H3 id="privacy-section-7">{t('section7.title')}</H3>
          <Table>
            <THead>
              <TR>
                <TH>{t('section7.table.headerCategory')}</TH>
                <TH>{t('section7.table.headerPeriod')}</TH>
              </TR>
            </THead>
            <tbody>
              <TR>
                <TD><Strong>{t('section7.table.account.category')}</Strong></TD>
                <TD>{t('section7.table.account.period')}</TD>
              </TR>
              <TR>
                <TD><Strong>{t('section7.table.screening.category')}</Strong></TD>
                <TD>{t('section7.table.screening.period')}</TD>
              </TR>
              <TR>
                <TD><Strong>{t('section7.table.conversation.category')}</Strong></TD>
                <TD>{t('section7.table.conversation.period')}</TD>
              </TR>
              <TR>
                <TD><Strong>{t('section7.table.wellbeing.category')}</Strong></TD>
                <TD>{t('section7.table.wellbeing.period')}</TD>
              </TR>
              <TR>
                <TD><Strong>{t('section7.table.safety.category')}</Strong></TD>
                <TD>{t('section7.table.safety.period')}</TD>
              </TR>
              <TR>
                <TD><Strong>{t('section7.table.payment.category')}</Strong></TD>
                <TD>{t('section7.table.payment.period')}</TD>
              </TR>
              <TR>
                <TD><Strong>{t('section7.table.backups.category')}</Strong></TD>
                <TD>{t('section7.table.backups.period')}</TD>
              </TR>
              <TR>
                <TD><Strong>{t('section7.table.support.category')}</Strong></TD>
                <TD>{t('section7.table.support.period')}</TD>
              </TR>
            </tbody>
          </Table>
          <P>{t('section7.deletion')}</P>

          <H3 id="privacy-section-8">{t('section8.title')}</H3>
          <P>{t('section8.intro')}</P>
          <UL>
            <li>{t.rich('section8.accessItem', strongRich)}</li>
            <li>{t.rich('section8.rectificationItem', strongRich)}</li>
            <li>{t.rich('section8.erasureItem', strongRich)}</li>
            <li>{t.rich('section8.restrictionItem', strongRich)}</li>
            <li>{t.rich('section8.objectionItem', strongRich)}</li>
            <li>{t.rich('section8.portabilityItem', strongRich)}</li>
            <li>{t.rich('section8.withdrawConsentItem', strongRich)}</li>
          </UL>
          <P>{t('section8.exerciseLabel')}</P>
          <UL>
            <li>{t('section8.dataSectionItem')}</li>
            <li>{t.rich('section8.emailItem', mailRich)}</li>
          </UL>
          <P>{t('section8.responseTime')}</P>
          <P>
            {t.rich('section8.icoComplaint', {
              ico: (c) => <ExtLink href="https://ico.org.uk">{c}</ExtLink>,
            })}
          </P>

          <H3 id="privacy-section-9">{t('section9.title')}</H3>
          <P>{t('section9.intro')}</P>
          <UL>
            <li>{t.rich('section9.necessaryItem', strongRich)}</li>
            <li>{t.rich('section9.analyticsItem', strongRich)}</li>
          </UL>
          <P>{t('section9.noAds')}</P>

          <H3 id="privacy-section-10">{t('section10.title')}</H3>
          <P>{t.rich('section10.body', mailRich)}</P>

          <H3 id="privacy-section-11">{t('section11.title')}</H3>
          <P>{t('section11.body')}</P>

          <H3 id="privacy-section-12">{t('section12.title')}</H3>
          <P>{t('section12.intro')}</P>
          <UL>
            <li>
              <Strong>{t('section12.emailLabel')}</Strong>{' '}
              <MailLink to="support@mindreset.ai" />
            </li>
            <li>
              <Strong>{t('section12.postalLabel')}</Strong>{' '}
              <Note inline>{t('section12.postalNote')}</Note>
            </li>
          </UL>
        </article>

        <Footer omit="privacy" />
      </div>
    </main>
  );
}
