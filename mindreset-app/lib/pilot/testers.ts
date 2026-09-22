// Pilot tester allowlist for the Journey launch pilot (2026-07-04).
//
// Testers on this list get the Journey `recode` Purchase row AND the
// MiniMind Extended tier auto-granted at User row creation time — via
// the Clerk `user.created` webhook OR the `/home` defensive upsert
// (whichever fires first, whichever succeeds). Zero Stripe involvement.
// The tester just signs up and has access immediately.
//
// To add a tester:
//   1. Append their email (lowercase) to PILOT_TESTER_EMAILS below.
//   2. Ship a one-line PR. Vercel deploy is ~30 seconds.
//   3. Send the tester the sign-up URL. That's it.
//
// To revoke a tester (rare — most testers stay for the pilot):
//   1. Remove the email from PILOT_TESTER_EMAILS.
//   2. If they had grants applied, they still hold them — code
//      removal only stops re-granting on future creations. Run the
//      revocation SQL in docs/pilot/revocation.sql (or ask Claude
//      to write it) to actually pull access.
//
// Emails are compared case-insensitively; store lowercase here for
// discipline.

export const PILOT_TESTER_EMAILS: ReadonlySet<string> = new Set<string>([
  // svetlana.morozova@inbox.lv removed 2026-09-22 (owner request): her
  // 30-day pilot trial ended 2026-08-12 and the legacy allowlist grant was
  // keeping MiniMind Extended re-granted on every /home visit. Removal
  // stops the re-grant loop; the already-applied tier is pulled by the
  // owner-run revocation SQL (see the header above). Her pilot history,
  // Purchase rows, and trial fields are untouched — they are what keeps
  // the Journey gate correctly returning pilot_expired.
  'quin55@mail.ru',
]);

export function isPilotTester(email: string | null | undefined): boolean {
  if (!email) return false;
  return PILOT_TESTER_EMAILS.has(email.trim().toLowerCase());
}
