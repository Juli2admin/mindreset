# Audit — The Original Clinical Method (MINDRESET_CLINICAL_MANUAL)

**Date:** 2026-07-19 (third audit; extends the clinician-narrowing and
runtime-decision-pathway audits of the same date)
**Source audited:** owner-supplied `MINDRESET_CLINICAL_MANUAL.docx` (108 KB, 1,852
paragraphs), cross-checked against the repo mirror
`mindreset-app/docs/journey/CLINICAL_MANUAL.md`.
**Scope:** read-only. No code, prompt, canon, or stage-file changes. Line references
below are to the repo mirror (the versioned copy).

---

## 1. Document identity

The uploaded docx and the repo's `CLINICAL_MANUAL.md` are **the same document**.
Normalised line-level diff: 1,680 vs 1,811 unique lines, with the ~350 non-matching
lines accounted for by line-splitting/joining artifacts of conversion and minor
punctuation variants — no block, section, practice list, or protocol exists in one and
not the other. Conclusion: the runtime canon was derived from this exact source; there
is **no hidden fuller method** in the original that the repo lost wholesale. The losses
are finer-grained (see §4).

Structure of the source: 8 detailed block protocols (purpose, rationale, indications,
contraindications, three-layer depth model, methods, client types, practice lists,
therapist algorithms, expected reactions, red flags, completion criteria, closing
protocols) + Section 0 pre-screening (exclusion list, 0–5 functionality self-assessment,
trauma-description rules, consent statements, therapist review notes). Every practice
list says "full scripts are in the separate **Practice Library**" — see finding SM3.

---

## 2. Verdict

The original method is a coherent, safety-first, **sequential** stabilisation-to-
integration protocol written for a human therapist. Three things follow, and they
reframe the earlier audits' root causes:

1. **The single-route repertoire (RC1) originates at source.** The image–pattern–release
   arc *is* the method by design. Existential exploration, decision facilitation, life
   timeline, and writing practices are absent from the manual too. The runtime did not
   delete them; they were never authored. Users bringing those requests were outside
   the manual's intended presentation profile ("internal chaos, anxiety, agitation…",
   Block 1 §2) — but the product now sells to them.
2. **The missing task-contract (RC2) also originates at source — with a crucial
   difference.** The manual never asks what the client wants either (its Block 1
   decision algorithm begins with *observation*, not inquiry; no goals/expectations
   intake exists anywhere — verified by search). For a *human* therapist this is
   survivable: contracting, request-tracking, and knowing when to deviate are the
   profession's implicit skills, which a manual can presuppose. The runtime inherited
   the **letter of the protocol without the implicit human-clinician layer the protocol
   presupposes**. That layer — exactly Julia's ten "the clinician must continuously
   answer" questions — was never written down anywhere, because for a human it never
   needed to be. This is the deepest finding of the three audits.
3. **Several things the manual DOES specify were thinned or inverted in translation**
   (§4): per-type route selection as the first clinical act, ~96 named practices,
   client-reported intensity ratings, decision-capacity as an *outcome*, and per-block
   scoping of the "shift thoughts to body" tactic. These are recoverable from the source
   without new authorship.

The method is not "wrong." It is a sequential protocol that assumed a human operator,
authored for a narrower presentation profile than the product now serves, and
translated into runtime with fidelity losses concentrated exactly where the pilot
hurts.

---

## 3. What the original method authorises (block-by-block inventory)

**Practice breadth: ~96 named practices** (Block 1: 12 · Block 2: 15 · Block 3: 10 ·
Block 4: 16 · Block 5: 12 · Block 6: 15 · Block 7: 10 · Block 8: 6). The runtime's
Practice Generation Algorithm replaced the library with 5 families and ~30 example
items; the stage specs carry 2–3 signature anatomies each. Manual practices with **no
runtime trace** include: Micro-Choice Stabilisation, Environmental Mapping, Cognitive
Orientation Trio (B1); Three-Layer Emotion Scan, Emotion Wave Tracking, Feeling-as-Object
(B2); Mini-Dialogue: Adult Self to Current Emotion, Adult Self Reflection "What Do I
Know Now?" (B3); Emotional Temperature Check, Symbolic Boundary Reset, Scene Softening
(B4); Belief Sentence Deconstruction, Role Naming, My Space / Not My Space, What Opens
Up When It's Gone? (B5); Safe Future Self Preview, Resistance Mapping & Releasing,
Future-Behaviour Mapping (1% Rule), Bridging Ritual (B6); Inner Compass Check, Values
Sorting (Safe Version), Boundary Texture Exploration, "What Stays, What Shifts" Mapping,
Future Self: One Emotion Ahead (B7); New-Self Behavioural Tracking, Embodied Behaviour
Rehearsal (B8).

