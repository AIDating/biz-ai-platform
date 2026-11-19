/** Brand mark candidates for /logo-options. App logo stays on the live default in logo.tsx. */

export const RED = "#E10600";
export const INK = "#111111";

export type NewLogoVariant = "arc" | "stencil" | "sweep" | "stroke" | "outline" | "kick";
export type LegacyLogoVariant = "cut" | "signal" | "frame";
export type LogoMarkId = NewLogoVariant | LegacyLogoVariant;

/** D — Arc: rounded geometric R; diagonal redline cuts the bowl. */
export function MarkArc({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        fill={RED}
        d="M15 11c0-1.2.8-2 2-2h18.5C47 9 54 16.2 54 26c0 7.4-4.2 13-11.2 15.2L54 55h-9.5L34.2 40H24v15h-9V11zm9 7v15h11.5c5.4 0 8.8-3 8.8-7.5S40.9 18 35.5 18H24z"
      />
      <path d="M10 14l40 40" stroke={RED} strokeWidth="4.2" strokeLinecap="round" />
    </svg>
  );
}

/** E — Stencil: open stencil R; broken underline as the redline. */
export function MarkStencil({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        fill={RED}
        fillRule="evenodd"
        d="M16 8h22c9.5 0 15 5.6 15 14.2 0 6.8-3.5 11.5-9.8 13.2L53 54H40.5L31.2 35.5H27V54h-9.5V8H16zm11 8.5V27h9.8c4.2 0 6.6-2.2 6.6-5.3s-2.4-5.2-6.6-5.2H27zM16 8h2.8v46H16V8zm8.2 0H27v8.5h-2.8V8zm0 19H27V35.5h-2.8V27z"
      />
      <path
        d="M10 58h12M28 58h12M46 58h10"
        stroke={RED}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="0"
      />
    </svg>
  );
}

/** F — Sweep: italic R; redline continues the leg as a long dynamic stroke. */
export function MarkSweep({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        fill={RED}
        d="M12 10h20.5c9.2 0 14.8 5 14.8 13.2 0 6.2-3.4 10.8-9.2 12.4L50 52H38.2L29.5 36.2h-7.2L34 54H21.5L12 36.8V10zm10.2 7.5v11.2h9.4c4.4 0 7-2.3 7-5.6s-2.6-5.6-7-5.6h-9.4z"
        transform="skewX(-8) translate(4 0)"
      />
      <path
        d="M28 38c8 6 18 12 28 14"
        fill="none"
        stroke={RED}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** G — Stroke: single-stroke monogram R; dashed redline under the stem. */
export function MarkStroke({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="none">
      <path
        d="M18 54V12h19c8.5 0 14 5.2 14 13.5S45.5 39 37 39H18M30 39L46 54"
        stroke={RED}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 58h40"
        stroke={RED}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeDasharray="3 7"
      />
    </svg>
  );
}

/** H — Outline: contour R; redline is a partial outer stroke on the right. */
export function MarkOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="none">
      <path
        d="M18 10h20c9 0 14.5 5.4 14.5 14.2 0 6.6-3.6 11.4-10 13L52 54H40L31.5 37.5H27.5V54H18V10z"
        stroke={RED}
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path
        d="M27.5 18.5V29.5H36c3.8 0 6-2 6-5.5s-2.2-5.5-6-5.5h-8.5z"
        stroke={RED}
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path
        d="M48 8c6 8 8 18 8 28s-2 18-8 24"
        stroke={RED}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** I — Kick: block R; the leg kicks out into a long horizontal redline at the baseline. */
export function MarkKick({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        fill={RED}
        d="M14 8h24c8.8 0 14 5.4 14 13.8 0 6.6-3.5 11.2-9.6 12.8L36 34H23.5v-8H34c3.6 0 5.8-2 5.8-5.2S37.6 15.5 34 15.5H23.5V8H14v48h9.5V42H33l14 14H58L40.5 38.5C49.2 36.2 55 28.8 55 21.8 55 11.2 47.2 8 38 8H14z"
      />
      <path d="M33 42h26" stroke={RED} strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}

export function LogoMarkById({ id, className }: { id: LogoMarkId; className?: string }) {
  switch (id) {
    case "arc":
      return <MarkArc className={className} />;
    case "stencil":
      return <MarkStencil className={className} />;
    case "sweep":
      return <MarkSweep className={className} />;
    case "stroke":
      return <MarkStroke className={className} />;
    case "outline":
      return <MarkOutline className={className} />;
    case "kick":
      return <MarkKick className={className} />;
    case "signal":
      return <MarkSignalLegacy className={className} />;
    case "frame":
      return <MarkFrameLegacy className={className} />;
    case "cut":
    default:
      return <MarkCutLegacy className={className} />;
  }
}

/** Wordmark: Red + Line, no space; Red in brand red, Line in ink for contrast. */
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

function MarkCutLegacy({ className }: { className?: string }) {
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

function MarkSignalLegacy({ className }: { className?: string }) {
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

function MarkFrameLegacy({ className }: { className?: string }) {
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
