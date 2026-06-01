import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { waitUntil } from '@vercel/functions';
import prisma from '@/lib/prisma';
import { categoriseSupport } from '@/lib/support/categorise';

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
  data?: {
    text?: string | null;
    html?: string | null;
    headers?: Array<{ name: string; value: string }>;
  };
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
    const json = (await res.json()) as ResendReceivingEmailResponse;
    const text = json.data?.text ?? '';
    const html = json.data?.html ?? null;
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
  const bodyText = fetched
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
        await prisma.supportEmail.update({
          where: { id: created.id },
          data: {
            locale: result.locale,
            category: result.category,
            urgency: result.urgency,
            draftReply: result.draftReply,
            draftLocale: result.draftLocale,
            status: 'drafted',
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
