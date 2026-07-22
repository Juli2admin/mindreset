# Doc 9 — PR B1 complete line-review package (anchor prompt cleanup)

**Planning/review only. No file edited, no PR opened.** This is the exhaustive,
line-level review package the owner requested before PR B1 is implemented. Every
active-corpus line containing "anchor" (case-insensitive) is enumerated and
classified. PR B1 is model-visible **anchor language** only.

Governing decision **D2 (2026-07-02):** the anchor is an internally observed
positive lived reality — **not required for progression, never announced as
"your anchor", not automatically invoked to soothe/stabilise/close, captured
silently, usable only as ordinary context in the user's own words when genuinely
relevant.**

B1 **must not**: change any gate, remove anchor requirements from code, alter
progression, touch memory, change open-cycle logic, modify state-report fields,
or edit unrelated validation/echo/hypothesis/move-announcing language; and must
not broadly shorten or distil any stage spec. Every change below is a surgical
phrase-level rewrite that preserves the clinical move.

**Corpus scanned (11 active files only):** `00-shared-core.md`, `01`–`08` stage
specs, `PRACTICE_GENERATION_ALGORITHM.md` (0 anchor lines), `runtime/
journey-master.md`. **Confirmation: no deprecated files are included — `runtime/
stage-01.md` and `runtime/stage-02.md` were removed by PR A0 (merged, `b984a5c`)
and are absent from `main`.**

**Rollback (all changes):** each proposed edit is an independent phrase-level
change; revert any single line with a per-line `git revert` / hunk restore. Two
coupling notes: revert `02:51`+`02:272` together (shared method rename), and
revert the doc-claim set (`01:19`/`01:106`/`01:148`) together for internal
consistency.

---

## THE PIVOTAL OWNER DECISION (before B1 can be finalised)

**Does B1 extend to the Identity Anchor?** D2 governs the **Stage-1 Personal
Anchor**. The **Identity Anchor / Identity Anchoring Ritual** (built in Stage 6,
used in 6/7/8) is a *distinct* construct — a co-created permanent identity
reference the user returns to in daily life. ~49 of the 67 ambiguous lines are
Identity-Anchor recall/close/naming scripts. **If you decide B1 covers only the
Stage-1 anchor**, those ~49 lines stay unchanged and B1 = the 67 required Stage-1
changes below. **If B1 also covers the Identity Anchor**, those ~49 lines become
change candidates (same D2 rewrite pattern) and the Stage-7/8 recall *gates*
(`07:322`, `08:329`) become a later code-phase item. **Everything in Part A is
independent of this decision** (all Stage-1 anchor).

---

# PART A — CLEARLY REQUIRED CHANGES (67 lines)

Fields per line: **file:line — [class]** · Original · Proposed · Capability
preserved · D2 conflict · Visible change · Fixture. (Rollback: per-line revert,
as above.)

## 00-shared-core.md (2)

**00-shared-core.md:83 — [soothe/stabilise]** *(lowest severity; if the owner scopes method-list adjectives out of B1, drop to KEEP)*
- Original: `…applied within MindReset's constraints (non-regressive, non-trauma-reliving, anchor-supported, Adult-Self-led from the appropriate stage onward).…`
- Proposed: `…(non-regressive, non-trauma-reliving, regulation-supported, Adult-Self-led from the appropriate stage onward).…`
- Capability: the within-tolerance support scaffold is still named — now regulation, which D2 designates as the settling mechanism.
- D2 conflict: "anchor-supported" frames the anchor as the standing support of the whole toolkit ("not automatically invoked to soothe/stabilise").
- Visible change: model reads regulation, not the anchor, as continuous support.
- Fixture: `sharedCore()` must NOT contain `anchor-supported`; SHOULD contain `regulation-supported`.

