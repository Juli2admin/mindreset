// Welcome email templates — EN (source of truth) and RU (hand-curated by Julia).
// Copy locked 2026-05-24.

export type WelcomeLocale = 'en' | 'ru';

export function getWelcomeSubject(locale: WelcomeLocale): string {
  return locale === 'ru'
    ? 'Добро пожаловать в MindReset.ai'
    : 'Welcome to MindReset.ai';
}

// Plain-text version — used as fallback by email clients that don't render HTML.
export function getWelcomePlainText(locale: WelcomeLocale): string {
  if (locale === 'ru') return RU_PLAIN;
  return EN_PLAIN;
}

// HTML version — inline styles only (email client compatibility).
export function getWelcomeHtml(locale: WelcomeLocale, appUrl: string): string {
  const body = locale === 'ru' ? ruHtmlBody(appUrl) : enHtmlBody(appUrl);
  return wrapHtml(body);
}

// ---------------------------------------------------------------------------
// Shared HTML wrapper
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

        <!-- Header -->
        <tr>
          <td style="background:#2D7A85;padding:28px 40px;">
            <p style="margin:0;font-family:Georgia,serif;font-size:20px;
                      color:#F4F1EA;letter-spacing:0.04em;">MindReset.ai</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;color:#393939;font-size:15px;
                     line-height:1.7;font-family:Georgia,serif;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 32px;border-top:1px solid #D9D2C2;
                     font-size:12px;color:#6A6A6A;font-family:Georgia,serif;
                     line-height:1.6;">
            MindReset.ai &nbsp;·&nbsp; A trauma-informed self-help companion — not therapy,
            not a crisis service. &nbsp;·&nbsp;
            <a href="https://mindreset.ai" style="color:#2D7A85;text-decoration:none;">
              mindreset.ai
            </a>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// EN
// ---------------------------------------------------------------------------

function enHtmlBody(appUrl: string): string {
  return `
<p style="margin:0 0 20px;">Hello — and welcome to MindReset.ai.</p>

<p style="margin:0 0 20px;">You've stepped into a space designed to help you slow down, breathe, and
reconnect with yourself a little more gently. And alongside you is MiniMind —
your digital companion for emotional support and self-reflection.</p>

<p style="margin:0 0 20px;">Before anything else, it's worth saying this: there's no rush here, and
there's no "right" way to use MiniMind.</p>

<p style="margin:0 0 20px;">Even a few quiet minutes can be enough. You can come back whenever it feels
right for you — MiniMind will still be here.</p>

<p style="margin:0 0 20px;"><strong>How to get started</strong></p>

<p style="margin:0 0 20px;">Say whatever feels honest and natural. You can type or speak, keep things
brief or go deeper if you want to. Phrases like <em>"I'm not sure what to say"</em>,
<em>"Can we slow down?"</em>, <em>"Say that again"</em>, or simply <em>"Keep going"</em> are all
completely fine. MiniMind adapts to your pace and the way you communicate.</p>

<p style="margin:0 0 20px;">How deeply you go is always your choice. Try to be honest with yourself,
but never force anything. Sometimes simply reading, noticing your reactions,
or sitting with a thought for a moment is enough.</p>

<p style="margin:0 0 20px;">You can pause at any time and return later exactly where you left off.
Your conversations with MiniMind are stored privately, so nothing disappears
if you step away.</p>

<p style="margin:0 0 20px;">Small, regular check-ins tend to help more than occasional long sessions.
Often it's the quieter, more consistent moments of reflection that create
the biggest shifts over time.</p>

<p style="margin:0 0 20px;"><strong>Your free messages</strong></p>

<p style="margin:0 0 20px;">To begin, you have 50 free messages — no card details needed, and no time
limit. Take your time with them and see whether this kind of support feels
helpful for you. If you decide you'd like more later on, there are simple
subscription options and optional message top-ups available.</p>

<p style="margin:0 0 20px;border-left:3px solid #D9D2C2;padding-left:16px;color:#6A6A6A;">
<strong>One important note:</strong> MindReset.ai is a self-support and wellbeing platform, not
therapy and not a crisis service. If you are ever in danger, in crisis, or
need urgent support, please contact your local emergency services or call
<strong>Samaritans free on 116 123 (UK)</strong>, any time, day or night.</p>

<p style="margin:0 0 20px;">If you have any questions, we're always here:
<a href="mailto:support@mindreset.ai" style="color:#2D7A85;">support@mindreset.ai</a></p>

<p style="margin:0 0 28px;">Whenever you're ready, you can begin in your own time.</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
  <tr>
    <td style="background:#2D7A85;border-radius:6px;padding:12px 28px;">
      <a href="${appUrl}/account" style="color:#F4F1EA;font-family:Georgia,serif;
         font-size:14px;text-decoration:none;letter-spacing:0.04em;">
        Open MiniMind →
      </a>
    </td>
  </tr>
</table>

<p style="margin:24px 0 0;color:#6A6A6A;">The MindReset.ai team</p>`;
}

