import { cn } from "@/lib/cn";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-[#e10600] focus-visible:ring-1 focus-visible:ring-[#e10600]",
        className,
      )}
      {...props}
    />
  );
}
