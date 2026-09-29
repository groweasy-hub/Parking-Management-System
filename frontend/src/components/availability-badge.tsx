import { AvailabilityStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const CONFIG: Record<AvailabilityStatus, { label: string; classes: string; Icon: typeof CheckCircle2 }> = {
  AVAILABLE: {
    label: "AVAILABLE",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
    Icon: CheckCircle2,
  },
  LIMITED: {
    label: "LIMITED",
    classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
    Icon: AlertTriangle,
  },
  FULL: {
    label: "FULL",
    classes: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
    Icon: XCircle,
  },
};

export function AvailabilityBadge({
  status,
  available,
  size = "md",
}: {
  status: AvailabilityStatus;
  available: number;
  size?: "sm" | "md" | "lg";
}) {
  const { label, classes, Icon } = CONFIG[status];
  const sizeClasses =
    size === "lg" ? "text-lg px-4 py-2 gap-2" : size === "sm" ? "text-xs px-2 py-0.5 gap-1" : "text-sm px-3 py-1 gap-1.5";

  return (
    <span className={cn("inline-flex items-center rounded-full border font-semibold", classes, sizeClasses)}>
      <Icon className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
      {label}
      {" · "}
      {available < 0 ? 0 : available} spot{available === 1 ? "" : "s"}
    </span>
  );
}
