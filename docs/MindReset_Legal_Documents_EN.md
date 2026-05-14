# MindReset AI Self-Help Platform — Legal Documents (English)

**Document set for /terms and /privacy pages — English version.**

Version: 2.2 EN (14 May 2026)
Status: **Pre-launch draft. Solicitor review recommended before public marketing launch.**

A separate Russian-language version of these documents will be produced as a dedicated document, reviewed by a native Russian-speaker (ideally with UK legal context). Each language version is a complete, standalone legal document — not a translation appendix.

---

## 📋 Implementation notes for Claude Code

When wiring this into the site:

- **Two pages, not one:** `/terms` (contains Terms of Service + Refund Policy + Medical Disclaimer) and `/privacy` (contains Privacy Policy)
- **Two language versions of each page:** EN and RU served separately. Either via `?lang=en|ru` query parameter or as separate routes (`/terms` vs `/ru/terms`). The page rendering reads ONE language at a time — never mixed.
- **Lang toggle in page header** switches between the two language versions; no inline translation, no parallel columns
- **Footer links** to both `/terms` and `/privacy` from every public page (Landing, Screening, Sign-in, Sign-up, Account)
- **Sign-up T&C capture**: two checkboxes — "I agree to Terms" and "I agree to Privacy Policy" — required before sign-up button enables
- **First-visit modal** (one-time, before screening starts): a shorter Medical & Crisis Disclaimer with "I understand" button
- **Update timestamps** on every material change; show "last updated" date prominently at top of each document
- **Email address** referenced throughout (`support@mindreset.ai`) — needs to be set up via Resend or Google Workspace before going live

**Checkout waiver checkboxes (required for legal enforceability of non-refundable products):**

When implementing Stripe checkout for any non-refundable digital product (individual States/Themes modules, States/Themes all-access subscription, the Reset 8 Blocks Programme — both lump-sum and instalment plans), the checkout flow MUST include a clearly-presented checkbox ABOVE the payment button:

```
☐ I understand that this content is delivered for immediate use, and I waive my 14-day right
  to cancel under the Consumer Contracts Regulations 2013. I will not be entitled to a refund
  after purchase except where the content is faulty or not as described.
```

Without this explicit, pre-purchase waiver tick:
- The user retains the 14-day right to cancel under UK Consumer Contracts Regulations 2013
- The "non-refundable" language in our T&Cs would be unenforceable
- A court would likely side with the consumer in any dispute

The waiver tick must be:
1. Unchecked by default (user actively opts in)
2. Required (Stripe checkout button disabled until ticked)
3. Logged with timestamp and user ID in our database (new field: `Purchase.cancellationWaiverAcceptedAt: DateTime?`)
4. Re-shown on every purchase (not a one-time "set and forget")

For the MiniMind subscription, no waiver checkbox is needed — subscriptions have different cancellation rules and our T&Cs already align with consumer protection law (cancel anytime, no further charges, access continues to end of paid month).

---

# 1. TERMS OF SERVICE

**Last updated: 14 May 2026**

**Operator:** **MindReset AI self-help platform**, operated by **Julia Loya** (sole proprietor), based in London, United Kingdom.
*[NOTE: To be updated when a UK Limited company is registered. The corporate entity, registration number, registered address, and trading name (if changed) will replace this line. The methodology and product structure remain the same.]*

**Contact:** support@mindreset.ai

By using the MindReset AI self-help platform (the "Service"), available at mindreset.ai, you agree to these Terms. Read them carefully. If you do not agree, please do not use the Service.

---

### 1. What This Service Is — And What It Is Not

**What it is.** The MindReset AI self-help platform (the "Service") is an AI-assisted self-help platform for general psychological wellbeing. It provides conversational reflection, structured self-exploration exercises, grounding practices, educational materials, and progress tracking. It draws on established frameworks including somatic regulation, parts-aware self-work, trauma-informed pacing principles, narrative reframing, and integrative identity formation. It is positioned as a **wellbeing tool for non-clinical contexts.**