**Method families named per block** (all internal): polyvagal regulation, affect
labelling, somatic awareness, symbolic externalisation, compassionate witnessing,
reflective inquiry (B1–2); ego-state/IFS-light, mindfulness self-observation (B3);
trauma-informed parts work, emotion–body mapping, three-tier layering (B4);
IFS-informed externalisation, **Schema micro-rescripting, Gestalt boundary work,
Belief Sentence Deconstruction** (B5); internal family integration, Gestalt completion,
somatic anchoring, **cognitive reframing of identity beliefs, micro-behavioural
rewiring** (B6); parts-informed consolidation, **narrative reorientation, values
mapping (ACT)**, embodied identity sensing (B7); self-stabilisation, **behavioural
shaping, CAL, behaviour rehearsal** (B8).

**Meaning and values content exists at source — late-arc only**: Block 6 purpose
integrates "updated meaning systems" and produces "a renewed sense of direction,
meaning, and personal agency" (2255, 2296); Block 7 §5.4 Values Mapping + practice list
(2871, 2974). Same placement as runtime: consolidation-phase work, never an entry route.

**Decision capacity is an outcome of the method**: "I feel like I can take decisions"
is listed as a *healthy integration marker* (Block 6 §8, 2602), and Block 8 §7.2 tracks
"new decisions" as wins to reinforce (3287-3295) — while Blocks 7–8 simultaneously
prohibit *making* major decisions during the fragile window (2904-2944, 3349-3352,
3366-3380). The manual's own logic supports Julia's 2026-07-19 scope ruling: restored
decision agency is a goal; what the method guards against is *impulsive* deciding from
an unstable state, not decision work as such.

