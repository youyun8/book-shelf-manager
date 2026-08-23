import Link from "next/link";
import { BookOpen, Camera, CloudDownload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Camera,
    title: "拍照辨識",
    description: "對著書架拍一張，自動認出照片裡的每一本書。",
  },
  {
    icon: BookOpen,
    title: "購買狀態",
    description: "一鍵切換已購買 / 未購買，逛書店時不再買重複。",
  },
  {
    icon: CloudDownload,
    title: "雲端與匯出",
    description: "資料存在雲端，隨時把整個書庫匯出成 CSV。",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-10 px-6 py-16">
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm font-medium">書櫃管家</p>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          拍一張照片，整理好你的書櫃
        </h1>
        <p className="text-muted-foreground text-lg text-pretty">
          上傳書架照片，自動辨識書名與作者、補齊書目資料，並標記哪些已經買了。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="gap-3 py-5">
            <CardContent className="space-y-2">
              <Icon className="text-muted-foreground size-5" aria-hidden />
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/login">開始使用</Link>
        </Button>
      </div>
    </main>
  );
}