const EN_PLAIN = `Hello — and welcome to MindReset.ai.

You've stepped into a space designed to help you slow down, breathe, and reconnect with yourself a little more gently. And alongside you is MiniMind — your digital companion for emotional support and self-reflection.

Before anything else, it's worth saying this: there's no rush here, and there's no "right" way to use MiniMind.

Even a few quiet minutes can be enough. You can come back whenever it feels right for you — MiniMind will still be here.

Say whatever feels honest and natural. You can type or speak, keep things brief or go deeper if you want to. Phrases like "I'm not sure what to say", "Can we slow down?", "Say that again", or simply "Keep going" are all completely fine. MiniMind adapts to your pace and the way you communicate.

How deeply you go is always your choice. Try to be honest with yourself, but never force anything. Sometimes simply reading, noticing your reactions, or sitting with a thought for a moment is enough.

You can pause at any time and return later exactly where you left off. Your conversations with MiniMind are stored privately, so nothing disappears if you step away.

Small, regular check-ins tend to help more than occasional long sessions. Often it's the quieter, more consistent moments of reflection that create the biggest shifts over time.

To begin, you have 50 free messages — no card details needed, and no time limit. Take your time with them and see whether this kind of support feels helpful for you. If you decide you'd like more later on, there are simple subscription options and optional message top-ups available.

IMPORTANT: MindReset.ai is a self-support and wellbeing platform, not therapy and not a crisis service. If you are ever in danger, in crisis, or need urgent support, please contact your local emergency services or call Samaritans free on 116 123 (UK), any time, day or night.

If you have any questions, we're always here: support@mindreset.ai

Whenever you're ready, you can begin in your own time.

The MindReset.ai team`;

// ---------------------------------------------------------------------------
// RU
// ---------------------------------------------------------------------------

