import { requireUserId } from "@/lib/auth/require-user";
import { getBookStats } from "@/lib/data/books";

export default async function LibraryPage() {
  const userId = await requireUserId();
  const stats = await getBookStats(userId);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">我的書庫</h1>
      <p className="text-muted-foreground mt-2 text-sm">目前共 {stats.total} 本書。</p>
    </main>
  );
}
