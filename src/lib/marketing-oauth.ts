import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, maskSecretHint } from "@/lib/secret-crypto";
import type { TenantClient } from "@/lib/tenant-db";

export const MARKETING_PLATFORMS = ["facebook", "instagram", "tiktok"] as const;
export type MarketingPlatform = (typeof MARKETING_PLATFORMS)[number];

export function isMarketingPlatform(value: string): value is MarketingPlatform {
  return (MARKETING_PLATFORMS as readonly string[]).includes(value);
}

export type OAuthCredentials = {
  clientId: string;
  clientSecret: string;
  source: "tenant" | "env";
};

type PlatformEnv = {
  clientId: string | undefined;
  clientSecret: string | undefined;
};

type StoredOAuth = {
  clientIdEnc: string;
  clientSecretEnc: string;
  clientIdLast4: string;
  savedAt: string;
};

export type IntegrationConfig = {
  oauth?: StoredOAuth;
  oauthPending?: boolean;
  codeReceivedAt?: string;
  note?: string;
  accountLabel?: string;
  [key: string]: unknown;
};

export type PlatformKeyPublicState = {
  channel: MarketingPlatform;
  hasKeys: boolean;
  clientIdMasked: string | null;
  source: "tenant" | "env" | "none";
  connected: boolean;
  accountLabel: string | null;
};

/** Read-only env fallback. Never writes env. */
function platformEnv(platform: MarketingPlatform): PlatformEnv {
  switch (platform) {
    case "facebook":
      return {
        clientId: process.env.FACEBOOK_CLIENT_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim(),
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET?.trim() || process.env.FACEBOOK_APP_SECRET?.trim(),
      };
    case "instagram":
      return {
        clientId:
          process.env.INSTAGRAM_CLIENT_ID?.trim() ||
          process.env.FACEBOOK_CLIENT_ID?.trim() ||
          process.env.FACEBOOK_APP_ID?.trim(),
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

export function parseIntegrationConfig(configJson: string | null | undefined): IntegrationConfig {
  if (!configJson) return {};
  try {
    return JSON.parse(configJson) as IntegrationConfig;
  } catch {
    return {};
  }
}

function readTenantCredentials(config: IntegrationConfig): OAuthCredentials | null {
  const oauth = config.oauth;
  if (!oauth?.clientIdEnc || !oauth?.clientSecretEnc) return null;
  const clientId = decryptSecret(oauth.clientIdEnc);
  const clientSecret = decryptSecret(oauth.clientSecretEnc);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, source: "tenant" };
}

export function credentialsFromEnv(platform: MarketingPlatform): OAuthCredentials | null {
  const env = platformEnv(platform);
  if (!env.clientId || !env.clientSecret) return null;
  return { clientId: env.clientId, clientSecret: env.clientSecret, source: "env" };
}

export async function resolveOAuthCredentials(
  platform: MarketingPlatform,
  db: TenantClient,
): Promise<OAuthCredentials | null> {
  const row = await db.integration.findFirst({ where: { channel: platform } });
  const tenant = readTenantCredentials(parseIntegrationConfig(row?.configJson));
  if (tenant) return tenant;
  return credentialsFromEnv(platform);
}

export function isOAuthConfigured(platform: MarketingPlatform, credentials: OAuthCredentials | null): boolean {
  return Boolean(credentials?.clientId && credentials?.clientSecret);
}

/** @deprecated Prefer resolveOAuthCredentials — env-only check for legacy callers. */
export function oauthConfigStatus(platform: MarketingPlatform): {
  configured: boolean;
  missing: string[];
} {
  const env = platformEnv(platform);
  const missing: string[] = [];
  if (!env.clientId) missing.push("Client ID");
  if (!env.clientSecret) missing.push("Client Secret");
  return { configured: missing.length === 0, missing };
}

export async function loadPlatformKeyStates(db: TenantClient): Promise<PlatformKeyPublicState[]> {
  const rows = await db.integration.findMany({
    where: { channel: { in: [...MARKETING_PLATFORMS] } },
  });
  return MARKETING_PLATFORMS.map((channel) => {
    const row = rows.find((item) => item.channel === channel);
    const config = parseIntegrationConfig(row?.configJson);
    const tenant = readTenantCredentials(config);
    const env = credentialsFromEnv(channel);
    const hasKeys = Boolean(tenant || env);
    const source: PlatformKeyPublicState["source"] = tenant ? "tenant" : env ? "env" : "none";
    return {
      channel,
      hasKeys,
      clientIdMasked: tenant
        ? `••••${config.oauth?.clientIdLast4 || ""}`
        : env
          ? maskSecretHint(env.clientId)
          : null,
      source,
      connected: Boolean(row?.enabled),
      accountLabel: typeof config.accountLabel === "string" ? config.accountLabel : null,
    };
  });
}

export async function savePlatformOAuthKeys(
  db: TenantClient,
  tenantId: string,
  platform: MarketingPlatform,
  input: { clientId: string; clientSecret: string },
) {
  const existing = await db.integration.findFirst({ where: { channel: platform } });
  const config = parseIntegrationConfig(existing?.configJson);
  const previous = readTenantCredentials(config);

  const clientId = input.clientId.trim() || previous?.clientId || "";
  const clientSecret = input.clientSecret.trim() || previous?.clientSecret || "";
  if (!clientId || !clientSecret) {
    return { ok: false as const, reason: "required" as const };
  }

  const next: IntegrationConfig = {
    ...config,
    oauth: {
      clientIdEnc: encryptSecret(clientId),
      clientSecretEnc: encryptSecret(clientSecret),
      clientIdLast4: clientId.slice(-4),
      savedAt: new Date().toISOString(),
    },
  };
  const configJson = JSON.stringify(next);

  if (existing) {
    await db.integration.updateMany({
      where: { id: existing.id },
      data: { configJson },
    });
  } else {
    await db.integration.create({
      data: { tenantId, channel: platform, enabled: false, configJson },
    });
  }
  return { ok: true as const };
}

export async function clearPlatformOAuthKeys(db: TenantClient, platform: MarketingPlatform) {
  const existing = await db.integration.findFirst({ where: { channel: platform } });
  if (!existing) return;
  const config = parseIntegrationConfig(existing.configJson);
  delete config.oauth;
  await db.integration.updateMany({
    where: { id: existing.id },
    data: { configJson: JSON.stringify(config), enabled: false },
  });
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

export function buildAuthorizeUrl(
  platform: MarketingPlatform,
  state: string,
  credentials: OAuthCredentials,
): string {
  const redirectUri = oauthCallbackUrl(platform);
  const { clientId } = credentials;

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
