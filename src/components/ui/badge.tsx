import { cn } from "@/lib/cn";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.ComponentProps<"span"> & { tone?: "neutral" | "good" | "warn" | "bad" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase",
        tone === "neutral" && "bg-[#f4f4f4] text-foreground",
        tone === "good" && "bg-white text-foreground ring-1 ring-[#111]",
        tone === "warn" && "bg-white text-[#e10600] ring-1 ring-[#e10600]",
        tone === "bad" && "bg-[#e10600] text-white",
        className,
      )}
      {...props}
    />
  );
}
