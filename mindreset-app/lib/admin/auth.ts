import { currentUser } from '@clerk/nextjs/server';

// Email allowlist gate for /admin. Middleware enforces Clerk sign-in;
// this helper enforces "is this signed-in user actually allowed in admin?".
// Source of truth: ADMIN_EMAILS env var (comma-separated). Compare against
// every email Clerk has for the user (lower-cased) so a user with multiple
// verified emails can still admin via any of them.
//
// Returns true only for users whose primary or secondary email matches a
// non-empty entry in ADMIN_EMAILS.

// Pre-launch audit fix H10 (2026-07-11). Empty / unset ADMIN_EMAILS
// silently disables admin access for EVERYONE — the layout gate 404s
// Julia's own login with no signal that env was misconfigured. Warn
// once per process so it shows up in Vercel logs immediately after any
// env-var wipe.
let hasWarnedAboutEmptyAdmins = false;

export async function currentUserIsAdmin(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) {
    if (!hasWarnedAboutEmptyAdmins) {
      hasWarnedAboutEmptyAdmins = true;
      console.error(
        '[admin/auth] ADMIN_EMAILS env var is empty or unset — admin panel is inaccessible for ALL users. Set ADMIN_EMAILS on Vercel to restore access.',
      );
    }
    return false;
  }
  return user.emailAddresses.some((e) =>
    allowed.includes(e.emailAddress.toLowerCase()),
  );
}
