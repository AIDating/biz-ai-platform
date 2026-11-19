"use client";

import { LogoMark } from "@/components/logo";

type Labels = {
  socials: string;
  database: string;
  assistant: string;
  flow: string;
};

const SOCIALS = [
  {
    name: "TikTok",
    href: "https://www.tiktok.com",
    icon: TikTokIcon,
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com",
    icon: FacebookIcon,
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com",
    icon: InstagramIcon,
  },
] as const;

export function NetworkHero({ labels }: { labels: Labels }) {
  return (
    <div className="network-hero relative isolate overflow-hidden border border-[#ececec] bg-[linear-gradient(165deg,#fff_0%,#fff_45%,#fff5f4_100%)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="network-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />

      <p className="relative z-10 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {labels.flow}
      </p>

      <div className="relative z-10 mt-8 grid items-center gap-6 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          <p className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">{labels.socials}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {SOCIALS.map((social, index) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="network-node group flex h-14 w-14 items-center justify-center border border-[#ececec] bg-white text-[#111] transition-colors hover:border-[#E10600] hover:text-[#E10600]"
                  style={{ animationDelay: `${index * 120}ms` }}
                  aria-label={social.name}
                  title={social.name}
                >
                  <Icon className="h-6 w-6" />
                </a>
              );
            })}
          </div>
        </div>

        <FlowArrow className="hidden sm:block" />

        <div className="flex flex-col items-center gap-3">
          <p className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">{labels.database}</p>
          <div className="network-node network-node-core flex h-20 w-20 items-center justify-center border border-[#E10600]/30 bg-white">
            <DatabaseIcon className="h-9 w-9 text-[#E10600]" />
          </div>
        </div>

        <FlowArrow className="hidden sm:block" />

        <div className="flex flex-col items-center gap-3">
          <p className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">{labels.assistant}</p>
          <div className="network-node network-node-assistant relative flex h-20 w-20 items-center justify-center border border-[#111] bg-[#111] text-white">
            <LogoMark className="h-10 w-10 brightness-0 invert" />
            <span className="network-pulse absolute inset-0 border border-[#E10600]" aria-hidden />
          </div>
        </div>
      </div>

      <svg className="pointer-events-none absolute inset-x-8 top-1/2 hidden h-16 -translate-y-1/2 sm:block" aria-hidden>
        <path
          className="network-path"
          d="M40 32 H220 M260 32 H440 M480 32 H640"
          fill="none"
          stroke="#E10600"
          strokeWidth="1.5"
          strokeDasharray="6 8"
          opacity="0.45"
        />
      </svg>
    </div>
  );
}

function FlowArrow({ className = "" }: { className?: string }) {
  return (
    <div className={`network-arrow flex items-center justify-center text-[#E10600] ${className}`} aria-hidden>
      <svg viewBox="0 0 48 16" className="h-4 w-12">
        <path d="M0 8h40M34 2l10 6-10 6" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  );
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <ellipse cx="12" cy="5" rx="8" ry="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M19.6 8.3a6.8 6.8 0 0 1-4-1.3v7.2a5.9 5.9 0 1 1-5.1-5.8v3a2.9 2.9 0 1 0 2.1 2.8V2.5h3a3.9 3.9 0 0 0 4 3.8v2z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 7.2A4.8 4.8 0 1 0 12 16.8 4.8 4.8 0 0 0 12 7.2zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2z" />
      <circle cx="17.5" cy="6.6" r="1.1" />
      <path d="M16.7 3H7.3A4.3 4.3 0 0 0 3 7.3v9.4A4.3 4.3 0 0 0 7.3 21h9.4a4.3 4.3 0 0 0 4.3-4.3V7.3A4.3 4.3 0 0 0 16.7 3zm2.6 13.7a2.6 2.6 0 0 1-2.6 2.6H7.3a2.6 2.6 0 0 1-2.6-2.6V7.3A2.6 2.6 0 0 1 7.3 4.7h9.4a2.6 2.6 0 0 1 2.6 2.6v9.4z" />
    </svg>
  );
}
