import { cn } from "@/lib/cn";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-md border border-input bg-white px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-[#e10600] focus-visible:ring-1 focus-visible:ring-[#e10600]",
        className,
      )}
      {...props}
    />
  );
}