**00-shared-core.md:193 — [auto-recall]**
- Original: `- The AI recalls it gently whenever intensity rises in any later stage: *"Take a moment with [the user's anchor, in their words]"*.`
- Proposed: `- The AI does not recall it to settle the user. When intensity rises the AI offers a regulation or grounding practice; the material may be referenced later only in the user's own words, when genuinely relevant — never as a scripted *"take a moment with…"* opener.`
- Capability: grounding-on-intensity preserved via a practice; optional reference retained.
- D2 conflict: scripts automatic recall on rising intensity with a fixed opener.
- Visible change: rising intensity → regulation practice, not anchor recital.
- Fixture: `sharedCore()` must NOT contain `recalls it gently whenever intensity rises` or `Take a moment with [the user's anchor`.

## 01-stage-stabilisation.md (6)

**01:19 — [doc-claim]** *(revert with 01:106, 01:148)*
- Original: `…Anchor material may or may not have surfaced by then — that is fine; the anchor is no longer a gate token.`
- Proposed: `…Anchor material may or may not have surfaced in the user's own words by then. NOTE: the Stage 1 code gate today STILL enforces \`anchorText\` and the \`anchor_identified\` token (stage-gates.ts:113,120-121); their removal is scheduled for PR C. Treat the anchor as no longer clinically load-bearing, but do not assume the gate has dropped it.`
- Capability: clinical intent (anchor not load-bearing) kept; doc stops misstating live code.
- D2 conflict: truthfulness fix — the false "no longer a gate token" claim misleads about live gate state.
- Visible change: none to the user; corrects a spec-vs-code contradiction (`stage1-gate.test.ts` still asserts the anchor tokens).
- Fixture: `stage01()` must NOT state the anchor "is no longer a gate token" as present fact.

**01:106 — [doc-claim]**
- Original: `- **NOT a load-bearing Stage 1 gate.** The \`anchorText\`-set requirement and the \`anchor_identified\` readiness token are dropped from the Stage 1 code gate (§10).`
- Proposed: `- **Scheduled to be removed from the Stage 1 gate (PR C).** The \`anchorText\`-set requirement and the \`anchor_identified\` readiness token are STILL enforced by the Stage 1 code gate today (stage-gates.ts:113,120-121); their removal is scheduled for PR C. Clinically treat the anchor as no longer load-bearing now; do not assume the gate has dropped it yet.`
- Capability / D2 / Visible / Fixture: as 01:19 (truthfulness; `stage01()` must NOT contain `are dropped from the Stage 1 code gate`).

**01:148 — [doc-claim]**
- Original: `**Revised 2026-07-02: anchor requirement dropped from the Stage 1 gate.** The anchor is now captured throughout Block 1 as data about the user (positive lived reality → Adult Self resource), but it is no longer a load-bearing gate token.…`
- Proposed: `**Revised 2026-07-02: anchor requirement scheduled for removal from the Stage 1 gate (PR C).** The anchor is captured throughout Block 1 as data about the user (positive lived reality → Adult Self resource). The Stage 1 code gate STILL enforces \`anchorText\` and the \`anchor_identified\` token today (stage-gates.ts:113,120-121); removing them is scheduled for PR C.…`
- (Caveat: the §10 gate list at 150-156 also omits the anchor while code enforces it — same PR-C reconciliation, out of this anchor-line set.)

**01:214 — [naming]**
- Original: `7. **Name explicitly** (step 4). *"This is your anchor. The blanket. We can return to it whenever you need."*`
- Proposed: `7. **Mirror silently, do not name** (capture by observation). *"The blanket on the sofa — soft, heavy, knitted by your grandmother. That's yours."* The AI does not say "anchor", does not announce it, and does not promise to return to it whenever needed.`
- Capability: material still captured + reflected in the user's exact words.
- D2 conflict: announces "this is your anchor" and scripts return-on-demand ("NEVER announced" + "not automatically invoked").
- Visible change: model mirrors the blanket in the user's words instead of labelling it and promising recall.
- Fixture: `stage01()` must NOT contain `This is your anchor`.