**What it is not.**
- Not therapy, counselling, or psychiatric treatment
- Not a medical device
- Not a substitute for a qualified clinician, doctor, or licensed mental health professional
- Not a crisis service, emergency service, or 24-hour helpline
- Not a diagnostic tool — it does not diagnose, treat, cure, or prevent any medical or psychological condition

If you require clinical care or are in distress that exceeds what self-help can support, please consult a qualified professional or contact emergency services. We provide signposting to such services within the Service.

---

### 2. The Readiness Check (Section 0) — Informational Only

Before engaging with the deeper materials of the Service, you are invited to complete a short Readiness Check. The Readiness Check is provided as **informational guidance only.** It is not a medical or psychological assessment, not a diagnosis, and not a clinical gate.

The Readiness Check classifies your responses into one of three informational categories:

- **Green** — Your responses suggest the Service may be suitable for you at this time.
- **Yellow** — Your responses suggest you may benefit from a careful, paced introduction. Some materials may not be appropriate at this time.
- **Red** — Your responses suggest the Service may not be appropriate for you at this time, and that professional support would serve you better.

**Important.** The Readiness Check provides information; it does not gate access to the Service. You may choose to proceed regardless of the result. If you choose to proceed despite a Red or Yellow result, or to retake the Readiness Check with different responses, you do so on your own responsibility and confirm by your continued use that:

- You have read and understood the Readiness Check result and the limitations of the Service stated in these Terms;
- You understand the Service is not appropriate for active crisis, severe psychiatric symptoms, active suicidality, recent psychosis, dissociation requiring clinical care, or other conditions that exceed self-help support;
- You accept full responsibility for your decision to use the Service;
- You release the operator of the Service (currently Julia Loya, sole proprietor) from liability for any harm arising from your use of the Service when the Readiness Check has indicated it may not be appropriate.

---

### 3. Acceptance and Age

By creating an account or using any part of the Service you confirm that:

- You are at least **18 years of age**
- You accept these Terms of Service in full
- You accept our Privacy Policy
- You are accessing the Service from a jurisdiction where it is legal to do so
- You have read the Medical & Crisis Disclaimer

If you are under 18, you are not permitted to use the Service.

---

### 4. No Emergency or Professional Treatment

The Service is **not designed for emergencies or active mental health crises.**

**If you are experiencing any of the following, stop using the Service immediately and contact appropriate professional support:**

- Suicidal thoughts or intent to harm yourself
- Thoughts of harming others
- Acute psychiatric symptoms (psychosis, severe dissociation, mania)
- Active substance withdrawal
- Any immediate physical danger to yourself or others

**UK crisis resources:**
- **Samaritans** — 116 123 (free, 24 hours, every day)
- **NHS 111** — option 2 for mental health (24 hours)
- **Your GP** — for non-urgent mental health support
- **A&E or 999** — for any medical or psychiatric emergency

The operator of the Service and the Service itself are not liable for any decision or action you take based on AI suggestions or content provided through the Service.

---

### 5. Accounts and Security

- You may register using your email address and a password. You may use a pseudonym.
- You are responsible for safeguarding your login credentials and for all activity that occurs under your account.
- You agree not to share illegal, threatening, defamatory, or abusive content within the Service.
- You agree not to attempt to circumvent or interfere with the Service's safety protocols, content filters, or technical safeguards.
- You agree not to use the Service to harm others, infringe rights, or violate any applicable law.

---

### 6. AI and Automated Processing

The Service uses artificial intelligence (large language models provided by a third-party AI infrastructure partner) to generate conversational responses, suggest practices, and personalise educational content.

You acknowledge and accept that:

- AI responses are generated automatically and may be inaccurate, incomplete, or unsuitable for your circumstances
- AI does not "know" or "understand" you in the way a human practitioner does
- AI cannot replace the clinical judgment of a qualified professional
- AI-generated content should be treated as informational, not as personal advice
- You should not rely on AI suggestions for decisions with significant life consequences without consulting a qualified professional

The AI processes your conversations to generate a private wellbeing profile (e.g., "elevated anxiety patterns") to better tailor practices. This profile is not a diagnosis and is not shared with third parties for marketing or research purposes. You may request to view, correct, or delete this profile at any time.

