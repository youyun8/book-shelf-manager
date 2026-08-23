import { Check, CircleDashed, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PurchaseBadge({
  isPurchased,
  className,
}: {
  isPurchased: boolean;
  className?: string;
}) {
  return (
    <Badge variant={isPurchased ? "success" : "secondary"} className={cn("gap-1", className)}>
      {isPurchased ? <Check aria-hidden /> : <CircleDashed aria-hidden />}
      {isPurchased ? "已購買" : "未購買"}
    </Badge>
  );
}

export function ReviewBadge({ className }: { className?: string }) {
  return (
    <Badge variant="warning" className={cn("gap-1", className)}>
      <TriangleAlert aria-hidden />
      待確認
    </Badge>
  );
}
