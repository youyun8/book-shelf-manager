import { BookOpen } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Cover art with a typographic fallback.
 *
 * Covers come from Google Books over plain <img>: they are third-party URLs on
 * hosts we do not control, and routing them through the Next image optimizer
 * would mean either an allow-list per host or paying to proxy every thumbnail.
 */
export function BookCover({
  title,
  coverUrl,
  className,
  sizes = "(min-width: 1024px) 12rem, 33vw",
}: {
  title: string;
  coverUrl?: string | null;
  className?: string;
  sizes?: string;
}) {
  if (!coverUrl) {
    return (
      <div
        className={cn(
          "bg-muted text-muted-foreground flex flex-col items-center justify-center gap-2 p-3 text-center",
          className,
        )}
        role="img"
        aria-label={`${title}（無書封）`}
      >
        <BookOpen className="size-6 opacity-60" aria-hidden />
        <span className="line-clamp-3 text-xs leading-snug font-medium">{title}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={coverUrl}
      alt={`${title} 書封`}
      loading="lazy"
      decoding="async"
      sizes={sizes}
      className={cn("bg-muted object-cover", className)}
    />
  );
}
