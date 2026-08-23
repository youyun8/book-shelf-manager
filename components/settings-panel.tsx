"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, LogOut, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { StatBar } from "@/components/stat-bar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteEverythingAction } from "@/app/(app)/actions";
import { authClient } from "@/lib/auth/client";
import type { SessionUser } from "@/lib/auth/require-user";
import type { BookStats } from "@/lib/data/books";

/** Typing the phrase makes an irreversible action a deliberate one. */
const CONFIRM_PHRASE = "刪除全部";

export function SettingsPanel({ user, stats }: { user: SessionUser; stats: BookStats }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, startDelete] = useTransition();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    const { error } = await authClient.signOut();
    if (error) {
      setSigningOut(false);
      toast.error("登出失敗", { description: error.message ?? "請稍後再試一次。" });
      return;
    }
    router.push("/login");
    router.refresh();
  }

  function deleteEverything() {
    startDelete(async () => {
      const result = await deleteEverythingAction();
      setConfirmOpen(false);
      setConfirmation("");

      if (!result.ok) {
        toast.error("刪除失敗", { description: result.error });
        return;
      }

      toast.success(`已刪除 ${result.data} 本書與所有掃描紀錄`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>帳號</CardTitle>
          <CardDescription>你的書庫只有你自己看得到。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-20">名稱</dt>
              <dd>{user.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-20">電子郵件</dt>
              <dd className="break-all">{user.email}</dd>
            </div>
          </dl>

          <Button type="button" variant="outline" onClick={signOut} disabled={signingOut}>
            {signingOut ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
            登出
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>書庫概況</CardTitle>
        </CardHeader>
        <CardContent>
          <StatBar stats={stats} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>匯出資料</CardTitle>
          <CardDescription>
            匯出成 CSV（UTF-8 with BOM），可以直接用 Excel 或 Numbers 開啟。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href="/api/export" download data-testid="settings-export">
              <Download aria-hidden />
              匯出全部 {stats.total} 本書
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <TriangleAlert className="size-4" aria-hidden />
            危險操作
          </CardTitle>
          <CardDescription>
            刪除書庫中的所有書籍、掃描紀錄與上傳的照片。這個動作無法復原，建議先匯出備份。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
            disabled={deleting || stats.total === 0}
          >
            刪除所有資料
          </Button>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setConfirmation("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除所有資料？</AlertDialogTitle>
            <AlertDialogDescription>
              {stats.total} 本書、所有掃描紀錄與上傳的照片都會被永久刪除，無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirm-delete">請輸入「{CONFIRM_PHRASE}」以確認</Label>
            <Input
              id="confirm-delete"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmation !== CONFIRM_PHRASE || deleting}
              onClick={(event) => {
                event.preventDefault();
                deleteEverything();
              }}
            >
              {deleting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              永久刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
