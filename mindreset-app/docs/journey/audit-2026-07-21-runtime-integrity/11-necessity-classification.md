# Necessity Classification — Journey Runtime Components (2026-07-21)

Classification only — NO deletion recommendations. Classes: ESSENTIAL-EVERY-TURN ·
ESSENTIAL-WHEN-RELEVANT · SAFETY-CRITICAL · MEMORY-CRITICAL · PROGRESSION-ONLY ·
QA/TELEMETRY-ONLY · USEFUL-BUT-DUPLICATIVE · OBSOLETE · HARMFUL-VIA-CONTRADICTION/WEIGHT ·
CANNOT-DETERMINE. Columns: lost-if-absent / provided elsewhere? / must load every turn? /
conditionally loadable? / contains voice-affecting examples? / belongs in
runtime|code|retrieval|docs / evidence used successfully / evidence of interference.

| Component | Class | Lost if absent | Elsewhere? | Every turn? | Conditional? | Voice examples? | Belongs | Evidence of success | Evidence of interference |
|---|---|---|---|---|---|---|---|---|---|
| Shared Core (minus §6, §9) | ESSENTIAL-EVERY-TURN (constitution: identity, prohibitions, red-flag script) | universal prohibitions, voice constitution | partly (traps overlap) | yes | no | yes ("I hear you" at :209; forbidden/allowed lists) | runtime | prohibitions respected in transcripts | §2 voice rules fuel matrix A1/A4/A5 |
| Shared Core §6 (anchor-recall regime) | OBSOLETE (owner 2026-07-02) | nothing — superseded by MASTER §1 | yes | — | — | yes | docs | — | drives T3 (10× anchor formula) |
| Shared Core §9 (old report schema) | OBSOLETE/DUPLICATIVE | nothing — `<output_format>` supersedes | yes | — | — | no | docs | — | divergent schema versions (no `discharge`) |
| Practice Generation Algorithm doc | USEFUL-BUT-DUPLICATIVE (3rd copy) | nothing unique — master `<practice_generation>` is the operational superset | yes | — | maybe | yes (image-led scripts) | runtime or docs | owner-approved load fixed under-generation (2026-07-04) | duplication weight |
| Stage specs 1–8 — unique clinical method (~25-30% of their mass) | ESSENTIAL-WHEN-RELEVANT | per-stage clinical playbooks (practices, contraindications, watch-fors) | no | **NOT PROVEN necessary every turn** — loaded all-8 since PR λ | yes (per active work, if owner chose) | — | runtime/retrieval | method fidelity | 65.5% mass dilutes behaviour layer |
| Stage specs — worked examples (25, 812 snippets) | **HARMFUL-VIA-CONTRADICTION/WEIGHT** (as runtime content) | demonstration of method | master `<examples>` shows current voice | no | yes | **YES — the dominant voice trainer, 50:1** | docs/training material | — | matrix A1–A7, C1–C5; trace T1–T4 |
| Stage specs — per-stage gate sections ("code-enforced gate… ALL of") | OBSOLETE-IN-PROMPT (gates live in code; PR λ disavows) | nothing the model can use | code enforces the real gates | no | — | no | code/docs | — | teaches model to withhold `advance` (E3) |
| S1 §11 Example C (pre-revision anchor script) | OBSOLETE (owner 2026-07-02) | — | — | — | — | yes | docs | — | direct violation demo of an owner rule |
| Master `<communication>` | ESSENTIAL-EVERY-TURN (the approved voice) | the anti-robotic contract | no | yes | no | yes (3 contrast pairs) | runtime | too new to judge (added 2026-07-20) | outweighed 50:1 |
| `<clinical_reading>` | ESSENTIAL-EVERY-TURN (unenforced) | the pre-reply reading discipline | Sensitivity Layer overlaps | yes | no | no | runtime (+needs enforcement to matter — out of scope) | clinicalReads are high quality | none |
| `<method>` 8 moves | ESSENTIAL-EVERY-TURN | operational move set incl. owner anchor rule | canon overlaps heavily | yes | no | light | runtime | — | — |
| `<assessment_phase>` | ESSENTIAL-WHEN-RELEVANT (Block 1 only) | share-back milestone, wide-before-deep | no | only in Block 1 | **yes — trivially (stage-conditional)** | yes (share-back script) | runtime | share-back worked in June tests | conflicts with flexible map when deep material is alive |
| `<practice_generation>` | ESSENTIAL-EVERY-TURN | the operational practice engine | SC §5/PGA duplicate it | yes | no | some | runtime | micro-movement targeting used | trigger-pull toward practice-shaped turns |
| `<traps>` | ESSENTIAL-EVERY-TURN | 12 pitfall guards incl. rupture protocol | no | yes | no | quotes | runtime | — | trap 5 outgunned by exemplars |
| `<memory>` | ESSENTIAL-EVERY-TURN | continuity-note contract | no | yes | no | no | runtime | notes are written | additivity unenforced (overwrite) |
| `<examples>` (master, 10) | ESSENTIAL-EVERY-TURN (only current-voice demonstrations) | the approved voice in action | no | yes | no | **yes — the good kind** | runtime | — | outnumbered 50:1 |
| `<output_format>` schema + vocab | ESSENTIAL-EVERY-TURN (the state pipeline depends on it) | all structured capture | no | yes | partially (Block-conditional field sets already exist) | no | runtime | reports parse; router works | 6.6% machinery; includes dead fields (`cycleCanClose`, `stabilityCheck` score) |
| Block-1 checklist (12 items) | PROGRESSION-ONLY + QA | gate-token emission | overlaps schema | Block 1 only | yes | no | runtime (Block 1) | tokens fire | reward-shapes replies toward token-earning turns |
| Sensitivity Layer | ESSENTIAL-EVERY-TURN (process-sensitivity) + SAFETY-adjacent | five questions, hard rules, closure check | partially in `<clinical_reading>`/traps | yes | no | worked failure example | runtime | — | self-tension (demands+forbids reasoning); absent from prod 07-09→07-19 |
| All-8-spec loading (PR λ mechanism) | CANNOT-DETERMINE (owner-attributed philosophy vs measured dilution) | cross-stage reach | retrieval could provide | — | yes | — | — | licenses flexible work | +24k cached tokens; carries every stale spec rule into every turn |
| State block | ESSENTIAL-EVERY-TURN + MEMORY-CRITICAL | live user data | no | yes | no | no | runtime | contract/anchor render correctly | dead depth line; two cycle definitions |
| Task contract | ESSENTIAL-EVERY-TURN (the "what the user asked" spine) | — | no | yes | no | no | runtime+code | merge-protection works | nothing routes on it |
| Continuity note | MEMORY-CRITICAL | only cross-session formulation | no | yes | no | no | runtime+code | notes exist | overwrite + truncation + unread by code |
| Patterns | MEMORY-CRITICAL + QA | pattern recognition across sessions | no | yes | maybe | no | runtime+code | dedup works | no correction path (memory doc §7) |
| Progression telemetry (moves, practiceRun, readiness) | PROGRESSION-ONLY + QA/TELEMETRY | router fuel + admin review | no | yes | no | no | code | move lane consumes moves | emission burden on every turn |
| Classic gates (code) | PROGRESSION-ONLY + SAFETY-adjacent | paced advancement | move lane partially | n/a | n/a | n/a | code | — | anchor requirement retired-but-live; E3 starvation |
| Move lane (code) | PROGRESSION-ONLY | arc-shaped rescue | classic partially | n/a | n/a | n/a | code | owner-locked rules | arc-only assumption |
| Safety stack (keyword/verifier/freeze) | SAFETY-CRITICAL | crisis handling | no | n/a | n/a | n/a | code | freezes fire (3× on 07-11 — over-fired, then tuned) | — |
| Emission reminder | QA/TELEMETRY-critical | prevents report dropout | no | every call | no | no | code | dropout fixed (07-19) | occupies the recency slot |
| `CLINICAL_MANUAL.md` | OBSOLETE as authority (never loaded, unrevised) | human reference | canon carries method | no | — | yes (spoken-anchor lines) | docs | — | authority claim falsified |
| `runtime/stage-01/02.md` | OBSOLETE (deprecated, unreachable) | — | — | no | — | yes (pre-revision anchor) | delete-candidate for owner review — NOT decided here | — | reactivation hazard only |
| Dead fields/paths (`currentDepth`, `cycleCanClose` consumer, `stabilityCheck` enforcement, `save.ts:116`, assemble fallback) | DEAD | nothing | — | — | — | — | code | — | depth line misinforms model; fallback crashes |

## Summary counts
- ESSENTIAL-EVERY-TURN: 12 components (≈26–28k tokens' worth — matches the duplication
  report's "unique and necessary" estimate).
- HARMFUL-VIA-CONTRADICTION/WEIGHT as currently deployed: stage-spec worked examples;
  plus 4 OBSOLETE prompt sections still shipped (SC §6, SC §9, S1 Ex.C, per-stage gate
  text) and 2 obsolete disk artefacts.
- CANNOT-DETERMINE: all-8-spec loading (owner-attributed philosophy vs measured cost —
  an owner decision, flagged for the decision list).

*Classification only. No deletions recommended.*
