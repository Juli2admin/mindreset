import type { ReactNode } from 'react';
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

export default function TermsPage() {
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
          Last updated · {LAST_UPDATED}
        </p>

        {/* ─── 1. Terms of Service ────────────────────────────── */}
        <article className="mb-12">
          <H2>Terms of Service</H2>

          <P>
            <Strong>Operator:</Strong> <Strong>MindReset AI self-help platform</Strong>,
            operated by <Strong>Julia Loya</Strong> (sole proprietor), based in London,
            United Kingdom.
          </P>
          <Note>
            [NOTE: To be updated when a UK Limited company is registered. The corporate
            entity, registration number, registered address, and trading name (if changed)
            will replace this line. The methodology and product structure remain the same.]
          </Note>
          <P>
            <Strong>Contact:</Strong> <MailLink to="support@mindreset.ai" />
          </P>
          <P>
            By using the MindReset AI self-help platform (the &ldquo;Service&rdquo;),
            available at mindreset.ai, you agree to these Terms. Read them carefully. If
            you do not agree, please do not use the Service.
          </P>

          <H3 id="terms-section-1">1. What This Service Is — And What It Is Not</H3>
          <P>
            <Strong>What it is.</Strong> The MindReset AI self-help platform (the
            &ldquo;Service&rdquo;) is an AI-assisted self-help platform for general
            psychological wellbeing. It provides conversational reflection, structured
            self-exploration exercises, grounding practices, educational materials, and
            progress tracking. It draws on established frameworks including somatic
            regulation, parts-aware self-work, trauma-informed pacing principles, narrative
            reframing, and integrative identity formation. It is positioned as a{' '}
            <Strong>wellbeing tool for non-clinical contexts.</Strong>
          </P>
          <P>
            <Strong>What it is not.</Strong>
          </P>
          <UL>
            <li>Not therapy, counselling, or psychiatric treatment</li>
            <li>Not a medical device</li>
            <li>
              Not a substitute for a qualified clinician, doctor, or licensed mental health
              professional
            </li>
            <li>Not a crisis service, emergency service, or 24-hour helpline</li>
            <li>
              Not a diagnostic tool — it does not diagnose, treat, cure, or prevent any
              medical or psychological condition
            </li>
          </UL>
          <P>
            If you require clinical care or are in distress that exceeds what self-help can
            support, please consult a qualified professional or contact emergency services.
            We provide signposting to such services within the Service.
          </P>

          <H3 id="terms-section-2">2. The Readiness Check (Section 0) — Informational Only</H3>
          <P>
            Before engaging with the deeper materials of the Service, you are invited to
            complete a short Readiness Check. The Readiness Check is provided as{' '}
            <Strong>informational guidance only.</Strong> It is not a medical or
            psychological assessment, not a diagnosis, and not a clinical gate.
          </P>
          <P>
            The Readiness Check classifies your responses into one of three informational
            categories:
          </P>
          <UL>
            <li>
              <Strong>Green</Strong> — Your responses suggest the Service may be suitable
              for you at this time.
            </li>
            <li>
              <Strong>Yellow</Strong> — Your responses suggest you may benefit from a
              careful, paced introduction. Some materials may not be appropriate at this
              time.
            </li>
            <li>
              <Strong>Red</Strong> — Your responses suggest the Service may not be
              appropriate for you at this time, and that professional support would serve
              you better.
            </li>
          </UL>
          <P>
            <Strong>Important.</Strong> The Readiness Check provides information; it does
            not gate access to the Service. You may choose to proceed regardless of the
            result. If you choose to proceed despite a Red or Yellow result, or to retake
            the Readiness Check with different responses, you do so on your own
            responsibility and confirm by your continued use that:
          </P>
          <UL>
            <li>
              You have read and understood the Readiness Check result and the limitations
              of the Service stated in these Terms;
            </li>
            <li>
              You understand the Service is not appropriate for active crisis, severe
              psychiatric symptoms, active suicidality, recent psychosis, dissociation
              requiring clinical care, or other conditions that exceed self-help support;
            </li>
            <li>You accept full responsibility for your decision to use the Service;</li>
            <li>
              You release the operator of the Service (currently Julia Loya, sole
              proprietor) from liability for any harm arising from your use of the Service
              when the Readiness Check has indicated it may not be appropriate.
            </li>
          </UL>

          <H3 id="terms-section-3">3. Acceptance and Age</H3>
          <P>By creating an account or using any part of the Service you confirm that:</P>
          <UL>
            <li>You are at least <Strong>18 years of age</Strong></li>
            <li>You accept these Terms of Service in full</li>
            <li>You accept our Privacy Policy</li>
            <li>You are accessing the Service from a jurisdiction where it is legal to do so</li>
            <li>You have read the Medical &amp; Crisis Disclaimer</li>
          </UL>
          <P>If you are under 18, you are not permitted to use the Service.</P>

          <H3 id="terms-section-4">4. No Emergency or Professional Treatment</H3>
          <P>
            The Service is{' '}
            <Strong>not designed for emergencies or active mental health crises.</Strong>
          </P>
          <P>
            <Strong>
              If you are experiencing any of the following, stop using the Service
              immediately and contact appropriate professional support:
            </Strong>
          </P>
          <UL>
            <li>Suicidal thoughts or intent to harm yourself</li>
            <li>Thoughts of harming others</li>
            <li>Acute psychiatric symptoms (psychosis, severe dissociation, mania)</li>
            <li>Active substance withdrawal</li>
            <li>Any immediate physical danger to yourself or others</li>
          </UL>
          <P><Strong>UK crisis resources:</Strong></P>
          <UL>
            <li><Strong>Samaritans</Strong> — 116 123 (free, 24 hours, every day)</li>
            <li><Strong>NHS 111</Strong> — option 2 for mental health (24 hours)</li>
            <li><Strong>Your GP</Strong> — for non-urgent mental health support</li>
            <li><Strong>A&amp;E or 999</Strong> — for any medical or psychiatric emergency</li>
          </UL>
          <P>
            The operator of the Service and the Service itself are not liable for any
            decision or action you take based on AI suggestions or content provided through
            the Service.
          </P>

          <H3 id="terms-section-5">5. Accounts and Security</H3>
          <UL>
            <li>
              You may register using your email address and a password. You may use a
              pseudonym.
            </li>
            <li>
              You are responsible for safeguarding your login credentials and for all
              activity that occurs under your account.
            </li>
            <li>
              You agree not to share illegal, threatening, defamatory, or abusive content
              within the Service.
            </li>
            <li>
              You agree not to attempt to circumvent or interfere with the Service&apos;s
              safety protocols, content filters, or technical safeguards.
            </li>
            <li>
              You agree not to use the Service to harm others, infringe rights, or violate
              any applicable law.
            </li>
          </UL>

          <H3 id="terms-section-6">6. AI and Automated Processing</H3>
          <P>
            The Service uses artificial intelligence (large language models provided
            by a third-party AI infrastructure partner) to generate conversational
            responses, suggest practices, and personalise educational content.
          </P>
          <P>You acknowledge and accept that:</P>
          <UL>
            <li>
              AI responses are generated automatically and may be inaccurate, incomplete,
              or unsuitable for your circumstances
            </li>
            <li>
              AI does not &ldquo;know&rdquo; or &ldquo;understand&rdquo; you in the way a
              human practitioner does
            </li>
            <li>AI cannot replace the clinical judgment of a qualified professional</li>
            <li>AI-generated content should be treated as informational, not as personal advice</li>
            <li>
              You should not rely on AI suggestions for decisions with significant life
              consequences without consulting a qualified professional
            </li>
          </UL>
          <P>
            The AI processes your conversations to generate a private wellbeing profile
            (e.g., &ldquo;elevated anxiety patterns&rdquo;) to better tailor practices.
            This profile is not a diagnosis and is not shared with third parties for
            marketing or research purposes. You may request to view, correct, or delete
            this profile at any time.
          </P>
          <P>
            A human review process is available if you believe an automated response is
            materially incorrect or harmful. Contact <MailLink to="support@mindreset.ai" />.
          </P>
          <P>
            You may use voice input as an alternative to typing on the MiniMind chat
            surface. Voice messages are securely transcribed and deleted after processing
            — we do not store the audio recording, and our speech-to-text provider is
            configured for zero data retention. Only the resulting text is saved to your
            conversation history (encrypted at rest). Voice input is optional — you may
            use the Service entirely by typing.
          </P>

          <H3 id="terms-section-7">7. Intellectual Property</H3>
          <P>
            All texts, audio, code, design, methodology, brand identity, and other
            materials within the Service are © Julia Loya, except where third-party content
            is clearly marked.
          </P>
          <P>
            You receive a personal, non-transferable, non-exclusive, non-commercial licence
            to access and use the content of the Service for your own personal wellbeing
            during your subscription or purchase term.
          </P>
          <P>You agree not to:</P>
          <UL>
            <li>Redistribute, resell, publish, or share the Service&apos;s content</li>
            <li>
              Extract, scrape, or otherwise harvest AI responses for the purpose of training
              another AI system
            </li>
            <li>
              Reverse-engineer, decompile, or attempt to extract the source code of the
              Service
            </li>
            <li>Use the Service or its content for commercial gain</li>
          </UL>

          <H3 id="terms-section-8">8. Paid Products</H3>
          <P>
            The Service offers three product types.{' '}
            <Strong>Current pricing is always displayed at checkout</Strong> before any
            payment is taken. We may change pricing, offer promotional discounts, run
            sales, or adjust pricing for any product at any time; such changes do not
            affect any product you have already purchased.
          </P>

          <H4>MiniMind</H4>
          <P>
            <Strong>Free taster.</Strong> Every new account receives 50 messages with
            MiniMind at no cost. The taster does not require a card, has no time limit,
            and is limited to one per email address.
          </P>

          <H5>MiniMind subscriptions</H5>
          <P>Two tiers, each billed monthly or annually:</P>
          <UL>
            <li>
              <Strong>MiniMind Essential</Strong> — £14.99/month or £129/year. 200
              messages per billing cycle.
            </li>
            <li>
              <Strong>MiniMind Extended</Strong> — £24.99/month or £209/year. 800 to
              1,200 messages per billing cycle.
            </li>
          </UL>
          <UL>
            <li>Charged to your chosen payment method until you cancel</li>
            <li>
              Message allowance resets at the start of each billing cycle and does not
              roll over
            </li>
            <li>
              <Strong>7-day refund window:</Strong> you may request a full refund within
              7 days of your initial subscription purchase, having used fewer than 30
              messages, by emailing{' '}
              <MailLink to="support@mindreset.ai" /> with &ldquo;REFUND&rdquo; in the
              subject. After 7 days or 30 messages used, the standard cancellation policy
              applies.
            </li>
            <li>
              <Strong>Cancellation:</Strong> you may cancel at any time via your account
              billing settings. When you cancel:
              <UL>
                <li>No further payments will be taken</li>
                <li>You retain access until the end of your current billing cycle</li>
                <li>Access ends automatically at the end of the current cycle</li>
              </UL>
            </li>
            <li>
              No partial-cycle refunds are issued for cancellations after the 7-day
              window
            </li>
          </UL>

          <H5>Message top-up</H5>
          <UL>
            <li>
              £4.99 one-off charge — adds 200 messages to your current billing cycle
            </li>
            <li>Top-up messages expire when your billing cycle resets</li>
            <li>Available to both Essential and Extended subscribers; stackable</li>
            <li>
              <Strong>Non-refundable</Strong> — top-ups are delivered for immediate use
              as digital content
            </li>
          </UL>

          <H4>States &amp; Themes — individual module purchases</H4>
          <UL>
            <li>£59 per module (one-off, permanent access)</li>
            <li>
              Active MiniMind subscribers (Essential or Extended) pay £29 per module —
              discount applied automatically at checkout when logged in with an active
              subscription
            </li>
            <li>Access begins immediately upon successful payment</li>
            <li>
              At checkout, you confirm a waiver of the 14-day cancellation right under the
              Consumer Contracts Regulations 2013, in exchange for immediate access. If you
              do not open the module within 14 days of purchase, you may request a full
              refund by emailing{' '}
              <MailLink to="support@mindreset.ai" /> with &ldquo;REFUND&rdquo; in the
              subject
            </li>
            <li>
              <Strong>Once a module has been opened, the purchase is non-refundable</Strong>
            </li>
          </UL>

          <H4>The Journey</H4>
          <Note>
            [NOTE: Product name finalised as &ldquo;The Journey&rdquo;. Methodology
            described as the eight-stage Reset 8 Blocks framework — internal
            terminology only.]
          </Note>
          <P>Two purchase options:</P>
          <H5>Option A — Full programme, one-time payment:</H5>
          <UL>
            <li>Access to all eight blocks begins immediately upon successful payment</li>
            <li>
              <Strong>Non-refundable from the moment of purchase.</Strong> This is digital
              content delivered for immediate use
            </li>
            <li>
              Under the Consumer Contracts Regulations 2013, the 14-day cancellation right
              does not apply where the consumer has explicitly waived it in exchange for
              immediate access
            </li>
            <li>
              <Strong>You will be asked to confirm this waiver at checkout</Strong> before
              payment is taken
            </li>
            <li>
              No refunds are issued under any circumstances after purchase, except where
              required by the Consumer Rights Act 2015 for faulty content (see Refund
              Policy below)
            </li>
          </UL>
          <H5>Option B — Weekly instalment plan:</H5>
          <UL>
            <li>12 weekly payments of £55 — each payment unlocks the next block of content</li>
            <li>You may stop future payments at any time</li>
            <li>
              Any weekly payments already made are non-refundable; previously unlocked
              content remains accessible after stopping payments
            </li>
            <li>
              Once the first block has been accessed, the right to a cooling-off period no
              longer applies
            </li>
            <li>You will be asked to confirm the immediate-access waiver at checkout</li>
          </UL>

          <H4>Payment processing</H4>
          <P>
            All payments are processed by a regulated third-party payment processor,
            which acts as an independent data controller for payment card information
            under its own terms. We do not store full card numbers or CVV codes.
          </P>
          <P>
            All prices include VAT where applicable. We may add or remove sales taxes based
            on your billing location as required by law.
          </P>

          <H3 id="terms-section-9">9. Cancellation</H3>
          <UL>
            <li>
              <Strong>Subscriptions:</Strong> cancel anytime in your account billing
              settings; no further charges will be made
            </li>
            <li>
              <Strong>One-off products:</Strong> email{' '}
              <MailLink to="support@mindreset.ai" /> with &ldquo;REFUND&rdquo; in the
              subject line, your order ID, account email, and reason for refund
            </li>
          </UL>

          <H3 id="terms-section-10">10. Limitation of Liability</H3>
          <P>
            The Service is provided{' '}
            <Strong>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;</Strong> without
            warranties of any kind, express or implied, to the fullest extent permitted by
            law.
          </P>
          <P>To the fullest extent permitted by applicable law:</P>
          <UL>
            <li>
              Our total aggregate liability to you for any claim arising from your use of
              the Service is limited to the greater of (a) the amount you paid us in the
              six (6) months preceding the claim, or (b) £100.
            </li>
            <li>
              We are not liable for indirect, incidental, special, consequential, or
              punitive damages of any kind.
            </li>
            <li>
              We are not liable for any decisions you make, actions you take, or harm you
              experience as a result of using the Service, except where such liability
              cannot be excluded by law.
            </li>
            <li>
              Nothing in these Terms excludes our liability for death or personal injury
              caused by our negligence, for fraud, or for any other liability that cannot
              lawfully be excluded.
            </li>
          </UL>
          <P>
            Nothing in these Terms affects your statutory rights as a consumer under the{' '}
            <Strong>Consumer Rights Act 2015</Strong> or the{' '}
            <Strong>Digital Markets, Competition and Consumers Act 2024</Strong>.
          </P>

          <H3 id="terms-section-11">11. Data Protection</H3>
          <P>
            We process personal and special-category data as described in our{' '}
            <Link href="/privacy" className="underline underline-offset-2" style={{ color: PALETTE.accent }}>
              Privacy Policy
            </Link>
            . Special-category data (including data about your mental health and wellbeing)
            is processed only with your explicit consent, which you grant by accepting
            these Terms and using the Service for its intended purpose.
          </P>
          <P>
            The lawful basis for processing this data is{' '}
            <Strong>explicit consent under Article 9(2)(a) UK GDPR</Strong> and the
            equivalent provision of EU GDPR. You may withdraw this consent at any time by
            deleting your account, at which point your conversational data will be deleted
            in accordance with our retention schedule.
          </P>

          <H3 id="terms-section-12">12. Compliance with Applicable Law</H3>
          <P>
            The Service operates in compliance with applicable UK and EU law as it stands
            at the time of last update of these Terms, including but not limited to:
          </P>
          <UL>
            <li><Strong>UK GDPR</Strong> and the Data Protection Act 2018</li>
            <li><Strong>Data (Use and Access) Act 2025</Strong> (in force from 5 February 2026)</li>
            <li><Strong>EU GDPR</Strong> (where applicable to EU users)</li>
            <li>
              <Strong>EU AI Act</Strong> (where applicable; the Service is positioned as a
              limited-risk AI system for general wellbeing support, not a high-risk AI
              system)
            </li>
            <li>
              <Strong>Online Safety Act 2023</Strong> (where applicable; we maintain
              content moderation and safety protocols including, without limitation,
              detection and response to content involving self-harm and other priority
              harms)
            </li>
            <li><Strong>Consumer Rights Act 2015</Strong></li>
            <li><Strong>Digital Markets, Competition and Consumers Act 2024</Strong></li>
            <li>
              <Strong>Medical Devices Regulations 2002</Strong> — the Service is not a
              medical device and does not make medical claims
            </li>
          </UL>
          <P>
            We do not target users under 18 and do not knowingly process the personal data
            of minors.
          </P>

          <H3 id="terms-section-13">13. Governing Law and Disputes</H3>
          <P>
            These Terms are governed by the laws of <Strong>England &amp; Wales</Strong>.
            Any dispute arising under these Terms shall be submitted to the courts of
            England &amp; Wales, unless mandatory consumer law in your country of residence
            (within the UK or EU) allows you to bring a claim in your local courts.
          </P>
          <P>
            For EU users, you may also have the right to use the European Commission&apos;s
            Online Dispute Resolution platform:{' '}
            <ExtLink href="https://ec.europa.eu/consumers/odr">
              https://ec.europa.eu/consumers/odr
            </ExtLink>
          </P>

          <H3 id="terms-section-14">14. Changes to These Terms</H3>
          <P>
            We may update these Terms from time to time. If we make material changes, we
            will notify you by email and/or by displaying notice within the Service at
            least 30 days before the changes take effect. Continued use of the Service
            after the effective date constitutes your acceptance of the updated Terms. If
            you do not agree with the updated Terms, you may terminate your account at any
            time before the effective date and obtain a pro rata refund for any unused
            subscription period.
          </P>

          <H3 id="terms-section-15">15. Contact</H3>
          <P>
            For questions about these Terms: <MailLink to="support@mindreset.ai" />
          </P>
        </article>

        <Divider />

        {/* ─── 2. Refund & Cancellation Policy ────────────────── */}
        <article className="mb-12">
          <H2>Refund &amp; Cancellation Policy</H2>
          <P>
            This Refund Policy forms part of our Terms of Service. Current pricing for all
            products is shown at checkout.
          </P>

          <H3 id="terms-refund-minimind">MiniMind Subscriptions (Essential and Extended)</H3>
          <UL>
            <li>
              <Strong>7-day refund window from initial purchase</Strong> — for both
              monthly and annual plans. Request via{' '}
              <MailLink to="support@mindreset.ai" /> with &ldquo;REFUND&rdquo; in the
              subject. After 7 days the standard cancellation policy applies.
            </li>
            <li>Cancel anytime in your account billing settings</li>
            <li>
              When you cancel: <Strong>no further payments are taken</Strong>, and your
              access continues until the end of the current billing cycle
            </li>
            <li>Access ends automatically at the end of the current cycle</li>
            <li>
              <Strong>No partial-cycle or pro-rata refunds</Strong> are issued for
              cancellations after the 7-day window
            </li>
          </UL>

          <H3 id="terms-refund-minimind-topup">MiniMind Message Top-up</H3>
          <UL>
            <li>
              £4.99 one-off purchase — adds 200 messages to your current billing cycle
            </li>
            <li>Delivered for immediate use as digital content</li>
            <li>
              At checkout, you confirm a waiver of the 14-day cancellation right under
              the Consumer Contracts Regulations 2013, in exchange for immediate access
            </li>
            <li><Strong>Non-refundable once purchased</Strong></li>
            <li>Top-up messages expire at the end of the current billing cycle</li>
          </UL>

          <H3 id="terms-refund-modules-individual">States &amp; Themes — individual module purchases</H3>
          <UL>
            <li>£59 per module (non-subscribers) — one-off, permanent access</li>
            <li>
              Active MiniMind subscribers (Essential or Extended) pay £29 per module —
              discount applied automatically at checkout
            </li>
            <li>Access begins immediately upon successful payment</li>
            <li>
              At checkout, you confirm a waiver of the 14-day cancellation right under the
              Consumer Contracts Regulations 2013, in exchange for immediate access. If you
              do not open the module within 14 days of purchase, you may request a full
              refund by emailing{' '}
              <MailLink to="support@mindreset.ai" /> with &ldquo;REFUND&rdquo; in the
              subject
            </li>
            <li>
              <Strong>Once a module has been opened, the purchase is non-refundable</Strong>
            </li>
          </UL>

          <H3 id="terms-refund-recode-onetime">The Journey — One-time payment</H3>
          <UL>
            <li>
              Content is delivered for <Strong>immediate use</Strong> across all eight
              blocks
            </li>
            <li>
              At checkout, you will be asked to confirm a waiver of the 14-day cancellation
              right in exchange for immediate access
            </li>
            <li><Strong>Non-refundable from the moment of purchase</Strong></li>
            <li>
              No refunds are issued under any circumstances after purchase, except as
              required by the Consumer Rights Act 2015 for faulty content
            </li>
          </UL>

          <H3 id="terms-refund-recode-installment">The Journey — Weekly instalment plan</H3>
          <UL>
            <li>12 weekly payments of £55 — each payment unlocks the next block of content</li>
            <li>You may stop future payments at any time</li>
            <li>
              Any weekly payments already made are non-refundable; previously unlocked
              content remains accessible after stopping payments
            </li>
            <li>
              Once the first block has been accessed, the right to a cooling-off period no
              longer applies
            </li>
          </UL>

          <H3 id="terms-refund-howto">How to request a refund (where eligible)</H3>
          <P>
            Email <MailLink to="support@mindreset.ai" /> with &ldquo;REFUND&rdquo; in
            the subject line so we can route it quickly. Include:
          </P>
          <UL>
            <li>Your order ID</li>
            <li>The email address associated with your account</li>
            <li>Reason for the refund request</li>
          </UL>
          <P>
            Eligibility will be assessed based on the rules above. Approved refunds are
            processed to the original payment method within 10 business days.
          </P>

          <H3 id="terms-refund-faulty">Faulty content (statutory rights preserved)</H3>
          <P>
            Nothing in this Refund Policy excludes your statutory rights under the{' '}
            <Strong>Consumer Rights Act 2015</Strong>. If digital content is faulty, not
            as described, or fails to function as expected, we will repair, replace, or
            refund the content as required by law, regardless of the waiver you signed at
            checkout. Contact us at <MailLink to="support@mindreset.ai" /> with details.
          </P>
        </article>

        <Divider />

        {/* ─── 3. Medical & Crisis Disclaimer ─────────────────── */}
        <article className="mb-8">
          <H2>Medical &amp; Crisis Disclaimer</H2>
          <P>
            <Strong>
              MindReset is a wellbeing tool — not therapy, not a medical device, not a
              crisis service.
            </Strong>
          </P>
          <P>
            The AI here cannot diagnose, treat, or replace a clinician. If you are in
            crisis, in danger, or experiencing severe psychological symptoms — please reach
            out to professional support.
          </P>
          <P>
            <Strong>UK:</Strong> Samaritans <Strong>116 123</Strong> (24/7). NHS{' '}
            <Strong>111</Strong> option 2. Your GP. In an emergency: <Strong>999</Strong>{' '}
            or A&amp;E.
          </P>
        </article>

        <Footer omit="terms" />
      </div>
    </main>
  );
}
