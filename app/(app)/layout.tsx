import { AppNav } from "@/components/app-nav";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Shell for every signed-in page.
 *
 * The auth check lives here so no page in this group can accidentally render
 * without a session; `requireUser` redirects anonymous visitors to /login.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppNav user={user} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
