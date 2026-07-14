// Pilot welcome email — EN and RU (formal Вы + feminine forms).
//
// PR ω2 (2026-07-14). Sent once, at the moment a tester redeems their
// pilot invitation. Its ONE job is to put the "before Journey"
// questionnaire link in the tester's inbox so they can't miss it —
// the previous flow only showed the link on the /redeem success page,
// and testers who clicked through fast never came back for it.

export type PilotLocale = 'en' | 'ru';

export function getPilotWelcomeSubject(locale: PilotLocale): string {
  return locale === 'ru'
    ? 'MindReset пилот — короткая анкета перед началом'
    : 'MindReset pilot — a short questionnaire before you begin';
}

export function getPilotWelcomePlainText(
  locale: PilotLocale,
  formUrl: string,
  journeyUrl: string,
): string {
  return locale === 'ru' ? ruPlain(formUrl, journeyUrl) : enPlain(formUrl, journeyUrl);
}

export function getPilotWelcomeHtml(
  locale: PilotLocale,
  formUrl: string,
  journeyUrl: string,
): string {
  const body = locale === 'ru' ? ruHtmlBody(formUrl, journeyUrl) : enHtmlBody(formUrl, journeyUrl);
  return wrapHtml(body);
}

// ---------------------------------------------------------------------------
// EN
// ---------------------------------------------------------------------------

function enPlain(formUrl: string, journeyUrl: string): string {
  return `Welcome to the MindReset pilot.

Thank you for joining the pilot programme. Before you begin The Journey, please take five minutes to fill in the questionnaire below. Your answers help us learn what serves people best.

The questionnaire (5 min):
${formUrl}

When you're ready, The Journey starts here:
${journeyUrl}

You have 30 days of full access. If anything feels off — the AI, the pace, a moment that lands wrong — I want to know. Reply to this email.

Julia
MindReset.ai`;
}

function enHtmlBody(formUrl: string, journeyUrl: string): string {
  return `
<h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:24px;
           font-weight:400;color:#2D7A85;line-height:1.3;">
  Welcome to the MindReset pilot.
</h1>

<p style="margin:0 0 18px;">Thank you for joining the pilot programme.</p>

<p style="margin:0 0 18px;">
  Before you begin The Journey, please take five minutes to fill in the
  questionnaire below. Your answers help us learn what serves people best.
</p>

<p style="margin:24px 0;text-align:center;">
  <a href="${formUrl}"
     style="display:inline-block;background:#2D7A85;color:#F4F1EA;
            text-decoration:none;padding:14px 28px;border-radius:24px;
            font-family:Georgia,serif;font-size:15px;">
    Open the questionnaire (5 min)
  </a>
</p>

<p style="margin:0 0 18px;">
  When you're ready, The Journey starts here:
</p>

<p style="margin:0 0 24px;text-align:center;">
  <a href="${journeyUrl}"
     style="color:#2D7A85;text-decoration:underline;font-family:Georgia,serif;">
    ${journeyUrl}
  </a>
</p>

<p style="margin:0 0 18px;">
  You have 30 days of full access. If anything feels off — the AI, the pace,
  a moment that lands wrong — I want to know. Reply to this email.
</p>

<p style="margin:0;color:#666;">Julia<br />MindReset.ai</p>
`;
}

// ---------------------------------------------------------------------------
// RU  (formal Вы, feminine forms per CLAUDE.md rules)
// ---------------------------------------------------------------------------

function ruPlain(formUrl: string, journeyUrl: string): string {
  return `Добро пожаловать в пилот MindReset.

Спасибо, что присоединились к пилотной программе. Пожалуйста, перед началом The Journey уделите пять минут анкете по ссылке ниже. Ваши ответы помогают нам понять, что работает лучше всего.

Анкета (5 минут):
${formUrl}

Когда будете готовы, The Journey начинается здесь:
${journeyUrl}

У Вас есть 30 дней полного доступа. Если что-то пойдёт не так — ИИ, темп, момент, который лёг не туда, — я хочу знать. Ответьте на это письмо.

Юлия
MindReset.ai`;
}

function ruHtmlBody(formUrl: string, journeyUrl: string): string {
  return `
<h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:24px;
           font-weight:400;color:#2D7A85;line-height:1.3;">
  Добро пожаловать в пилот MindReset.
</h1>

<p style="margin:0 0 18px;">Спасибо, что присоединились к пилотной программе.</p>

<p style="margin:0 0 18px;">
  Пожалуйста, перед началом The Journey уделите пять минут анкете по ссылке
  ниже. Ваши ответы помогают нам понять, что работает лучше всего.
</p>

<p style="margin:24px 0;text-align:center;">
  <a href="${formUrl}"
     style="display:inline-block;background:#2D7A85;color:#F4F1EA;
            text-decoration:none;padding:14px 28px;border-radius:24px;
            font-family:Georgia,serif;font-size:15px;">
    Открыть анкету (5 минут)
  </a>
</p>

<p style="margin:0 0 18px;">
  Когда будете готовы, The Journey начинается здесь:
</p>

<p style="margin:0 0 24px;text-align:center;">
  <a href="${journeyUrl}"
     style="color:#2D7A85;text-decoration:underline;font-family:Georgia,serif;">
    ${journeyUrl}
  </a>
</p>

<p style="margin:0 0 18px;">
  У Вас есть 30 дней полного доступа. Если что-то пойдёт не так — ИИ, темп,
  момент, который лёг не туда, — я хочу знать. Ответьте на это письмо.
</p>

<p style="margin:0;color:#666;">Юлия<br />MindReset.ai</p>
`;
}

// ---------------------------------------------------------------------------
// Shared HTML wrapper — mirrors lib/email/welcome.ts for visual continuity.
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
