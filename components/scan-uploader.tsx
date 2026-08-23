"use client";

import { useCallback, useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Loader2, RotateCw, Upload, X } from "lucide-react";

import { ReviewList } from "@/components/review-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Book } from "@/lib/data/books";
import {
  ACCEPTED_TYPES,
  ImageCompressionError,
  MAX_FILE_BYTES,
  compressImage,
} from "@/lib/image-compression";
import { cn } from "@/lib/utils";

type JobStatus = "compressing" | "uploading" | "processing" | "done" | "failed";

type Job = {
  /** Stable key before the server assigns a scan id. */
  key: string;
  fileName: string;
  previewUrl: string;
  status: JobStatus;
  scanId?: string;
  error?: string;
  books: Book[];
};

const STATUS_LABELS: Record<JobStatus, string> = {
  compressing: "壓縮中",
  uploading: "上傳中",
  processing: "辨識中",
  done: "完成",
  failed: "失敗",
};

const STATUS_PROGRESS: Record<JobStatus, number> = {
  compressing: 15,
  uploading: 40,
  processing: 75,
  done: 100,
  failed: 100,
};

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

type ScanStatusResponse = {
  status: JobStatus | "pending";
  errorMessage?: string | null;
  books?: Book[];
};

/** Books come back as JSON, so the date columns arrive as strings. */
function reviveBook(book: Book): Book {
  return {
    ...book,
    createdAt: new Date(book.createdAt),
    updatedAt: new Date(book.updatedAt),
    purchasedAt: book.purchasedAt ? new Date(book.purchasedAt) : null,
  };
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function ScanUploader() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateJob = useCallback((key: string, patch: Partial<Job>) => {
    setJobs((previous) => previous.map((job) => (job.key === key ? { ...job, ...patch } : job)));
  }, []);

  /** Polls until the worker finishes the scan, gives up, or errors. */
  const pollScan = useCallback(
    async (key: string, scanId: string) => {
      const deadline = Date.now() + POLL_TIMEOUT_MS;

      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

        if (Date.now() > deadline) {
          updateJob(key, {
            status: "failed",
            error: "辨識花費的時間超出預期，請重試。",
          });
          return;
        }

        let response: Response;
        try {
          response = await fetch(`/api/scan/${scanId}`, { cache: "no-store" });
        } catch {
          continue; // transient network blip; keep polling until the deadline
        }

        if (!response.ok) {
          updateJob(key, { status: "failed", error: "找不到這次掃描的狀態。" });
          return;
        }

        const body = (await response.json()) as ScanStatusResponse;

        if (body.status === "done") {
          updateJob(key, {
            status: "done",
            books: (body.books ?? []).map(reviveBook),
          });
          return;
        }

        if (body.status === "failed") {
          updateJob(key, {
            status: "failed",
            error: body.errorMessage ?? "辨識失敗，請重試。",
          });
          return;
        }
      }
    },
    [updateJob],
  );

  const startRecognition = useCallback(
    async (key: string, scanId: string) => {
      updateJob(key, { status: "processing", scanId, error: undefined });

      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scanId }),
      });

      if (!response.ok) {
        updateJob(key, {
          status: "failed",
          error: await readError(response, "無法開始辨識，請稍後再試。"),
        });
        return;
      }

      await pollScan(key, scanId);
    },
    [pollScan, updateJob],
  );

  const processFile = useCallback(
    async (file: File) => {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      const previewUrl = URL.createObjectURL(file);

      setJobs((previous) => [
        ...previous,
        { key, fileName: file.name, previewUrl, status: "compressing", books: [] },
      ]);

      let prepared: File;
      try {
        prepared = await compressImage(file);
      } catch (error) {
        updateJob(key, {
          status: "failed",
          error:
            error instanceof ImageCompressionError
              ? error.message
              : "無法處理這張圖片，請換一張試試。",
        });
        return;
      }

      updateJob(key, { status: "uploading" });

      const form = new FormData();
      form.append("file", prepared);

      let response: Response;
      try {
        response = await fetch("/api/upload", { method: "POST", body: form });
      } catch {
        updateJob(key, { status: "failed", error: "上傳失敗，請檢查連線後重試。" });
        return;
      }

      if (!response.ok) {
        updateJob(key, {
          status: "failed",
          error: await readError(response, "上傳失敗，請重試。"),
        });
        return;
      }

      const { scanId } = (await response.json()) as { scanId: string };
      await startRecognition(key, scanId);
    },
    [startRecognition, updateJob],
  );

  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;

      for (const file of Array.from(fileList)) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          setJobs((previous) => [
            ...previous,
            {
              key: `${file.name}-${Date.now()}-${Math.random()}`,
              fileName: file.name,
              previewUrl: "",
              status: "failed",
              error: "只接受 JPEG、PNG、WebP 或 HEIC 圖片。",
              books: [],
            },
          ]);
          continue;
        }

        if (file.size > MAX_FILE_BYTES) {
          setJobs((previous) => [
            ...previous,
            {
              key: `${file.name}-${Date.now()}-${Math.random()}`,
              fileName: file.name,
              previewUrl: "",
              status: "failed",
              error: "單張圖片不能超過 10MB。",
              books: [],
            },
          ]);
          continue;
        }

        void processFile(file);
      }
    },
    [processFile],
  );

  function retry(job: Job) {
    if (!job.scanId) return;
    void startRecognition(job.key, job.scanId);
  }

  function dismiss(job: Job) {
    if (job.previewUrl) URL.revokeObjectURL(job.previewUrl);
    setJobs((previous) => previous.filter((item) => item.key !== job.key));
  }

  const reviewable = jobs.filter((job) => job.status === "done" && job.books.length > 0);

  return (
    <div className="space-y-6">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center transition-colors",
          dragging && "border-primary bg-accent",
        )}
      >
        <Camera className="text-muted-foreground size-8" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium">把書架照片拖進來，或選擇檔案</p>
          <p className="text-muted-foreground text-sm text-pretty">
            一次可以選多張。支援 JPEG、PNG、WebP、HEIC，單張最大 10MB。
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => inputRef.current?.click()}>
            <Upload aria-hidden />
            選擇照片
          </Button>
          <Button type="button" variant="outline" asChild>
            <label>
              <Camera aria-hidden />
              直接拍照
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                capture="environment"
                className="sr-only"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="sr-only"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {jobs.length > 0 ? (
        <ul className="space-y-3" aria-label="上傳進度">
          {jobs.map((job) => (
            <li key={job.key}>
              <Card className="py-4">
                <CardContent className="flex items-start gap-3">
                  {job.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={job.previewUrl}
                      alt=""
                      className="bg-muted size-16 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="bg-muted size-16 shrink-0 rounded-md" />
                  )}

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{job.fileName}</p>
                      <span className="text-muted-foreground ml-auto flex shrink-0 items-center gap-1 text-xs">
                        {job.status === "done" ? (
                          <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />
                        ) : job.status === "failed" ? (
                          <AlertTriangle className="text-destructive size-3.5" aria-hidden />
                        ) : (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        )}
                        {STATUS_LABELS[job.status]}
                      </span>
                    </div>

                    <Progress
                      value={STATUS_PROGRESS[job.status]}
                      className={cn(job.status === "failed" && "bg-destructive/20")}
                    />

                    {job.status === "done" ? (
                      <p className="text-muted-foreground text-xs">
                        {job.books.length > 0
                          ? `辨識出 ${job.books.length} 本書，請在下方確認。`
                          : "這張照片裡沒有辨識到書籍，換個角度或更近一點再拍一次試試。"}
                      </p>
                    ) : null}

                    {job.error ? <p className="text-destructive text-xs">{job.error}</p> : null}

                    {job.status === "failed" ? (
                      <div className="flex gap-2 pt-1">
                        {job.scanId ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => retry(job)}
                          >
                            <RotateCw aria-hidden />
                            重試
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => dismiss(job)}
                        >
                          <X aria-hidden />
                          移除
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {reviewable.map((job) => (
        <ReviewList
          key={job.key}
          scanId={job.scanId as string}
          books={job.books}
          onDone={() => dismiss(job)}
        />
      ))}
    </div>
  );
}
