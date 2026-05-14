# Security upgrade deferrals

This document tracks dependency upgrades that `npm audit` flags as fixes for
known vulnerabilities, but that we have **deliberately deferred** rather than
applied. Each entry records the realistic exposure for MindReset, the cost of
applying the fix now, and the trigger event that should prompt action.

The intent: nothing here is silently ignored. When a trigger event fires, the
relevant entry below should be the first checklist item.

Last reviewed: 2026-05-14.

---

## 1. `next` — 14 → 15+ (major)

**Currently installed:** `next@14.2.35` (range `^14.2.0` in `package.json`).
**npm-suggested fix:** `next@16.2.6` (latest at audit time).
**Minimum version that clears the advisories:** `next@15.5.16`.

### Vulnerabilities

`next` carries 13 advisories at audit time. Highest-impact for our actual
surface:

- **DoS via HTTP request deserialization in React Server Components** (high) —
  applies; we use RSC throughout `/account` and elsewhere.
- **DoS with Server Components** (high, two distinct CVEs) — applies.
- **Cache poisoning in RSC responses** (moderate) — theoretical.

Lower-impact for us (do not apply to our current code paths but are bundled in
the upgrade):

- SSRF via WebSocket upgrades — no WS handlers.
- Middleware/Proxy bypass via Pages-router i18n — App Router only here.
- XSS via `<Script strategy="beforeInteractive">` — not used.
- XSS in App Router with CSP nonces — no CSP nonces configured.
- HTTP smuggling via rewrites — no rewrites configured.
- `next/image` DoS / unbounded cache growth — minimal `next/image` usage.

### Why deferred

Next 15 introduces breaking changes in widely-used APIs:

- `cookies()`, `headers()`, `params`, `searchParams` become **async**.
  `app/account/page.tsx` reads `cookies()` synchronously; this must change.
- Caching defaults flip (`fetch` no longer caches by default).
- React 19 RC integration and runtime changes.

Applying the fix is a small but real migration that wants its own focused pass,
not a rushed bundle with hygiene work.

### Trigger event

**Before Phase 3 (MiniMind streaming chat) lands.** Streaming responses and RSC
behavior change non-trivially across the 14→15 line; doing the upgrade first
avoids re-doing chat work twice.

### Action when triggered

1. Read the [Next.js 15 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-15).
2. Migrate `cookies()` / `headers()` call sites to `await`.
3. Audit `fetch()` call sites for caching expectations.
4. Run full preview deploy + manual smoke before promoting.

---

## 2. `@clerk/nextjs` — 5 → 7 (major)

**Currently installed:** `@clerk/nextjs@5.7.6` (range `^5.7.0`).
**npm-suggested fix:** `@clerk/nextjs@7.3.3`.

### Vulnerability

- **Authorization bypass when combining organization, billing, or
  reverification checks** (high). The bypass occurs when multiple checks are
  chained on the same route.

### Why deferred

The realistic exposure is **zero today**: we do not use Clerk organizations,
do not use Clerk billing, and do not use reverification flows.

The fix path is a two-major-version upgrade (v5 → v6 → v7). v5→v7 includes:

- Deprecation of `@clerk/clerk-react` as a standalone import.
- Renamed exports in `@clerk/nextjs/server`.
- Middleware shape evolution (the v5-style `auth().protect()` we use today
  has a different shape in v6+).

Done in isolation this is a 2–3 hour exercise; bundled with auth feature work
it's much cheaper.

### Trigger event

**Whenever we wire Clerk organizations or Clerk billing.** Both are roadmap
items for Phase 4+ (paid modules, team workspaces). The upgrade is most
legible when paired with the feature it unblocks, since the migration touches
the same surfaces.

### Action when triggered

1. Read Clerk's [v6 migration guide](https://clerk.com/docs/upgrade-guides/core-2)
   and [v7 migration guide](https://clerk.com/docs/upgrade-guides/core-3).
2. Update `middleware.ts` to the new `clerkMiddleware` signature.
3. Update `app/sign-in/*` and `app/sign-up/*` for any prop changes on
   `<SignIn />` / `<SignUp />`.
4. Run the Clerk webhook end-to-end in preview before merging.

---

## 3. `eslint-config-next` — 14 → 16 (major, devDep)

**Currently installed:** `eslint-config-next@14.x`.
**npm-suggested fix:** `eslint-config-next@16.2.6`.

### Vulnerability

Transitively pulls `glob@10.2.0-10.4.5`, which has a **command injection
via `glob -c/--cmd`** (high). The vulnerability is in glob's **CLI** (`shell: true`
execution of matched filenames); `eslint-config-next` imports glob as a
**library**, not as a CLI.

### Why deferred

Realistic exposure is **zero**. Our toolchain never invokes `glob` as a CLI
with `-c`. The advisory is unreachable from our usage.

Major-bumping `eslint-config-next` standalone risks lint-config drift between
the linter and the framework we lint. Cleanest to bump alongside `next`.

### Trigger event

**Automatic — when the `next` upgrade (entry #1 above) is performed.** Pin
both to compatible major versions in the same commit.

### Action when triggered

Bundled with entry #1 — no separate action required.

---

## How to use this file

When `npm audit` reports vulnerabilities in any of the packages listed above:

1. Check whether the entry's **trigger event** has fired.
2. If yes, follow the **Action when triggered** steps for that entry and
   remove it from this file in the same commit.
3. If no, the advisory is already accounted for — note the audit run and
   move on.

When a **new** vulnerability appears that is **not** listed here, add an entry
or apply the fix; do not let undocumented vulnerabilities accumulate.
