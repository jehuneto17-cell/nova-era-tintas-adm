export function StatusDot({ color, filled = true }: { color: string; filled?: boolean }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full border-2"
      style={{ background: filled ? color : "transparent", borderColor: color }}
    />
  );
}