A human review process is available if you believe an automated response is materially incorrect or harmful. Contact support@mindreset.ai.

---

### 7. Intellectual Property

All texts, audio, code, design, methodology, brand identity, and other materials within the Service are © Julia Loya, except where third-party content is clearly marked.

You receive a personal, non-transferable, non-exclusive, non-commercial licence to access and use the content of the Service for your own personal wellbeing during your subscription or purchase term.

You agree not to:
- Redistribute, resell, publish, or share the Service's content
- Extract, scrape, or otherwise harvest AI responses for the purpose of training another AI system
- Reverse-engineer, decompile, or attempt to extract the source code of the Service
- Use the Service or its content for commercial gain

---

### 8. Paid Products

The Service offers three product types. **Current pricing is always displayed at checkout** before any payment is taken. We may change pricing, offer promotional discounts, run sales, or adjust pricing for any product at any time; such changes do not affect any product you have already purchased.

#### MiniMind subscription (monthly)

- Charged monthly to your chosen payment method until you cancel
- **Cancellation:** you may cancel at any time via your account billing settings. When you cancel:
  - No further payments will be taken
  - You retain access to MiniMind until the end of your current paid month
  - Access ends automatically at the end of the current paid month
- No partial-month refunds are issued for cancellations
- *[NOTE: Free trial period to be determined. Currently no trial offered.]*

#### States & Themes — modules and all-access subscription

Two purchase options:

**Option A — Individual modules** (one-off digital purchase):
- Access begins immediately upon successful payment
- Due to the nature of digital content delivered immediately, these modules are **non-refundable once accessed**
- Under the Consumer Contracts Regulations 2013, you have a 14-day right to cancel digital purchases UNLESS you have explicitly waived this right by accessing the content immediately
- **You will be asked to confirm this waiver at checkout** before payment is taken. By ticking the waiver checkbox, you accept that you lose the 14-day cancellation right in exchange for immediate access
- Refunds are not provided after access is granted

**Option B — All-access monthly subscription:**
- Charged monthly to your chosen payment method until you cancel
- **Non-refundable for the current paid month** — even if you cancel mid-month, access continues to the end of that month but no refund is issued. This is because the content is delivered for immediate use throughout the month
- **Cancellation:** as for MiniMind — no further charges, access until end of current paid month
- You will be asked to confirm the immediate-access waiver at first subscription

#### Reset 8 Blocks Programme

*[NOTE: Product name finalised as "Reset 8 Blocks Programme". Branding and marketing language may evolve.]*

Two purchase options:

**Option A — Full programme, one-time payment:**
- Access to all eight blocks begins immediately upon successful payment
- **Non-refundable from the moment of purchase.** This is digital content delivered for immediate use
- Under the Consumer Contracts Regulations 2013, the 14-day cancellation right does not apply where the consumer has explicitly waived it in exchange for immediate access
- **You will be asked to confirm this waiver at checkout** before payment is taken
- No refunds are issued under any circumstances after purchase, except where required by the Consumer Rights Act 2015 for faulty content (see Refund Policy below)

**Option B — Monthly instalment plan:**
- Total programme fee divided into a fixed number of monthly instalments
- All instalments are due regardless of whether you complete the programme
- **Non-refundable from the first instalment.** Access to programme blocks begins immediately
- You may cancel the instalment plan at any time, but any instalments already paid are non-refundable, and you forfeit access to any blocks not yet unlocked
- You will be asked to confirm the immediate-access waiver at checkout

#### Payment processing

All payments are processed by a regulated third-party payment processor, which acts as an independent data controller for payment card information under its own terms. We do not store full card numbers or CVV codes.

All prices include VAT where applicable. We may add or remove sales taxes based on your billing location as required by law.

---

### 9. Cancellation

- **Subscriptions:** cancel anytime in your account billing settings; no further charges will be made
- **One-off products:** email support@mindreset.ai with your order ID, account email, and reason for refund

---

