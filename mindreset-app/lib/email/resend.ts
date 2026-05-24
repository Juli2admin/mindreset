import { Resend } from 'resend';

// Instantiated lazily so missing RESEND_API_KEY only errors when actually used,
// not at module load time (keeps the app bootable without email configured).
let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    _resend = new Resend(key);
  }
  return _resend;
}

export const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL ?? 'MindReset.ai <hello@mindreset.ai>';
