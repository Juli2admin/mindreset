# The Journey — Design vs Delivery Map

**Date:** 2026-06-23
**Audit type:** read-only investigation; no code or files changed during the investigation.
**Scope:** clinical canon (`docs/journey/00-shared-core.md` + 8 stage specs), runtime prompts (`journey-master.md`), runtime code (`lib/journey/**`, `app/api/journey/turn/route.ts`), live production data (70 JourneyTurns across 1 tester, 1 JourneyPracticeRun).
**Audit question:** what does the canonical method specify vs what the runtime actually delivers, and what is the minimum required to close the gap?

---

## Top-line structural finding

The master prompt is a deliberate departure from the per-stage specs. Per `journey-master.md:9-18`, the design decision was to collapse the 8 stages into a "moves available every turn" toolkit because "real clinical work is recursive". This is a defensible clinical position — but the operational consequence is that the master prompt **systematically under-specifies practice anatomy, mandatory moves, prohibitions, and capture fields** as compared to the canonical specs. Stage-specific rituals (Securing the Part, Identity Anchoring, Safety Reorientation, Discharge) live only in the spec documents the AI never sees. The runtime knows about "moves" 1–8 as one-paragraph summaries.

The live data confirms the operational gap: 70 turns of conversation, 1 logged practice (Stage 1 Personal Anchor Identification on the second day of use). The other 19 canonical practices have never fired.

---

## A. Practices — design vs delivery

### A.1 Catalogue of NAMED practices in the canon

| Stage | Named practice | Anatomy (steps) | Key capture fields |
|---|---|---|---|
| 1 | Personal Anchor Identification (§8) | 4–5 steps: invitation, receive, anchor in body, name back, light recall test | `anchorText`, `anchorSetAt` |
| 2 | Affect Labelling & Somatic Mapping (§8.1) | 5 steps: anchor recall, present moment, name one emotion, locate in body, acknowledge | emotion in user's words, body location |
| 2 | Reflective Inquiry / Soft Why (§8.2) | 3 steps: ask soft why, receive, anchor | user's reflection in their own words |
| 3 | Observer Seat (§8.1) | 3 steps: anchor, language shift, notice the noticer | `observerSeatTouched` |
| 3 | Adult Self Co-Creation (§8.2) | 6 steps including anchor-link + light test | `adultSelfPresent`, `adultSelfQualities`, `adultSelfAnchorLinked`, `heldEmotionInAdultSelf` |
| 4 | First Contact (§8.1) | 5 steps including safe distance | `partIdentified`, `partInUserWords`, `partChannel`, `safeDistance` |
| 4 | Compassion Bridge (§8.2) | 4 steps; 4 allowed qualities (compassion/curiosity/acceptance/willingness_to_comfort) | `compassionBridgeQuality`, `bridgeAchievedAt` |
| 4 | Securing the Part (§8.3) | 4 steps; **mandatory at every Stage 4 session close** | `partSecuredAt`, `partRestingPlace`, `userGrounded` |
| 5 | Origin Voice Mapping (§8.1) | 5 steps including Soft Origin Question | `foreignMaterialIdentified`, `originIdentified` |
| 5 | Symbolic Return of the Burden (§8.2) | 6 steps; honouring phrase + body check | `burdenReturnedTo`, `somaticRelease`, `whatStaysAsMine` |
| 5 | Clean Identity Statement (§8.3) | 4 steps; both halves required | `cleanIdentityStatement`, `bodyConfirmation` |
| 6 | Internal Consensus Check (§8.1) | 4 cohesion questions in order | `internalConsensus` + user's words per question |
| 6 | Identity Anchoring Ritual (§8.2) | 6 steps; gesture/phrase/object/place/felt sense | `identityAnchor` |
| 6 | Self-Loyalty Commitment (§8.3) | 3 steps; 2 questions | `selfLoyaltyStatement`, `oneSmallAction` |
| 7 | Qualities Inventory (§8.1) | 4 steps | `emergingQualities[]` |
| 7 | Symbolic Identity Map (§8.2) | 5 steps | `symbolicIdentityMap` |
| 7 | Safety Reorientation (§8.3) | 3 steps; **mandatory at every Stage 7 session close** | `safetyReorientation` |
| 8 | Conscious Action Loop (§8.1) | 5 steps; runs on a recent real moment | `calRunOn`, `calLayer`, `userReportedRedirection` |
| 8 | Identity Reinforcement Check-In (§8.2) | 3 questions; **run at start of every Stage 8 session** | `adultSelfThisWeek`, `feltAligned`, `feltOld` |
| 8 | Discharge Protocol (§8.3) | 6 steps | `journeyDischargedAt`, `dischargeReadiness` |