### 10. Limitation of Liability

The Service is provided **"as is" and "as available"** without warranties of any kind, express or implied, to the fullest extent permitted by law.

To the fullest extent permitted by applicable law:

- Our total aggregate liability to you for any claim arising from your use of the Service is limited to the greater of (a) the amount you paid us in the six (6) months preceding the claim, or (b) £100.
- We are not liable for indirect, incidental, special, consequential, or punitive damages of any kind.
- We are not liable for any decisions you make, actions you take, or harm you experience as a result of using the Service, except where such liability cannot be excluded by law.
- Nothing in these Terms excludes our liability for death or personal injury caused by our negligence, for fraud, or for any other liability that cannot lawfully be excluded.

Nothing in these Terms affects your statutory rights as a consumer under the **Consumer Rights Act 2015** or the **Digital Markets, Competition and Consumers Act 2024**.

---

### 11. Data Protection

We process personal and special-category data as described in our **Privacy Policy**. Special-category data (including data about your mental health and wellbeing) is processed only with your explicit consent, which you grant by accepting these Terms and using the Service for its intended purpose.

The lawful basis for processing this data is **explicit consent under Article 9(2)(a) UK GDPR** and the equivalent provision of EU GDPR. You may withdraw this consent at any time by deleting your account, at which point your conversational data will be deleted in accordance with our retention schedule.

---

### 12. Compliance with Applicable Law

The Service operates in compliance with applicable UK and EU law as it stands at the time of last update of these Terms, including but not limited to:

- **UK GDPR** and the Data Protection Act 2018
- **Data (Use and Access) Act 2025** (in force from 5 February 2026)
- **EU GDPR** (where applicable to EU users)
- **EU AI Act** (where applicable; the Service is positioned as a limited-risk AI system for general wellbeing support, not a high-risk AI system)
- **Online Safety Act 2023** (where applicable; we maintain content moderation and safety protocols including, without limitation, detection and response to content involving self-harm and other priority harms)
- **Consumer Rights Act 2015**
- **Digital Markets, Competition and Consumers Act 2024**
- **Medical Devices Regulations 2002** — the Service is not a medical device and does not make medical claims

We do not target users under 18 and do not knowingly process the personal data of minors.

---

### 13. Governing Law and Disputes

These Terms are governed by the laws of **England & Wales**. Any dispute arising under these Terms shall be submitted to the courts of England & Wales, unless mandatory consumer law in your country of residence (within the UK or EU) allows you to bring a claim in your local courts.

For EU users, you may also have the right to use the European Commission's Online Dispute Resolution platform: https://ec.europa.eu/consumers/odr

---

### 14. Changes to These Terms

We may update these Terms from time to time. If we make material changes, we will notify you by email and/or by displaying notice within the Service at least 30 days before the changes take effect. Continued use of the Service after the effective date constitutes your acceptance of the updated Terms. If you do not agree with the updated Terms, you may terminate your account at any time before the effective date and obtain a pro rata refund for any unused subscription period.

---

### 15. Contact

For questions about these Terms: support@mindreset.ai

---

---

# 2. PRIVACY POLICY

**Last updated: 14 May 2026**

**Data Controller:** **MindReset AI self-help platform**, operated by Julia Loya (sole proprietor), London, United Kingdom — support@mindreset.ai

**ICO Registration:** *[NOTE: To be obtained at ico.org.uk before public launch. Annual fee ~£40-60. Register before any marketing or public availability.]*

---

### 1. What This Policy Covers

This Privacy Policy explains what personal data we collect about you when you use the Service, why we collect it, how we secure it, with whom we share it, how long we keep it, and what rights you have under UK GDPR and (where applicable) EU GDPR.

---

### 2. Data We Collect