**01:216 — [auto-recall]**
- Original: `**State report** records: \`anchorText = "…"\`, in the user's exact words. From this turn forward, the AI references it any time intensity rises across any later stage.`
- Proposed: `**State report** records: \`anchorText = "…"\`, in the user's exact words. This is captured as internal data; it is NOT auto-invoked when intensity rises, and later stages reference it only in the user's own words when genuinely relevant.`
- Capability: `anchorText` capture untouched (state field preserved); optional reference retained.
- D2 conflict: "references it any time intensity rises across any later stage" is pure auto-recall.
- Visible change: stored anchor no longer treated as an intensity-triggered recall.
- Fixture: `stage01()` must NOT contain `references it any time intensity rises`; the `anchorText = "…"` capture sentence preserved.

**01:218 — [naming]**
- Original: `**Why this works**: Signature practice run cleanly. …It was anchored in body. It was named explicitly. The user's exact words are preserved verbatim for code to surface in every later turn.`
- Proposed: `**Why this works**: Captured cleanly by observation. …It was noticed in the body. It was mirrored back without being labelled "your anchor" and without being announced. The user's exact words are preserved verbatim for code to surface as internal context in later turns.`
- Capability: the clinical point (material came from the user, noticed in body, words preserved) retained.
- D2 conflict: praises "named explicitly" as the success criterion ("NEVER announced" + "captured silently").
- Visible change: removes the few-shot signal teaching explicit naming.
- Fixture: `stage01()` must NOT contain `It was named explicitly`.

## 02-stage-pain.md (21) — auto-recall/soothe openers, steps, and worked-example closes

For the recurring patterns the canonical rewrites are: **"Anchor recall." / "Take a moment with [anchor]" opener → a brief grounding beat (slow breath / feet on floor), with the user's own steady place referenced in their words only if genuinely present**; **"return to/with the Anchor" on rising intensity/overflow → a regulation or grounding practice**; **a close that recites "[anchor]" → close on a breath/grounding**. Per-line:

