// Account-deletion emails — EN + RU, mirror lib/email/welcome.ts structure.
//
// Two templates:
//   1. confirmRequest — sent after the user clicks "Delete account" on /home.
//      Contains a one-hour confirmation link.
//   2. scheduled — sent after the user clicks the link. Confirms the
//      scheduled hard-deletion date and how to cancel.

export type EmailLocale = 'en' | 'ru';

// ---------------------------------------------------------------------------
// 1. Confirmation request
// ---------------------------------------------------------------------------

export function getDeletionConfirmSubject(locale: EmailLocale): string {
  return locale === 'ru'
    ? 'Подтвердите удаление аккаунта MindReset.ai'
    : 'Confirm deletion of your MindReset.ai account';
}

export function getDeletionConfirmPlainText(
  locale: EmailLocale,
  confirmUrl: string,
): string {
  if (locale === 'ru') {
    return `Вы запросили удаление вашего аккаунта MindReset.ai.

Перейдите по ссылке ниже, чтобы подтвердить удаление. Ссылка действительна 1 час и работает один раз.

${confirmUrl}

После подтверждения мы запланируем удаление вашего аккаунта. Если у вас активна подписка, аккаунт удалится после окончания оплаченного периода — но не раньше, чем через 30 дней. У вас будет возможность отменить удаление в любой момент до этой даты.

Если вы не запрашивали удаление — просто проигнорируйте это письмо.

Команда MindReset.ai`;
  }
  return `You've requested to delete your MindReset.ai account.

Click the link below to confirm. It's valid for 1 hour and can only be used once.

${confirmUrl}

Once confirmed, we'll schedule your account for deletion. If you have an active subscription, your account will be deleted after the period you paid for ends — but no sooner than 30 days from now. You can cancel the deletion any time before then.

If you didn't request this, you can ignore this email.

The MindReset.ai team`;
}

export function getDeletionConfirmHtml(
  locale: EmailLocale,
  confirmUrl: string,
): string {
  const body = locale === 'ru'
    ? ruConfirmHtmlBody(confirmUrl)
    : enConfirmHtmlBody(confirmUrl);
  return wrapHtml(body);
}

function enConfirmHtmlBody(confirmUrl: string): string {
  return `
<p style="margin:0 0 20px;">You've requested to delete your MindReset.ai account.</p>

<p style="margin:0 0 20px;">Click the button below to confirm. The link is valid for 1 hour and can only be used once.</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
  <tr>
    <td style="background:#2D7A85;border-radius:6px;padding:12px 28px;">
      <a href="${confirmUrl}" style="color:#F4F1EA;font-family:Georgia,serif;
         font-size:14px;text-decoration:none;letter-spacing:0.04em;">
        Confirm deletion →
      </a>
    </td>
  </tr>
</table>

<p style="margin:0 0 20px;">Once confirmed, your account will be scheduled for deletion. If you have an active subscription, the deletion happens <strong>after the period you paid for ends</strong> — but no sooner than <strong>30 days</strong> from now. You can cancel any time before that date by signing in.</p>

<p style="margin:0 0 20px;color:#6A6A6A;">If you didn't request this, you can safely ignore this email — nothing will happen.</p>

<p style="margin:24px 0 0;color:#6A6A6A;">The MindReset.ai team</p>`;
}

function ruConfirmHtmlBody(confirmUrl: string): string {
  return `
<p style="margin:0 0 20px;">Вы запросили удаление вашего аккаунта MindReset.ai.</p>

<p style="margin:0 0 20px;">Нажмите кнопку ниже, чтобы подтвердить. Ссылка действительна 1 час и работает один раз.</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
  <tr>
    <td style="background:#2D7A85;border-radius:6px;padding:12px 28px;">
      <a href="${confirmUrl}" style="color:#F4F1EA;font-family:Georgia,serif;
         font-size:14px;text-decoration:none;letter-spacing:0.04em;">
        Подтвердить удаление →
      </a>
    </td>
  </tr>
</table>

<p style="margin:0 0 20px;">После подтверждения мы запланируем удаление аккаунта. Если у вас активна подписка, удаление произойдёт <strong>после окончания оплаченного периода</strong> — но не раньше, чем через <strong>30 дней</strong>. Отменить удаление можно в любой момент до этой даты, просто войдя в аккаунт.</p>

<p style="margin:0 0 20px;color:#6A6A6A;">Если вы не запрашивали удаление, просто проигнорируйте это письмо — ничего не произойдёт.</p>

<p style="margin:24px 0 0;color:#6A6A6A;">Команда MindReset.ai</p>`;
}

