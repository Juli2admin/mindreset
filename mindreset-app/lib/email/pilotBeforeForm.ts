// Pilot Before-form nudge email.
//
// PR ω3a (2026-07-14). Sent when a pilot tester opens /journey for the
// first time WITHOUT having filled the Before form. Warm support-tone
// message asking them to fill it before they begin so we can measure
// progress at the four-week mark.

export type PilotLocale = 'en' | 'ru';

export function getPilotBeforeFormSubject(locale: PilotLocale): string {
  return locale === 'ru'
    ? 'MindReset — короткая анкета до того, как Вы начнёте'
    : 'MindReset — a short questionnaire before you begin';
}

export function getPilotBeforeFormPlainText(
  locale: PilotLocale,
  formUrl: string,
  journeyUrl: string,
): string {
  return locale === 'ru'
    ? ruPlain(formUrl, journeyUrl)
    : enPlain(formUrl, journeyUrl);
}

export function getPilotBeforeFormHtml(
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
  return `I saw you opened The Journey — thank you for being here.

Before you begin, please take five minutes to fill in the short
questionnaire below. The six 0–10 scales in it repeat at the end of
your four weeks — that's how we'll see whether the pilot did anything
real for you. Without that first read there's nothing to compare
against later, so it's the most useful thing you can do today.

The questionnaire (~5 min):
${formUrl}

When it's saved, The Journey is here:
${journeyUrl}

If anything feels off at any point — the AI, the pace, a moment that
lands wrong — please reply to this email. Direct feedback is the
whole point of the pilot.

Julia
MindReset.ai`;
}

function enHtmlBody(formUrl: string, journeyUrl: string): string {
  return `
<h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:24px;
           font-weight:400;color:#2D7A85;line-height:1.3;">
  A short questionnaire before you begin.
</h1>

<p style="margin:0 0 18px;">
  I saw you opened The Journey — thank you for being here.
</p>

<p style="margin:0 0 18px;">
  Before you begin, please take five minutes to fill in the short
  questionnaire below. The six 0–10 scales in it repeat at the end of
  your four weeks — that's how we'll see whether the pilot did anything
  real for you. Without that first read there's nothing to compare
  against later, so it's the most useful thing you can do today.
</p>

<p style="margin:24px 0;text-align:center;">
  <a href="${formUrl}"
     style="display:inline-block;background:#2D7A85;color:#F4F1EA;
            text-decoration:none;padding:14px 28px;border-radius:24px;
            font-family:Georgia,serif;font-size:15px;">
    Open the questionnaire (5 min)
  </a>
</p>

<p style="margin:0 0 18px;">When it's saved, The Journey is here:</p>

<p style="margin:0 0 24px;text-align:center;">
  <a href="${journeyUrl}"
     style="color:#2D7A85;text-decoration:underline;font-family:Georgia,serif;">
    ${journeyUrl}
  </a>
</p>

<p style="margin:0 0 18px;">
  If anything feels off at any point — the AI, the pace, a moment that
  lands wrong — please reply to this email. Direct feedback is the whole
  point of the pilot.
</p>

<p style="margin:0;color:#666;">Julia<br />MindReset.ai</p>
`;
}

// ---------------------------------------------------------------------------
// RU — formal Вы + feminine forms per CLAUDE.md
// ---------------------------------------------------------------------------

function ruPlain(formUrl: string, journeyUrl: string): string {
  return `Я увидела, что Вы открыли Путь — спасибо, что Вы здесь.

Перед началом, пожалуйста, уделите пять минут короткой анкете по ссылке
ниже. Шесть шкал 0–10 в ней повторятся в конце четырёх недель — так
мы увидим, дал ли пилот Вам что-то настоящее. Без этой первой отметки
не с чем будет сравнивать потом, поэтому это самое полезное, что Вы
можете сделать сегодня.

Анкета (~5 минут):
${formUrl}

Когда сохраните, Путь здесь:
${journeyUrl}

Если что-то пойдёт не так в любой момент — ИИ, темп, момент, который
лёг не туда, — пожалуйста, ответьте на это письмо. Прямая обратная
связь — весь смысл пилота.

Юлия
MindReset.ai`;
}

function ruHtmlBody(formUrl: string, journeyUrl: string): string {
  return `
<h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:24px;
           font-weight:400;color:#2D7A85;line-height:1.3;">
  Короткая анкета до того, как Вы начнёте.
</h1>

<p style="margin:0 0 18px;">
  Я увидела, что Вы открыли Путь — спасибо, что Вы здесь.
</p>

<p style="margin:0 0 18px;">
  Перед началом, пожалуйста, уделите пять минут короткой анкете по ссылке
  ниже. Шесть шкал 0–10 в ней повторятся в конце четырёх недель — так мы
  увидим, дал ли пилот Вам что-то настоящее. Без этой первой отметки не
  с чем будет сравнивать потом, поэтому это самое полезное, что Вы можете
  сделать сегодня.
</p>

<p style="margin:24px 0;text-align:center;">
  <a href="${formUrl}"
     style="display:inline-block;background:#2D7A85;color:#F4F1EA;
            text-decoration:none;padding:14px 28px;border-radius:24px;
            font-family:Georgia,serif;font-size:15px;">
    Открыть анкету (5 минут)
  </a>
</p>

<p style="margin:0 0 18px;">Когда сохраните, Путь здесь:</p>

<p style="margin:0 0 24px;text-align:center;">
  <a href="${journeyUrl}"
     style="color:#2D7A85;text-decoration:underline;font-family:Georgia,serif;">
    ${journeyUrl}
  </a>
</p>

<p style="margin:0 0 18px;">
  Если что-то пойдёт не так в любой момент — ИИ, темп, момент, который лёг
  не туда, — пожалуйста, ответьте на это письмо. Прямая обратная связь —
  весь смысл пилота.
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
