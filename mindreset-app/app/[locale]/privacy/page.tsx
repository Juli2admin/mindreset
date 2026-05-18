import type { ReactNode } from 'react';
// Phase i18n.1b — locale-aware Link.
import { Link } from '@/i18n/navigation';
import { PALETTE as FULL_PALETTE, TOKENS } from '@/lib/brand/colors';
import Footer from '@/components/Footer';

const PALETTE = FULL_PALETTE.day;
const SANS = TOKENS.sans;
const SERIF = TOKENS.serif;

const LAST_UPDATED = '14 May 2026';

export const metadata = {
  title: 'Privacy Policy — MindReset',
  description:
    'Privacy Policy for the MindReset AI self-help platform — what data we collect, how we use it, and your rights under UK GDPR.',
};

// Typography helpers — keep the legal text below uncluttered.
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
        className="min-w-full text-[14px] leading-[1.55]"
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

export default function PrivacyPage() {
  return (
    <main className="min-h-screen" style={{ background: PALETTE.bg }}>
      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        {/* ─── Page header ────────────────────────────────────── */}
        <header className="mb-16">
          <Link href="/" className="inline-block">
            <h1
              className="text-[22px] tracking-tight"
              style={{ fontFamily: SERIF, fontWeight: 400 }}
            >
              <span style={{ color: PALETTE.accent }}>Mind</span>
              <span style={{ color: PALETTE.accentSage }}>Reset</span>
            </h1>
          </Link>
          <p
            className="text-[11px] uppercase tracking-[0.22em] mt-8"
            style={{ color: PALETTE.textHint, fontFamily: SANS, fontWeight: 500 }}
          >
            Last updated · {LAST_UPDATED}
          </p>
        </header>

        {/* ─── Privacy Policy ─────────────────────────────────── */}
        <article className="mb-8">
          <H2>Privacy Policy</H2>

          <P>
            <Strong>Data Controller:</Strong>{' '}
            <Strong>MindReset AI self-help platform</Strong>, operated by Julia Loya
            (sole proprietor), London, United Kingdom — <MailLink to="support@mindreset.ai" />
          </P>
          <Note>
            [NOTE: ICO Registration to be obtained at ico.org.uk before public launch.
            Annual fee ~£40-60. Register before any marketing or public availability.]
          </Note>

          <H3 id="privacy-section-1">1. What This Policy Covers</H3>
          <P>
            This Privacy Policy explains what personal data we collect about you when
            you use the Service, why we collect it, how we secure it, with whom we
            share it, how long we keep it, and what rights you have under UK GDPR and
            (where applicable) EU GDPR.
          </P>

          <H3 id="privacy-section-2">2. Data We Collect</H3>
          <Table>
            <THead>
              <TR>
                <TH>Category</TH>
                <TH>Examples</TH>
                <TH>Purpose</TH>
                <TH>Lawful basis</TH>
              </TR>
            </THead>
            <tbody>
              <TR>
                <TD><Strong>Account data</Strong></TD>
                <TD>email address, hashed password, country (inferred from IP), preferred language</TD>
                <TD>create and manage your account; deliver the Service</TD>
                <TD>Contract</TD>
              </TR>
              <TR>
                <TD><Strong>Screening data</Strong></TD>
                <TD>your responses to the Readiness Check, resulting classification (Green / Yellow / Red), reason summary</TD>
                <TD>classify whether the Service is appropriate for you; protect users from potential harm</TD>
                <TD>Explicit consent (Art 9 §2 a UK GDPR)</TD>
              </TR>
              <TR>
                <TD><Strong>Conversation data</Strong> (special category)</TD>
                <TD>the messages you send to MiniMind or modules; reflections and answers in exercises; mood and energy check-ins</TD>
                <TD>AI analysis to suggest practices; personalised wellbeing support; tracking your progress</TD>
                <TD>Explicit consent (Art 9 §2 a UK GDPR)</TD>
              </TR>
              <TR>
                <TD><Strong>Wellbeing profile</Strong></TD>
                <TD>derived patterns (e.g., &ldquo;elevated anxiety&rdquo;, &ldquo;recent stable period&rdquo;), state and theme observations</TD>
                <TD>personalisation; smart routing to appropriate practices and modules</TD>
                <TD>Explicit consent (Art 9 §2 a UK GDPR)</TD>
              </TR>
              <TR>
                <TD><Strong>Safety events</Strong></TD>
                <TD>flagged conversation moments that triggered our safety protocol, our automated response, optional manual review notes</TD>
                <TD>safety protocol audit; compliance with Online Safety Act 2023 priority offences obligations</TD>
                <TD>Legitimate interest (audit trail for safety) / Legal obligation</TD>
              </TR>
              <TR>
                <TD><Strong>Usage data</Strong></TD>
                <TD>device type, browser, IP address, cookies, timestamps, page views</TD>
                <TD>security, anti-abuse, service improvement, anonymous analytics</TD>
                <TD>Legitimate interest</TD>
              </TR>
              <TR>
                <TD><Strong>Payment data</Strong></TD>
                <TD>last 4 digits of card, transaction ID, billing email (full card data is held by the payment processor, not us)</TD>
                <TD>billing, fraud prevention, financial record-keeping</TD>
                <TD>Contract / Legal obligation (tax law)</TD>
              </TR>
              <TR>
                <TD><Strong>Support messages</Strong></TD>
                <TD>emails you send to <MailLink to="support@mindreset.ai" /> or our other addresses</TD>
                <TD>responding to inquiries; resolving issues</TD>
                <TD>Legitimate interest</TD>
              </TR>
            </tbody>
          </Table>
          <P>
            We do not request your real name, physical address, date of birth, or
            government identifiers. Please avoid sharing personally identifying details
            about yourself or others inside conversations with the AI.
          </P>

          <H3 id="privacy-section-3">3. How We Use AI</H3>
          <P>
            Your conversation data is processed by our AI engine to generate responses
            and suggest practices.
          </P>
          <UL>
            <li>
              The AI creates non-medical wellbeing observations (e.g., &ldquo;the user
              describes physical tension when discussing work&rdquo;) to better
              personalise practices
            </li>
            <li>The AI does not make medical diagnoses</li>
            <li>The AI does not make decisions that have legal effects on you</li>
            <li>
              You may contact us at <MailLink to="support@mindreset.ai" /> if you
              believe an automated response is incorrect or harmful; a human will review
            </li>
          </UL>
          <P>
            Under Article 22 of UK GDPR, you have the right not to be subject to a
            decision based solely on automated processing that produces legal or
            similarly significant effects. The wellbeing observations and practice
            suggestions made by our AI do not constitute such decisions.
          </P>

          <H3 id="privacy-section-4">4. With Whom We Share Data</H3>
          <P>
            We <Strong>never</Strong> sell or rent your personal data. We share it
            only with categories of service providers necessary to deliver the
            Service:
          </P>
          <UL>
            <li>Cloud hosting and database services</li>
            <li>AI infrastructure (for the conversational and analytical features)</li>
            <li>Authentication and account management</li>
            <li>Payment processing</li>
            <li>Transactional email delivery</li>
            <li>Website hosting</li>
          </UL>
          <P>
            Specific providers may change over time. A current list of the service
            providers we use is available on request — email{' '}
            <MailLink to="support@mindreset.ai" />.
          </P>
          <P>
            We may also disclose your data when legally compelled by a court order or
            similar legal process.
          </P>
          <P>
            We use <Strong>Standard Contractual Clauses</Strong> (or equivalent UK IDTA
            mechanisms) for any international data transfers, supplemented where
            necessary by additional safeguards including encryption in transit and at
            rest.
          </P>

          <H3 id="privacy-section-5">5. International Transfers</H3>
          <P>
            Your data may be processed outside the UK and EU, primarily in the United
            States. Where this happens we rely on either:
          </P>
          <UL>
            <li>An adequacy decision by the UK or EU (where one exists)</li>
            <li>Standard Contractual Clauses approved by the European Commission or the UK ICO</li>
            <li>Other appropriate safeguards permitted under UK GDPR or EU GDPR</li>
          </UL>
          <P>
            You may request details of the specific safeguards in place for any
            transfer by emailing <MailLink to="support@mindreset.ai" />.
          </P>

          <H3 id="privacy-section-6">6. Security</H3>
          <P>
            We implement appropriate technical and organisational measures to protect
            your data:
          </P>
          <UL>
            <li><Strong>TLS 1.2 or higher</Strong> for all data in transit</li>
            <li><Strong>AES-256 encryption at rest</Strong> for stored data (provided by Supabase)</li>
            <li><Strong>Hashed passwords</Strong> using industry-standard algorithms (managed by Clerk)</li>
            <li><Strong>Role-based access</Strong> to our backend systems; access logged and audited</li>
            <li><Strong>Confidentiality obligations</Strong> for anyone with access to data</li>
            <li><Strong>Regular security reviews</Strong> and dependency vulnerability monitoring</li>
            <li><Strong>Encrypted backups</Strong> with limited retention</li>
          </UL>
          <P>
            No security system is 100% impenetrable. In the event of a data breach
            affecting your rights and freedoms, we will notify the ICO within 72 hours
            and, where required, notify affected users without undue delay.
          </P>

          <H3 id="privacy-section-7">7. Retention</H3>
          <Table>
            <THead>
              <TR>
                <TH>Data category</TH>
                <TH>Retention period</TH>
              </TR>
            </THead>
            <tbody>
              <TR>
                <TD><Strong>Account data</Strong></TD>
                <TD>Active account: until you delete it. Inactive account: deleted 12 months after last sign-in.</TD>
              </TR>
              <TR>
                <TD><Strong>Screening data</Strong></TD>
                <TD>12 months after last sign-in, or immediately upon account deletion</TD>
              </TR>
              <TR>
                <TD><Strong>Conversation data</Strong></TD>
                <TD>12 months after last sign-in, or immediately upon account deletion</TD>
              </TR>
              <TR>
                <TD><Strong>Wellbeing profile</Strong></TD>
                <TD>Same as Conversation data</TD>
              </TR>
              <TR>
                <TD><Strong>Safety events</Strong></TD>
                <TD>7 years (legal audit trail obligation) — depersonalised after account deletion</TD>
              </TR>
              <TR>
                <TD><Strong>Payment records</Strong></TD>
                <TD>6 years (UK tax law requirement)</TD>
              </TR>
              <TR>
                <TD><Strong>Backups</Strong></TD>
                <TD>Maximum 30 days</TD>
              </TR>
              <TR>
                <TD><Strong>Support messages</Strong></TD>
                <TD>24 months from last contact</TD>
              </TR>
            </tbody>
          </Table>
          <P>
            You may request earlier deletion of any data, except where we have a legal
            obligation to retain it (e.g., financial records under tax law, safety
            events under Online Safety Act).
          </P>

          <H3 id="privacy-section-8">8. Your Rights</H3>
          <P>Under UK GDPR (and EU GDPR where applicable), you have the right to:</P>
          <UL>
            <li><Strong>Access</Strong> — request a copy of the personal data we hold about you</li>
            <li><Strong>Rectification</Strong> — correct inaccurate data</li>
            <li><Strong>Erasure</Strong> — request deletion of your data (&ldquo;right to be forgotten&rdquo;), subject to legal retention obligations</li>
            <li><Strong>Restriction</Strong> — request that we limit how we process your data</li>
            <li><Strong>Objection</Strong> — object to processing based on legitimate interests</li>
            <li><Strong>Portability</Strong> — receive your data in a structured, commonly-used, machine-readable format</li>
            <li><Strong>Withdraw consent</Strong> — for any processing based on consent</li>
          </UL>
          <P>To exercise any of these rights:</P>
          <UL>
            <li>Use the &ldquo;Data&rdquo; section in your account settings (when available), or</li>
            <li>Email <MailLink to="support@mindreset.ai" /> with your request</li>
          </UL>
          <P>
            We will respond within one month, or notify you within one month if we
            need additional time (up to a further two months) due to complexity.
          </P>
          <P>
            If you are unsatisfied with our handling of your data, you have the right
            to lodge a complaint with the UK Information Commissioner&apos;s Office
            (ICO) at <ExtLink href="https://ico.org.uk">ico.org.uk</ExtLink>, or with
            your local data protection authority in the EU.
          </P>

          <H3 id="privacy-section-9">9. Cookies</H3>
          <P>We use:</P>
          <UL>
            <li>
              <Strong>Strictly necessary cookies</Strong> — for authentication (Clerk
              session), security, and basic site function. These cannot be disabled
            </li>
            <li>
              <Strong>Optional analytics cookies</Strong> — for understanding usage
              patterns and improving the Service. You will be asked to accept or
              decline these on your first visit
            </li>
          </UL>
          <P>
            We do not use advertising cookies, tracking pixels for marketing, or
            third-party trackers.
          </P>

          <H3 id="privacy-section-10">10. Children&apos;s Data</H3>
          <P>
            The Service is for adults aged 18 and over. We do not knowingly collect
            personal data from individuals under 18. If you believe a child under 18
            has provided us with personal data, please contact us at{' '}
            <MailLink to="support@mindreset.ai" /> and we will delete it.
          </P>

          <H3 id="privacy-section-11">11. Changes to This Policy</H3>
          <P>
            We may update this Privacy Policy from time to time to reflect changes in
            our practices or in applicable law. Material changes will be announced by
            email and/or in-app at least 30 days before they take effect. Continued
            use of the Service after the effective date constitutes acceptance of the
            updated Policy.
          </P>

          <H3 id="privacy-section-12">12. Contact</H3>
          <P>For privacy-related questions or to exercise your rights:</P>
          <UL>
            <li><Strong>Email:</Strong> <MailLink to="support@mindreset.ai" /></li>
            <li>
              <Strong>Postal address:</Strong>{' '}
              <Note inline>
                [NOTE: To be added when a registered business address is available.]
              </Note>
            </li>
          </UL>
        </article>

        <Footer omit="privacy" />
      </div>
    </main>
  );
}
