import Link from "next/link";

export const RED = "#E10600";

/** Three candidate marks — pick one and we keep that as the brand default. */
export type LogoVariant = "cut" | "signal" | "frame";

export function LogoMark({
  className,
  variant = "cut",
}: {
  className?: string;
  variant?: LogoVariant;
}) {
  if (variant === "signal") return <MarkSignal className={className} />;
  if (variant === "frame") return <MarkFrame className={className} />;
  return <MarkCut className={className} />;
}

/** A — Cut: solid R with one continuous redline slash through the middle. */
function MarkCut({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        fill={RED}
        d="M14 10h22c9.4 0 15.5 5.2 15.5 13.6 0 6.4-3.6 10.8-9.4 12.5L52 54h-11.2L32.2 36.2H23.5V54H14V10zm9.5 8.2v10.4h12c4.3 0 6.7-2.1 6.7-5.2s-2.4-5.2-6.7-5.2h-12z"
      />
      <rect x="6" y="29.4" width="52" height="4.2" rx="2.1" fill={RED} />
      <rect x="6" y="29.4" width="52" height="4.2" rx="2.1" fill="#fff" opacity="0.35" />
    </svg>
  );
}

/** B — Signal: open monoline R; the redline is the only heavy stroke. */
function MarkSignal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="none">
      <path
        d="M18 12v40M18 12h20.5c8.2 0 13.5 4.6 13.5 12.2S46.7 36.4 38.5 36.4H18"
        stroke={RED}
        strokeWidth="5.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path d="M34 36.4L48 52" stroke={RED} strokeWidth="5.5" strokeLinecap="square" />
      <path d="M8 32h48" stroke={RED} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** C — Frame: R sits in a thin square; the redline breaks the box edge-to-edge. */
function MarkFrame({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="8" y="8" width="48" height="48" fill="none" stroke={RED} strokeWidth="2.5" />
      <path
        fill={RED}
        d="M20 16h16.2c6.8 0 11.2 3.8 11.2 10 0 4.7-2.6 8-7 9.2L48 48h-8.4L32.4 35.4H27.5V48H20V16zm7.5 6.2v7.6h8.2c3 0 4.7-1.5 4.7-3.8s-1.7-3.8-4.7-3.8h-8.2z"
      />
      <rect x="4" y="30" width="56" height="3.5" rx="1.75" fill={RED} />
    </svg>
  );
}

export function Logo({
  href = "/",
  className = "",
  variant = "cut",
}: {
  href?: string;
  className?: string;
  light?: boolean;
  variant?: LogoVariant;
}) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2.5 text-[#E10600] ${className}`}>
      <LogoMark className="h-9 w-9 shrink-0" variant={variant} />
      <span className="text-[15px] font-semibold leading-none tracking-[0.26em]">REDLINE</span>
    </Link>
  );
}
