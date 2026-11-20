import "server-only";
import { createHmac, randomBytes } from "node:crypto";

export const MARKETING_PLATFORMS = ["facebook", "instagram", "tiktok"] as const;
export type MarketingPlatform = (typeof MARKETING_PLATFORMS)[number];

export function isMarketingPlatform(value: string): value is MarketingPlatform {
  return (MARKETING_PLATFORMS as readonly string[]).includes(value);
}

type PlatformEnv = {
  clientId: string | undefined;
  clientSecret: string | undefined;
};

/** Read-only: which env vars each platform expects. Never writes env. */
function platformEnv(platform: MarketingPlatform): PlatformEnv {
  switch (platform) {
    case "facebook":
      return {
        clientId: process.env.FACEBOOK_CLIENT_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim(),
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET?.trim() || process.env.FACEBOOK_APP_SECRET?.trim(),
      };
    case "instagram":
      return {
        clientId: process.env.INSTAGRAM_CLIENT_ID?.trim() || process.env.FACEBOOK_CLIENT_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim(),
        clientSecret:
          process.env.INSTAGRAM_CLIENT_SECRET?.trim() ||
          process.env.FACEBOOK_CLIENT_SECRET?.trim() ||
          process.env.FACEBOOK_APP_SECRET?.trim(),
      };
    case "tiktok":
      return {
        clientId: process.env.TIKTOK_CLIENT_KEY?.trim() || process.env.TIKTOK_CLIENT_ID?.trim(),
        clientSecret: process.env.TIKTOK_CLIENT_SECRET?.trim(),
      };
  }
}

export function isOAuthConfigured(platform: MarketingPlatform): boolean {
  const { clientId, clientSecret } = platformEnv(platform);
  return Boolean(clientId && clientSecret);
}

export function oauthConfigStatus(platform: MarketingPlatform): {
  configured: boolean;
  missing: string[];
} {
  const env = platformEnv(platform);
  const missing: string[] = [];
  if (platform === "facebook") {
    if (!env.clientId) missing.push("FACEBOOK_CLIENT_ID (or FACEBOOK_APP_ID)");
    if (!env.clientSecret) missing.push("FACEBOOK_CLIENT_SECRET (or FACEBOOK_APP_SECRET)");
  } else if (platform === "instagram") {
    if (!env.clientId) missing.push("INSTAGRAM_CLIENT_ID (or FACEBOOK_CLIENT_ID / FACEBOOK_APP_ID)");
    if (!env.clientSecret) missing.push("INSTAGRAM_CLIENT_SECRET (or FACEBOOK_CLIENT_SECRET / FACEBOOK_APP_SECRET)");
  } else {
    if (!env.clientId) missing.push("TIKTOK_CLIENT_KEY (or TIKTOK_CLIENT_ID)");
    if (!env.clientSecret) missing.push("TIKTOK_CLIENT_SECRET");
  }
  return { configured: missing.length === 0, missing };
}

function appOrigin() {
  const explicit = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://127.0.0.1:43123";
}

export function oauthCallbackUrl(platform: MarketingPlatform) {
  return `${appOrigin()}/api/marketing/oauth/${platform}/callback`;
}

export function oauthStartPath(platform: MarketingPlatform) {
  return `/api/marketing/oauth/${platform}/start`;
}

function stateSecret() {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length >= 16) return secret;
  return "dev-only-session-secret";
}

export function createOAuthState(payload: { platform: MarketingPlatform; tenantId: string; userId: string }) {
  const nonce = randomBytes(16).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({ ...payload, nonce, exp: Date.now() + 15 * 60 * 1000 }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function parseOAuthState(state: string): { platform: MarketingPlatform; tenantId: string; userId: string } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  if (expected !== sig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      platform: string;
      tenantId: string;
      userId: string;
      exp: number;
    };
    if (!isMarketingPlatform(parsed.platform)) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return { platform: parsed.platform, tenantId: parsed.tenantId, userId: parsed.userId };
  } catch {
    return null;
  }
}

/** Build the provider authorize URL when keys exist. Returns null if not configured. */
export function buildAuthorizeUrl(platform: MarketingPlatform, state: string): string | null {
  const { clientId, clientSecret } = platformEnv(platform);
  if (!clientId || !clientSecret) return null;
  const redirectUri = oauthCallbackUrl(platform);

  if (platform === "facebook") {
    const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "pages_show_list,pages_manage_posts,pages_read_engagement");
    return url.toString();
  }

  if (platform === "instagram") {
    // Instagram Business uses Meta Login with Instagram scopes when Meta app credentials are set.
    const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "instagram_basic,instagram_content_publish,pages_show_list");
    return url.toString();
  }

  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "user.info.basic,video.publish,video.upload");
  return url.toString();
}

export type PlatformConnectionStatus = "connected" | "disconnected" | "not_configured";

export function connectionLabelKey(status: PlatformConnectionStatus) {
  return status;
}
