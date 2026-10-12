import { STATUS_BADGE_TEXT, STATUS_STYLE } from "@/lib/status";
import type { Gender, RequestStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

export function StatusBadge({ status, text, className }: { status: RequestStatus; text?: string | null; className?: string }) {
  const style = STATUS_STYLE[status] ?? { bg: "#D4D8DC", fg: "#6B7280" };
  const label = (text || STATUS_BADGE_TEXT[status] || status).toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] leading-4 font-semibold tracking-wide whitespace-nowrap",
        status === "MENUNGGU" && "animate-pulse-ring",
        className,
      )}
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {label}
    </span>
  );
}

export function GenderPill({ gender }: { gender: Gender | null | undefined }) {
  if (gender !== "L" && gender !== "P") return null;
  const male = gender === "L";
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] leading-4 font-medium"
      style={male ? { backgroundColor: "#CFE0FB", color: "#2B64B5" } : { backgroundColor: "#FBD3E9", color: "#B8357A" }}
    >
      {male ? "Laki-laki" : "Perempuan"}
    </span>
  );
}

export function PlatePill({ plate }: { plate: string }) {
  return (
    <span className="inline-flex rounded-full bg-primary-soft px-2.5 py-0.5 text-[10px] leading-4 font-medium text-[#C43F3C]">
      {plate}
    </span>
  );
}
