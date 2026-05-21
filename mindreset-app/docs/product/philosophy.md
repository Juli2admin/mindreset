# Product philosophy

## What MindReset is

MindReset.ai is a **trauma-informed self-help platform** built around an
AI companion (MiniMind) and a progressive depth model (States & Themes,
The Journey). It is positioned legally and commercially as a **self-help
wellbeing tool**, not as therapy.

The methodology underneath is serious: an eight-block recoding framework
that draws from somatic regulation, parts-aware self-work,
trauma-informed pacing, narrative reframing, and integrative identity
formation. The methodology is real. The legal framing is not a hedge.
Both are true at once.

## What MindReset is not

The legal/safety stance is preserved across every user-facing surface:

- **Not therapy** — not licensed mental-health care
- **Not a medical device** — no MHRA registration, no medical claims
- **Not a diagnostic tool** — Readiness Check (Section 0) is
  **informational only**, not a clinical gate
- **Not a crisis service** — every section that touches distress carries
  Samaritans / NHS 111 / 999 signposting

## Brand voice

The voice is **warm, quiet, non-marketing**. Reads like a careful note,
not a sales pitch.

Concretely:

- Short sentences. White space.
- No exclamation marks (almost ever).
- Imperative used sparingly — "Begin." not "Click here to start!"
- No "amazing", "powerful", "incredible". These break the register.
- Verbs that signal pacing: *land*, *return*, *try*, *rest*, *carry*.
- Words to avoid even in marketing: *unlock*, *master*, *transform*,
  *boost*.

## Language constraints on payment surfaces

Stripe deplatforms apps using clinical/therapy language without medical
credentials. The following constraints apply to:

- Stripe product names and descriptions
- Stripe Checkout copy
- Email receipts
- `/[locale]/account/checkout/success` and `/cancel` landing pages
- Anywhere the user is mid-payment

### Approved on payment surfaces

- self-help
- self-guided reflection
- emotional wellbeing
- personal growth
- trauma-informed self-development *(this term is approved — confirmed
  in the spec)*
- recovery support
- companion for daily reflection

### Forbidden on payment surfaces

- therapy / therapeutic
- treatment
- medical
- mental illness
- diagnosis / diagnostic *(except in legal-disclaimer context)*
- counseling / counselling
- clinical intervention
- **unlimited** *(never used anywhere — even on Extended tier)*

### In-app surfaces (NOT subject to the above)

In-app screening, MiniMind prompt, Landing copy keep their existing
trauma-informed language. The forbidden list is **only** for payment
surfaces. The decision was locked 21 May 2026 — see
`../decisions/locked-decisions.md`.

## Safety posture

- **Section 0 (Readiness Check)** classifies users Green / Yellow / Red.
  Result is informational; users can proceed past Yellow or Red, but
  only after explicit acknowledgement of the limitations.
- **Phase 3c safety scanner** runs on every MiniMind user turn (keyword
  layer + LLM verifier). Sev 5 triggers freeze the conversation into
  `inCrisisCooldown` until the verifier sees an explicit safety
  confirmation in a user reply.
- **SafetyEvent log is immutable** — every red-flag event is recorded
  permanently and goes into a human-review queue.
- **CrisisResources are always visible** in the Footer and crisis-modal
  surfaces.

## Owner stance

- Julia is the operator and clinical-voice owner. She does live frontend
  testing on production and reviews every PR diff.
- She does not click merge buttons — the agent (Claude Code) merges.
- She does run manual SQL migrations herself in the Supabase editor.
- Translations into RU are hand-curated by her; other locales go through
  the Anthropic-backed translator + her review pre-launch.

## What MindReset will never do

Recorded as constraints because they recur in design discussions:

- No celebratory animations on screening results or safety events
- No streaks, gamification, or push notifications nagging at users
- No personalised marketing email beyond Welcome + transactional
- No selling, renting, or sharing of conversational data, ever
- No "AI therapist" framing in any surface, marketing or in-product

## Pricing principles

- One price, shown at checkout. No anchoring tricks, no fake "discount
  off was-£X" language.
- Free taster has no card requirement, no time pressure.
- Cancellation is one click — no retention dark patterns.
- Refund window is generous (7 days from initial purchase) and the
  agent should err on the side of approving manual refund requests.
- Annual is cheaper per month; the saving is shown plainly, no urgency.

## Russian-market considerations

- RU bundle is hand-curated by Julia (native speaker).
- Formal Вы default; feminine grammatical canonical.
- Russian-market pricing is **deferred to month 6** — at launch, RU
  users see GBP prices.
- The Russian audience uses "trauma-informed" terminology differently
  than UK audiences; per recent decisions, EN drops it from tier
  descriptions on `/account` while RU mirrors that EN change to keep
  parity. The locked translation in `Screening.tagline` keeps it.