- **02:23 — [auto-recall]** `The Anchor is recalled throughout to keep the system within the window of tolerance.` → `Regulation and grounding practices keep the system within the window of tolerance; anchor material is not recalled to do this, though it may be referenced in the user's own words when genuinely relevant.` — window-of-tolerance containment preserved via practices. Fixture: `stage02()` must NOT contain `Anchor is recalled throughout`.
- **02:51 — [auto-recall]** *(method rename; revert with 02:272)* `- **Anchor-Supported Emotional Work** — the Stage 1 Anchor is recalled whenever intensity rises. It is the steady reference point of every Stage 2 session.` → `- **Regulation-Supported Emotional Work** — when intensity rises the AI offers a regulation or grounding practice to hold the window of tolerance. Anchor material is not the reference point of the session; it may be referenced in the user's own words only when genuinely relevant.` — the supported-work method survives, regulation-based. Fixture: must NOT contain `recalled whenever intensity rises` / `reference point of every Stage 2 session`.
- **02:63 — [auto-recall]** `- **The Anchor is recalled at the first sign of rising intensity** — not as a fix, as a return.` → `- **When intensity first rises, the AI offers a regulation or grounding practice** — not the anchor. Anchor material may be referenced afterwards in the user's own words only if genuinely relevant.`
- **02:82 — [auto-recall/closure]** `**One emotion, one practice cycle, one anchor return.**` → `**One emotion, one practice cycle, one grounding close.** Do not build a routine anchor return into the cycle.` — one-cycle discipline + settled close preserved.
- **02:96 — [auto-recall]** `Anchor recalled often.` (in emotional-overflow) → `Grounding and regulation offered often.` — containment offer preserved verbatim.
- **02:114 — [soothe/stabilise]** `…(run Anchor recall and Regulation first).…` → `…(run a Regulation or grounding practice first).…`
- **02:122 — [soothe/stabilise]** `…Let it be here for a moment — and you are here too, with your [anchor]."` → `…Let it be here for a moment — and you are here too, breathing, in your body."`
- **02:128 — [soothe/stabilise]** `…spend longest in witnessing and anchor.` → `…spend longest in witnessing and grounding.`
- **02:134 — [soothe/stabilise]** `…in which case, return to anchor and try later).` → `…return to a grounding practice and try later).`
- **02:148 — [auto-recall]** `- Intensity rises rather than falls → anchor recall, return to Stage 1 Regulation if needed.` → `→ offer a regulation or grounding practice, return to Stage 1 Regulation if needed.`
- **02:168 — [auto-recall]** `3. **Anchor.** Return briefly to the Anchor. *"Stay with [anchor] for a breath."*` → `3. **Ground.** Return briefly to a settling breath. *"Stay with your breath for a moment."* If the user has named something of their own that steadies them, you may reference it in their words — the breath does the settling.`
- **02:200 — [soothe/stabilise]** `**Signs to slow (the AI returns to Anchor and Regulation):**` → `**Signs to slow (the AI returns to grounding and Regulation):**`
- **02:210 — [soothe/stabilise]** `- The user cannot maintain contact with the Anchor when invited.` → `- The user cannot regain grounding when offered a regulation practice.`
- **02:247 — [auto-recall]** `2. **Anchor recall.** *"Take a moment with [the user's anchor]."*` → `2. **Settle.** *"Let's take one slow breath together before we go on."* If the user has named something of their own that steadies them, reference it in their words — the breath does the settling.`
- **02:252 — [auto-recall/closure]** `7. **Mirror without analysing.** *"…Let's stay with this for a moment — and come back to [anchor]."*` → `7. **Mirror without analysing.** *"…Let's stay with this for a moment — and take one steadying breath."*`
- **02:264 — [auto-recall]** `2. **Anchor recall, before any practice.** *"Take a moment with [her anchor]. Just hold it for a breath."*` → `2. **Settle, before any practice.** *"Let's take one slow breath together and feel the ground under you. Just for a moment."* Reference something of her own that steadies her, in her words, only if it is genuinely present.`
- **02:269 — [auto-recall/closure]** `7. **Anchor.** *"And come back to [anchor]. Just for a breath."*` → `7. **Ground.** *"And come back to your breath. Just for a moment."*`
- **02:272 — [soothe/stabilise]** *(revert with 02:51)* `…→ Regulation (anchor). Methods = …, Anchor-Supported Work.…` → `…→ Regulation (grounding). Methods = …, Regulation-Supported Work.…`
- **02:281 — [auto-recall]** `1. **Anchor recall.** Brief.` → `1. **Grounding.** Brief — a slow breath or feet on the floor.`
- **02:289 — [auto-recall/closure]** `9. **Anchor.** *"Stay with [anchor] for a moment."*` → `9. **Ground.** *"Stay with your breath for a moment."*`
- **02:118 — [auto-recall]** `1. **Anchor recall.** Begin with a soft reference to the user's Anchor. *"Before we go any further, take a moment with [user's anchor…]…"*` → `1. **Optional grounding, only if the user is dysregulated and it fits.** If used, reference the steadying thing in the user's own words — not recited by default.`

Capability/D2/Visible for the 02 block (uniform): each preserves the settle / slow-down / overflow-containment / turn-close function via a regulation-or-grounding practice; each violates D2's "not automatically invoked to soothe/stabilise" (and, for the closes, "not a session-close move"); visible change = the model grounds via a breath/practice instead of reciting the anchor. Fixtures: `stage02()` must NOT contain the quoted anchor-recall/`Take a moment with`/`Stay with [anchor]`/`come back to [anchor]` strings on the cited lines.

## 03-stage-adult-self.md (10)

