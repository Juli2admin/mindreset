# Doc 10 — PR B1 revised line-review (channel-neutral)

Supersedes Doc 9's Part A. **Planning/review only — no file edited, no PR
opened, B1 not implemented.** Incorporates three recorded owner decisions.

## Recorded owner decisions

**Decision 1 — Identity Anchor (out of B1).** The Stage-6 Identity Anchor is a
distinct construct from the Stage-1 Personal Anchor. **B1 does not cover it.**
Preserve the Identity Anchoring Ritual, the `identityAnchor` state field, the
Stage-6 identity-consolidation method, and the Stage-7/8 gates + progression.
The ~49 Identity-Anchor lines are **not modified** in this PR. (Whether the
Identity Anchor is over-recalled at open/close is a separate bounded question,
not folded in here.)

**Decision 2 — Adult Self & Stage-1 Anchor.** Adult Self is **not** permanently
dependent on or structurally linked to the Stage-1 Anchor. The Stage-1 Anchor is
**one optional resource** available to the Adult Self when genuinely relevant —
not mandatory, not permanently paired, not automatically recalled, not required
across later stages. The 13 Adult-Self↔Stage-1-anchor lines are **reclassified
from ambiguous to change** (Part A-bis below), each reworded to preserve
Adult-Self presence while making the Stage-1 resource optional and contextual.

**Correction — replacement strategy.** Do **not** mechanically replace anchor
recall with breathing / body awareness / feet-on-floor / any fixed grounding
ritual — that swaps one repetitive default for another and conflicts with
channel flexibility and body/imagery optionality. **Canonical principle:** *when
regulation is needed, choose the least intrusive regulation channel appropriate
to this user and this moment; do not automatically recall the Anchor and do not
automatically prescribe a body or breathing exercise.* Available responses:
slowing the pace · brief conversational orientation · returning to concrete
facts · Adult-Self perspective · a cognitive grounding question · silence/pause ·
body or breathing **only when that channel suits and is accepted** · an existing
user-owned resource **only when naturally relevant.**

### Reusable channel-neutral phrasing (referenced below as **CN-STEP**)
> *Steady only if needed, by the least intrusive means that fits this user and
> moment — slowing the pace, a brief orientation, returning to concrete facts,
> an Adult-Self perspective, a cognitive grounding question, or a pause; use body
> or breath only if that channel suits and is welcome. Not an automatic anchor
> recall; a resource of the user's own may be referenced in their words when
> genuinely relevant.*

## Replacement-type key (field 4, as requested)
- **PD** — pure deletion of automatic anchor behaviour (remove the anchor
  element; leave the rest of the original line verbatim).
- **CN** — channel-neutral regulation instruction (the whole step/clause was an
  anchor recall; replace with CN-STEP, not a body/breath default).
- **OUR** — optional user-resource reference (the user's own resource, in their
  words, only when naturally relevant).
- **DOC** — documentation correction (no clinical-move change).

Rollback (all): per-line `git revert`. Couplings: 02:51+02:272; 01:19+106+148.

---

# PART A (revised) — 67 Stage-1 anchor lines

## 00-shared-core.md
- **00:83** [soothe → **CN**] — `…non-trauma-reliving, regulation-supported, Adult-Self-led…` ("anchor-supported" → "regulation-supported"; regulation is a family, channel chosen at runtime — no body default).
- **00:193** [auto-recall → **CN**] — `- The AI does not recall it to settle the user. When intensity rises the AI regulates by the least intrusive means that fits this user and moment (see the regulation principle); the material may be referenced later only in the user's own words, when genuinely relevant — never as a scripted "take a moment with…" opener.`

## 01-stage-stabilisation.md
- **01:19 / 01:106 / 01:148** [doc-claim → **DOC**] — unchanged from Doc 9 (state that the gate STILL enforces `anchorText` + `anchor_identified` today, removal scheduled PR C). No clinical-move or channel content.
- **01:214** [naming → **OUR+PD**] — `7. **Mirror in the user's own words, do not name.** *"The blanket on the sofa — soft, heavy, knitted by your grandmother. That's yours."* The AI does not say "anchor", does not announce it, and does not promise to return to it.` (deletes naming + return-on-demand; no body added.)
- **01:216** [auto-recall → **PD**] — keep the `anchorText = "…"` capture sentence; delete `From this turn forward, the AI references it any time intensity rises across any later stage.` → `This is captured as internal data; it is not auto-invoked when intensity rises, and later stages reference it only in the user's own words when genuinely relevant.`
- **01:218** [naming → **PD**] — replace `It was anchored in body. It was named explicitly.` with `It was noticed by the AI and mirrored back in the user's own words, without being labelled or announced.` (removes the "named explicitly" few-shot signal; no body prescription — "noticed" is channel-neutral.)

