import Link from "next/link";

export const RED = "#E10600";
export const INK = "#111111";

/** Text-only wordmark: Red (#E10600) + Line (#111), no space, no icon. */
export function RedLineWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline leading-none ${className}`} aria-label="RedLine">
      <span className="font-semibold tracking-tight" style={{ color: RED }}>
        <span className="text-[1.05em]">R</span>
        <span className="text-[0.92em] font-medium">ed</span>
      </span>
      <span className="font-semibold tracking-tight" style={{ color: INK }}>
        <span className="text-[1.05em]">L</span>
        <span className="text-[0.92em] font-medium">ine</span>
      </span>
    </span>
  );
}

export function Logo({
  href = "/",
  className = "",
}: {
  href?: string;
  className?: string;
  light?: boolean;
}) {
  return (
    <Link href={href} className={`inline-flex items-center ${className}`}>
      <RedLineWordmark className="text-[1.35rem]" />
    </Link>
  );
}