- **03:60 — [auto-recall]** `…gently returns to the body and the Anchor, and continues the Adult Self work…` → `…gently returns to the body and to present-moment grounding, and continues the Adult Self work…`
- **03:118 — [auto-recall]** `1. **Anchor recall.** Brief, in the user's exact words.` → `1. **Brief grounding.** A short present-moment settling beat, in the user's own words. If a steady place is genuinely alive for them, they may reference it — it is not recited by default.`
- **03:131 — [auto-recall]** `…return to Anchor and witnessing.` → `…return to grounding and witnessing.`
- **03:160 — [auto-recall]** `1. **Anchor recall.** *"Take a moment with [user's anchor]."*` → `1. **Brief grounding.** *"Let's take a slow breath and arrive here for a moment."* If the user's own steady place is genuinely present, it may be referenced in their words; not recited by default.`
- **03:192 — [auto-recall]** `…gently return to the Anchor and Adult Self. *"…For now, stay with this steadier presence and your [anchor]."*` → `…gently return to the Adult Self and present-moment grounding. *"…For now, stay with this steadier presence."*`
- **03:200 — [auto-recall]** `**Signs to slow (the AI returns to Anchor and Observer Seat or Stage 2 work):**` → `…returns to grounding and Observer Seat or Stage 2 work):**`
- **03:204 — [auto-recall]** `- Intensity rises during the activation — return to Anchor, return to Observer Seat, slow down.` → `…return to grounding, return to Observer Seat, slow down.`
- **03:205 — [soothe/stabilise]** `…Let's sit with that for a moment, with your [anchor]."` → `…Let's sit with that for a moment."`
- **03:250 — [auto-recall]** *(worked example)* `1. **Anchor.** *"Take a moment with the bench under the apple tree."*` → `1. **Grounding.** *"Let's take a slow breath and arrive here for a moment."*`
- **03:273 — [auto-recall]** *(worked example)* `1. **Anchor.** Brief.` → `1. **Grounding.** Brief.`

(Capability: the trauma-redirect / slow-down / grief-holding / practice-opener functions preserved via body/grounding/Adult-Self. D2: auto-return-to-anchor on rising intensity / discomfort / grief. Visible: grounds via body/breath, not anchor recital. Fixtures: `stage03()` must NOT contain the cited `Anchor recall`/`Take a moment with`/`with your [anchor]`/`return to Anchor` strings.)

## 04-stage-parts.md (14)

- **04:19 — [auto-recall]** `The Anchor is recalled throughout.` → `The user's steady place stays available as their own context, referenced in their words only when genuinely relevant.` (MII gate sentence untouched.)
- **04:107 — [auto-recall]** `…return to the Adult Self and Anchor.` → `…return to the Adult Self and grounding.`
- **04:146 — [auto-recall]** `1. **Anchor + Adult Self confirmation.** *"Take a moment with [user's anchor]. And let [Adult Self…] be here with you."* Confirm…` → `1. **Grounding + Adult Self confirmation.** *"Let's arrive here for a moment, with a slow breath. And let [Adult Self…] be here with you."* Confirm… (If the user's steady place is genuinely present, it may be referenced in their words — not recited by default.)`
- **04:172 — [auto-recall]** `…Return to Adult Self + Anchor. Try again next session.` → `…Return to Adult Self + grounding. Try again next session.`
- **04:175 — [auto-recall]** `…Return to Anchor and Stage 1 grounding.` → `…Return to Stage 1 grounding.`
- **04:193 — [auto-recall]** `1. **Anchor + Adult Self + part awareness.** …*"You're here with [anchor]. The [Adult Self words] is here.…"*` → `1. **Grounding + Adult Self + part awareness.** …*"You're here, grounded in this moment. The [Adult Self words] is here.…"*`
- **04:242 — [closure]** `3. **Confirm the Adult Self stays present.** *"The [Adult Self] is here, with the [part], with the [anchor]. They are together.…"*` → `…*"The [Adult Self] is here, with the [part]. They are together.…"*`
- **04:249 — [auto-recall]** `…extend the session or run additional Anchor recall before closing.` → `…extend the session or run additional grounding before closing.`
- **04:255 — [closure]** `- *"The [Adult Self] is here, with the [anchor]. They hold themselves."*` → `- *"The [Adult Self] is here, with the [part]. They hold themselves."*`
- **04:259 — [auto-recall]** `…Run Anchor recall, Adult Self presence work.…` → `…Run grounding and Adult Self presence work.…`
- **04:278 — [auto-recall]** `**Resistance markers** (the AI returns to Surface Layer or Anchor):` → `…returns to Surface Layer or grounding):`
- **04:383 — [soothe/stabilise]** `…begins the next session with stabilisation (Stage 1 grounding + Adult Self + Anchor), not new part work…` → `…(Stage 1 grounding + Adult Self), not new part work…` (MII-6 gate wording untouched.)
- **04:396 — [auto-recall]** *(worked example)* `1. **Anchor + Adult Self confirmation.** *"Take a moment with the blanket. And let the steady one in your chest be here with you."*…` → `1. **Grounding + Adult Self confirmation.** *"Let's arrive here for a moment, with a slow breath. And let the steady one in your chest be here with you."*…`
- **04:457 — [soothe/stabilise]** *(worked example)* `…Just be here, with the [anchor], with the [Adult Self].…` → `…Just be here, with the [Adult Self].…`

