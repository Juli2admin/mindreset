import crypto from 'crypto';

// HMAC-signed unsubscribe tokens. Embedded in marketing emails as a
// link parameter so a one-click unsubscribe needs no DB lookup or login.
//
// Format: <userId>.<signature>
// where signature = base64url(HMAC-SHA256(userId, UNSUBSCRIBE_TOKEN_SECRET))
//
// Tokens never expire — UK PECR + GDPR require an unsubscribe link to
// remain valid for the lifetime of the email. If a user's account is
// deleted the userId no longer resolves to anyone, so the unsubscribe
// is a no-op (still returns success — no information leak about whether
// an account exists).
//
// SECRET ROTATION: rotating UNSUBSCRIBE_TOKEN_SECRET will invalidate
// every previously-sent unsubscribe link. Only rotate if a key is
// compromised; document the rotation in carry-forward.md so future
// support reads (people clicking a year-old link) make sense.

const SECRET_ENV = 'UNSUBSCRIBE_TOKEN_SECRET';

function getSecret(): Buffer {
  const raw = process.env[SECRET_ENV];
  if (!raw) {
    throw new Error(`${SECRET_ENV} is not set`);
  }
  return Buffer.from(raw, 'utf-8');
}

function base64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function signUnsubscribeToken(userId: string): string {
  const secret = getSecret();
  const mac = crypto.createHmac('sha256', secret).update(userId).digest();
  return `${userId}.${base64url(mac)}`;
}

export function verifyUnsubscribeToken(token: string): { userId: string } | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;

  const lastDot = token.lastIndexOf('.');
  const userId = token.slice(0, lastDot);
  const providedSig = token.slice(lastDot + 1);
  if (!userId || !providedSig) return null;

  let expected: string;
  try {
    expected = base64url(
      crypto.createHmac('sha256', getSecret()).update(userId).digest(),
    );
  } catch {
    return null;
  }

  if (!timingSafeEqualStr(providedSig, expected)) return null;
  return { userId };
}
