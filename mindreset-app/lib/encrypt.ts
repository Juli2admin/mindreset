// AES-256-GCM authenticated encryption for Article 9 special-category data.
//
// Storage format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
//
// The version prefix serves three purposes:
//   1. Distinguishes encrypted values from legacy plaintext (migration safety)
//   2. Enables future key rotation (bump version, provide decoder for both)
//   3. Makes accidental plaintext storage detectable at a glance
//
// In production: MESSAGE_ENCRYPTION_KEY must be a 64-char hex string (32 bytes).
// In dev/test:   a deterministic zero-key is used when env var is absent so the
//                app works without local setup. Never deploy without the real key.

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const VERSION_PREFIX = 'enc:v1:';
const DEV_KEY = Buffer.alloc(32, 0); // zero key — local dev only

function getKey(): Buffer {
  const hex = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'MESSAGE_ENCRYPTION_KEY must be a 64-character hex string in production',
      );
    }
    return DEV_KEY;
  }
  return Buffer.from(hex, 'hex');
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return (
    VERSION_PREFIX +
    iv.toString('hex') +
    ':' +
    authTag.toString('hex') +
    ':' +
    encrypted.toString('hex')
  );
}

// Returns plaintext. Handles both encrypted strings (enc:v1: prefix) and
// legacy plaintext (no prefix) so the migration period is safe — existing
// rows are readable until the backfill script encrypts them.
export function decrypt(value: string): string {
  if (!value.startsWith(VERSION_PREFIX)) {
    return value; // legacy plaintext passthrough
  }
  const key = getKey();
  const payload = value.slice(VERSION_PREFIX.length);
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Encrypted message format invalid: expected iv:authTag:ciphertext');
  }
  const [ivHex, authTagHex, ctHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ct = Buffer.from(ctHex, 'hex');

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error('Encrypted message format invalid: wrong iv or authTag length');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

// Returns true if the value is in the encrypted format (not legacy plaintext).
export function isEncrypted(value: string): boolean {
  return value.startsWith(VERSION_PREFIX);
}

// Constant-time equality for secret comparison (e.g. Bearer tokens).
// Exported here so the cron route can use it without importing 'crypto' directly.
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