function ruHtmlBody(appUrl: string): string {
  return `
<p style="margin:0 0 20px;">Здравствуйте — и добро пожаловать в MindReset.ai.</p>

<p style="margin:0 0 20px;">Вы открыли пространство, где можно немного остановиться, выдохнуть и
побыть внимательнее к себе. А MiniMind — ваш цифровой компаньон для
эмоциональной поддержки и саморефлексии — будет рядом в этом процессе.</p>

<p style="margin:0 0 20px;">И прежде чем начать, хочется сказать главное: здесь не нужно спешить
и не существует «правильного» способа пользоваться MiniMind.</p>

<p style="margin:0 0 20px;">Даже нескольких спокойных минут уже достаточно. Вы можете возвращаться
тогда, когда вам удобно — MiniMind всегда будет рядом.</p>

<p style="margin:0 0 20px;"><strong>Как начать</strong></p>

<p style="margin:0 0 20px;">Говорите так, как получается именно у вас. Можно писать коротко, можно
подробно. Можно печатать или говорить вслух. Фразы вроде
<em>«Я не знаю, что сказать»</em>, <em>«Давай помедленнее»</em>,
<em>«Повтори»</em> или просто <em>«Продолжай»</em> — абсолютно нормальны.
MiniMind подстраивается под вас и ваш ритм.</p>

<p style="margin:0 0 20px;">Насколько глубоко идти — решаете только вы. Старайтесь быть честными
с собой, но не давите на себя. Иногда достаточно просто читать, замечать
свои реакции и немного размышлять — это тоже часть процесса.</p>

<p style="margin:0 0 20px;">Вы можете остановиться в любой момент и вернуться позже. Ваши разговоры
с MiniMind сохраняются приватно, поэтому ничего не потеряется.</p>

<p style="margin:0 0 20px;">Небольшие, но регулярные разговоры обычно помогают больше всего. Часто
именно короткие и честные моменты контакта с собой со временем дают самые
заметные изменения.</p>

<p style="margin:0 0 20px;"><strong>Ваши бесплатные сообщения</strong></p>

<p style="margin:0 0 20px;">Для начала у вас есть 50 бесплатных сообщений — без привязки карты и
без ограничений по времени. Используйте их спокойно, чтобы понять,
подходит ли вам такой формат поддержки. Если позже захочется продолжить,
будут доступны подписки и дополнительные сообщения.</p>

<p style="margin:0 0 20px;border-left:3px solid #D9D2C2;padding-left:16px;color:#6A6A6A;">
<strong>И ещё одно важное замечание:</strong> MindReset.ai — это инструмент поддержки
и самопомощи, а не терапия и не кризисная служба. Если вы находитесь в кризисе,
чувствуете угрозу своей безопасности или вам срочно нужна помощь, пожалуйста,
обратитесь в местную экстренную службу или свяжитесь с Samaritans по номеру
<strong>116 123 (Великобритания)</strong> — бесплатно и круглосуточно.</p>

<p style="margin:0 0 20px;">Если у вас появятся вопросы, мы всегда на связи:
<a href="mailto:support@mindreset.ai" style="color:#2D7A85;">support@mindreset.ai</a></p>

<p style="margin:0 0 28px;">Когда будете готовы — начинайте в своём темпе.</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
  <tr>
    <td style="background:#2D7A85;border-radius:6px;padding:12px 28px;">
      <a href="${appUrl}/account" style="color:#F4F1EA;font-family:Georgia,serif;
         font-size:14px;text-decoration:none;letter-spacing:0.04em;">
        Открыть MiniMind →
      </a>
    </td>
</tr>
</table>

<p style="margin:24px 0 0;color:#6A6A6A;">Команда MindReset.ai</p>`;
}

const RU_PLAIN = `Здравствуйте — и добро пожаловать в MindReset.ai.

Вы открыли пространство, где можно немного остановиться, выдохнуть и побыть внимательнее к себе. А MiniMind — ваш цифровой компаньон для эмоциональной поддержки и саморефлексии — будет рядом в этом процессе.

И прежде чем начать, хочется сказать главное: здесь не нужно спешить и не существует «правильного» способа пользоваться MiniMind.

Даже нескольких спокойных минут уже достаточно. Вы можете возвращаться тогда, когда вам удобно — MiniMind всегда будет рядом.

Говорите так, как получается именно у вас. Можно писать коротко, можно подробно. Можно печатать или говорить вслух. Фразы вроде «Я не знаю, что сказать», «Давай помедленнее», «Повтори» или просто «Продолжай» — абсолютно нормальны. MiniMind подстраивается под вас и ваш ритм.

Насколько глубоко идти — решаете только вы. Старайтесь быть честными с собой, но не давите на себя. Иногда достаточно просто читать, замечать свои реакции и немного размышлять — это тоже часть процесса.

Вы можете остановиться в любой момент и вернуться позже. Ваши разговоры с MiniMind сохраняются приватно, поэтому ничего не потеряется.

Небольшие, но регулярные разговоры обычно помогают больше всего. Часто именно короткие и честные моменты контакта с собой со временем дают самые заметные изменения.

Для начала у вас есть 50 бесплатных сообщений — без привязки карты и без ограничений по времени. Используйте их спокойно, чтобы понять, подходит ли вам такой формат поддержки. Если позже захочется продолжить, будут доступны подписки и дополнительные сообщения.

ВАЖНО: MindReset.ai — это инструмент поддержки и самопомощи, а не терапия и не кризисная служба. Если вы находитесь в кризисе, чувствуете угрозу своей безопасности или вам срочно нужна помощь, пожалуйста, обратитесь в местную экстренную службу или свяжитесь с Samaritans по номеру 116 123 (Великобритания) — бесплатно и круглосуточно.

Если у вас появятся вопросы, мы всегда на связи: support@mindreset.ai

Когда будете готовы — начинайте в своём темпе.

Команда MindReset.ai`;
