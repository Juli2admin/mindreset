# Communication System — Architecture

**Status**: Audit completed 2026-05-24. Foundation not yet built.
**Supersedes**: roadmap Block D (email sequences, Pattern A)

---

## 1. Current state — what exists

### Built
| Item | Location | Notes |
|---|---|---|
| `support@mindreset.ai` in Footer | `components/Footer.tsx:52` | `mailto:` link only — no mailbox behind it |
| `support@mindreset.ai` in UI strings | `messages/en.json` (refund, contact, T&C references) | Copy exists; email doesn't work yet |
| `support@mindreset.ai` in T&C | Legal docs — ~10 references | Contact, refunds, GDPR requests, crisis |
| Resend SDK | `package.json` — `"resend": "^4.0.0"` | Installed; zero send calls in codebase |
| Clerk webhook handler | `app/api/webhooks/clerk/route.ts` | Creates User on sign-up. Svix signature verified ✅ |
| Stripe webhook handler | `app/api/stripe/webhook/route.ts` | Handles 6 events. Stripe signature verified ✅ |
| Welcome email templates | `lib/email/welcome.ts`, `lib/email/resend.ts`, `lib/email/sendWelcome.ts` (PR #33 — not yet merged) | EN + RU copy locked. Integrated into `/account/page.tsx` via `waitUntil`. Missing: `welcomeEmailSentAt` field needs migration. |

### Not built (confirmed by code search)
- No FAQ page, route, component, or i18n string anywhere in the app
- No inbound email webhook
- No `EmailLog` table in Prisma schema
- No `User.marketingConsent` field
- No unsubscribe token mechanism
- No AI support email queue or admin review UI
- No email sequences beyond welcome (no re-engagement, milestone, win-back)

---

## 2. Security audit — API routes

| Route | Auth | Signature | Rate limit | Body size limit |
|---|---|---|---|---|
| `POST /api/minimind/chat` | ✅ Clerk `auth()` | n/a | ❌ **MISSING** | ❌ **MISSING** |
| `POST /api/stripe/webhook` | n/a | ✅ `stripe.webhooks.constructEvent` | ❌ missing | n/a (raw body) |
| `POST /api/webhooks/clerk` | n/a | ✅ svix `wh.verify` | ❌ missing | n/a (raw body) |
| `POST /api/checkout/create` | ✅ Clerk `auth()` | n/a | ❌ missing | ❌ missing |
| `POST /api/screening` | none (anonymous) | n/a | ❌ **MISSING** | ❌ missing |
| `POST /api/disclaimer/acknowledge` | none (anonymous) | n/a | ❌ missing | ❌ missing |
| Future: `POST /api/webhooks/resend` | n/a | ⚠️ must add svix | ❌ must add | n/a |

### Priority security gaps

**HIGH — add before launch:**

1. **Rate limiting on `/api/minimind/chat`** — each request costs ~£0.05+ in Anthropic API
   calls. No limit = unlimited free inference for any authenticated user, and potential
   DoS via credential stuffing. Recommend: Upstash Redis (Vercel-native) or `@vercel/kv`
   with sliding window. 10 req/min per userId is appropriate.

2. **Message body length cap on chat** — no max length on the `message` field. A 1MB
   message payload costs money and could probe the context window. Cap at 4,000 chars
   (generous for a conversation turn).

3. **Rate limiting on `/api/screening`** — anonymous endpoint. Submitting thousands of
   fake screenings would bloat the database. 5 req/hour per IP is sufficient.

**MEDIUM — add before public launch:**

4. **Resend Inbound webhook signature** — when Pattern A is built, the webhook endpoint
   must verify Resend's svix headers. Same pattern as Clerk webhook already uses.

5. **Input sanitisation on email addresses** — any Resend `to:` field fed from user
   input must be validated against a regex. The welcome email uses Clerk-verified email
   addresses (safe), but support reply flows will take addresses from inbound payloads.

**LOW — track but not blocking:**

6. **11 npm vulnerabilities** — 2 moderate, 9 high. Pre-existing in dependency tree.
   Logged in `docs/security-deferrals.md`. Review before major version upgrades.

---

## 3. Communication channels — full picture

### Outbound (app → user)

| Type | When | Consent required? | Template |
|---|---|---|---|
| Welcome | First `/account` visit | No (transactional) | ✅ EN + RU written |
| Subscription confirmed | `customer.subscription.created` webhook | No (contract) | Not built |
| Subscription cancelled | `customer.subscription.deleted` webhook | No (contract) | Not built |
| Payment failed | `invoice.payment_failed` webhook | No (contract) | Not built |
| Top-up receipt | `checkout.session.completed` (mode=payment) | No (contract) | Not built — Stripe sends its own |
| T&C material change | Manual trigger by Julia | No (legal obligation) | Not built |
| Re-engagement nudge | User inactive N days | **Yes (marketing)** | Not built |
| Module suggestion | DiagnosticProfile pattern | **Yes (marketing)** | Not built — Block C |
| Win-back | Subscription cancelled | **Yes (marketing)** | Not built |
| Milestone celebration | First week, first module, etc. | **Yes (marketing)** | Not built — Block C |

### Inbound (user → us)

| Channel | Address | Volume estimate | Current state |
|---|---|---|---|
| Support inquiries | `support@mindreset.ai` | Low at launch | Mailbox doesn't exist |
| Refund requests | `support@mindreset.ai` | Occasional | Same |
| GDPR data requests | `support@mindreset.ai` | Rare | Same |
| Crisis escalations | Via T&C → emergency services | N/a | Handled by safety scanner in-app |

---

## 4. Email addresses

| Address | Purpose |
|---|---|
| `hello@mindreset.ai` | All outbound transactional + marketing (from address) |
| `support@mindreset.ai` | Inbound support + outbound replies to users |

No others needed at launch. Both require `mindreset.ai` DNS to be connected and domain
verified in Resend (outbound) and a mailbox or forwarder (inbound for `support@`).

---

## 5. Inbound options for `support@` — decision needed

| Option | Cost | Complexity | Pattern A integration |
|---|---|---|---|
| **A. Resend Inbound webhook** | Free (Resend plan) | Medium — webhook to our API | Native — same vendor, svix verification |
| **B. Google Workspace mailbox** | ~£6/mo | Low — standard email client | Manual copy-paste into admin queue |
| **C. Cloudflare Email Routing (forwarder)** | Free | Minimal — forward to Julia's Gmail | Manual reply from Julia's Gmail |

**Recommendation**: Option C at launch (zero cost, zero complexity, Julia can reply manually
from Gmail). Upgrade to Option A when admin panel (Block E) and Pattern A are built — the
full Pattern A pipeline makes Option C obsolete. Option B (Google Workspace) is only worth
the cost if Julia prefers a branded mailbox for professional appearance before Pattern A
ships.

---

## 6. FAQ system — architecture decision needed

### Current state
Nothing exists — no route, no component, no content.

### What was planned
Roadmap mentions "FAQ section" referenced in welcome email copy but no formal spec exists.
Julia's intent: "mostly AI response."

### Options

**Option A: Static FAQ page** (`/faq`, `/ru/faq`)
- A curated set of questions Julia writes (EN + RU)
- Simple page component, no backend
- Searchable via browser Cmd+F or a simple JS filter
- Zero AI cost, zero maintenance
- **Best for launch** — can ship in 1 session

**Option B: AI-powered FAQ search** (RAG over knowledge base)
- Julia writes a knowledge-base document; questions are embedded
- User types a question → nearest-match answer surfaced + AI-synthesised reply
- Requires vector store (Supabase pgvector exists), embedding call (Voyage or OpenAI), Anthropic synthesis
- Significant complexity; ongoing AI cost per FAQ lookup
- **Post-launch** — not launch-critical

**Option C: MiniMind handles FAQ questions**
- FAQ link opens MiniMind with a seed message ("I have a question about MindReset...")
- MiniMind is prompted to handle billing/product/usage questions via a separate system prompt
- Requires careful prompt design so FAQ mode doesn't bleed into therapy mode
- **Not recommended** — mixing support and therapeutic context is confusing for users

**Recommendation**: Option A at launch. Julia writes the 15–20 most common questions
(billing, privacy, what MiniMind is/isn't, crisis resources, cancellation, top-up). Static
page ships in one session. Option B can be evaluated post-launch if search-and-AI-answer
is genuinely needed.

---

## 7. Proposed library structure

```
lib/email/
  resend.ts              — Resend client + FROM_ADDRESS (exists, PR #33)
  send.ts                — Generic send fn: locale-aware, logs to EmailLog, handles errors
  consent.ts             — Marketing-consent gate; unsubscribe token sign/verify (HMAC-SHA256)
  types.ts               — EmailKind enum, EmailLocale type
  templates/
    welcome.ts           — (move from lib/email/welcome.ts — PR #33)
    subscriptionLifecycle.ts  — confirmed / cancelled / paymentFailed
    tcUpdate.ts          — T&C material change notice
    supportReply.ts      — AI Pattern A outbound reply template

lib/support/
  inbound.ts             — Resend Inbound payload parsing + categorisation
  categoriser.ts         — Anthropic call: category + locale detect
  draftReply.ts          — Anthropic call: draft reply in user's locale + voice
  types.ts               — SupportTicket, TicketCategory, DraftStatus
```

---

## 8. Prisma schema additions

All migrations are run manually by Julia in Supabase SQL editor.

### New fields on User
```prisma
welcomeEmailSentAt   DateTime?   // guard: send once (PR #33)
marketingConsent     Boolean     @default(false)  // PECR opt-in
marketingUnsubAt     DateTime?   // set when user unsubscribes
```

### New table: EmailLog
```prisma
model EmailLog {
  id         String   @id @default(cuid())
  userId     String?  // null for non-user emails (e.g. support@ replies to anonymous)
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  kind       String   // EmailKind enum value
  locale     String   // 'en' | 'ru' | etc.
  toEmail    String
  resendId   String?  // Resend message ID for tracing
  status     String   @default("sent")  // sent | failed | bounced
  errorMsg   String?
  sentAt     DateTime @default(now())

  @@index([userId])
  @@index([kind, sentAt])
}
```

### New table: SupportTicket (Pattern A)
```prisma
model SupportTicket {
  id             String    @id @default(cuid())
  fromEmail      String
  fromName       String?
  subject        String
  bodyText       String
  bodyHtml       String?
  resendInboundId String?  @unique  // idempotency
  receivedAt     DateTime
  locale         String?   // detected by AI categoriser
  category       String?   // billing | emotional | methodology | crisis | other
  urgency        String    @default("normal")  // normal | elevated | crisis
  draftReply     String?   // AI-generated draft
  draftLocale    String?
  status         String    @default("pending")  // pending | approved | sent | escalated
  approvedAt     DateTime?
  sentAt         DateTime?
  sentResendId   String?

  @@index([status, receivedAt])
}
```

---

## 9. T&C additions required

Before marketing emails can be sent legally (UK PECR), add to T&C:

```
### Communications

We will send you:
- Transactional emails: account-related notifications (welcome, billing
  confirmations, policy changes). These are necessary for the service
  and cannot be opted out of while your account is active.
- Optional updates: occasional tips, progress milestones, and relevant
  platform news. You can opt in at sign-up and opt out at any time from
  your account settings or via the unsubscribe link in any marketing email.
```

Also: welcome email references "our FAQ section" — the FAQ page must exist before
welcome email goes live, or that copy line needs updating.

---

## 10. Build sequence — PRs

### Immediately (pre-launch)

| PR | Branch | Scope | Dependencies |
|---|---|---|---|
| **#33** | `claude/welcome-email` | Welcome email — merge as-is after migration SQL runs | Julia: run migration + set up Resend |
| **#34** | `claude/rate-limiting-chat` | Rate limiting on `/api/minimind/chat` + body size cap | None |
| **#35** | `claude/static-faq` | Static FAQ page EN + RU — Julia provides FAQ content | Julia: write FAQ Q&A |
| **#36** | `claude/email-foundation` | `EmailLog` table, `send.ts`, `marketingConsent` field, unsubscribe tokens, T&C clause | After PR #33 merged |
| **#37** | `claude/subscription-lifecycle-emails` | Stripe lifecycle emails (confirmed / cancelled / payment-failed) using foundation from #36 | After PR #36 merged |
| **#38** | `claude/support-email-forwarder` | Cloudflare Email Routing setup instructions + `support@` mailto links audit | Julia: DNS + Cloudflare |

### Post-launch (Block D)

| PR | Scope |
|---|---|
| D1 | Pattern A: Resend Inbound webhook + AI categoriser + SupportTicket table |
| D2 | Admin queue UI: approve / edit / send support drafts |
| D3 | Re-engagement email sequence (User inactive N days) |
| D4 | Marketing preferences UI in `/account` |
| D5 | Milestone + module-suggestion email sequences (Block C dependency) |
| D6 | AI-powered FAQ (Option B) — if warranted by usage data |

---

## 11. Decisions needed from Julia

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | Inbound `support@` at launch | A (Resend webhook), B (Google Workspace), C (Cloudflare forwarder → Gmail) | **C** — simplest, free, upgrade to A when Pattern A ships |
| 2 | Marketing emails at launch? | In scope (need consent checkbox + unsub) / Out of scope (transactional only) | **Out of scope at launch** — add re-engagement post-launch once user behaviour is understood |
| 3 | FAQ format | A (static, Julia writes) / B (AI-powered, post-launch) | **A at launch** — static, one session |
| 4 | Rate limiting on chat | Upstash Redis (~£0/mo free tier) / Vercel KV (~£0/mo free tier) / in-memory (not persistent) | **Upstash Redis** — persistent across serverless instances |
| 5 | PR #33 (welcome email) | Merge as-is and refactor onto foundation later / close and rebuild with foundation | **Merge as-is** — code is sound; foundation can wrap it in PR #36 |
| 6 | FAQ page lives at | `/faq` and `/ru/faq` / inline on Landing page / inside `/account` | **`/faq` standalone page** — SEO value, linkable from welcome email |
