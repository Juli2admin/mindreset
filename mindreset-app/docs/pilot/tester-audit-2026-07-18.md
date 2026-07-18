# Pilot tester audit — 2026-07-18

Triggered by Sergei's feedback that the Journey AI "wasn't working with him."
Ran a full-cohort SQL audit across all 4 pilot testers, cross-referenced
Journey / MiniMind / States / Themes. All findings are database-metadata
only — no user content was read.

Nothing is being actioned from this doc today. Julia is still evaluating
M1 on the Journey master prompt. Come back here after M1 evaluation
completes.

## Cohort at a glance

| Tester | Locale | Primary surface | Journey turns | MiniMind msgs | Last active |
|---|---|---|---|---|---|
| vmelentev2003@gmail.com | (en?) | Journey | 104 | 0 | 16 Jul |
| sergecrim@hotmail.com | en | Journey | 39 | 5 | 18 Jul (today) |
| quin55@mail.ru | ru | Journey | 26 | 7 | 15 Jul |
| svetlana.morozova@inbox.lv | ru | MiniMind | 0 | 98 | 18 Jul (today) |
| 9020240320@mail.ru | ru | MiniMind | 0 | 19 | 15 Jul |

Note: quin55 was added via allowlist earlier (task #32), not through the
formal PilotInvitation flow. She predates the pilot cohort but is being
treated as one for audit purposes.

## Journey findings — cohort-wide patterns

Across the 3 Journey users (Vlad, Sergei, quin55) — 169 total turns.

### 1. AI verbosity is a constant, not user-adaptive

Regardless of user brevity, the Journey AI produces ~440–530 bytes per reply.

| User | avg user bytes | avg AI bytes | ratio |
|---|---|---|---|
| Vlad | 138 | 433 | 3.1× |
| Sergei | 53 | 453 | 8.5× |
| quin55 | 70 | 527 | 7.5× |

Extreme cases:
- quin55 turn 10: user 65 bytes → AI 2135 bytes (32.8×)
- quin55 turn 23: user 1 byte → AI 650 bytes (650×)
- Sergei turn 6: user 2 bytes → AI 324 bytes (162×)

Compare MiniMind (Svetlana, ru): user ~70 bytes → AI 130–290 bytes (2–3×).
Same user brevity, dramatically different AI reply length.

### 2. 100% surface depth across all Journey users

All 169 Journey turns reported `depthAtTurn=surface`. Not one dropped below.
Whether that's method-correct for early-stage users or a stuck-at-surface
bug is not distinguishable from data alone.

### 3. Recommendation policy: 99.5% "stay"

194 of 195 `recommendedAction` reads were `stay`. Only 1 `advance`. AI is
telling itself not to move, on nearly every turn, for every user.

### 4. Safety-watch heuristic is unstable

| User | safetyFlag=watch % | red_flag % |
|---|---|---|
| Vlad | 74% (77/104) | 0% |
| Sergei | 56% (22/39) | 0% |
| quin55 | 19% (5/26) | 0% |

Watch is firing on majority of turns for two users despite zero red-flag
escalations. Wide variance suggests miscalibration. Likely tunable
independent of the master clinical prompt (safety verifier is a separate
model call in some code paths).

### 5. Method invocation is highly conditional

- Vlad (104 turns): 3 patterns, 0 parts, 0 foreign, 0 practices, 0 sig imgs
- Sergei (39 turns): 0 patterns, 0 parts, 0 foreign, 0 practices, 0 sig imgs
- quin55 (26 turns): 2 patterns, 0 parts, 1 foreign, 0 sig imgs, 11 practices (2 completed)

quin55 is the only Journey user to have practice runs. Her arc entered
somatic modality via "anger in the body" content. AI adapted after she
aborted a compassion practice on turn 16 — every subsequent practice was
somatic. Real methodological adaptation, but conditional on the entry
theme.

### 6. Small pipeline integrity finding

Vlad has 104 user Journey messages but only 101 AI Journey messages.
2.9% AI-reply drop rate — probably streaming errors where the assistant
reply failed to persist. Sergei, quin55, and all MiniMind conversations
were clean 1:1.

## MiniMind findings

### 1. Verbosity is chat-appropriate

Avg AI reply 130–290 bytes across Svetlana's 6 conversations. Length
ratio 1.8×–4.7× (mostly 2–3×). MiniMind's prompt produces chat-length
output. This is a Journey-specific verbosity issue, not app-wide.

### 2. Conversations never close

All 6 of Svetlana's conversations have `endedAt=null`. She re-enters the
same conversation across days. Conv 6 shows a 5516-minute (91-hour) span
because she keeps returning. Whether that's intended chat-product behavior
or a lifecycle bug is not decided.

### 3. Pre/post mood check-ins showing null

Every Svetlana conversation has preMood, preEnergy, postMood, postEnergy
all null. Either the check-in flow isn't being shown, or she's skipping it.
Worth tracing.

### 4. Referral logic points to state/theme modules only

MiniMind's `lib/minimind/prompt.ts` at lines 576–594 has PATTERN DETECTION
& MODULE SUGGESTION. The suggested module list is state clusters
(anxiety, burnout, identity, shame, etc.). Journey is not a referral
target anywhere in MiniMind's prompt. Per Julia (2026-07-18): this is
by design; MiniMind and Journey are separate surfaces. Not a gap to
close.

## Sergei's specific feedback — decoded

His words (paraphrased by Julia):
- Pessimistic about mental-health apps at intake
- Existential-level content ("what's the purpose of my life")
- Expected same-day resolution
- Asked for personal progress metrics visible in-app

What the data confirms:
- His Journey experience was objectively thinner than quin55's — no
  practices, no captures.
- AI stayed at surface + verbose across 39 turns. For his terse pessimistic
  input this was overwhelming, not calibrated.
- His complaint is partly real (verbosity, no method firing) and partly
  expectation mismatch (single-shot existential resolution isn't what
  Journey does).

## Sergei's product asks (worth queueing)

1. **User-facing progress metrics**: all arc data (patterns, parts, foreign
   material, practices, stage) is admin-only today. Users see none of it.
   A "your journey so far" surface for the reader themselves does not
   exist. Real product work — not just a slot on the account page. Needs:
   what to show, when it's safe to show it, what encryption / safety
   constraints apply.
2. **Onboarding expectation-setting**: nothing tells him what Journey does
   or doesn't do before he starts. Landing copy work.

## Not-actioned today — deferred candidates

None of the below is being touched now. All wait for M1 evaluation to
complete.

### Journey candidates
- Investigate constant AI reply length. Whatever in the master prompt
  produces ~450 bytes even for 1-byte user replies is not calibrated.
  Full assessment blocked by M1 constraint on clinical prompt.
- Tune safety-watch verifier. 19–74% variance with 0% red-flag suggests
  miscalibration. Likely independent of master prompt.
- Trace the 2.9% streaming-failure rate on Vlad's turns.

### MiniMind candidates
- Prompt hygiene review of `lib/minimind/prompt.ts` +
  `docs/minimind/MiniMind_System_Prompt_v2.3.md` (dual-source per
  CLAUDE.md).
- Conversation lifecycle — should convs auto-close after N min idle?
- Advisor / mood check-in flow — verify it reaches the user.
- Language handling for ru users (Svetlana, mail.ru).

### Product candidates (from tester feedback)
- User-facing progress metrics surface.
- Journey onboarding expectation copy.

## Cohort-level onboarding observation

Two of four pilot testers went straight to MiniMind and never opened
Journey. Both are Russian speakers. Third ru speaker (quin55) chose
Journey. The en speakers (Vlad, Sergei) both went to Journey. Sample size
is too small to draw conclusions, but worth watching as the pilot grows.

## Method used for this audit

- Cohort SQL over Journey + MiniMind + States + Themes surfaces
- Per-user timeline for quin55 (turn-by-turn with practice markers)
- Per-conversation summary for Svetlana's MiniMind arc
- All queries used encrypted-content length as a size proxy
  (`plaintext_bytes ≈ (LENGTH(contentEncrypted) - 65) / 2` for
  `enc:v1:<iv:24><tag:32><ciphertext>` format). No decryption performed.
- Full SQL scripts are in the audit conversation; can be re-run for
  fresh data by rerunning the queries against current DB state.