| **Category** | **Examples** | **Purpose** | **Lawful basis** |
|---|---|---|---|
| Account data | email address, hashed password, country (inferred from IP), preferred language | create and manage your account; deliver the Service | Contract |
| Screening data | your responses to the Readiness Check, resulting classification (Green / Yellow / Red), reason summary | classify whether the Service is appropriate for you; protect users from potential harm | Explicit consent (Art 9 §2 a UK GDPR) |
| Conversation data (special category) | the messages you send to MiniMind or modules; reflections and answers in exercises; mood and energy check-ins | AI analysis to suggest practices; personalised wellbeing support; tracking your progress | Explicit consent (Art 9 §2 a UK GDPR) |
| Wellbeing profile | derived patterns (e.g., "elevated anxiety", "recent stable period"), state and theme observations | personalisation; smart routing to appropriate practices and modules | Explicit consent (Art 9 §2 a UK GDPR) |
| Safety events | flagged conversation moments that triggered our safety protocol, our automated response, optional manual review notes | safety protocol audit; compliance with Online Safety Act 2023 priority offences obligations | Legitimate interest (audit trail for safety) / Legal obligation |
| Usage data | device type, browser, IP address, cookies, timestamps, page views | security, anti-abuse, service improvement, anonymous analytics | Legitimate interest |
| Payment data | last 4 digits of card, transaction ID, billing email (full card data is held by the payment processor, not us) | billing, fraud prevention, financial record-keeping | Contract / Legal obligation (tax law) |
| Support messages | emails you send to support@mindreset.ai or our other addresses | responding to inquiries; resolving issues | Legitimate interest |

We do not request your real name, physical address, date of birth, or government identifiers. Please avoid sharing personally identifying details about yourself or others inside conversations with the AI.

---

### 3. How We Use AI

Your conversation data is processed by our AI engine to generate responses and suggest practices.

- The AI creates non-medical wellbeing observations (e.g., "the user describes physical tension when discussing work") to better personalise practices
- The AI does not make medical diagnoses
- The AI does not make decisions that have legal effects on you
- You may contact us at support@mindreset.ai if you believe an automated response is incorrect or harmful; a human will review

Under Article 22 of UK GDPR, you have the right not to be subject to a decision based solely on automated processing that produces legal or similarly significant effects. The wellbeing observations and practice suggestions made by our AI do not constitute such decisions.

---

### 4. With Whom We Share Data

We **never** sell or rent your personal data. We share it only with categories of service providers necessary to deliver the Service:

- Cloud hosting and database services
- AI infrastructure (for the conversational and analytical features)
- Authentication and account management
- Payment processing
- Transactional email delivery
- Website hosting

Specific providers may change over time. A current list of the service providers we use is available on request — email support@mindreset.ai.

We may also disclose your data when legally compelled by a court order or similar legal process.

We use **Standard Contractual Clauses** (or equivalent UK IDTA mechanisms) for any international data transfers, supplemented where necessary by additional safeguards including encryption in transit and at rest.

---

### 5. International Transfers

Your data may be processed outside the UK and EU, primarily in the United States. Where this happens we rely on either:

- An adequacy decision by the UK or EU (where one exists)
- Standard Contractual Clauses approved by the European Commission or the UK ICO
- Other appropriate safeguards permitted under UK GDPR or EU GDPR

You may request details of the specific safeguards in place for any transfer by emailing support@mindreset.ai.

---

### 6. Security

We implement appropriate technical and organisational measures to protect your data:

- **TLS 1.2 or higher** for all data in transit
- **AES-256 encryption at rest** for stored data (provided by our hosting partner)
- **Hashed passwords** using industry-standard algorithms (managed by our authentication provider)
- **Role-based access** to our backend systems; access logged and audited
- **Confidentiality obligations** for anyone with access to data
- **Regular security reviews** and dependency vulnerability monitoring
- **Encrypted backups** with limited retention

No security system is 100% impenetrable. In the event of a data breach affecting your rights and freedoms, we will notify the ICO within 72 hours and, where required, notify affected users without undue delay.

---

### 7. Retention

| **Data category** | **Retention period** |
|---|---|
| Account data | Active account: until you delete it. Inactive account: deleted 12 months after last sign-in. |
| Screening data | 12 months after last sign-in, or immediately upon account deletion |
| Conversation data | 12 months after last sign-in, or immediately upon account deletion |
| Wellbeing profile | Same as Conversation data |
| Safety events | 7 years (legal audit trail obligation) — depersonalised after account deletion |
| Payment records | 6 years (UK tax law requirement) |
| Backups | Maximum 30 days |
| Support messages | 24 months from last contact |

