import type { Metadata } from "next";

import { requireUserId } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "掃描書架" };

export default async function ScanPage() {
  await requireUserId();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">掃描書架</h1>
    </main>
  );
}
