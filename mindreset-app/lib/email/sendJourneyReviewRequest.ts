// lib/email/sendJourneyReviewRequest.ts
//
// Day 1 audit fix item 4.3 — request-review affordance for frozen
// Journey users. A paying customer who tripped a false positive on
// the freeze gate previously had no path out without owner running
// manual SQL. This email gives the owner the signal to triage.
//
// Recipient: REVIEW_REQUEST_EMAIL env first, falling back to
// SEV5_ALERT_EMAIL, falling back to ADMIN_EMAILS, falling back to a
// hard-coded safety net. Multiple comma-separated addresses
// supported throughout.
//
// FROM: shared RESEND_FROM_EMAIL. Failure mode: caller wraps in
// .catch() so a Resend outage doesn't block the user feedback.

import { getResend } from './resend';

const FROM_ADDRESS_FALLBACK = 'MindReset.ai <hello@mindreset.ai>';
const HARD_CODED_FALLBACK_RECIPIENT = 'jloya4436@gmail.com';

function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? FROM_ADDRESS_FALLBACK;
}

function recipients(): string[] {
  const explicit =
    process.env.REVIEW_REQUEST_EMAIL?.trim() ??
    process.env.SEV5_ALERT_EMAIL?.trim() ??
    process.env.ADMIN_EMAILS?.trim();
  if (explicit) {
    return explicit
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
  }
  return [HARD_CODED_FALLBACK_RECIPIENT];
}

export type JourneyReviewRequestInput = {
  userId: string;
  userEmail: string | null;
  frozenAt: Date | null;
  frozenReason: string | null;
};

export type JourneyReviewRequestResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendJourneyReviewRequest(
  input: JourneyReviewRequestInput,
): Promise<JourneyReviewRequestResult> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: 'Resend not configured' };
  }

  const subject = `Journey freeze review requested — user ${input.userId}`;

  const body = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #2b2b2b; line-height: 1.55; max-width: 640px;">
      <h2 style="margin: 0 0 16px; font-weight: 500;">Freeze review requested</h2>
      <p>A user has requested review of their frozen Journey state.</p>

      <table style="margin-top: 16px; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 12px 4px 0; color: #6A6A6A;">User ID</td>
          <td style="padding: 4px 0; font-family: monospace;">${escapeHtml(input.userId)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 12px 4px 0; color: #6A6A6A;">Email</td>
          <td style="padding: 4px 0;">${input.userEmail ? escapeHtml(input.userEmail) : '<em>(not stored)</em>'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 12px 4px 0; color: #6A6A6A;">Frozen at</td>
          <td style="padding: 4px 0;">${input.frozenAt ? input.frozenAt.toISOString() : '<em>(unknown)</em>'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 12px 4px 0; color: #6A6A6A;">Freeze reason</td>
          <td style="padding: 4px 0;">${input.frozenReason ? escapeHtml(input.frozenReason) : '<em>(unspecified)</em>'}</td>
        </tr>
      </table>

      <p style="margin-top: 24px; color: #6A6A6A; font-size: 13px;">
        To unfreeze the user, clear <code>frozenForReview</code> and related
        fields on their <code>RecodeProgress</code> row in Supabase
        (<code>lib/journey/safety/freeze.ts</code> documents the exact
        fields). The user can resume the Journey on their next visit.
      </p>
    </div>
  `;

  try {
    const result = await resend.emails.send({
      from: fromAddress(),
      to: recipients(),
      subject,
      html: body,
    });
    if (result.error) {
      return { ok: false, error: result.error.message };
    }
    return { ok: true, id: result.data?.id ?? 'unknown' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown error' };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
