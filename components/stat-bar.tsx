import { BookOpen, CircleDashed, ShoppingBag, TriangleAlert } from "lucide-react";

import type { BookFilter, BookStats } from "@/lib/data/books";
import { cn } from "@/lib/utils";

const ITEMS: {
  key: keyof BookStats;
  filter: BookFilter;
  label: string;
  icon: typeof BookOpen;
}[] = [
  { key: "total", filter: "all", label: "總書數", icon: BookOpen },
  { key: "purchased", filter: "purchased", label: "已購買", icon: ShoppingBag },
  { key: "unpurchased", filter: "unpurchased", label: "未購買", icon: CircleDashed },
  { key: "needsReview", filter: "needsReview", label: "待確認", icon: TriangleAlert },
];

/**
 * Library totals. Each tile doubles as a filter shortcut when `onSelect` is
 * given, which is how the home page wires it up.
 */
export function StatBar({
  stats,
  activeFilter,
  onSelect,
  className,
}: {
  stats: BookStats;
  activeFilter?: BookFilter;
  onSelect?: (filter: BookFilter) => void;
  className?: string;
}) {
  return (
    <dl className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", className)}>
      {ITEMS.map(({ key, filter, label, icon: Icon }) => {
        const active = activeFilter === filter;
        const content = (
          <>
            <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Icon className="size-3.5" aria-hidden />
              {label}
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{stats[key]}</dd>
          </>
        );

        const classes = cn(
          "rounded-lg border px-3 py-2.5 text-left transition-colors",
          active ? "border-primary bg-accent" : "bg-card",
          onSelect && "hover:bg-accent focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        );

        if (!onSelect) {
          return (
            <div key={key} data-testid={`stat-${key}`} className={classes}>
              {content}
            </div>
          );
        }

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(filter)}
            aria-pressed={active}
            data-testid={`stat-${key}`}
            className={classes}
          >
            {content}
          </button>
        );
      })}
    </dl>
  );
}