You may request earlier deletion of any data, except where we have a legal obligation to retain it (e.g., financial records under tax law, safety events under Online Safety Act).

---

### 8. Your Rights

Under UK GDPR (and EU GDPR where applicable), you have the right to:

- **Access** — request a copy of the personal data we hold about you
- **Rectification** — correct inaccurate data
- **Erasure** — request deletion of your data ("right to be forgotten"), subject to legal retention obligations
- **Restriction** — request that we limit how we process your data
- **Objection** — object to processing based on legitimate interests
- **Portability** — receive your data in a structured, commonly-used, machine-readable format
- **Withdraw consent** — for any processing based on consent

To exercise any of these rights:
- Use the "Data" section in your account settings (when available), or
- Email support@mindreset.ai with your request

We will respond within one month, or notify you within one month if we need additional time (up to a further two months) due to complexity.

If you are unsatisfied with our handling of your data, you have the right to lodge a complaint with the UK Information Commissioner's Office (ICO) at **ico.org.uk**, or with your local data protection authority in the EU.

---

### 9. Cookies

We use:

- **Strictly necessary cookies** — for authentication, security, and basic site function. These cannot be disabled
- **Optional analytics cookies** — for understanding usage patterns and improving the Service. You will be asked to accept or decline these on your first visit

We do not use advertising cookies, tracking pixels for marketing, or third-party trackers.

---

### 10. Children's Data

The Service is for adults aged 18 and over. We do not knowingly collect personal data from individuals under 18. If you believe a child under 18 has provided us with personal data, please contact us at support@mindreset.ai and we will delete it.

---

### 11. Changes to This Policy

We may update this Privacy Policy from time to time to reflect changes in our practices or in applicable law. Material changes will be announced by email and/or in-app at least 30 days before they take effect. Continued use of the Service after the effective date constitutes acceptance of the updated Policy.

---

### 12. Contact

For privacy-related questions or to exercise your rights:
- **Email:** support@mindreset.ai
- **Postal address:** *[NOTE: To be added when a registered business address is available.]*

---

---

# 3. REFUND & CANCELLATION POLICY

**Last updated: 14 May 2026**

This Refund Policy forms part of our Terms of Service. Current pricing for all products is shown at checkout.

### MiniMind Subscription (monthly)

- Cancel anytime in your account billing settings
- When you cancel: **no further payments are taken**, and your access continues until the end of the current paid month
- Access ends automatically at the end of the current paid month
- **No partial-month or pro-rata refunds** are issued

### States & Themes — Individual modules (one-off purchase)

- Content is delivered for **immediate use**
- At checkout, you will be asked to confirm a waiver of the 14-day cancellation right under the Consumer Contracts Regulations 2013, in exchange for immediate access to the content
- **Non-refundable once accessed**
- If you did not tick the waiver checkbox and have not yet accessed the content, you may request a refund within 14 days

### States & Themes — All-access monthly subscription

- **Non-refundable for any month already paid**, even if you cancel mid-month
- Access continues to the end of the current paid month
- Cancel anytime — no further payments will be taken
- You will be asked to confirm the immediate-access waiver at first subscription

### Reset 8 Blocks Programme — One-time payment

- Content is delivered for **immediate use** across all eight blocks
- At checkout, you will be asked to confirm a waiver of the 14-day cancellation right in exchange for immediate access
- **Non-refundable from the moment of purchase**
- No refunds are issued under any circumstances after purchase, except as required by the Consumer Rights Act 2015 for faulty content

### Reset 8 Blocks Programme — Monthly instalment plan

- **All instalments are due regardless of programme completion**
- Each instalment is non-refundable from the date it is taken
- You may cancel the instalment plan at any time to stop further charges
- Any instalments already paid are non-refundable; you forfeit access to blocks not yet unlocked

### How to request a refund (where eligible)

