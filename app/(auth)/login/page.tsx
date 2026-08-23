import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookMarked } from "lucide-react";

import { LoginForm } from "@/components/login-form";
import { getSessionUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "登入" };

export default async function LoginPage() {
  // Already signed in: nothing to do here.
  if (await getSessionUser()) redirect("/");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <BookMarked className="mx-auto size-8" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">書櫃管家</h1>
          <p className="text-muted-foreground text-sm text-pretty">
            拍一張書架照片，自動整理成你的雲端書庫。
          </p>
        </div>

        <LoginForm />

        <p className="text-muted-foreground text-center text-xs text-pretty">
          登入即表示你同意我們保存你的書庫資料。每位使用者的資料完全獨立，其他人看不到你的書庫。
        </p>
      </div>
    </main>
  );
}
