import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ScanUploader } from "@/components/scan-uploader";
import { Button } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "掃描書架" };

export default async function ScanPage() {
  await requireUserId();

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/">
            <ArrowLeft aria-hidden />
            回到書庫
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">掃描書架</h1>
        <p className="text-muted-foreground text-sm text-pretty">
          拍下整排書背或一疊書，系統會逐一辨識書名與作者，再自動補上出版社、ISBN 與書封。
          辨識完成後可以逐本確認再加入書庫。
        </p>
      </div>

      <ScanUploader />
    </main>
  );
}
