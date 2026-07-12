// Redeem-code carry cookie.
//
// If a signed-out user visits /redeem/[code], we can't attach the code to
// a User row yet — they need to sign up first. We stash the code in a
// short-lived cookie, redirect them to /sign-up, and the /home defensive
// upsert reads the cookie post-signup and claims the invitation.
//
// Read + consumed exactly once. If the tester bounces before signing up,
// the cookie times out on its own.

const REDEEM_COOKIE = 'mr_pilot_code';
const REDEEM_COOKIE_MAX_AGE = 60 * 60; // 1 hour — long enough for signup

export const PILOT_REDEEM_COOKIE = REDEEM_COOKIE;
export const PILOT_REDEEM_COOKIE_MAX_AGE = REDEEM_COOKIE_MAX_AGE;
