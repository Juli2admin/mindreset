import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { waitUntil } from '@vercel/functions';
import prisma from '@/lib/prisma';
import { categoriseSupport } from '@/lib/support/categorise';
import { evaluateAutoSend } from '@/lib/support/autoSendEligibility';

export const dynamic = 'force-dynamic';

// POST /api/webhooks/email-inbound
//
// Resend Inbound webhook receiver. Resend forwards every email sent to
// any address @mindreset.ai (per the MX record we set up) here, signed
// via svix-style headers.
//
// We only act on `email.received` events. Other event types (outbound
// delivery: email.sent, email.delivered, …) hit this URL too because the
// owner ticked them all in the Resend webhook config; those return
// `{ received: true, ignored: true }`.
//
// Body fetch: Resend's email.received webhook payload contains METADATA
// ONLY — from / to / subject / email_id / message_id / attachments
// metadata. The plaintext body and HTML body are NOT in the webhook
// payload (Resend's documented design — supports large attachments in
// serverless). We fetch them by calling
// `GET https://api.resend.com/emails/receiving/{email_id}` with a
// Bearer RESEND_API_KEY header, inside waitUntil so the webhook returns
// fast.
//
// Idempotency: Resend retries on non-2xx. SupportEmail.resendInboundId
// has a unique constraint; a retried delivery hits the P2002 path and
// short-circuits with `{ received: true, deduped: true }`.

type ResendInboundEvent = {
  type: string;
  data?: Record<string, unknown>;
};

type ResendReceivingEmailResponse = {
  text?: string | null;
  html?: string | null;
  headers?: Record<string, string>;
};

function isP2002(err: unknown): boolean {
  return !!(
    err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}

// Resend webhook `from` is a plain string like "yulia@gmail.com" or
// "Name <yulia@gmail.com>". Parse both forms.
function parseFrom(raw: unknown): { email: string; name: string | null } | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const angleMatch = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (angleMatch) {
    const name = angleMatch[1].trim().replace(/^["']|["']$/g, '');
    return { email: angleMatch[2].trim().toLowerCase(), name: name || null };
  }
  return { email: raw.trim().toLowerCase(), name: null };
}

// Fetch the email body from Resend's Receiving API. Returns null on any
// error; caller logs and falls back to a placeholder so the row still
// gets created and the admin can manually retrieve from Resend dashboard
// via the email_id we store.
async function fetchInboundBody(
  emailId: string,
  apiKey: string,
): Promise<{ text: string; html: string | null } | null> {
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      console.error('[email-inbound] Resend receiving GET failed', {
        emailId,
        status: res.status,
        statusText: res.statusText,
      });
      return null;
    }
    // Resend's REST API returns the email fields FLAT (text, html, headers
    // at the top level). The `{ data, error }` envelope only exists in the
    // resend-node SDK's response wrapper — when calling REST directly via
    // fetch, json.text and json.html are at the root.
    const json = (await res.json()) as ResendReceivingEmailResponse;
    const text = typeof json.text === 'string' ? json.text : '';
    const html = typeof json.html === 'string' && json.html.length > 0 ? json.html : null;
    return { text, html };
  } catch (err) {
    console.error('[email-inbound] Resend receiving GET threw', {
      emailId,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  if (!secret) {
    console.error('[email-inbound] RESEND_INBOUND_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 });
  }
  if (!apiKey) {
    console.error('[email-inbound] RESEND_API_KEY not set');
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 });
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'missing svix headers' }, { status: 400 });
  }

  const body = await request.text();

  let event: ResendInboundEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendInboundEvent;
  } catch (err) {
    console.error('[email-inbound] signature verification failed', err);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  if (event.type !== 'email.received') {
    return NextResponse.json({ received: true, ignored: true });
  }

  const data = event.data ?? {};

  const fromParsed = parseFrom(data.from);
  if (!fromParsed) {
    console.warn('[email-inbound] missing from address', { eventId: svixId });
    return NextResponse.json({ received: true, error: 'no from' });
  }

  const subject =
    typeof data.subject === 'string' ? data.subject.trim().slice(0, 998) : '';

  const emailId = typeof data.email_id === 'string' ? data.email_id : '';
  const messageId =
    typeof data.message_id === 'string' ? data.message_id : '';
  const resendInboundId = emailId || messageId || svixId;

  const createdAtRaw =
    typeof data.created_at === 'string' ? data.created_at : '';
  const receivedAt = createdAtRaw ? new Date(createdAtRaw) : new Date();

  // Fetch body via Resend Receiving API. If it fails, create the row with
  // a placeholder so the admin still sees the email arrived and can
  // retrieve the body manually from the Resend dashboard.
  const fetched = emailId ? await fetchInboundBody(emailId, apiKey) : null;
  // Guard on `fetched.text` having content, not just `fetched` being
  // truthy — fetchInboundBody returns `{ text: '', html: null }` on a
  // successful response with empty plaintext (e.g. HTML-only mail), and
  // we'd silently persist '' if we only checked the wrapper.
  const bodyText = fetched && fetched.text
    ? fetched.text
    : `[Body could not be fetched from Resend. email_id: ${emailId || '(none)'} — check Resend dashboard or function logs.]`;
  const bodyHtml = fetched?.html ?? null;

  let created;
  try {
    created = await prisma.supportEmail.create({
      data: {
        fromEmail: fromParsed.email,
        fromName: fromParsed.name,
        subject: subject || '(no subject)',
        bodyText,
        bodyHtml,
        resendInboundId,
        receivedAt,
      },
    });
  } catch (err) {
    if (isP2002(err)) {
      console.log('[email-inbound] duplicate inbound id — already processed', {
        resendInboundId,
      });
      return NextResponse.json({ received: true, deduped: true });
    }
    console.error('[email-inbound] create failed', err);
    return NextResponse.json({ error: 'persistence failed' }, { status: 500 });
  }

  // Trigger AI categoriser asynchronously. The categoriser updates the
  // SupportEmail row in-place when it completes. If it fails, the row
  // stays at status='pending' and the admin can hit "Run AI" on the
  // detail page to retry manually.
  waitUntil(
    (async () => {
      try {
        const result = await categoriseSupport({
          subject: created.subject,
          bodyText: created.bodyText,
        });

        // Decide whether to enqueue auto-send (narrow whitelist) or
        // stay on manual-review. evaluateAutoSend checks env kill-switch,
        // category, urgency, locale, subject blacklist, and per-sender
        // daily cap. The 60-second hold gives the admin a window to
        // intervene before the cron picks the row up.
        const autoDecision = await evaluateAutoSend({
          fromEmail: created.fromEmail,
          subject: created.subject,
          category: result.category,
          urgency: result.urgency,
          locale: result.locale,
          draftReply: result.draftReply,
        });

        await prisma.supportEmail.update({
          where: { id: created.id },
          data: {
            locale: result.locale,
            category: result.category,
            urgency: result.urgency,
            draftReply: result.draftReply,
            draftLocale: result.draftLocale,
            status: autoDecision.eligible ? 'auto_queued' : 'drafted',
            autoSendAt: autoDecision.eligible ? autoDecision.sendAt : null,
          },
        });
      } catch (err) {
        console.error('[email-inbound] AI categoriser failed', {
          supportEmailId: created.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    })(),
  );

  return NextResponse.json({ received: true, supportEmailId: created.id });
}
