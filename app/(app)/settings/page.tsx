import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "設定" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">設定</h1>
      <p className="text-muted-foreground mt-2 text-sm">{user.email}</p>
    </main>
  );
}