## 05-stage-foreign-material.md (10)

- **05:19 — [doc-claim]** `The Anchor remains the steady reference.` → `The user's steady place remains available as their own context.`
- **05:99 — [auto-recall]** `…returns to Stage 4 Adult Self + Anchor work.` → `…returns to Stage 4 Adult Self work.`
- **05:148 — [auto-recall]** `1. **Anchor + Adult Self present.** *"Take a moment with [anchor]. Let [Adult Self…] be here with you."*` → `1. **Grounding + Adult Self present.** *"Let's arrive here for a moment, with a slow breath. Let [Adult Self…] be here with you."* (If the user's steady place is genuinely present, it may be referenced in their words — not recited by default.)`
- **05:173 — [auto-recall]** `…do not deepen the anger, return to Anchor.` → `…do not deepen the anger, return to grounding.`
- **05:175 — [auto-recall]** `…Return to Anchor and Adult Self. The reclaiming work comes later.` → `…Return to grounding and the Adult Self. The reclaiming work comes later.`
- **05:224 — [auto-recall]** `- Shame surge → stop the release. Return to Adult Self + Anchor + Self-Compassion.…` → `…Return to Adult Self + Self-Compassion.…`
- **05:273 — [auto-recall]** `**Signs to slow (the AI returns to Anchor and Adult Self work, or steps back a layer):**` → `…returns to grounding and Adult Self work, or steps back a layer):**`
- **05:275 — [auto-recall]** `…normal Surface marker. Return to Anchor.` → `…normal Surface marker. Return to grounding and the Adult Self.`
- **05:322 — [auto-recall]** *(worked example)* `1. **Anchor + Adult Self.** *"Take a moment with [her anchor]. Let [Adult Self…] be here with you."*` → `1. **Grounding + Adult Self.** *"Let's arrive here for a moment, with a slow breath. Let [Adult Self…] be here with you."*`
- **05:329 — [closure]** *(worked example)* `8. **Close.** *"That's enough for today. The [Adult Self] knows where this came from now. The [anchor] is still there. Let's stop here."*` → `8. **Close.** *"That's enough for today. The [Adult Self] knows where this came from now. Let's stop here."*`

## 06/07/08 (4 — Stage-1 anchor only; Identity-Anchor lines are in Part B)

- **06:91 — [soothe/stabilise]** `If at any layer emotional flooding occurs — return to Surface Layer, Anchor, and Adult Self.` → `…return to Surface Layer, a grounding practice, and the Adult Self.`
- **06:277 — [soothe/stabilise]** `**Signs to slow (the AI returns to Surface Layer, Anchor, Adult Self):**` → `…returns to Surface Layer, a grounding practice, Adult Self):**`
- **07:52 — [soothe/stabilise]** `…The AI returns to Anchor and body any time the user starts to leap forward.` → `…returns to grounding and body any time the user starts to leap forward.`
- **08:250 — [soothe/stabilise] (borderline)** `If overwhelm returns, return to the [Block-1 Anchor], the [Adult Self], and grounding.` → `If overwhelm returns, return to grounding — a slow breath, feet on the floor — and the [Adult Self].` *(borderline: at discharge, naming the user's comfort-source may qualify as "genuinely relevant ordinary context"; owner may prefer to keep it and only reorder so grounding leads. The same soothe-framing recurs at `08:407` — renders the user's words, no literal "anchor", outside this anchor-line set — mirror any :250 fix there.)*

