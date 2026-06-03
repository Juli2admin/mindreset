# Launch cutover — soft-launch runbook

Step-by-step for the day you flip MindReset.ai from development-mode third
parties to production-mode. Read end-to-end **before** starting; the order
matters and several steps are one-way.

**Owner**: Julia. The agent (Claude) can fix code or env-var issues mid-run
but cannot execute the cutover steps themselves (most are external
dashboards).

**Estimated time**: 2–3 hours focused, with a buffer for surprise.

**Pre-requisite**: Don't start mid-week. Friday afternoon is a bad cutover
slot (any breakage waits till Monday). Pick a quiet Sunday morning or
similar.

---

## 0. Pre-flight — before you start

Confirm each of these is ready. If any item is no, **stop and resolve
first**.

- [ ] All open PRs merged to `main` or closed
- [ ] Vercel last deploy on `main` is green
- [ ] You have a fresh cup of tea
- [ ] You have 2–3 uninterrupted hours
- [ ] You have access to: Vercel · Stripe · Clerk · Resend · Namecheap ·
      Supabase · GitHub
- [ ] Sentry is live and you're signed in to verify it captures errors
- [ ] ICO registration confirmed + solicitor sign-off on Terms/Privacy
      (the legal pieces — outside this doc)

---

## 1. Stripe — switch to live mode

Stripe products + prices + coupons are entirely separate between Test and
Live mode. The 11 module + Journey prices + the £30 subscriber coupon all
need to be recreated in Live.

### 1.1 Verify Stripe business identity

- [ ] Stripe Dashboard → Settings → Business → verify identity, business
      details, bank account
- [ ] Confirm Stripe shows "live mode is enabled"
- [ ] **VAT setting must stay OFF** (locked decision — see
      `docs/decisions/locked-decisions.md`)
- [ ] **Stripe Tax must stay OFF**

### 1.2 Recreate all products + prices in Live mode

In Stripe Dashboard, top-right toggle **TEST → LIVE**.

| # | Product | Price | Type | Env var |
|---|---|---|---|---|
| 1 | MiniMind Essential | £14.99 | Recurring monthly | `STRIPE_PRICE_ESSENTIAL_MONTHLY` |
| 2 | MiniMind Essential | £129 | Recurring yearly | `STRIPE_PRICE_ESSENTIAL_ANNUAL` |
| 3 | MiniMind Extended | £24.99 | Recurring monthly | `STRIPE_PRICE_EXTENDED_MONTHLY` |
| 4 | MiniMind Extended | £209 | Recurring yearly | `STRIPE_PRICE_EXTENDED_ANNUAL` |
| 5 | Top-up | £4.99 | One-off | `STRIPE_PRICE_TOPUP` |

- [ ] Create products 1–5 in Live mode
- [ ] Copy each new `price_...` ID to a safe place (notes app, password manager)

> **States & Themes modules (£59 × 9) and The Journey (£599 / £55-weekly) are Block C** —
> the checkout endpoint only knows the 5 launch SKUs above. Pricing page renders S&T and
> Journey cards with "available soon" badges. **Do NOT create the additional Stripe
> products at launch.** Add them when Block C content ships.

### 1.3 Subscriber module coupon — DEFERRED to Block C

- [ ] **Skip at launch.** The £30 "Subscriber module discount" coupon is only used by S&T
  module checkout, which is Block C. Create the coupon when Block C ships.

### 1.4 Generate live webhook signing secret

- [ ] Stripe Dashboard → Developers → Webhooks → + Add endpoint
- [ ] URL: `https://mindreset.ai/api/stripe/webhook`
- [ ] Events to listen to (these match what the handler expects):
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- [ ] Save → copy the new `whsec_...` signing secret
- [ ] Optional: enable promo codes in the new prices (per-checkout-session
      flag is already on in our code)

### 1.5 Save Customer Portal configuration in Live mode

> Stripe does **not** copy Customer Portal settings from Test mode to
> Live mode. They must be re-saved per environment, or the Portal
> session creation in `/api/stripe/portal` will return a generic
> default Portal without the toggles we expect.

- [ ] Stripe Dashboard → Settings → Customer Portal → **switch to Live mode** (top-right toggle)
- [ ] Toggle ON: **Cancel subscriptions**, **Update payment method**, **View invoices**
- [ ] Toggle OFF: **Pause subscriptions** (locked decision — no pause at launch)
- [ ] Switch tier / interval: leave at Stripe defaults
- [ ] Click **Save** at the bottom — settings are environment-scoped, this is the canonical step
- [ ] Sanity-check: open the live portal preview link, confirm only the three enabled buttons show

---

## 2. Clerk — switch to production mode

