type Platform = "facebook" | "instagram" | "tiktok" | "youtube" | "google_ads";

const marks = {
  facebook: FacebookMark,
  instagram: InstagramMark,
  tiktok: TikTokMark,
  youtube: YouTubeMark,
  google_ads: GoogleAdsMark,
} as const;

export function MarketingPlatformMark({ platform }: { platform: Platform }) {
  const Mark = marks[platform];
  const youtube = platform === "youtube";
  return (
    <span
      className={
        youtube
          ? "inline-flex h-9 w-9 shrink-0 items-center justify-center bg-[#e10600] text-white"
          : "inline-flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-white text-[#111]"
      }
      aria-hidden
    >
      <Mark />
    </span>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1z" />
    </svg>
  );
}

function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 7.2A4.8 4.8 0 1 0 12 16.8 4.8 4.8 0 0 0 12 7.2zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2z" />
      <circle cx="17.4" cy="6.6" r="1.1" />
      <path d="M16.7 3H7.3A4.3 4.3 0 0 0 3 7.3v9.4A4.3 4.3 0 0 0 7.3 21h9.4a4.3 4.3 0 0 0 4.3-4.3V7.3A4.3 4.3 0 0 0 16.7 3zm2.6 13.7a2.6 2.6 0 0 1-2.6 2.6H7.3a2.6 2.6 0 0 1-2.6-2.6V7.3A2.6 2.6 0 0 1 7.3 4.7h9.4a2.6 2.6 0 0 1 2.6 2.6v9.4z" />
    </svg>
  );
}

function TikTokMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M19.6 8.3a6.8 6.8 0 0 1-4-1.3v7.2a5.9 5.9 0 1 1-5.1-5.8v3a2.9 2.9 0 1 0 2.1 2.8V2.5h3a3.9 3.9 0 0 0 4 3.8v2z" />
    </svg>
  );
}

function YouTubeMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M22.5 7.2a2.8 2.8 0 0 0-2-2C18.8 4.8 12 4.8 12 4.8s-6.8 0-8.5.4a2.8 2.8 0 0 0-2 2C1.1 8.9 1.1 12 1.1 12s0 3.1.4 4.8a2.8 2.8 0 0 0 2 2c1.7.4 8.5.4 8.5.4s6.8 0 8.5-.4a2.8 2.8 0 0 0 2-2c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8zM9.8 15.5v-7l6.3 3.5-6.3 3.5z" />
    </svg>
  );
}

function GoogleAdsMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#FBBC04" d="M4.8 19.2 11.2 5.4l3 6-4.6 7.8H4.8z" />
      <path fill="#4285F4" d="M12.8 5.4 19.6 19.2h-4.2L11.3 9.4l1.5-4z" />
      <circle cx="7" cy="17.6" r="2.7" fill="#34A853" />
    </svg>
  );
}