---

# PART B — AMBIGUOUS (67 lines; owner decision required)

### B-i. Identity-Anchor construct scope (~49 lines) — ONE decision governs all
Does B1 cover the Identity Anchor (Stage 6 ritual, used 6/7/8)? If yes, apply the
D2 pattern (no auto-recall/close, no label spoken; placeholders already render
the user's words). If no, all of these KEEP.
- **Recall-at-open / naming / close scripts (AI voice):** 06:141, 06:189, 06:191, 06:193, 06:214, 06:238, 06:330, 06:354, 06:357, 06:361, **06:365 ("You have an anchor now you can take anywhere" — the AI literally says "anchor" to the user; sharpest naming line if extended)**, 06:378, 07:150, 07:196, 07:246, 07:345, 07:367, 07:390, 07:396, 07:397, 08:152, 08:204, 08:247, **08:249 ("You know your [Identity Anchor]" — names it to the user)**, 08:357, 08:404.
- **Doc-claims / purpose (Identity Anchor as the daily resource):** 06:19, 06:179, 06:181, 06:222 (auto-recall clause only; the `identityAnchor` field clause KEEPs), 06:367 (same split), 08:25, 08:70, 08:126.
- **Channel-form descriptors / watch-fors:** 06:115, 06:116, 06:117, 06:118, 06:121, 06:197, 06:217, 06:218, 06:219, 08:128, 08:129.
- **Adult-Self↔Identity-Anchor construction lines:** 06:50, 06:60, 08:58.
- **Entangled Stage-1 weave inside Stage-6 example:** 06:336 (Stage-1 anchor woven into parts re-attending; master §136 permits weaving the anchor-words into a practice, so this may already be compliant).
- **Code-side counterpart if extended (do NOT touch in B1):** the recall-requiring gates `07:322`, `08:329` — later code phase.

### B-ii. Adult-Self ↔ Stage-1-anchor pairing (~13 lines) — is the pairing kept as method?
The canonical "The Adult Self lives with / is linked to the Anchor" construct.
If kept as method → leave (likely soften the "permanent"/"returns across all
later stages" auto-recall doc-claims); if read as auto-recall → make the pairing
optional, user-worded context. Lines: 03:61, 03:95, 03:96, 03:152, 03:164,
03:169 (canonical + the cross-stage "returns to it across all later stages"
clause needs softening even if the pairing stays), 03:185, 03:257, 03:264,
03:278, 04:150, 04:169. Plus aftercare **04:380** ("Revisit the Anchor any time"
— keep reworded to the user's own words vs drop).

### B-iii. Master regression-routing (2 lines) — model-visible vs progression scope
Contradict D2 (anchor as the destabilisation response) but are internal
regression-routing; B1 must not alter progression. Owner: fix now (anchor →
grounding practice) or defer to the later code phase with master `681`.
- 217 `…suddenly destabilises — return to move 1 (anchor), then back to depth…`
- 392 `…Return to anchor whenever needed.…`

### B-iv. Stage-5 forward-pointer (1) — 05:378 references the Stage-6 "Identity Anchoring Ritual" that "makes the Block-1 Anchor permanent"; soften/annotate now or defer to the Stage-6 review (tied to B-i).

---

# PART C — KEEP (168 lines; contain "anchor", unchanged)

By reason (representative refs; full set = every remaining active-corpus anchor line):
- **state-report fields** (B1 must not touch): `anchorText`, `anchorIdentified`, `anchorRecalled`, `adultSelfAnchorLinked`, `identityAnchor`, `readinessTouched:["anchor_identified"]`, move-IDs `universal.anchor_recall`/`stage_1.anchor_capture`/`stage_6.identity_anchoring_ritual` — e.g. 00:223; 01:114; 02:31; 03:262,281; 04:405; master 118,195,539,633,634,647,679,681,697,721,767,773,784,798.
- **already-D2-compliant** (the correct rules — keep): master 110,112,114,117,120,127,130,132,134,136,138,221,235,285,288,290,292,329,333,337,424,431,526,536,542; 00:270,273; 01:15,101,104,105,119,124,199.
- **capture/concept / definition** (silent capture preserved by D2): 00:189,191,194,195,197; 01:63,88,89,90,91,120,122; 02:15,278; 03:32; and internal "confirm foundations" (no spoken recital) 04:416,437; 05:194,244,342,349,362.
- **regression-preservation** ("the Anchor is preserved on regression"): 01:160; 02:35,207; 03:37; 04:31; 05:39,279; 06:35.
- **gate/progression** (deferred to PR C — B1 must not change gates): 02:227; 03:24,225,226; 04:27; 07:322; 08:329.
- **generic verb "to anchor" = consolidate/land** (not the Anchor construct): 01:190,194; 03:191,260,298,301,305; 05:247; 06:148,279,338; 07:153,175,200,223,349,373; 08:52,54,113,159,209,391; and "Receive and anchor" 08:365.
- **method-name / header / example-state labels**: 00:187,281; 01:1,99,103,110,203,222; 04:44; 05:52; 06:47,177,349; plus "Anchor: '…'" scene labels 03:247,270; 04:393,413,434; 06:327,375; 07:342; 08:354,401.
- **Identity-Anchor field/gate/constraint/compliant lines** (kept regardless of the B-i decision): 06:21,88,106,204,206,207,232,305,369; 07:15,31; 08:300.
- **master rationale / practice-guidance** (compliant): master 15,106,108,221,235,240,279,283,345,369,380,446,458,459.

---

# STATS

- **Total active-corpus lines containing "anchor": 302** (00:12, 01:32, 02:29, 03:34, 04:26, 05:20, 06:50, 07:19, 08:24, PGA:0, master:56).
- **Total active runtime lines proposed for change (Part A): 67** — naming 2, auto-recall 43, soothe/stabilise 15, closure 3, doc-claim 4. (If the owner extends B1 to the Identity Anchor, ~26 of the Part-B recall/naming/close scripts become additional changes.)
- **Ambiguous: 67. Keep: 168.**
- **Exact assembled-prompt token difference:** the changes land in Block 1 (Shared Core + stage specs, cached) and Block 4 (master-after-state) — verbatim-injected, so the assembled-prompt byte delta equals the sum of per-line character deltas. Estimated **≈ +3,500–4,000 characters ≈ +0.9–1.0K tokens** (~+1% of the ~85K-token prompt), dominated by the auto-recall reframes and the doc-claim corrections that add words (many soothe/closure edits are net deletions). **The exact figure will be measured by the PR-A0 parity dump at apply-time** — the wording is owner-adjustable, so an exact count now would not survive review; committing to measure it exactly before merge (behind the tester switch).
- **Expected anchor-invocation harness-metric impact:** the *recorded* metric (5 on the julia fixture) is unchanged — recorded mode scores already-produced replies. In a *live* A/B, the metric is expected to fall **sharply toward 0**, because the auto-recall/soothe/close scripting these 67 lines encode is exactly what drives the model to recite the anchor. Caveat: the harness's anchor-fragment lexicon is a RU first-draft; to measure B1 precisely it should be extended to the EN openers this PR removes ("take a moment with…", "stay with [anchor]", "anchor recall").
- **No-deprecated confirmation:** all 302 lines are from the 11 active files; `runtime/stage-01.md` and `runtime/stage-02.md` (removed by PR A0) are excluded and absent from `main`.

---

*Planning/review only. No file edited; no PR opened. B1 is finalised after the
owner (a) decides the Identity-Anchor scope question and the Adult-Self-pairing
question, and (b) signs off each Part-A line; it then ships behind the tester
switch with a Golden-Harness before/after and the exact prompt-byte/token
measurement.*
