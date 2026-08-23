"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookMarked, Camera, Library, LogOut, Settings } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth/client";
import type { SessionUser } from "@/lib/auth/require-user";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "書庫", icon: Library },
  { href: "/scan", label: "掃描", icon: Camera },
  { href: "/settings", label: "設定", icon: Settings },
];

export function AppNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const { error } = await authClient.signOut();
    if (error) {
      toast.error("登出失敗", { description: error.message ?? "請稍後再試一次。" });
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4 sm:px-6">
        <Link href="/" className="mr-2 flex items-center gap-2 font-semibold">
          <BookMarked className="size-5" aria-hidden />
          <span className="hidden sm:inline">書櫃管家</span>
        </Link>

        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Button
              key={href}
              asChild
              variant="ghost"
              size="sm"
              className={cn(active && "bg-accent text-accent-foreground")}
            >
              <Link href={href} aria-current={active ? "page" : undefined}>
                <Icon aria-hidden />
                {label}
              </Link>
            </Button>
          );
        })}

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="max-w-40">
                <span className="truncate">{user.name || user.email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <span className="block truncate text-sm font-medium">{user.name}</span>
                <span className="text-muted-foreground block truncate text-xs">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings aria-hidden />
                  設定
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={handleSignOut}>
                <LogOut aria-hidden />
                登出
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </header>
  );
}