**Total: 20 named, audit-logged signature practices across stages 1–8.**

### A.2 Expected practice cadence

The canon does not say "every session has a practice", but each stage has at least one **load-bearing** practice the stage cannot close without. Stage 4 mandates Securing the Part at *every* session close. Stage 7 mandates Safety Reorientation at *every* session close. Stage 8 mandates Identity Reinforcement Check-In at the *start* of every session and at least one CAL per session.

**Live data check:** 70 turns, 1 practiceRun. Tester reportedly did parts work + foreign material territory in conversation. The 1 logged practice is the Stage 1 Personal Anchor — no Compassion Bridge, no First Contact, no Securing the Part, no Origin Voice Mapping. The runtime treated those as "conversation moments", not "practice moments".

### A.3 Practice support in the master prompt

| Practice | Listed by name in master? | Anatomy described? | Mandated when? | Framing language required? |
|---|---|---|---|---|
| Personal Anchor Identification | Yes (`:200-204`) | Loose — 4 bullet steps | When user names a comfort | NOT required |
| Affect Labelling & Somatic Mapping | No, only "Pain identification move" (`:206-213`) | Three questions, no 5-step structure | Optional | No |
| Reflective Inquiry (Soft Why) | No | Absent | n/a | No |
| Observer Seat | Glanced at (`:222`) | No anatomy | n/a | No |
| Adult Self Co-Creation | No (`:214-222`) | Three example questions, no 6-step structure | "When she emerges, name her" | No |
| First Contact | No (`:224-237`) | Rules listed, not the 5-step practice | n/a | No |
| Compassion Bridge | No — buried in "Parts work move" | No anatomy; the 4 qualities aren't named here | n/a | No |
| Securing the Part | Implied by field reference, no name | No anatomy | **NOT mandated as session-close** | No |
| Origin Voice Mapping | No (`:239-251`) | Three example questions | n/a | No |
| Symbolic Return of the Burden | No | No anatomy; honouring phrase not flagged | n/a | No |
| Clean Identity Statement | Implied | No anatomy; both-halves requirement absent | n/a | No |
| Internal Consensus Check | Brief mention via field (`:600`); 4 questions NOT in master | No | n/a | No |
| Identity Anchoring Ritual | Implied | No anatomy | n/a | No |
| Self-Loyalty Commitment | **ABSENT** | n/a | n/a | No |
| Qualities Inventory | Implied | No anatomy | n/a | No |
| Symbolic Identity Map | Implied | No anatomy | n/a | No |
| Safety Reorientation | **ABSENT** | n/a | **NOT mandated as Stage 7 session-close** | No |
| Conscious Action Loop | Glanced at (`:269-275`) | Not described as 5-step CAL | n/a | No |
| Identity Reinforcement Check-In | Implied | No anatomy; 3-question structure absent | **NOT mandated at session-open** | No |
| Discharge Protocol | **ABSENT** | n/a | n/a | No |

Master prompt's framing instruction (`:356`): *"Frame every practice explicitly. Do not slip grounding into the conversation as a stealth question."* But this lives **only in `<practice_generation>` and only for Block 1 anchor / grounding / self-compassion practices**. Stages 2–8 named practices are not held to this framing standard.

