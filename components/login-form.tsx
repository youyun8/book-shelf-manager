"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth/client";

type Step = "email" | "otp";

const GOOGLE_ICON_PATHS = [
  {
    d: "M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z",
    fill: "#4285F4",
  },
  {
    d: "M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z",
    fill: "#34A853",
  },
  {
    d: "M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3-2.33Z",
    fill: "#FBBC05",
  },
  {
    d: "M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z",
    fill: "#EA4335",
  },
];

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden focusable="false">
      {GOOGLE_ICON_PATHS.map((path) => (
        <path key={path.fill} d={path.d} fill={path.fill} />
      ))}
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [googlePending, setGooglePending] = useState(false);
  const [pending, startTransition] = useTransition();

  async function signInWithGoogle() {
    setGooglePending(true);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });
    if (error) {
      setGooglePending(false);
      toast.error("Google 登入失敗", { description: error.message ?? "請稍後再試一次。" });
    }
    // On success the browser navigates to Google, so leave the button disabled.
  }

  function sendOtp(event: React.FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;

    startTransition(async () => {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email: address,
        type: "sign-in",
      });
      if (error) {
        toast.error("驗證碼寄送失敗", { description: error.message ?? "請確認信箱後再試一次。" });
        return;
      }
      setStep("otp");
      toast.success("驗證碼已寄出", { description: `請查收 ${address} 的來信。` });
    });
  }

  function verifyOtp(event: React.FormEvent) {
    event.preventDefault();
    const code = otp.trim();
    if (code.length < 6) return;

    startTransition(async () => {
      const { error } = await authClient.signIn.emailOtp({ email: email.trim(), otp: code });
      if (error) {
        toast.error("驗證碼不正確", { description: error.message ?? "請重新輸入或重寄驗證碼。" });
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  if (step === "otp") {
    return (
      <form onSubmit={verifyOtp} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="otp">驗證碼</Label>
          <Input
            id="otp"
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
            className="text-center text-lg tracking-[0.4em]"
            autoFocus
            required
          />
          <p className="text-muted-foreground text-xs">
            我們寄了 6 位數驗證碼到 {email}，10 分鐘內有效。
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={pending || otp.length < 6}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          登入
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            setStep("email");
            setOtp("");
          }}
          disabled={pending}
        >
          <ArrowLeft aria-hidden />
          改用其他信箱
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={signInWithGoogle}
        disabled={googlePending || pending}
      >
        {googlePending ? <Loader2 className="animate-spin" aria-hidden /> : <GoogleIcon />}
        使用 Google 登入
      </Button>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-muted-foreground text-xs">或</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={sendOtp} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="email">電子郵件</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={pending || googlePending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Mail aria-hidden />}
          寄送登入驗證碼
        </Button>
      </form>
    </div>
  );
}
