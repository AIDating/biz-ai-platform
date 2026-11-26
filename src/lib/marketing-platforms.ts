/** Client-safe marketing channel constants (no server-only imports). */

export const MARKETING_PLATFORMS = ["facebook", "instagram", "tiktok", "youtube", "google_ads"] as const;
export type MarketingPlatform = (typeof MARKETING_PLATFORMS)[number];

export function isMarketingPlatform(value: string): value is MarketingPlatform {
  return (MARKETING_PLATFORMS as readonly string[]).includes(value);
}