### A.4 practiceRun emission on aborted statuses

The `<output_format>` (`:619`) lists status values including `aborted_user_request` and `aborted_overwhelm`. There is **no instruction that practiceRun MUST still be emitted on abort.** The master treats `practiceRun` as something the AI emits when it ran a practice. Aborts are an enum value; whether the AI thinks to emit one when it didn't fully run a practice is left to interpretation.

### A.5 "Practice moment" vs "conversation moment" decision

`<practice_generation>` (`:336-367`) gives a generation-logic ladder. Step 2 (Block-1 proactive rule) is the *only* place a practice is mandated:

> *"If `intensity ≥ 5` AND you have NOT offered a practice in the last 3 turns AND the user is not actively rejecting practices → OFFER a small grounding / anchor / self-compassion practice this turn."*

This applies **only in Block 1** and only to Regulation/Anchor/Self-Compassion. For Stages 2–8, the algorithm bottoms out at step 8: *"Else → keep talking. Reflect, ask, sit with them."* The canonical practices (Compassion Bridge, Symbolic Return, Identity Anchoring, CAL) have **no firing condition** in the master prompt. They sit inside the move descriptions as capture fields.

### A.6 Headline gaps

| Per canon, X fires when Y | Master prompt does Z | Gap |
|---|---|---|
| Personal Anchor: every Stage 1 user | Captured only "when user spontaneously names" | Capture is reactive |
| Affect Labelling: spine of Stage 2 | Replaced by 3 unprompted questions | 5-step anatomy gone |
| Observer Seat & Adult Self Co-Creation: required twice on different days | Only capture fields mentioned | AI has no instruction on HOW to invite |
| Compassion Bridge: required twice on different days for MII-4 | Enum exists; the 4 qualities NOT enumerated in master | Parser drops most AI emissions |
| **Securing the Part: mandatory close of every Stage 4 session** | **Absent from master** | **Clinical safety gap — parts left exposed at session close** |
| Origin Voice Mapping & Symbolic Return | Capture fields named, no anatomy | AI may release without canonical structure |
| Clean Identity Statement: both halves required | Capture field exists, requirement absent | AI may emit one-half; gate passes |
| Internal Consensus Check: 4 specific questions | boolean capture exists; the 4 questions absent | AI emits from gut feel |
| Identity Anchoring Ritual: 6 steps | Capture field exists, no ritual anatomy | 6 steps not in playbook |
| Self-Loyalty Commitment | **Fields ABSENT from schema** | Stage 6 close cannot be observed |
| **Safety Reorientation: every Stage 7 session close** | **Field ABSENT from schema. Practice absent.** | **Sessions can end without slow-down ritual** |
| CAL: at least one per Stage 8 session | Capture fields exist; 5-step structure absent | AI may capture for any conversational reference |
| Identity Reinforcement Check-In: every Stage 8 session-open | Implied; no mandate to run at start | Capture depends on session-shape AI invents |
| **Discharge Protocol: 6 steps** | **Fields ABSENT. Practice absent from master.** | **Router can fire discharge; AI has no protocol** |

---

## B. Stage-by-stage method anatomy

Each marked DELIVERED / PARTIAL / MISSING:

### Stage 1 — Stabilisation
- **Required moves:** anchor capture, share-back assessment, formulation-confirmed milestone. **DELIVERED** in `<assessment_phase>` (`:284-334`) — strongest section.
- **Prohibitions** (no childhood, no deep, no parts work, no chaining): **PARTIAL** — list at `:308`. Stage-1 voice constraints (no deep breathing too early, extended exhale only, anchor framed per channel-type) are **MISSING**.
- **Session-close ritual:** none beyond completion — DELIVERED by default.
- **Capture fields:** `anchorIdentified`, `formulation_confirmed`, etc. **DELIVERED** in checklist `:660-667`.

