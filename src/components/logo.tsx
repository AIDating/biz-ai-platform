import Link from "next/link";

const RED = "#E10600";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="13" y="8" width="11" height="48" fill={RED} />
      <path
        fill={RED}
        fillRule="evenodd"
        d="M20 8h16.5C48.8 8 54 14.6 54 23.4 54 33.4 47.2 39.6 36 39.6H20V8zm9.2 8.4v15.2h6.2c5.2 0 8-2.8 8-7.6s-2.8-7.6-8-7.6h-6.2z"
      />
      <polygon points="26,34 37,34 52,56 39,56" fill={RED} />
      <rect x="7" y="28.6" width="52" height="3.2" rx="1.6" fill={RED} />
    </svg>
  );
}

export function Logo({ href = "/", className = "" }: { href?: string; className?: string; light?: boolean }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 text-[#E10600] ${className}`}>
      <LogoMark className="h-9 w-9 shrink-0" />
      <span className="text-[15px] font-semibold leading-none tracking-[0.26em]">REDLINE</span>
    </Link>
  );
}