Clerk has fully separate Development and Production instances. Production
needs its own custom subdomain.

### 2.1 Upgrade to Clerk Pro

- [ ] Clerk Dashboard → Billing → upgrade to Pro plan (~$25/mo)
- [ ] Confirm payment processed

### 2.2 Create the Clerk subdomain DNS record

- [ ] Namecheap → mindreset.ai → Advanced DNS
- [ ] Add CNAME record: `clerk → frontend-api.clerk.services.`
      (Clerk Dashboard will give you the exact target — copy from there)
- [ ] Save

### 2.3 Add the custom domain in Clerk

- [ ] Clerk Dashboard → switch instance to **Production** (or create a
      new Production instance from your Development instance's settings)
- [ ] Domains → add `clerk.mindreset.ai`
- [ ] Wait for verification (DNS propagation ~15-30 min)
- [ ] Status should flip to **Verified ✅**

### 2.4 Migrate sign-in / sign-up settings to Production

In the Production instance:

- [ ] Authentication strategies — same as Development (email + Google + etc)
- [ ] Add `https://mindreset.ai/sign-in` to allowed redirect URLs
- [ ] Add `https://mindreset.ai/sign-up` to allowed redirect URLs
- [ ] Add `https://mindreset.ai/home` as the default after-signin URL
- [ ] Localizations: Clerk auto-loads the appropriate locale based on your
      app's existing `CLERK_LOCALIZATIONS` mapping — no change needed
- [ ] Configure Sessions (multi-session, length, MFA if you want)
- [ ] Set up webhooks pointing at `https://mindreset.ai/api/webhooks/clerk`
- [ ] Configure Email + SMS settings (skip SMS for soft launch)

### 2.5 Get new Production API keys

- [ ] Clerk Dashboard → API keys (Production instance)
- [ ] Copy `pk_live_...` (publishable) and `sk_live_...` (secret)
- [ ] Generate a webhook signing secret for the new Clerk webhook —
      copy `whsec_...`

### 2.6 Create your admin account in Production Clerk

⚠️ **Important**: Development Clerk users do NOT carry over to Production.
You'll need to sign up fresh from `https://mindreset.ai/sign-up` AFTER the
env-var swap (next section).

---

## 3. Resend — production sending

### 3.1 Verify the domain (probably already done)

- [ ] Resend Dashboard → Domains → mindreset.ai → confirm all records
      show "verified" ✅: DKIM, SPF, DMARC

### 3.2 If Resend Inbound access is granted

- [ ] Resend Dashboard → Inbound → Create inbound endpoint
- [ ] URL: `https://mindreset.ai/api/webhooks/email-inbound`
- [ ] Match address: `support@mindreset.ai`
- [ ] Copy the signing secret → save for env vars
- [ ] When you ship the inbound webhook code (PR 2c, not yet written),
      you'll need a `RESEND_INBOUND_WEBHOOK_SECRET` env var

### 3.3 If Resend Inbound still unavailable

- [ ] Set up Namecheap email forwarding (Domain List → Manage → Email
      Forwarding) — forward `support@mindreset.ai` to your real Gmail
- [ ] Remove the Resend inbound MX (`@ → inbound-smtp.eu-west-1.amazonaws.com`)
      — replaced by Namecheap's mail servers automatically
- [ ] Note: outbound (welcome / marketing / lifecycle emails) is
      unaffected — those use TXT records (SPF/DKIM/DMARC)

### 3.4 Update RESEND_FROM_SUPPORT_EMAIL

- [ ] If you set up `support@` properly in 3.2 or 3.3, you can flip the
      env var so support reply emails come from support@ not hello@
- [ ] Otherwise leave it unset (falls back to `hello@`)

---

## 4. Vercel — env var swap

⚠️ **This is the moment when production switches.** Have everything from
sections 1–3 ready before you start.

### 4.1 Replace test → live keys

In Vercel → mindreset project → Settings → Environment Variables:

| Env var | Old (Test) | New (Live) |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (test) | `whsec_...` (from section 1.4) |
| `STRIPE_PRICE_ESSENTIAL_MONTHLY` | test price ID | live price ID (#1) |
| `STRIPE_PRICE_ESSENTIAL_ANNUAL` | test | live (#2) |
| `STRIPE_PRICE_EXTENDED_MONTHLY` | test | live (#3) |
| `STRIPE_PRICE_EXTENDED_ANNUAL` | test | live (#4) |
| `STRIPE_PRICE_TOPUP` | test | live (#5) |
| `STRIPE_PRICE_STATE_ANXIETY` through `STRIPE_PRICE_JOURNEY_WEEKLY` | test | live (#6–16) |
| `STRIPE_COUPON_MODULE` | test coupon | live coupon (section 1.3) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | `pk_live_...` |
| `CLERK_SECRET_KEY` | `sk_test_...` | `sk_live_...` |
| `CLERK_WEBHOOK_SECRET` | dev signing | prod signing (section 2.5) |
| `ADMIN_EMAILS` | your test email | the email you'll sign up as in Production Clerk |

- [ ] All scoped to **Production** + **Preview** (both checkboxes)
- [ ] Hit Save on each

### 4.2 Redeploy

- [ ] Vercel → Deployments → most recent `main` → "..." → **Redeploy**
- [ ] Wait for green checkmark (~1–2 min)

---

## 5. Smoke tests — verify everything works

### 5.1 Auth + admin

- [ ] Open `https://mindreset.ai` in an incognito window
- [ ] Sign up with the email you put in `ADMIN_EMAILS`
- [ ] Complete the screening flow → land on `/home`
- [ ] Visit `/admin` → admin dashboard loads (not 404)
- [ ] Test the marketing-consent banner → click "Yes" → toggle now shows "Subscribed"

### 5.2 Stripe — full purchase flow

⚠️ **Use your real card. Refund yourself immediately afterwards in Stripe Dashboard.**

- [ ] On `/pricing`, click MiniMind Essential monthly subscribe
- [ ] Stripe Checkout opens — verify it shows **£14.99 / month** (NOT a test
      banner)
- [ ] Enter your real card, complete checkout
- [ ] Land on `/checkout/success`
- [ ] Email arrives (subscription confirmation, from `hello@`)
- [ ] `/home` shows "Essential" tier
- [ ] Go to Stripe Dashboard → Customers → find your purchase → **Refund**
      to get your money back
- [ ] After refund, the subscription is cancelled → cancellation email arrives

### 5.3 Webhook check

- [ ] Stripe Dashboard → Webhooks → recent deliveries — all 200 OK
- [ ] No retry storms

### 5.4 Sentry

- [ ] Trigger a deliberate error (e.g. visit a non-existent route that 500s)
- [ ] Within ~30 seconds, error appears in Sentry dashboard

### 5.5 Marketing email

- [ ] `/admin/marketing` shows recipient count ≥ 1 (you opted in)
- [ ] Compose + send a "Production launch test" campaign to yourself
- [ ] Email arrives within ~1 min, includes unsubscribe footer
- [ ] Click footer unsubscribe link → confirmation page → audience count
      goes to 0

---

## 6. Post-cutover — monitoring

### First 24 hours

- [ ] Watch Sentry dashboard — investigate any new errors immediately
- [ ] Watch Vercel function logs for webhook errors
- [ ] Check Stripe Dashboard for any failed payments (shouldn't happen — you
      have no real users yet)
- [ ] Check Resend dashboard for delivery failures

### First week

- [ ] Daily check of `/admin` Overview tile — confirm signups + active
      users look plausible
- [ ] Daily check of Sev-5 alerts (should be zero unless real users)
- [ ] Daily check of the support email queue (whichever inbox you set up)

---

## 7. Rollback plan

If something serious breaks in the first hour and you can't fix forward:

- [ ] Vercel Dashboard → Deployments → find the last deployment that was
      pre-cutover (probably the one from before you swapped env vars)
- [ ] Click "..." → **Promote to Production**
- [ ] Status: code reverts; users mid-flow may have a confused experience
      but no data is lost
- [ ] Swap Vercel env vars back to Test-mode keys
- [ ] Sign in via Development Clerk again (your test users still exist)
- [ ] Diagnose the real failure with Claude in a session

Rollback is a last resort. Most issues — wrong env var, missing webhook
event — can be hot-fixed in 5 minutes by editing the env var and waiting
for a redeploy.

---

## Decisions deliberately deferred (do NOT chase these on cutover day)

- Resend Audiences sync (`PR 3c`) — needs Resend Inbound access first
- AI auto-send for support whitelist — Phase 2 of Pattern A
- Block C (modules + Journey content) — separate weeks-long effort
- Sentry Session Replay — needs PII redaction review
- Subscription pause / refund admin UI — handle in Stripe Dashboard

These are not launch blockers. Don't let scope creep delay the cutover.

---

## When to flip the switch from "soft launch" to "real launch"

Indicators that soft launch is going well and you can amplify:

- Sentry shows steady traffic with low error rate
- No Sev-5 events in the first month
- At least 50 signups, ≥30 of them sent a MiniMind message
- At least 5 marketing opt-ins via the banner
- One successful refund (or zero refund requests at all)
- No surprises in the support queue

If any of these go wrong → pause, diagnose, fix. Soft launch exists to find
problems before they're at scale.