### Stage 2 — Pain
- **Required moves:** Affect Labelling & Somatic Mapping (5 steps), Soft Why. **PARTIAL** — folded into "pain identification move" (`:206-213`) without anatomy.
- **Prohibitions** (no naming emotion for user, no historical why, no chaining, no parts dialogue): **MISSING** as stage-specific.
- **Session-close:** anchor-recall close — **MISSING**.
- **Capture fields:** Canon expects emotion-name + body location verbatim. Schema has only `readinessTouched` tokens — **no dedicated emotion or body-location field**.

### Stage 3 — Inner Adult Self
- **Required moves:** Observer Seat, Adult Self Co-Creation, two-different-days reproducibility. **PARTIAL** — captures exist, two-days enforced at `stage-gates.ts:139-144`. Practice anatomy absent.
- **Prohibitions** (don't describe Adult Self, don't impose imagery, harsh-critic-misidentification): **PARTIAL** — Trap 6 covers some.
- **Session-close:** anchor + presence pairing — **MISSING**.
- **Adult-Self-Anchor pairing capture:** `adultSelfAnchorLinked` **MISSING** from schema.

### Stage 4 — Meeting Inner Parts
- **Required moves:** Three-Layer pacing, First Contact, Compassion Bridge with 4 named qualities, Securing the Part, 48-hour settling. **PARTIAL** — partsTouched/partSecured/compassionBridgeQuality exist; 48-hour check renders. Three-Layer pacing absent. 4 bridge qualities not enumerated. **Securing the Part ritual is MISSING.**
- **Prohibitions** (no past scenes in sensory detail, never name the part, no persecutory-part dialogue, no skipping session-close): **PARTIAL**.
- **Session-close ritual:** **MISSING entirely.** Clinical safety risk.
- **Capture fields:** `bridgeAchievedAt`, `userGrounded` **MISSING**.

### Stage 5 — Foreign Material
- **Required moves:** Origin Voice Mapping, Symbolic Return, Clean Identity Statement. **PARTIAL** — all three live as captures. Practice anatomy absent. Three-Layer pacing absent.
- **Prohibitions** (no confrontation rehearsal, no real-world action prescribed, no blame as work): **DELIVERED** — Trap 1.
- **Session-close ritual:** "close on what stays as mine" — **MISSING.**
- **Capture fields:** `originIdentified`, `somaticRelease`, `bodyConfirmation` **MISSING.**

### Stage 6 — Integration
- **Required moves:** Internal Consensus Check (4 questions), Identity Anchoring Ritual (6 steps), Self-Loyalty Commitment. **MISSING** for the most part.
- **Prohibitions:** **PARTIAL**.
- **Capture fields:** `selfLoyaltyStatement`, `oneSmallAction` **MISSING from schema**.

### Stage 7 — Sensing New Identity
- **Required moves:** Qualities Inventory, Symbolic Identity Map, Safety Reorientation at every session close. **PARTIAL** — captures exist. **Safety Reorientation entirely absent.**
- **Prohibitions:** **PARTIAL** — Trap 2 covers part.
- **Session-close ritual:** Safety Reorientation. **MISSING entirely.**
- **Capture fields:** `safetyReorientation: boolean` **MISSING from schema.**

### Stage 8 — Embodiment
- **Required moves:** Identity Reinforcement Check-In at every session-open, CAL, 6-step Discharge Protocol. **PARTIAL** — capture fields exist. Check-In not mandated. **Discharge Protocol MISSING entirely.**
- **Prohibitions:** **PARTIAL** — Traps 8/9/10.
- **Capture fields:** `journeyDischargedAt`, `dischargeReadiness` **MISSING from schema.**

---

## C. State-report schema — design vs delivery

5-column matrix (✓ = present, ✗ = absent):

