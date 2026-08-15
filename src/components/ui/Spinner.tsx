import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-black/10 border-t-black/50",
        className
      )}
    />
  );
}