**Sequence is by design.** Every block has entry criteria referencing prior blocks
("Block 6 is used ONLY when: Block 4 fully stabilised (MII passed)… Block 5 is
completed", 2300-2332), plus return-to-earlier-block rules everywhere. The only
"non-linear" statement (3276) concerns TLSM *layers within Block 8*, not block order.
The runtime's PR λ "stages are a map, not a sequence" framing — and Julia's core
product principle — is a **liberalisation the manual does not yet contain**.

**Client-reported measures.** Block 1 STEP 7: "Ask for subjective rating (0–10) or
qualitative description ('a bit lighter / same / heavier')" (415-419). The client
rates; the therapist compares. Readiness and completion checks lean on client reports
throughout.

---

## 4. Fidelity chain: manual → stage specs → PGA/master → code

| # | Manual specifies | Stage specs | PGA / master prompt | Code | Verdict |
|---|---|---|---|---|---|
| F1 | **Typing → route selection as STEP 1**: "Identify client type… Choose Stabilisation Route based on client type (see Mini-Protocols)" (379-395, 427-467); per-block per-type entries (B2 §8 "Cognitive: use reflective questioning" 760; B3 §10.2 "Cognitive → values-based Adult Self" 1182; B5 §7.3 Cognitive Processors → sentence deconstruction 2072) | §7 adaptation lists kept | Collapsed to one 6-value channel enum + per-turn family preference | `processingChannel` last-write-wins | **Thinned.** The manual's first clinical act (choose the route for THIS type) became a rendering nudge |
| F2 | **"Thoughts → body" is a Block-1 stabilisation tactic** for the over-analytical type (449-457). Block 2 for cognitive clients says only "use reflective questioning" (760) — no body-drop mandate | Stage 2 §7 added "Then gently drop into body"; Stage 1 kept the tactic | `CHANNEL_FAMILY_GUIDANCE` made it a standing all-stages rule: "invite body location so the work does not stay in the head" | rendered every turn | **Inverted.** A scoped stabilisation tactic became a permanent redirect — the manual is *less* body-forcing toward cognitive clients than the runtime |
| F3 | **~96 named practices** + separate Practice Library with full scripts (347-375, 782-814, 1188-1214, 1880-1918, 2082-2118, 2392-2428, 2964-2986, 3278-3317) | 2-3 signature anatomies per stage | 5 families, ~30 examples; library deliberately replaced by dynamic generation (PGA §1) | `PracticeFamily` enum of 5 | **Thinned.** The library never existed in the repo; its titles never seeded the generation guidance — the "breathing/grounding/feet/warmth" collapse is the residue |
| F4 | **Client-rated intensity** (STEP 7, 415-419) | — | Intensity = AI's own read, required every turn; user asked only in the destabilisation-only stability check | `intensityReported` = model value, gates consume as fact | **Replaced.** Self-report survives only in one conditional protocol; baseline/close comparison lost |
| F5 | **Anchor mandatory in Block 1** (STEP 5, 403-407; readiness §14, 481) | Stage 1 spec **revised 2026-07-02**: anchor demoted to observation, dropped from gate | master follows revision (l. 730 "being retired") | `checkStage1Gate` still requires it (stage-gates.ts:113,120-121) | **Three-way split.** Code matches the *manual*; canon revision was never propagated to code — or back into the manual. RC6 reclassified: not code-drift but unversioned method revision |
| F6 | **Sequential block entry criteria** (2300-2332 and every block's §"When to Use") | §10 gates faithfully encode them | PR λ header declares stages a map, not gates | Router enforces sequence (+ move-lane) | **Contradiction between the product principle and the source method.** The runtime is *faithful*; the principle is new. The manual needs the map/sequence decision authored, or the principle scoped |
| F7 | Per-block closing protocols incl. "clear identification of what was reclaimed", 24h stability confirmation (B5 §12, 2218-2231), MII-C multi-domain checklist (2706-2750) | carried | carried (release-shaped cycle rules added) | no session object | Carried — but the manual, like the runtime, has **no close-against-request**; nothing to restore here, must be authored new |
| F8 | Decision capacity as outcome + "new decisions" tracked as wins (2602, 3287-3295) alongside impulsivity guards (3349-3380) | Only the guards survived | Only the guards + Trap 2 | `urgencyMarkers` blocks advance | **Half-carried.** The prohibition side was translated; the restored-agency side was not |
| F9 | Pre-screening Section 0 (3469-3991) | — | — | `screeningResult === 'red'` block (turn route) | Carried at the gate level |
| F10 | Therapist self-checks ("Have I followed the client's nervous system, not my agenda?", 525-539) | — | Partially reborn as the 12 traps | — | Rough equivalent exists |

---

## 5. Findings (SM-series, added to the machine-readable file)

- **SM1 (critical, source gap):** The manual presupposes the human clinician's implicit
  layer — contracting, request-tracking, route judgement, permission to deviate — and
  never states it. The AI executes the explicit protocol without the implicit skills;
  Julia's ten continuous questions are precisely that unwritten layer. Correction:
  author it into the manual (new Section: "Clinical Contract & the Clinician's
  Continuous Questions"), then mirror to runtime.
- **SM2 (high, source gap):** No intake of the client's request/expectations anywhere in
  the manual; Block 1 STEP 1 starts at observation. The runtime's `<assessment_phase>`
  "treatment goals" bullet is actually an *addition* beyond the manual — unconsumed
  downstream. RC2 traces to source.
- **SM3 (high, missing artifact):** The Practice Library ("full scripts in the separate
  Practice Library") is referenced by all 8 blocks and exists nowhere in the repo. The
  PGA replaced it architecturally but never inherited its ~96 titles as generation
  exemplars; ~40+ manual practices have no runtime trace (list in §3).
- **SM4 (high, translation inversion):** The cognitive-type body-shift is Block-1-scoped
  in the manual; the runtime generalised it into a standing all-stage redirect (F2).
  The manual supports cognitive-first work per block (reflective questioning, values-
  based Adult Self, sentence deconstruction).
- **SM5 (medium, translation loss):** Client-rated intensity (0–10 self-report with
  before/after comparison) replaced by model-estimated intensity (F4).
- **SM6 (high, source design):** Blocks are sequential by authored design (F6); "stages
  as a formulation map" requires a manual revision — it cannot be honestly delivered by
  prompt framing alone while the entry-criteria text stands.
- **SM7 (medium, unversioned revision):** The 2026-07-02 anchor demotion revised the
  stage spec but neither the manual nor the gate (F5); the "source of truth" title on
  CLINICAL_MANUAL.md is currently false in at least this respect. A method-versioning
  discipline is needed (manual edition + changelog, stage specs cite the edition).
- **SM8 (medium, source support for new scope):** The manual itself frames restored
  decision-making as an outcome and tracks "new decisions" as wins (F8) — direct
  clinical grounding for the 2026-07-19 decision-facilitation product rule. Additional
  prohibition sites to reword beyond audit #2 §13.4: Block 7 "Encourage exploration of
  states, not goals" (2779), Block 7 Layer 2/3 "Still no behavioural plans, no
  decisions" (2921, 2944), Block 8 Step 7 (3349-3352), Risk Management §9 (3366-3380),
  After-Care "delaying major life decisions" (3465).
- **SM9 (info):** Intended population is explicitly the destabilised presentation
  (Block 1 §2); pre-screening excludes crisis but nothing routes or names the
  *stable-but-seeking* presentations (meaning, decisions, practical clarity) the
  product now attracts. New entry-route authorship is an *extension* of the method,
  not a correction of it.

---

## 6. Revised root-cause attribution (supersedes the attribution table where noted)

| Cause (from audit #2) | Origin after source audit |
|---|---|
| RC1 single-route repertoire | **Source** (method authored as one arc) + translation loss of within-arc breadth (SM3/F3). Fix: new authored canon for new routes; re-seed generation guidance from the manual's own practice titles for existing routes |
| RC2 no task contract | **Source** (SM1/SM2) — the unwritten human layer. Fix at manual level first, then runtime |
| RC3 token/emission pressure | **Runtime-only** (no manual equivalent; the manual's checks are therapist self-checks, not per-turn evidence quotas) |
| RC4 cognition discounted | **Translation inversion** (SM4/F2) — the manual is more permissive than the runtime here |
| RC5 method-state closure | **Shared**: manual closure = protocol-state too (F7), but the manual at least closes on client-reported stability and "what was reclaimed"; request-check absent in both |
| RC6 Stage-1 anchor contradiction | **Reclassified** (SM7): unversioned method revision, three-way split manual/spec/code |
| Sequence-vs-map | **New (SM6):** the product principle contradicts the authored method; a deliberate manual revision is required |

---

## 7. What this means for the correction plan (no changes made)

The stabilisation plan S1–S7 (audit #2 §12) stands, with two adjustments and three
manual-level work items now grounded in the source:

1. **S3 (cognitive-channel fix) gains direct source authority** — it *restores* the
   manual's per-block scoping (SM4). Same for S1/S2's "staying cognitive is valid
   work": Block 2 §8 already routes cognitive clients to reflective questioning.
2. **S7 (Stage-1 anchor gate) needs an owner decision first**, not just a code edit:
   either the 2026-07-02 revision is confirmed (then fix the gate AND the manual), or
   the manual stands (then revert the stage-spec revision). SM7.
3. **Manual work items (Julia's authorship, before or alongside Section C):**
   (a) write the implicit-clinician layer into the manual (SM1) — the ten continuous
   questions, contracting, deviation rules; (b) decide and author the map-vs-sequence
   semantics (SM6); (c) author the new entry routes (meaning/existential, decision
   facilitation per §13.4 wording + SM8 sites, practical clarity), explicitly framed as
   method extension for the stable-but-seeking population (SM9); (d) reconstitute or
   consciously retire the Practice Library — at minimum, feed its titles into the PGA
   as per-family per-block exemplars (SM3); (e) adopt method versioning (SM7).

Recommended immediate sequence remains: S6+S7-decision → S1–S5 → fixtures + transcript
export → manual authorship (this section) → Section C runtime work.