| Canonical capture field | schema.ts | parse.ts | save.ts | master `<output_format>` | stage-gates.ts |
|---|---|---|---|---|---|
| `anchorIdentified` | ✓ | ✓ | ✓ set-once | ✓ | ✓ Stage 1 |
| `identityAnchor` | ✓ | ✓ | ✓ | ✓ | ✓ Stage 6/7/8 |
| `observerSeatTouched` | ✓ | ✓ | audit only | ✓ | ✓ Stage 3 |
| `adultSelfQualities` | ✓ | ✓ | ✓ | ✓ | ✓ Stage 3 |
| `adultSelfAnchorLinked` (canon Stage 3) | ✗ | ✗ | ✗ | ✗ | ✗ |
| `heldEmotionInAdultSelf` (canon Stage 3) | ✗ | ✗ | ✗ | ✗ | ✗ |
| `partsTouched[]` | ✓ | ✓ | ✓ | ✓ | ✓ MII-2 |
| `partSecured.*` | ✓ | ✓ | ✓ | ✓ | ✓ MII-5 |
| `bridgeAchievedAt` (canon Stage 4) | ✗ | ✗ | ✗ | ✗ | ✗ |
| `userGrounded` (canon Stage 4 close) | ✗ | ✗ | ✗ | ✗ | ✗ |
| `compassionBridgeQuality` | ✓ | ✓ | audit only | ✓ | ✓ MII-4 |
| `mii6Check` | ✓ | ✓ | ✓ | ✓ | ✓ MII-6 |
| `cohesionAwareness` | ✓ | ✓ | audit only | ✓ | ✓ MII-7 |
| `cleanIdentityStatement` | ✓ | ✓ | audit only | ✓ | ✓ Stage 5 |
| `foreignFileReleased.*` | ✓ | ✓ | ✓ | ✓ | ✓ Stage 5 |
| `originIdentified` (canon Stage 5) | ✗ | ✗ | ✗ (column exists, no write path) | ✗ | ✗ |
| `somaticRelease` (canon Stage 5) | ✗ | ✗ | ✗ | ✗ | ✗ |
| `bodyConfirmation` (canon Stage 5) | ✗ | ✗ | ✗ | ✗ | ✗ |
| `internalConsensus` | ✓ | ✓ | audit only | ✓ | ✓ Stage 6 |
| `selfLoyaltyStatement` (canon Stage 6) | ✗ | ✗ | ✗ | ✗ | ✗ acknowledged P1 followup |
| `oneSmallAction` (canon Stage 6) | ✗ | ✗ | ✗ | ✗ | ✗ |
| `symbolicIdentityMap` | ✓ | ✓ | audit only | ✓ | ✓ Stage 7 |
| `emergingQualities[]` | ✓ | ✓ | audit only | ✓ | ✓ Stage 7 |
| `urgencyMarkers` | ✓ | ✓ | audit only | ✓ | ✓ Stage 7/8 |
| `safetyReorientation` (canon Stage 7) | ✗ | ✗ | ✗ | ✗ | ✗ |
| `calRunOn`, `calLayer` | ✓ | ✓ | audit only | ✓ | ✓ Stage 8 |
| `adultSelfThisWeek`, `feltAligned[]`, `feltOld[]` | ✓ | ✓ | audit only | ✓ | ✗ not checked |
| `journeyDischargedAt` (canon Stage 8) | ✗ | ✗ | ✗ (RecodeProgress.dischargedAt exists, router-written) | ✗ | ✓ router writes |
| `dischargeReadiness` (canon Stage 8) | ✗ | ✗ | ✗ | ✗ | ✗ |

**11 canonical capture fields are entirely absent from the schema.** Most other captures persist only via the encrypted audit blob, not as queryable columns.

---

## D. Voice and prohibitions

DELIVERED: British English, warm/slow/present, match user's vocabulary, nameless AI, no diagnosing, no spiritual claims, no pet names, no promises of cure, no toxic positivity, no "your subconscious is telling you", no advice, no plans, no life decisions.

PARTIAL: "do not narrate user's body" (Trap 5 addresses adjacent issue, not direct), "no past scenes in sensory detail without stability + adult self present" (Red Flag covers flashbacks; explicit Stage 4 prohibition absent).

