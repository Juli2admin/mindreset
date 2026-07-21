# Doc 8 — Revised PR B split: B1 / B2 / B3 (+ B4 deferred)

Supersedes the single "PR B" in Doc 7. Per owner correction, PR B was not one
bounded category; it is split into four separate, independently-tested plans.
**Planning only — nothing here is implemented; no code or prompt edited; no PR
opened.** Each B-PR, when eventually built, ships behind the **tester-only
runtime switch** with a **Golden-Harness before/after**, one bounded category,
full rollback, no migration.

**Effect of PR A0 on these plans:** PR A0 deleted the deprecated
`docs/journey/runtime/stage-01.md` and `stage-02.md`. Several anchor/echo
exemplars previously listed (e.g. `runtime/stage-01.md:173` "That's your
anchor", `runtime/stage-02.md` recall lines) are therefore **already gone** and
are dropped from the plans below. The B-PRs target only the **live** corpus:
`00-shared-core.md`, `01`–`08` stage specs, `PRACTICE_GENERATION_ALGORITHM.md`,
`runtime/journey-master.md`.

Governing decisions: **D2** (anchor) and the **2026-07-20 `<communication>`
decision, #329**. Both already explicit — no new owner decision is needed, only
owner sign-off on each line.

---

# PR B1 — Anchor language & automatic recall (D2)

Covers only: "your anchor" naming · automatic anchor recall · anchor-as-soothe/
stabilise/close language · the false documentation claims about gate removal.
**Preserves anchor capture as internal observational information** (D2: "captured
silently when naturally present; usable only as ordinary contextual material
when genuinely relevant"). B1 does **not** touch the Stage-1/…/Stage-8 gate code
— that anchor-gate removal is PR C (behavioural). B1 is prompt/doc text only.

### B1.a — "your anchor" named to the user (rule: mirror the word, don't label)
- `01-stage-stabilisation.md:214`
  - Original: `7. **Name explicitly** (step 4). *"This is your anchor. The blanket. We can return to it whenever you need."*`
  - Proposed: `7. **Reflect in the user's own words, without labelling** (step 4). *"The blanket. We can come back to that whenever you need."*`
  - Capability preserved: still offers a felt return-point in the user's language; drops the forbidden label. Supported by D2 and `journey-master.md:112,117` (the master's own rule: "NEVER say 'anchor'… mirror the thing in the user's own words WITHOUT labeling it").

### B1.b — automatic anchor recall as soothe/stabilise/close
D2: "not automatically invoked to soothe, stabilise or close." Reframe automatic
recall into "available as ordinary context when genuinely relevant"; keep the
option to reference it. **Owner-reviewed per line** (largest B1 surface).
- `00-shared-core.md:193`
  - Original: `- The AI recalls it gently whenever intensity rises in any later stage: *"Take a moment with [the user's anchor, in their words]"*.`
  - Proposed: `- When genuinely relevant, the AI may reference it in the user's own words as ordinary context — never recited automatically to soothe, stabilise, or close.`
- `02-stage-pain.md` — the scripted auto-recall openers and method prescriptions:
  `:23`, `:51`, `:63`, `:96`, `:114`, `:118`, `:147`, `:227`, `:247`, `:264`, `:281`.
  - Representative — `:118`:
    - Original: `1. **Anchor recall.** Begin with a soft reference to the user's Anchor. *"Before we go any further, take a moment with [user's anchor…]…"*`
    - Proposed: `1. **Optional grounding — only if the user is dysregulated and it fits.** If used, reference it in the user's own words; do not open sessions with it by default.`
  - Representative — `:51`:
    - Original: `- **Anchor-Supported Emotional Work** — the Stage 1 Anchor is recalled whenever intensity rises. It is the steady reference point of every Stage 2 session.`
    - Proposed: `- **Anchor available as context** — the Stage 1 anchor may be referenced when genuinely relevant; it is not automatically recalled on rising intensity and is not "the reference point of every session."`
- `03-stage-adult-self.md:160,250,192` · `04-stage-parts.md:146,396` ·
  `05-stage-foreign-material.md:148,322` · `07-stage-new-identity.md:200,373` —
  the "Take a moment with [anchor]" and "return to your [anchor]" scripted lines,
  each reframed per the same rule (owner-reviewed per line).
  - Full enumeration pattern: `rg -ni "anchor recall|recall(s|ed)? (it|the anchor)|anchor (is )?recalled|take a moment with|return to (your )?(the )?anchor" docs/journey/00-shared-core.md docs/journey/0[1-8]-*.md docs/journey/PRACTICE_GENERATION_ALGORITHM.md docs/journey/runtime/journey-master.md`
- **Explicit non-goal:** do not remove the anchor concept or the Stage-1 anchor
  *capture* method; D2 preserves its internal observational value.

### B1.c — false "anchor dropped from the gate" documentation (3 lines)
These assert the gate no longer requires the anchor — **false** vs shipped code
(`stage-gates.ts:113,120-121`). B1 must NOT claim removal that has not shipped
(the gate removal is PR C). Interim-truthful rewrite; PR C flips these to
"removed" when the code changes.
- `01-stage-stabilisation.md:148`
  - Original: `**Revised 2026-07-02: anchor requirement dropped from the Stage 1 gate.** … it is no longer a load-bearing gate token. …`
  - Proposed: `**Owner decision 2026-07-02: the anchor requirement is to be removed from the Stage 1 gate (scheduled: PR C).** As of this document the Stage 1 code gate STILL enforces \`anchorText\`-set and the \`anchor_identified\` token (\`stage-gates.ts:113,120-121\`). The anchor is captured throughout Block 1 as data about the user (positive lived reality → Adult Self resource).`
- `01-stage-stabilisation.md:106` (same false "dropped from the Stage 1 code gate" claim) → same interim reframing.
- `01-stage-stabilisation.md:19` ("the anchor is no longer a gate token") → "the anchor is scheduled to stop being a gate token (PR C); until then the gate still requires it."

### B1 verification
- Governing decision: D2.
- Regression fixtures: a Stage-1 fixture where an anchor emerges → reply never contains "anchor"/"your anchor" (harness `anchor-invocation` → 0); a dysregulation fixture → grounding is still available when clinically indicated (anchor not deleted, just not automatic); a doc-consistency check that no spec claims the anchor gate is already removed while `stage-gates.ts` still enforces it.
- Rollback: per-line git revert.
- Ships behind the tester switch with a harness before/after; owner signs off every recall reframing.

---

# PR B2 — Explicitly banned stock wrappers only (#329)

Covers **only** the exact phrases the `<communication>` decision prohibits
(`journey-master.md:78,80`): "I hear you / I hear that", "I'm curious / I'm
wondering", "That's a real place", and explicit move-announcing. **Rule: remove
the banned wrapper, keep the clinical proposition unchanged.** Any line where
removing the wrapper would change the assertion force of the proposition is **NOT
in B2** — it is moved to PR B3 (see the two examples the owner flagged).

### B2.a — "I hear you / I hear that" (proposition-neutral filler only) — 6 lines
| line | original (excerpt) | proposed | proposition kept |
|---|---|---|---|
| `01-stage-stabilisation.md:173` | `"I'm here. I hear you. You don't have to be calm with me…"` | `"I'm here. You don't have to be calm with me…"` | "you don't have to be calm with me" |
| `02-stage-pain.md:85` | `(*"there's a part of you that feels this — yes, I hear that"*)` | `(*"there's a part of you that feels this"*)` | "there's a part of you that feels this" |
| `07-stage-new-identity.md:264` | `"I hear that. Let's let this week pass before any big move…"` | `"Let this week pass before any big move…"` | the pacing guidance |
| `07-stage-new-identity.md:389` | `"I hear you. You've been feeling a lot this weekend…"` | `"You've been feeling a lot this weekend…"` | "you've been feeling a lot this weekend" |
| `journey-master.md:331` | `"You're furious / overwhelmed / done. I hear it. I'm not going to try to fix it."` | `"You're furious / overwhelmed / done. I'm not going to try to fix it."` | both statements |
| `journey-master.md:424` | `"You're furious. I hear it. I'm not going to argue with it."` | `"You're furious. I'm not going to argue with it."` | both statements |

**Moved to B3 (removing the wrapper here would make the claim categorical):**
`03-stage-adult-self.md:292` `"That voice is real. I hear that she's always there."` — see B3.

### B2.b — "I'm curious / I'm wondering" — master self-violation
- `journey-master.md:508`
  - Original: `You: "…What I'm curious about — when you look back at one of those moments, what does the part of you that messes it up actually seem to be doing? …"`
  - Proposed: `You: "…When you look back at one of those moments, what does the part of you that messes it up actually seem to be doing? …"`
  - The question (the proposition) is untouched.
- Full enumeration: `rg -ni "i.?m curious|i.?m wondering|what i.?m curious about" docs/journey/…` — apply the same wrapper-strip.

### B2.c — "That's a real place" — master self-violation
- `journey-master.md:486`
  - Original: `You: "Heavy and tired. That's a real place to start from."`
  - Proposed: `You: "Heavy and tired."`
  - Note: the residual `"Heavy and tired."` is a bare echo; **echo rhythm is B4's territory** (B2 only removes the banned wrapper). Flagged, not fixed here.

### B2.d — explicit move-announcing (rule: ask, don't announce — `:80`)
- `03-stage-adult-self.md:161`
  - Original: `2. **Set the field.** *"We're going to try something gentle. Not forcing anything. …"*`
  - Proposed: `2. **Set the field by asking.** *"Can we try something gentle — nothing forced?"*`
  - Proposition (offering a gentle move) unchanged; announce → ask.
- Representative others: `03:119,251,274`; `05:324,344`. Full set:
  `rg -ni "we.?re going to|let.?s try|let.?s do|now we|i want to (try|ask)" docs/journey/…` — keep the sanctioned share-back and consent forms ("Would you like to try something small?").

### B2 verification
- Governing decision: #329 (`:78,:80`). **No clinical proposition changes.**
- Regression fixture: harness `stock-phrase` metric (EN lexicon: "I hear", "I'm curious/wondering", "that's a real place") → 0 on the julia fixture; a per-line semantic check that the retained sentence asserts exactly what the original asserted (no more, no less).
- Rollback: per-line revert.

---

# PR B3 — Hypothesis discipline (declarative causal/origin → tentative) (#329 `:84`, D4)

Covers declarative causal/origin claims stated as fact. **Every rewrite must
remain tentative and user-confirmable; do NOT replace tentative language with
more categorical language.** Approved tentative forms: "Could this be…?",
"Does it feel as though…?", "One possibility is…", "See whether this fits."

### B3.a — the two rewrites the owner rejected in Doc 7 (corrected here)
| line | original | REJECTED (Doc 7, too declarative) | B3-approved (tentative) |
|---|---|---|---|
| `03-stage-adult-self.md:178` | `"That sounds like the part that pushes you. …"` | ~~"That's the part that pushes you."~~ | `"Could this be the part that pushes you? See whether that fits."` |
| `03-stage-adult-self.md:292` | `"That voice is real. I hear that she's always there."` | ~~"That voice is real. She's always there."~~ | `"That voice is real. Does it feel as though she's always there?"` |

(The second line moved here from B2 precisely because dropping "I hear that"
would assert "she's always there" as fact; the tentative question preserves the
user-owned, non-categorical reading.)

### B3.b — Stage 5 declarative origin-as-fact (4 lines)
The Stage 5 norm already frames origin as a question the user answers
(`05:151,245`); these are the stated-as-fact exceptions.
| line | original | B3-approved (tentative) |
|---|---|---|
| `05-stage-foreign-material.md:223` | `"That guilt isn't yours either. That's part of what came with the package. …"` | `"One possibility is that guilt isn't yours either — part of what came with the package. Does that fit?"` |
| `05-stage-foreign-material.md:363` | `"Yes — that guilt comes. That's part of what was in the package. …"` | `"That guilt may be part of what was in the package — see whether that feels true."` |
| `05-stage-foreign-material.md:367` | `"Yes. The echo. Foreign guilt — it isn't yours either. …"` | `"Could the echo — that guilt — also be foreign, not yours? Notice whether that lands."` |
| `05-stage-foreign-material.md:328` | `"So 'you can't just sit there' came from your mother. Or somewhere like there. …"` | (already hedged — light touch) `"'You can't just sit there' — does that sound like your mother's voice, or somewhere like it?"` |

### B3 verification
- Governing decision: #329 (`:84` "the user should never feel diagnosed in real time"); D4 (working hypothesis, not fact).
- **Guardrail against over-correction:** each rewrite is checked to be *no more categorical* than the original — a tentative form replacing a declarative one, never the reverse. Owner signs off each.
- Regression fixture: live-arm `unsupported-hypothesis` and `conflation` judges ≤ baseline on the julia fixture; a check that no B3 line ends up more assertive than its original.
- Rollback: per-line revert.

---

# PR B4 — Echo rhythm & ask-more-than-tell (DEFERRED — scope only)

**Not planned line-by-line yet.** Per owner instruction, B4 is prepared only
after B1–B3 have each been separately built and tested. This category is broader
and more subjective (reply-shape/rhythm, not a fixed banned-phrase list), so mass
edits are explicitly **not** prepared now.

Scope when it is time:
- Mirror/echo openings that habitually restate the user ("It sounds like…",
  "What I'm hearing…"), against `journey-master.md:72,74,86`. Enumeration:
  `rg -ni "it sounds like|what i.?m hearing|so what i hear|if i.?m hearing|so what you.?re saying" docs/journey/…` — keeping the sanctioned formal share-back (`journey-master.md:259`) and any "Not:" negative examples.
- The ask-more-than-tell / question-ending rhythm and the concession-opening
  tendency (measured 3/25 on the julia baseline) — the "who leads" surface.
- Residuals surfaced by B2 (e.g. the bare `"Heavy and tired."` echo left after
  the `journey-master.md:486` wrapper removal).
- Governing input: #329 (`:72,:74,:86`) plus D1/D4/D6 (clinician leads).
- Because it is subjective, B4 will be proposed as a small representative set for
  owner review first, measured on the harness `restating-opening` / who-leads
  metrics, before any broad application.

---

*Planning only. No code or prompt edited; nothing removed; no PR opened. B1, B2
and B3 are independent, separately-tested PRs behind the tester switch; B4 waits
until B1–B3 are done.*
