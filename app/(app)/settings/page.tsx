import type { Metadata } from "next";

import { SettingsPanel } from "@/components/settings-panel";
import { requireUser } from "@/lib/auth/require-user";
import { getBookStats } from "@/lib/data/books";

export const metadata: Metadata = { title: "設定" };

export default async function SettingsPage() {
  const user = await requireUser();
  const stats = await getBookStats(user.id);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">設定</h1>
      <SettingsPanel user={user} stats={stats} />
    </main>
  );
}