MISSING: Stage 1 "no deep breathing too early", Stage 2 "no historical why", Stage 4 "no sensory trauma reconstruction", Stage 7 "no behavioural rehearsal".

---

## E. The "Conversation vs Practice" gap — the central finding

**What the canon says:**

> *"Working — the body of the session: witnessing, dialogue, **or one practice from the appropriate family**. One practice at a time; never chaining."*
> — Shared Core §10

The canon expects **one practice per session in the relevant stage's named set**, plus opportunistic practices on signal. Practices are not optional decoration — they are the load-bearing acts that close stage gates.

**What the master prompt says:**

> *"You offer a practice only when it would actually serve. **Most of the journey is conversation, listening, reflection.**"*
> — `journey-master.md:337`

This is the explicit design choice that produces the 70:1 ratio. The master:
- Mandates proactive practice only in Block 1 at `intensity ≥ 5`.
- Frames Stages 2–8 practices as *capture-when-they-happen* fields, not as required moves.
- Has no rule like "every Stage 4 session ends with Securing the Part" or "every Stage 7 session ends with Safety Reorientation".

**The gap, in one sentence:** the canon treats named practices as **required, named, audit-logged acts**; the master treats them as **opportunistic captures that surface in conversation**. The AI was given conversation as the default mode and shown practices only as fields to set when they happen to arise.

---

## F. The hidden state-report contract — what goes to /dev/null

**`clinicalRead`** — emitted per `<clinical_reading>` and `<output_format>:585`. Persistence: encrypted blob (`audit/log.ts:24`). Read by: nothing. There is no clinical-review surface that decrypts and surfaces it.

**`feltAligned`, `feltOld`, `adultSelfThisWeek`, `userReportedRedirection`** — emitted, parsed, but **not used by any Stage 8 gate code path**. `stage-gates.ts:349-363` reads only `calRunOn`, `calLayer`, `urgencyMarkers`. The Stage 8 completion criterion in canon §10 says "Identity Reinforcement Check-In completed at start of every Stage 8 session for the last 4 sessions" — this maps to `adultSelfThisWeek` but the gate doesn't check it.

**`whatStaysAsMine`** at top level — emitted, gate doesn't check. Persisted only inside `foreignFileReleased`.

**`internalConsensus`** as user's-words-per-question — canon `06:173` says "with the user's words for each of the four questions". Master only enables boolean. The 4 individual answers are lost.

**Gate fields with no schema entry:**
- `selfLoyaltyStatement`, `oneSmallAction` — canon §10 Stage 6 close. No schema, no gate check.
- `safetyReorientation` — Stage 7 mandatory close. No schema, no gate check.
- `dischargeReadiness`, `journeyDischargedAt` (as AI-emit) — Stage 8 discharge. Router writes `dischargedAt` on its own decision; AI has no protocol.

---

## G. Continuity across sessions

**Session count / distinct-days count: MISSING.** `renderStateBlock` (`assemble.ts:96-172`) injects active stage, depth, channel, intensity, anchor, identity anchor, qualities, parts, foreign files, signature images, continuity note, frozen flag, settling-time signal. **No field for session count, distinct-days count, or current-session number.** The AI cannot know if this is session 2 or session 27.

**continuityNote: DELIVERED end-to-end** with caveats. `save.ts:112` writes it on every turn the AI emits it. Master `<memory>:415-432` instructs maintenance. If AI doesn't emit, prior note persists.

**48-hour delayed check signal: DELIVERED end-to-end.** Cleanest path in the codebase. But it only fires after `practiceRun.depth === 'deep'` — with practices not firing, Deep Layer contacts may go undetected and the 48-hour check would never trigger.

---

## H. Stage transitions and what the AI knows

**Stage advancement: PARTIAL.** After `applyRouteDecision` writes `currentStage: decision.to`, the next turn's `renderStateBlock` injects the new number. But:
- No "you just advanced" signal.
- No mandatory ritual at the start of the new stage.
- No "deeper moves now available" instruction at Stage 4 advance.

