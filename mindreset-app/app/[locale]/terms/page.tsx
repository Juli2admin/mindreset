import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
// Phase i18n.1b — locale-aware Link.
import { Link } from '@/i18n/navigation';
import { PALETTE as FULL_PALETTE, TOKENS } from '@/lib/brand/colors';
import Footer from '@/components/Footer';
import TopBar from '@/components/TopBar';

const PALETTE = FULL_PALETTE.day;
const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

const LAST_UPDATED = '26 May 2026';

export const metadata = {
  title: 'Terms of Service — MindReset',
  description:
    'Terms of Service, Refund & Cancellation Policy, and Medical & Crisis Disclaimer for the MindReset AI self-help platform.',
};

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
function H4({ children }: { children: ReactNode }) {
  return (
    <h4
      className="text-[17px] mt-8 mb-2"
      style={{ fontFamily: SANS, fontWeight: 500, color: PALETTE.text }}
    >
      {children}
    </h4>
  );
}
function H5({ children }: { children: ReactNode }) {
  return (
    <h5
      className="text-[15px] mt-6 mb-2"
      style={{ fontFamily: SANS, fontWeight: 500, color: PALETTE.text }}
    >
      {children}
    </h5>
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
function Note({ children }: { children: ReactNode }) {
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
function Divider() {
  return (
    <hr
      className="my-20 border-0"
      style={{ borderTop: `1px solid ${PALETTE.border}` }}
    />
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

export default async function TermsPage() {
  const t = await getTranslations('Terms');
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

        {/* ─── 1. Terms of Service ────────────────────────────── */}
        <article className="mb-12">
          <H2>{t('article1.title')}</H2>

          <P>
            <Strong>{t('article1.preamble.operatorLabel')}</Strong>{' '}
            {t.rich('article1.preamble.operatorBody', {
              strong: (c) => <Strong>{c}</Strong>,
            })}
          </P>
          <Note>{t('article1.preamble.note')}</Note>
          <P>
            <Strong>{t('article1.preamble.contactLabel')}</Strong>{' '}
            <MailLink to="support@mindreset.ai" />
          </P>
          <P>{t('article1.preamble.agreement')}</P>

          <H3 id="terms-section-1">{t('article1.section1.title')}</H3>
          <P>
            {t.rich('article1.section1.whatItIs', {
              strong: (c) => <Strong>{c}</Strong>,
            })}
          </P>
          <P>
            {t.rich('article1.section1.whatItIsNotLabel', {
              strong: (c) => <Strong>{c}</Strong>,
            })}
          </P>
          <UL>
            <li>{t('article1.section1.notTherapyItem')}</li>
            <li>{t('article1.section1.notMedicalItem')}</li>
            <li>{t('article1.section1.notSubstituteItem')}</li>
            <li>{t('article1.section1.notCrisisItem')}</li>
            <li>{t('article1.section1.notDiagnosticItem')}</li>
          </UL>
          <P>{t('article1.section1.closing')}</P>

          <H3 id="terms-section-2">{t('article1.section2.title')}</H3>
          <P>
            {t.rich('article1.section2.intro', {
              strong: (c) => <Strong>{c}</Strong>,
            })}
          </P>
          <P>{t('article1.section2.classificationLabel')}</P>
          <UL>
            <li>
              {t.rich('article1.section2.greenItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>
              {t.rich('article1.section2.yellowItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>
              {t.rich('article1.section2.redItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
          </UL>
          <P>
            {t.rich('article1.section2.importantLabel', {
              strong: (c) => <Strong>{c}</Strong>,
            })}
          </P>
          <UL>
            <li>{t('article1.section2.understoodItem')}</li>
            <li>{t('article1.section2.notForCrisisItem')}</li>
            <li>{t('article1.section2.acceptResponsibilityItem')}</li>
            <li>{t('article1.section2.releaseLiabilityItem')}</li>
          </UL>

          <H3 id="terms-section-3">{t('article1.section3.title')}</H3>
          <P>{t('article1.section3.intro')}</P>
          <UL>
            <li>
              {t.rich('article1.section3.ageItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>{t('article1.section3.acceptTermsItem')}</li>
            <li>{t('article1.section3.acceptPrivacyItem')}</li>
            <li>{t('article1.section3.jurisdictionItem')}</li>
            <li>{t('article1.section3.readDisclaimerItem')}</li>
          </UL>
          <P>{t('article1.section3.under18')}</P>

          <H3 id="terms-section-4">{t('article1.section4.title')}</H3>
          <P>
            {t.rich('article1.section4.intro', {
              strong: (c) => <Strong>{c}</Strong>,
            })}
          </P>
          <P>
            {t.rich('article1.section4.experiencingLabel', {
              strong: (c) => <Strong>{c}</Strong>,
            })}
          </P>
          <UL>
            <li>{t('article1.section4.suicidalItem')}</li>
            <li>{t('article1.section4.harmOthersItem')}</li>
            <li>{t('article1.section4.acuteSymptomsItem')}</li>
            <li>{t('article1.section4.withdrawalItem')}</li>
            <li>{t('article1.section4.dangerItem')}</li>
          </UL>
          <P>
            {t.rich('article1.section4.ukResourcesLabel', {
              strong: (c) => <Strong>{c}</Strong>,
            })}
          </P>
          <UL>
            <li>
              {t.rich('article1.section4.samaritansItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>
              {t.rich('article1.section4.nhsItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>
              {t.rich('article1.section4.gpItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>
              {t.rich('article1.section4.aeItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
          </UL>
          <P>{t('article1.section4.outsideUk')}</P>
          <P>{t('article1.section4.liability')}</P>

          <H3 id="terms-section-5">{t('article1.section5.title')}</H3>
          <UL>
            <li>{t('article1.section5.registerItem')}</li>
            <li>{t('article1.section5.responsibilityItem')}</li>
            <li>{t('article1.section5.legalContentItem')}</li>
            <li>{t('article1.section5.safetyItem')}</li>
            <li>{t('article1.section5.harmItem')}</li>
          </UL>

          <H3 id="terms-section-6">{t('article1.section6.title')}</H3>
          <P>{t('article1.section6.intro')}</P>
          <P>{t('article1.section6.acknowledgeLabel')}</P>
          <UL>
            <li>{t('article1.section6.inaccurateItem')}</li>
            <li>{t('article1.section6.notKnowItem')}</li>
            <li>{t('article1.section6.notJudgmentItem')}</li>
            <li>{t('article1.section6.informationalItem')}</li>
            <li>{t('article1.section6.consultItem')}</li>
          </UL>
          <P>{t('article1.section6.profile')}</P>
          <P>
            {t.rich('article1.section6.humanReview', {
              mail: () => <MailLink to="support@mindreset.ai" />,
            })}
          </P>
          <P>{t('article1.section6.voiceInput')}</P>

          <H3 id="terms-section-7">{t('article1.section7.title')}</H3>
          <P>{t('article1.section7.ip')}</P>
          <P>{t('article1.section7.license')}</P>
          <P>{t('article1.section7.agreeNotToLabel')}</P>
          <UL>
            <li>{t('article1.section7.noRedistributeItem')}</li>
            <li>{t('article1.section7.noScrapeItem')}</li>
            <li>{t('article1.section7.noReverseItem')}</li>
            <li>{t('article1.section7.noCommercialItem')}</li>
          </UL>

          <H3 id="terms-section-8">{t('article1.section8.title')}</H3>
          <P>
            {t.rich('article1.section8.intro', {
              strong: (c) => <Strong>{c}</Strong>,
            })}
          </P>

          <H4>{t('article1.section8.minimind.title')}</H4>
          <P>
            {t.rich('article1.section8.minimind.freeTaster', {
              strong: (c) => <Strong>{c}</Strong>,
            })}
          </P>

          <H5>{t('article1.section8.minimind.subs.title')}</H5>
          <P>{t('article1.section8.minimind.subs.intro')}</P>
          <UL>
            <li>
              {t.rich('article1.section8.minimind.subs.essentialItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>
              {t.rich('article1.section8.minimind.subs.extendedItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
          </UL>
          <UL>
            <li>{t('article1.section8.minimind.subs.billingItem')}</li>
            <li>{t('article1.section8.minimind.subs.resetItem')}</li>
            <li>
              {t.rich('article1.section8.minimind.subs.refundWindowItem', {
                strong: (c) => <Strong>{c}</Strong>,
                mail: () => <MailLink to="support@mindreset.ai" />,
              })}
            </li>
            <li>
              {t.rich('article1.section8.minimind.subs.cancellationItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
              <UL>
                <li>{t('article1.section8.minimind.subs.cancelNoFurtherItem')}</li>
                <li>{t('article1.section8.minimind.subs.cancelRetainItem')}</li>
                <li>{t('article1.section8.minimind.subs.cancelAutoEndItem')}</li>
              </UL>
            </li>
            <li>{t('article1.section8.minimind.subs.noPartialItem')}</li>
          </UL>

          <H5>{t('article1.section8.minimind.topup.title')}</H5>
          <UL>
            <li>{t('article1.section8.minimind.topup.priceItem')}</li>
            <li>{t('article1.section8.minimind.topup.expiryItem')}</li>
            <li>{t('article1.section8.minimind.topup.availableItem')}</li>
            <li>
              {t.rich('article1.section8.minimind.topup.nonRefundableItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
          </UL>

          <H4>{t('article1.section8.modules.title')}</H4>
          <UL>
            <li>{t('article1.section8.modules.priceItem')}</li>
            <li>{t('article1.section8.modules.subscriberDiscountItem')}</li>
            <li>{t('article1.section8.modules.immediateAccessItem')}</li>
            <li>
              {t.rich('article1.section8.modules.waiverItem', {
                mail: () => <MailLink to="support@mindreset.ai" />,
              })}
            </li>
            <li>
              {t.rich('article1.section8.modules.openedNonRefundableItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
          </UL>

          <H4>{t('article1.section8.journey.title')}</H4>
          <Note>{t('article1.section8.journey.note')}</Note>
          <P>{t('article1.section8.journey.optionsLabel')}</P>
          <H5>{t('article1.section8.journey.onetime.title')}</H5>
          <UL>
            <li>{t('article1.section8.journey.onetime.accessItem')}</li>
            <li>
              {t.rich('article1.section8.journey.onetime.nonRefundableItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>{t('article1.section8.journey.onetime.regulationsItem')}</li>
            <li>
              {t.rich('article1.section8.journey.onetime.confirmWaiverItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>{t('article1.section8.journey.onetime.noRefundsItem')}</li>
          </UL>
          <H5>{t('article1.section8.journey.instalment.title')}</H5>
          <UL>
            <li>{t('article1.section8.journey.instalment.scheduleItem')}</li>
            <li>{t('article1.section8.journey.instalment.stopAnytimeItem')}</li>
            <li>{t('article1.section8.journey.instalment.nonRefundableItem')}</li>
            <li>{t('article1.section8.journey.instalment.firstBlockItem')}</li>
            <li>{t('article1.section8.journey.instalment.confirmWaiverItem')}</li>
          </UL>

          <H4>{t('article1.section8.payment.title')}</H4>
          <P>{t('article1.section8.payment.processor')}</P>
          <P>{t('article1.section8.payment.taxes')}</P>

          <H3 id="terms-section-9">{t('article1.section9.title')}</H3>
          <UL>
            <li>
              {t.rich('article1.section9.subscriptionsItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>
              {t.rich('article1.section9.oneOffItem', {
                strong: (c) => <Strong>{c}</Strong>,
                mail: () => <MailLink to="support@mindreset.ai" />,
              })}
            </li>
          </UL>

          <H3 id="terms-section-10">{t('article1.section10.title')}</H3>
          <P>
            {t.rich('article1.section10.asIs', {
              strong: (c) => <Strong>{c}</Strong>,
            })}
          </P>
          <P>{t('article1.section10.fullestExtentLabel')}</P>
          <UL>
            <li>{t('article1.section10.aggregateItem')}</li>
            <li>{t('article1.section10.indirectItem')}</li>
            <li>{t('article1.section10.decisionsItem')}</li>
            <li>{t('article1.section10.nothingItem')}</li>
          </UL>
          <P>
            {t.rich('article1.section10.statutoryRights', {
              strong: (c) => <Strong>{c}</Strong>,
            })}
          </P>

          <H3 id="terms-section-11">{t('article1.section11.title')}</H3>
          <P>
            {t.rich('article1.section11.specialCategory', {
              privacy: (c) => (
                <Link
                  href="/privacy"
                  className="underline underline-offset-2"
                  style={{ color: PALETTE.accent }}
                >
                  {c}
                </Link>
              ),
            })}
          </P>
          <P>
            {t.rich('article1.section11.lawfulBasis', {
              strong: (c) => <Strong>{c}</Strong>,
            })}
          </P>

          <H3 id="terms-section-12">{t('article1.section12.title')}</H3>
          <P>{t('article1.section12.intro')}</P>
          <UL>
            <li>
              {t.rich('article1.section12.gdprItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>
              {t.rich('article1.section12.duaItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>
              {t.rich('article1.section12.euGdprItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>
              {t.rich('article1.section12.aiActItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>
              {t.rich('article1.section12.onlineSafetyItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>
              {t.rich('article1.section12.craItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>
              {t.rich('article1.section12.dmccItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>
              {t.rich('article1.section12.mdrItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
          </UL>
          <P>{t('article1.section12.minors')}</P>

          <H3 id="terms-section-13">{t('article1.section13.title')}</H3>
          <P>
            {t.rich('article1.section13.governing', {
              strong: (c) => <Strong>{c}</Strong>,
            })}
          </P>
          <P>
            {t.rich('article1.section13.odr', {
              odr: (c) => (
                <ExtLink href="https://ec.europa.eu/consumers/odr">{c}</ExtLink>
              ),
            })}
          </P>

          <H3 id="terms-section-14">{t('article1.section14.title')}</H3>
          <P>{t('article1.section14.body')}</P>

          <H3 id="terms-section-15">{t('article1.section15.title')}</H3>
          <P>
            {t.rich('article1.section15.body', {
              mail: () => <MailLink to="support@mindreset.ai" />,
            })}
          </P>
        </article>

        <Divider />

        {/* ─── 2. Refund & Cancellation Policy ────────────────── */}
        <article className="mb-12">
          <H2>{t('refund.title')}</H2>
          <P>{t('refund.intro')}</P>

          <H3 id="terms-refund-minimind">{t('refund.minimind.title')}</H3>
          <UL>
            <li>
              {t.rich('refund.minimind.windowItem', {
                strong: (c) => <Strong>{c}</Strong>,
                mail: () => <MailLink to="support@mindreset.ai" />,
              })}
            </li>
            <li>{t('refund.minimind.cancelAnytimeItem')}</li>
            <li>
              {t.rich('refund.minimind.whenCancelItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>{t('refund.minimind.endOfCycleItem')}</li>
            <li>
              {t.rich('refund.minimind.noPartialItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
          </UL>

          <H3 id="terms-refund-minimind-topup">{t('refund.topup.title')}</H3>
          <UL>
            <li>{t('refund.topup.priceItem')}</li>
            <li>{t('refund.topup.immediateUseItem')}</li>
            <li>{t('refund.topup.waiverItem')}</li>
            <li>
              {t.rich('refund.topup.nonRefundableItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>{t('refund.topup.expiryItem')}</li>
          </UL>

          <H3 id="terms-refund-modules-individual">{t('refund.modules.title')}</H3>
          <UL>
            <li>{t('refund.modules.priceItem')}</li>
            <li>{t('refund.modules.subscriberDiscountItem')}</li>
            <li>{t('refund.modules.immediateAccessItem')}</li>
            <li>
              {t.rich('refund.modules.waiverItem', {
                mail: () => <MailLink to="support@mindreset.ai" />,
              })}
            </li>
            <li>
              {t.rich('refund.modules.openedNonRefundableItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
          </UL>

          <H3 id="terms-refund-recode-onetime">{t('refund.journeyOnetime.title')}</H3>
          <UL>
            <li>
              {t.rich('refund.journeyOnetime.immediateUseItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>{t('refund.journeyOnetime.waiverItem')}</li>
            <li>
              {t.rich('refund.journeyOnetime.nonRefundableItem', {
                strong: (c) => <Strong>{c}</Strong>,
              })}
            </li>
            <li>{t('refund.journeyOnetime.noRefundsItem')}</li>
          </UL>

          <H3 id="terms-refund-recode-installment">{t('refund.journeyInstalment.title')}</H3>
          <UL>
            <li>{t('refund.journeyInstalment.scheduleItem')}</li>
            <li>{t('refund.journeyInstalment.stopAnytimeItem')}</li>
            <li>{t('refund.journeyInstalment.nonRefundablePaymentsItem')}</li>
            <li>{t('refund.journeyInstalment.firstBlockItem')}</li>
          </UL>

          <H3 id="terms-refund-howto">{t('refund.howto.title')}</H3>
          <P>
            {t.rich('refund.howto.intro', {
              mail: () => <MailLink to="support@mindreset.ai" />,
            })}
          </P>
          <UL>
            <li>{t('refund.howto.orderIdItem')}</li>
            <li>{t('refund.howto.emailItem')}</li>
            <li>{t('refund.howto.reasonItem')}</li>
          </UL>
          <P>{t('refund.howto.outro')}</P>

          <H3 id="terms-refund-faulty">{t('refund.faulty.title')}</H3>
          <P>
            {t.rich('refund.faulty.body', {
              strong: (c) => <Strong>{c}</Strong>,
              mail: () => <MailLink to="support@mindreset.ai" />,
            })}
          </P>
        </article>

        <Divider />

        {/* ─── 3. Medical & Crisis Disclaimer ─────────────────── */}
        <article className="mb-8">
          <H2>{t('disclaimer.title')}</H2>
          <P>
            {t.rich('disclaimer.primary', {
              strong: (chunks) => <Strong>{chunks}</Strong>,
            })}
          </P>
          <P>{t('disclaimer.secondary')}</P>
          <P>
            {t.rich('disclaimer.ukCrisis', {
              strong: (chunks) => <Strong>{chunks}</Strong>,
            })}
          </P>
        </article>

        <Footer omit="terms" />
      </div>
    </main>
  );
}
