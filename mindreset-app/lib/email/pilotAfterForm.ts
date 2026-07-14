// Pilot After-form nudge email.
//
// PR ω3b (2026-07-14). Fires when the tester's beforeFormFilledAt is
// more than 30 days old and they haven't submitted the After form yet.
// Warm invitation to the second measurement so we can compare the
// six 0–10 scales before/after — that IS the pilot's result.

export type PilotLocale = 'en' | 'ru';

export function getPilotAfterFormSubject(locale: PilotLocale): string {
  return locale === 'ru'
    ? 'MindReset — четыре недели прошло, короткая анкета «после»'
    : 'MindReset — four weeks in, a short "after" questionnaire';
}

export function getPilotAfterFormPlainText(
  locale: PilotLocale,
  formUrl: string,
): string {
  return locale === 'ru' ? ruPlain(formUrl) : enPlain(formUrl);
}

export function getPilotAfterFormHtml(
  locale: PilotLocale,
  formUrl: string,
): string {
  const body = locale === 'ru' ? ruHtmlBody(formUrl) : enHtmlBody(formUrl);
  return wrapHtml(body);
}

// ---------------------------------------------------------------------------
// EN
// ---------------------------------------------------------------------------

function enPlain(formUrl: string): string {
  return `Four weeks have passed since you filled the Before form — thank you.

Please take about eight minutes to fill in the After questionnaire.
The same six 0–10 scales from the start repeat inside — that's how
we'll see whether the pilot moved anything real for you.

Please be critical. Polite feedback is useless to me. If it didn't
work, was boring, or was confusing — that is the most valuable thing
you can tell me.

The questionnaire (~8 min):
${formUrl}

Julia
MindReset.ai`;
}

function enHtmlBody(formUrl: string): string {
  return `
<h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:24px;
           font-weight:400;color:#2D7A85;line-height:1.3;">
  Four weeks in.
</h1>

<p style="margin:0 0 18px;">
  Four weeks have passed since you filled the Before form —
  thank you.
</p>

<p style="margin:0 0 18px;">
  Please take about eight minutes to fill in the After questionnaire.
  The same six 0–10 scales from the start repeat inside — that's how
  we'll see whether the pilot moved anything real for you.
</p>

<p style="margin:0 0 18px;">
  <strong>Please be critical.</strong> Polite feedback is useless to
  me. If it didn't work, was boring, or was confusing — that is the
  most valuable thing you can tell me.
</p>

<p style="margin:24px 0;text-align:center;">
  <a href="${formUrl}"
     style="display:inline-block;background:#2D7A85;color:#F4F1EA;
            text-decoration:none;padding:14px 28px;border-radius:24px;
            font-family:Georgia,serif;font-size:15px;">
    Open the questionnaire (~8 min)
  </a>
</p>

<p style="margin:0;color:#666;">Julia<br />MindReset.ai</p>
`;
}

// ---------------------------------------------------------------------------
// RU — formal Вы + feminine forms per CLAUDE.md
// ---------------------------------------------------------------------------

function ruPlain(formUrl: string): string {
  return `Прошло четыре недели с того момента, как Вы заполнили форму «До» — спасибо.

Пожалуйста, уделите около восьми минут анкете «После». Те же шесть
шкал 0–10, что были в начале, повторятся внутри — так мы увидим,
сдвинул ли пилот что-то настоящее для Вас.

Пожалуйста, будьте критичны. Вежливые отзывы мне бесполезны. Если
не сработало, было скучно или непонятно — это самое ценное, что
Вы можете сказать.

Анкета (~8 минут):
${formUrl}

Юлия
MindReset.ai`;
}

function ruHtmlBody(formUrl: string): string {
  return `
<h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:24px;
           font-weight:400;color:#2D7A85;line-height:1.3;">
  Четыре недели прошло.
</h1>

<p style="margin:0 0 18px;">
  Прошло четыре недели с того момента, как Вы заполнили форму «До» —
  спасибо.
</p>

<p style="margin:0 0 18px;">
  Пожалуйста, уделите около восьми минут анкете «После». Те же шесть
  шкал 0–10, что были в начале, повторятся внутри — так мы увидим,
  сдвинул ли пилот что-то настоящее для Вас.
</p>

<p style="margin:0 0 18px;">
  <strong>Пожалуйста, будьте критичны.</strong> Вежливые отзывы мне
  бесполезны. Если не сработало, было скучно или непонятно — это
  самое ценное, что Вы можете сказать.
</p>

<p style="margin:24px 0;text-align:center;">
  <a href="${formUrl}"
     style="display:inline-block;background:#2D7A85;color:#F4F1EA;
            text-decoration:none;padding:14px 28px;border-radius:24px;
            font-family:Georgia,serif;font-size:15px;">
    Открыть анкету (~8 минут)
  </a>
</p>

<p style="margin:0;color:#666;">Юлия<br />MindReset.ai</p>
`;
}

// ---------------------------------------------------------------------------
// HTML wrapper — same visual language as the other MindReset emails.
// ---------------------------------------------------------------------------

function wrapHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#F4F1EA;font-family:Georgia,serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
         style="background:#F4F1EA;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600"
             style="max-width:600px;width:100%;background:#FFFFFF;border-radius:8px;
                    border:1px solid #D9D2C2;overflow:hidden;">
        <tr>
          <td style="background:#2D7A85;padding:28px 40px;">
            <p style="margin:0;font-family:Georgia,serif;font-size:20px;
                      color:#F4F1EA;letter-spacing:0.04em;">MindReset.ai</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;color:#393939;font-size:15px;
                     line-height:1.7;font-family:Georgia,serif;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;background:#F4F1EA;color:#666;
                     font-size:12px;line-height:1.6;font-family:Georgia,serif;
                     border-top:1px solid #D9D2C2;">
            MindReset.ai — self-help wellbeing tool, not therapy.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