**Clinical consequence:** when code advances Stage 3 → 4 (parts work now open), there's nothing telling the AI "the user is now eligible for parts work; previously you were holding the line against it." The AI may continue Stage 3-shaped conversation indefinitely.

---

## Highest-leverage fixes (ranked by impact)

1. **Mandate practice framing and emission on every named-practice trigger.** Add per-stage practice-firing rules. Mandate `practiceRun` emission even on abort. Mandate session-close rituals.

2. **Add the 11 missing schema fields:** `selfLoyaltyStatement`, `oneSmallAction`, `safetyReorientation`, `originIdentified`, `somaticRelease`, `bodyConfirmation`, `bridgeAchievedAt`, `userGrounded`, `adultSelfAnchorLinked`, `heldEmotionInAdultSelf`, `dischargeReadiness`.

3. **Inject session number and distinct-days count into the state block.**

4. **Add a "stage just advanced" signal.**

5. **Bring named practice anatomy as compressed inline references inside `<method>`.**

6. **Enumerate the 4 Compassion Bridge qualities + the 4 Internal Consensus questions inline.**

7. **Wire `clinicalRead` to an admin review surface or drop it.**

8. **Add per-stage prohibitions and session-close rituals as inline blocks keyed off `state.currentStage`.**

---

## Recommended bundling

**Bundle A — Practice fidelity (the core fix).** Items 1, 5, 6, 8 combined. Master-prompt patch — content/clinical work, line-by-line review.

**Bundle B — Schema completeness.** Item 2 + parse + save + gate wiring. Code-only patch, ~half day + tests.

**Bundle C — Continuity signals.** Items 3, 4. Code-only patch, ~half day.

**Bundle D — `clinicalRead` disposition (defer).** Item 7. Owner decision.

Order: Bundle A first, Bundle B alongside or just after, Bundle C after A+B settle.

---

## What this audit will NOT prove

Even with all bundles shipped, the bundles close **structural gaps** in the prompt and schema. They do not guarantee:
- The AI will pick the right practice for the moment (clinical judgment)
- The AI will hold the clinical voice while running a practice (presence)
- The AI will read user dissociation, faking-completion, or quiet resistance correctly
- Long-session drift will be eliminated as context window grows

Proof of method delivery requires:
1. **Behavioural fidelity test** — fictional user transcripts scored against expected AI behaviour, run after each bundle
2. **Real-session re-measurement** — practiceRun count, session-close ritual count, distinct practice families per session
3. **Clinical reviewer audit** — Julia or trained clinician scores 10 full sessions
4. **Iterative prompt refinement** — feed reviewer findings back into the master prompt

The bundles are necessary. They are not sufficient.

---

## Files reviewed

**Canonical method:** `docs/journey/00-shared-core.md`, `01-stage-stabilisation.md`, `02-stage-pain.md`, `03-stage-adult-self.md`, `04-stage-parts.md`, `05-stage-foreign-material.md`, `06-stage-integration.md`, `07-stage-new-identity.md`, `08-stage-embodiment.md`.

**Runtime prompts:** `docs/journey/runtime/journey-master.md`, `runtime/stage-01.md`, `runtime/stage-02.md`.

**Runtime code:** `lib/journey/prompts/assemble.ts`, `prompts/load-spec.ts`, `state/types.ts`, `state/load.ts`, `state/save.ts`, `stateReport/parse.ts`, `stateReport/schema.ts`, `router/router.ts`, `router/stage-gates.ts`, `router/history.ts`, `safety/keywords.ts`, `safety/verifier.ts`, `safety/freeze.ts`, `audit/log.ts`, `delayedCheck/signal.ts`, `model.ts`, `app/api/journey/turn/route.ts`.

**Live data:** 70 JourneyTurns (tester `jloya4436@gmail.com`), 1 JourneyPracticeRun (Personal Anchor Identification, day 1).