## 02-stage-pain.md
- **02:23** [auto-recall → **CN**] — `…Regulation, chosen by the least intrusive channel that fits the user and the moment, keeps the system within the window of tolerance; anchor material is not recalled to do this, though it may be referenced in the user's own words when genuinely relevant.`
- **02:51** [auto-recall → **CN**] *(revert w/ 272)* — `- **Regulation-Supported Emotional Work** — when intensity rises the AI regulates by the least intrusive means that fits; anchor material is not the reference point of the session and is referenced only in the user's own words when genuinely relevant.`
- **02:63** [auto-recall → **CN**] — `- **When intensity first rises, the AI regulates by the least intrusive means that fits this user and moment** — not an automatic anchor recall and not an automatic body or breathing exercise.`
- **02:82** [auto-recall → **PD**] — `**One emotion, one practice cycle.** Do not build a routine anchor return into the cycle.` (delete "one anchor return".)
- **02:96** [auto-recall → **CN**] — `Regulation offered often, by whatever channel is least intrusive for this user.` (containment sentence kept verbatim.)
- **02:114** [soothe → **PD**] — `…(run a Regulation practice first).…` (delete "Anchor recall and"; Regulation's channel is chosen at runtime.)
- **02:122** [soothe → **PD**] — delete `, with your [anchor]`: `…Let it be here for a moment — and you are here too."`
- **02:128** [soothe → **PD**] — `…spend longest in witnessing.` (delete "and anchor".)
- **02:134** [soothe → **CN**] — `…in which case, regulate by the least intrusive means that fits and try later).`
- **02:148** [auto-recall → **PD**] — `- Intensity rises rather than falls → return to Stage 1 Regulation if needed.` (delete "anchor recall,".)
- **02:168** [auto-recall → **CN**] — `3. **Steady, only if needed.** CN-STEP (brief).`
- **02:200** [soothe → **PD**] — `**Signs to slow (the AI returns to Regulation):**` (delete "Anchor and".)
- **02:210** [soothe → **CN**] — `- The user cannot re-regulate when support is offered (by any suitable channel).`
- **02:247** [auto-recall → **CN**] — `2. **Steady, only if needed.** CN-STEP (brief).`
- **02:252** [auto-recall/closure → **PD**] — delete `— and come back to [anchor]`: `7. **Mirror without analysing.** *"That makes sense. Let's stay with this for a moment."*`
- **02:264** [auto-recall → **CN**] — `2. **Steady, before any practice, only if needed.** CN-STEP (brief).`
- **02:269** [auto-recall/closure → **PD**] — `7. **Close.** Quietly — not an automatic anchor return.`
- **02:272** [soothe → **CN**] *(revert w/ 51)* — `…→ Regulation (least-intrusive channel). Methods = …, Regulation-Supported Work.…`
- **02:281** [auto-recall → **CN**] — `1. **Steady, briefly, only if needed.** CN-STEP (brief).`
- **02:289** [auto-recall/closure → **PD**] — `9. **Close.** Quietly — not an automatic anchor return.`
- **02:118** [auto-recall → **CN**] — `1. **If the user needs steadying, use the least intrusive means that fits** (pace / orientation / concrete facts / Adult-Self perspective / a pause; body or breath only if it suits) — not an automatic anchor recall.`

## 03-stage-adult-self.md
- **03:60** [auto-recall → **PD**] — delete `and the Anchor`: `…gently returns to the body, and continues the Adult Self work in the present.` (keeps the original's "body"; pre-existing wording, not a B1 substitution.)
- **03:118** [auto-recall → **CN**] — `1. **Steady briefly, only if needed.** CN-STEP (brief).`
- **03:131** [auto-recall → **PD**] — `…return to witnessing.` (delete "Anchor and".)
- **03:160** [auto-recall → **CN**] — `1. **Steady, only if needed.** CN-STEP (brief).`
- **03:192** [auto-recall → **PD**] — `…gently return to the Adult Self. *"…For now, stay with this steadier presence."*` (delete "the Anchor and" + "and your [anchor]".)
- **03:200** [auto-recall → **PD**] — `**Signs to slow (the AI returns to Observer Seat or Stage 2 work):**`
- **03:204** [auto-recall → **PD**] — `- Intensity rises during the activation — return to Observer Seat, slow down.`
- **03:205** [soothe → **PD**] — delete `, with your [anchor]`: `…Let's sit with that for a moment."`
- **03:250** [auto-recall → **CN**] *(example)* — `1. **Steady, only if needed.** CN-STEP (brief). (The bench, her own resource, may be referenced in her words only if naturally present.)`
- **03:273** [auto-recall → **CN**] *(example)* — `1. **Steady, only if needed.** Brief; least intrusive means that fits.`

## 04-stage-parts.md
- **04:19** [auto-recall → **OUR**] — `The user's steadying resources remain available as their own context, referenced in their words only when genuinely relevant.` (MII gate sentence untouched.)
- **04:107** [auto-recall → **PD**] — `…return to the Adult Self.` (delete "and Anchor".)
- **04:146** [auto-recall → **CN+OUR**] — `1. **Adult Self confirmation.** *"…let [Adult Self in user's words] be here with you."* Confirm before proceeding. If the user needs steadying first, use the least intrusive means that fits; their own resource may be referenced in their words if genuinely present — not an automatic anchor recall.`
- **04:172** [auto-recall → **PD**] — `…Return to Adult Self. Try again next session.` (delete "+ Anchor".)
- **04:175** [auto-recall → **PD**] — `…Return to Stage 1 grounding.` (delete "Anchor and"; "Stage 1 grounding" is the original's routing to Stage 1 regulation.)
- **04:193** [auto-recall → **PD**] — delete the `"You're here with [anchor]."` opener: `1. **Adult Self + part awareness.** Reconnect. *"The [Adult Self words] is here. And the [part in user's words] is here too, at [safe distance]."*`
- **04:242** [closure → **PD**] — delete `, with the [anchor]`: `…*"The [Adult Self] is here, with the [part]. They are together…"*`
- **04:249** [auto-recall → **CN**] — `…extend the session or run additional regulation (least intrusive channel that fits) before closing.`
- **04:255** [closure → **PD**] — swap the anchor for the part (consistent w/ 242): `- *"The [Adult Self] is here, with the [part]. They hold themselves."*`
- **04:259** [auto-recall → **PD**] — `…Run Adult Self presence work.` (delete "Anchor recall,".)
- **04:278** [auto-recall → **PD**] — `**Resistance markers** (the AI returns to Surface Layer):`
- **04:383** [soothe → **PD**] — `…(Stage 1 grounding + Adult Self), not new part work…` (delete "+ Anchor"; MII-6 gate wording untouched.)
- **04:396** [auto-recall → **OUR**] *(example)* — `1. **Adult Self confirmation.** *"…let the steady one in your chest be here with you."* She settles. (The blanket, her own resource, may be referenced in her words only if genuinely present.)`
- **04:457** [soothe → **PD**] *(example)* — delete `with the [anchor], `: `…Just be here, with the [Adult Self].…`

## 05-stage-foreign-material.md
- **05:19** [doc-claim → **OUR/DOC**] — `The user's steadying resources remain available as their own context.` (softens "The Anchor remains the steady reference".)
- **05:99** [auto-recall → **PD**] — `…returns to Stage 4 Adult Self work.` (delete "+ Anchor".)
- **05:148** [auto-recall → **CN+OUR**] — `1. **Adult Self present.** *"Let [Adult Self in user's words] be here with you."* If steadying is needed first, use the least intrusive means that fits; their own resource may be referenced in their words if genuinely present — not an automatic anchor recall.`
- **05:173** [auto-recall → **CN**] — `…do not deepen the anger, and regulate by the least intrusive means that fits.`
- **05:175** [auto-recall → **PD**] — `…Return to the Adult Self. The reclaiming work comes later.` (delete "Anchor and".)
- **05:224** [auto-recall → **PD**] — `…Return to Adult Self + Self-Compassion.` (delete "+ Anchor".)
- **05:273** [auto-recall → **PD**] — `**Signs to slow (the AI returns to Adult Self work, or steps back a layer):**`
- **05:275** [auto-recall → **CN**] — `…normal Surface marker. Regulate by the least intrusive means that fits, and return to the Adult Self.`
- **05:322** [auto-recall → **CN+OUR**] *(example)* — `1. **Adult Self.** *"Let [Adult Self in user's words] be here with you."* Steady first only if needed, least intrusive means; her own resource referenced only if genuinely present.`
- **05:329** [closure → **PD**] *(example)* — delete `The [anchor] is still there. `: `…knows where this came from now. Let's stop here."*`

## 06 / 07 / 08 (Stage-1 anchor only; Identity-Anchor unchanged per Decision 1)
- **06:91** [soothe → **PD**] — `…return to Surface Layer and the Adult Self.` (delete "Anchor,".)
- **06:277** [soothe → **PD**] — `**Signs to slow (the AI returns to Surface Layer, Adult Self):**`
- **07:52** [soothe → **PD**] — `…The AI returns to the body any time the user starts to leap forward.` (delete "Anchor and"; "body" is the original's word, within the "Grounding and Regulation" section — pre-existing, out of B1 scope to change further.)
- **08:250** [soothe → **PD**] — `If overwhelm returns, return to the [Adult Self] and grounding.` (delete the Block-1 Anchor; "grounding" is the original's word. Mirror the same at `08:407`, which renders the user's words and is outside this anchor-line set.)

---

# PART A-bis (revised) — 13 Adult-Self ↔ Stage-1-anchor lines (reclassified per Decision 2)

Principle: preserve Adult-Self presence; make the Stage-1 anchor optional,
non-permanent, non-auto-recalled, not required across stages.

- **03:61** [pairing → **PD+OUR**] — `- **The Adult Self stands on its own.** The Stage-1 resource is one optional support it may draw on when genuinely relevant — not mandatory, not a permanent pairing, not automatically recalled. When natural, the AI may invite the presence in the user's own words.` (deletes "lives with the Anchor… pairing is permanent".)
- **03:95** [pairing → **PD**] — `…Then gradually invite the felt sense of the presence: "And if you let that presence have a body — how would it sit?"` (delete "body and Anchor" → "the felt sense of the presence"; quoted line unchanged.)
- **03:96** [pairing → **OUR**] — `…imagery is permitted (an older self in a place that feels steady to them, a presence with a particular quality of light…).` ("the Anchor place" → the user's own steady place, optional.)
- **03:152** [pairing → **PD+OUR**] — `…Co-created, never imposed. The user's own steady resource may be present as optional context, when genuinely relevant — the presence is not linked to it by default.`
- **03:164** [pairing → **OUR**] — `- *(visual)* *"If you imagine a slightly older version of yourself, sitting with you somewhere that feels steady to you — what do you notice?"*` ("[anchor place]" → the user's own steady place.)
- **03:169** [pairing → **PD+OUR**] — `5. **Let the presence settle.** *"Let this presence stand (or sit, or be) with you. Notice how that is."* If the user's own steady resource is genuinely present, it may be referenced in their words — the presence does not depend on it, and the AI does not return to a fixed pairing across later stages.` (deletes "Link to the Anchor… pairing is permanent… returns to it across all later stages".)
- **03:185** [pairing → **PD**] — `- *"Let it stand with you."*` (delete "in [anchor]".)
- **03:257** [pairing → **PD+OUR**] *(example)* — `8. **Let the presence settle.** *"Let that part of you — the one who knows it isn't the whole story — sit with you."* (The bench, her own resource, may be referenced in her words if naturally present.)`
- **03:264** [pairing → **PD**] *(commentary)* — `…then let the find settle in the user's own words.` (delete "anchored the find in body and the Anchor place".)
- **03:278** [pairing → **OUR**] *(example)* — `6. **Let the presence settle.** *"Let her sit with you tomorrow morning."* (The morning coffee, her own resource, may be referenced if naturally relevant.)`
- **04:150** [pairing → **PD**] — delete `with the [anchor]`: `…And you, the [Adult Self in user's words], are here."`
- **04:169** [pairing → **PD**] — `- *"And you are here, the [Adult Self words]."*` (delete "with the [anchor]".)
- **04:380** [pairing/aftercare → **OUR**] — `- The user may revisit a steadying resource of their own any time, in their own words, when it is naturally helpful.` ("Revisit the Anchor any time" → optional user resource.)

---

# Confirmation — Identity-Anchor lines unchanged (Decision 1)

**All ~49 Identity-Anchor lines remain UNCHANGED in B1**, plus their fields,
gates, and the ritual:
- Identity-Anchor recall/naming/close scripts: 06:141,189,191,193,214,238,330,354,357,361,365,378; 07:150,196,246,345,367,390,396,397; 08:152,204,247,249,357,404 — **unchanged.**
- Identity-Anchor doc-claims / channel-forms / constructs: 06:19,50,60,115,116,117,118,121,179,181,197,217,218,219,222,336,367; 08:25,58,70,126,128,129 — **unchanged.**
- `identityAnchor` field + Stage-6 ritual + Stage-7/8 recall **gates** (07:322, 08:329) + Stage-6 method — **unchanged / preserved.**
- Stage-5 forward-pointer 05:378 (references the ritual) — **unchanged** (belongs to the Identity-Anchor construct).
- Master state-report move-ID 681 (`universal.anchor_recall`) and regression-routing 217/392 — **deferred, not in B1** (state-report / progression scope; later code phase alongside the gate work).

---

# Counts (after revision)

- **Total B1 change lines: 80** = 67 Stage-1 anchor (Part A) + 13 Adult-Self pairing (Part A-bis).
- **Automatic-anchor instructions removed: 77** (every change line except the 3 pure documentation-claim corrections 01:19/106/148 — those correct a false claim rather than remove an instruction).
- **Fixed breathing/body substitutions remaining (introduced by B1): 0.** The earlier "slow breath / feet on floor / grounding breath" defaults were all revised to PD or CN. Four lines retain the **original's** pre-existing body/grounding word after a pure anchor deletion (03:60 "body", 04:175 & 08:250 "grounding", 07:52 "body") — these are the source text, not B1 substitutions; adjusting them is a separate body/imagery-optionality question (Decision 5 / C4), out of B1 scope.
- **Replacement-type distribution:**
  - **Pure deletion (PD): 41** — 01:216,218; 02:82,114,122,128,148,200,252,269,289; 03:60,131,192,200,204,205,264(commentary); 04:107,172,175,193,242,255,259,278,383,457; 05:99,175,224,273,329; 06:91,277; 07:52; 08:250; 03:95,185; 04:150,169.
  - **Channel-neutral (CN): 22** — 00:83,193; 02:23,51,63,96,134,168,210,247,264,272,281,118; 03:118,160,250,273; 04:249; 05:148,173,275,322 *(some CN lines also carry an OUR clause)*.
  - **Optional user-resource (OUR): 10** — 01:214; 04:19,146,396; 05:19,148,322; 03:61,96,152,164,169,257,278; 04:380 *(counted where OUR is primary; several overlap PD/CN)*.
  - **Documentation correction (DOC): 3** — 01:19,106,148.
  *(Lines with two tags are counted once by primary type; the four categories the owner requested are all represented.)*

---

# Exact B1 implementation scope (after revision)

B1 = **model-visible Stage-1-anchor language cleanup only**, across the active
corpus (00-shared-core, 01–08 specs; the master is already compliant):

1. **80 line changes** — the 67 Part-A lines + 13 Part-A-bis Adult-Self lines
   above — each a surgical phrase-level edit, no whole-example deletion, no spec
   distillation.
2. **Replacement discipline:** delete automatic anchor behaviour (PD), or replace
   a whole anchor-recall step with the channel-neutral least-intrusive-regulation
   instruction (CN), or make the anchor an optional user-resource reference
   (OUR); **never** substitute a fixed breathing/body ritual as the default.
3. **Explicitly out of B1:** the Identity Anchor (~49 lines + fields + gates +
   ritual, Decision 1); all gates and progression logic (incl. Stage-1 anchor
   gate — that is PR C); memory, open-cycle, state-report fields; the master
   move-ID 681 and regression-routing 217/392 (later code phase); pre-existing
   body/grounding defaults in the source (C4).
4. **Ships behind the tester-only runtime switch** with a Golden-Harness
   before/after; the **exact** assembled-prompt byte/token delta is measured at
   apply-time via the PR-A0 parity dump; owner signs off each of the 80 lines.
5. **No deprecated files** (`runtime/stage-01/02.md`, removed by PR A0) are
   touched.

*Planning/review only. No file edited; no PR opened; B1 not implemented.*