Email **support@mindreset.ai** with "REFUND" in the subject line so we can route it quickly. Include:
- Your order ID
- The email address associated with your account
- Reason for the refund request

Eligibility will be assessed based on the rules above. Approved refunds are processed to the original payment method within 10 business days.

### Faulty content (statutory rights preserved)

Nothing in this Refund Policy excludes your statutory rights under the **Consumer Rights Act 2015**. If digital content is faulty, not as described, or fails to function as expected, we will repair, replace, or refund the content as required by law, regardless of the waiver you signed at checkout. Contact us at support@mindreset.ai with details.

---

---

# 4. MEDICAL & CRISIS DISCLAIMER

*Short text for first-visit modal and footer. Must be displayed prominently before any user begins using the Service.*

> **MindReset is a wellbeing tool — not therapy, not a medical device, not a crisis service.**
>
> The AI here cannot diagnose, treat, or replace a clinician. If you are in crisis, in danger, or experiencing severe psychological symptoms — please reach out to professional support.
>
> **UK:** Samaritans **116 123** (24/7). NHS **111** option 2. Your GP. In an emergency: **999** or A&E.
>
> *By continuing, you confirm you have read this disclaimer and understand the Service's limitations.*
>
> [I understand — continue]

---

---

# 📝 Lawyer review checklist (before public marketing launch)

When you take this to a UK solicitor for sign-off (recommended ~£400-800), have them verify:

1. **Entity question** — Julia Loya will register a UK Limited company before public marketing launch. The legal entity name, registration number, and registered address will replace "MindReset AI self-help platform, operated by Julia Loya (sole proprietor)" in all four documents. The methodology, pricing, and product structure remain the same regardless of entity form.
2. **Liability cap** — £100 / 6-month payments cap may be challenged in court for special-category data products; solicitor will advise
3. **Limitation of liability for AI** — case law is evolving; current draft is conservative but may need updates
4. **Special category data consent wording** — verify the "explicit consent" wording meets Art 9 §2(a) UK GDPR standard for psychological wellbeing data
5. **Data Processing Agreements (DPAs)** — confirm you have signed DPAs with all sub-processors (cloud hosting, AI infrastructure, authentication, payment processing, transactional email, website hosting) before launch
6. **Online Safety Act applicability** — verify whether MiniMind's one-to-one chatbot architecture remains outside OSA scope after the 2026 amendments, or whether you fall in scope
7. **EU AI Act risk classification** — confirm "limited risk" categorisation for your specific use case
8. **ICO registration** — confirm registration is in place and notification fee paid
9. **Payment processor T&Cs alignment** — ensure your refund policy doesn't conflict with the payment processor's chargeback rules
10. **Consumer cancellation waiver wording** — confirm the exact wording of the at-checkout waiver checkbox is sufficient under Consumer Contracts Regulations 2013 to make individual modules and the Reset 8 Blocks Programme non-refundable from purchase. The Information Commissioner's Office and CMA have both indicated that "express consent to immediate performance" requires unambiguous, pre-purchase opt-in
11. **Pricing absent from T&Cs** — confirm that displaying current pricing only at checkout (not in T&Cs) is acceptable and that promotional pricing changes do not constitute material changes to the Terms that would require re-acceptance
12. **Non-refundable monthly subscription wording** — the all-access States & Themes monthly subscription is non-refundable for any paid month even on mid-month cancellation. Verify this clause is enforceable given consumer law's general protection of pro-rata refund rights
13. **Instalment plan enforceability** — confirm that "all instalments due regardless of completion" is enforceable for the Reset 8 Blocks Programme, especially in EU jurisdictions where consumer credit rules may apply
14. **Sub-processor disclosure level** — Privacy Policy §4 now lists *categories* of service providers rather than named entities. Confirm this satisfies UK GDPR transparency requirements (Art 13–14) for users to know who processes their data. A current named list is available on request via email.

---

— End of English-language document set —

A separate Russian-language document will be produced as a standalone file, ideally reviewed by a native Russian-speaker familiar with UK consumer and data protection law.
