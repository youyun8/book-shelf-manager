import type { Env } from './env.d';

/**
 * Sends transactional mail through Resend's REST API. The Node SDK is not
 * needed on Workers: one fetch does the job without a dependency.
 */
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = '藏書庫存管理 <onboarding@resend.dev>';

export interface ResetEmail {
  to: string;
  link: string;
  minutes: number;
}

export function resetEmailText({ link, minutes }: ResetEmail): string {
  return [
    '你（或某個知道你 Email 的人）要求重設藏書庫存管理的密碼。',
    '',
    `請在 ${minutes} 分鐘內點下面的連結設定新密碼：`,
    link,
    '',
    '如果不是你要求的，忽略這封信即可，你的密碼不會有任何變動。',
  ].join('\n');
}

export function resetEmailHtml(input: ResetEmail): string {
  const safeLink = input.link.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<div style="font-family:system-ui,-apple-system,'Noto Sans TC',sans-serif;line-height:1.7;color:#27272a">
  <h2 style="font-size:18px;margin:0 0 12px">重設藏書庫存管理的密碼</h2>
  <p style="margin:0 0 12px">你（或某個知道你 Email 的人）要求重設密碼。請在 ${input.minutes} 分鐘內點下面的按鈕設定新密碼：</p>
  <p style="margin:0 0 20px"><a href="${safeLink}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">設定新密碼</a></p>
  <p style="margin:0 0 12px;font-size:13px;color:#52525b">按鈕無法使用時，請複製這個網址：<br><span style="word-break:break-all">${safeLink}</span></p>
  <p style="margin:0;font-size:13px;color:#52525b">如果不是你要求的，忽略這封信即可，你的密碼不會有任何變動。</p>
</div>`;
}

export type MailOutcome = 'sent' | 'not-configured';

/**
 * Returns `not-configured` when no API key is set, after logging the link so a
 * local or self-hosted setup still works. Throws when Resend rejects the send.
 */
export async function sendResetEmail(env: Env, input: ResetEmail): Promise<MailOutcome> {
  if (!env.RESEND_API_KEY) {
    console.log(`[password-reset] no RESEND_API_KEY; link for ${input.to}: ${input.link}`);
    return 'not-configured';
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM ?? DEFAULT_FROM,
      to: [input.to],
      subject: '重設藏書庫存管理的密碼',
      text: resetEmailText(input),
      html: resetEmailHtml(input),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend ${response.status}: ${detail.slice(0, 300)}`);
  }
  return 'sent';
}
