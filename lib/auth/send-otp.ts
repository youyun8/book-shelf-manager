/**
 * Email OTP delivery.
 *
 * Cloudflare Workers have no built-in outbound email, so delivery goes through
 * Resend's HTTP API when RESEND_API_KEY is configured. Without it — local
 * development — the code falls back to logging the OTP, which keeps the login
 * flow usable without provisioning an email provider first. See DECISIONS.md.
 */
export type OtpType = "sign-in" | "email-verification" | "forget-password" | "change-email";

const SUBJECTS: Record<OtpType, string> = {
  "sign-in": "書櫃管家登入驗證碼",
  "email-verification": "書櫃管家電子郵件驗證碼",
  "forget-password": "書櫃管家密碼重設驗證碼",
  "change-email": "書櫃管家變更電子郵件驗證碼",
};

export async function sendLoginOtpEmail({
  email,
  otp,
  type,
}: {
  email: string;
  otp: string;
  type: OtpType;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.OTP_FROM_EMAIL ?? "書櫃管家 <onboarding@resend.dev>";
  const subject = SUBJECTS[type] ?? SUBJECTS["sign-in"];

  if (!apiKey) {
    console.warn(`[auth] RESEND_API_KEY is not set; OTP for ${email} is ${otp} (${type})`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      text: `你的驗證碼是 ${otp}，10 分鐘內有效。如果不是你本人操作，請忽略這封信。`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send OTP email: ${response.status} ${await response.text()}`);
  }
}