// ---------------------------------------------------------------------------
// 2. Scheduled-deletion confirmation
// ---------------------------------------------------------------------------

export function getDeletionScheduledSubject(locale: EmailLocale): string {
  return locale === 'ru'
    ? 'Удаление аккаунта запланировано'
    : 'Your account is scheduled for deletion';
}

export function getDeletionScheduledPlainText(
  locale: EmailLocale,
  scheduledDateStr: string,
  appUrl: string,
): string {
  if (locale === 'ru') {
    return `Удаление вашего аккаунта MindReset.ai запланировано на ${scheduledDateStr}.

До этой даты вы можете отменить удаление: войдите в аккаунт и нажмите «Отменить удаление» на главной странице.

После наступления даты удаления мы безвозвратно удалим все ваши данные: разговоры, профиль самочувствия, прогресс, историю покупок (кроме того, что мы обязаны хранить по закону).

Команда MindReset.ai
${appUrl}`;
  }
  return `Your MindReset.ai account is scheduled for deletion on ${scheduledDateStr}.

Until then, you can cancel the deletion: sign in and click "Cancel deletion" on your home page.

After the scheduled date, we'll permanently delete all your data: conversations, wellbeing profile, progress, and purchase history (except records we're legally required to retain).

The MindReset.ai team
${appUrl}`;
}

export function getDeletionScheduledHtml(
  locale: EmailLocale,
  scheduledDateStr: string,
  appUrl: string,
): string {
  const body = locale === 'ru'
    ? ruScheduledHtmlBody(scheduledDateStr, appUrl)
    : enScheduledHtmlBody(scheduledDateStr, appUrl);
  return wrapHtml(body);
}

function enScheduledHtmlBody(scheduledDateStr: string, appUrl: string): string {
  return `
<p style="margin:0 0 20px;">Your MindReset.ai account is scheduled for deletion on <strong>${scheduledDateStr}</strong>.</p>

<p style="margin:0 0 20px;">Until then, you can cancel the deletion: sign in and click "Cancel deletion" on your home page.</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
  <tr>
    <td style="background:#2D7A85;border-radius:6px;padding:12px 28px;">
      <a href="${appUrl}/home" style="color:#F4F1EA;font-family:Georgia,serif;
         font-size:14px;text-decoration:none;letter-spacing:0.04em;">
        Open my space →
      </a>
    </td>
  </tr>
</table>

<p style="margin:0 0 20px;">After the scheduled date, we'll permanently delete all your data: conversations, wellbeing profile, progress, and purchase history (except records we're legally required to retain).</p>

<p style="margin:24px 0 0;color:#6A6A6A;">The MindReset.ai team</p>`;
}

function ruScheduledHtmlBody(scheduledDateStr: string, appUrl: string): string {
  return `
<p style="margin:0 0 20px;">Удаление вашего аккаунта MindReset.ai запланировано на <strong>${scheduledDateStr}</strong>.</p>

<p style="margin:0 0 20px;">До этой даты вы можете отменить удаление: войдите в аккаунт и нажмите «Отменить удаление» на главной странице.</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
  <tr>
    <td style="background:#2D7A85;border-radius:6px;padding:12px 28px;">
      <a href="${appUrl}/home" style="color:#F4F1EA;font-family:Georgia,serif;
         font-size:14px;text-decoration:none;letter-spacing:0.04em;">
        Открыть моё пространство →
      </a>
    </td>
  </tr>
</table>

<p style="margin:0 0 20px;">После наступления даты удаления мы безвозвратно удалим все ваши данные: разговоры, профиль самочувствия, прогресс, историю покупок (кроме того, что мы обязаны хранить по закону).</p>

<p style="margin:24px 0 0;color:#6A6A6A;">Команда MindReset.ai</p>`;
}

// ---------------------------------------------------------------------------
// Shared wrapper (same style as welcome.ts)
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
          <td style="padding:20px 40px 32px;border-top:1px solid #D9D2C2;
                     font-size:12px;color:#6A6A6A;font-family:Georgia,serif;
                     line-height:1.6;">
            MindReset.ai &nbsp;·&nbsp; A self-help wellbeing companion — not therapy,
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
