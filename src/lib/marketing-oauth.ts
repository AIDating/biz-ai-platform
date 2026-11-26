import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import {
  isMarketingPlatform,
  MARKETING_PLATFORMS,
  type MarketingPlatform,
} from "@/lib/marketing-platforms";
import { decryptSecret, encryptSecret, maskSecretHint } from "@/lib/secret-crypto";
import type { TenantClient } from "@/lib/tenant-db";

export {
  isMarketingPlatform,
  MARKETING_PLATFORMS,
  type MarketingPlatform,
} from "@/lib/marketing-platforms";

/** Google OAuth. Env vars are an optional fallback, never required to build or run. */
export const YOUTUBE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const YOUTUBE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const YOUTUBE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

export const GOOGLE_ADS_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_ADS_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_ADS_OAUTH_SCOPE = "https://www.googleapis.com/auth/adwords";

/** Platforms that finish Google's authorization-code exchange and store encrypted tokens. */
function storesOAuthTokens(platform: MarketingPlatform) {
  return platform === "youtube" || platform === "google_ads";
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

type StoredOAuthTokens = {
  accessTokenEnc: string;
  refreshTokenEnc?: string;
  expiresAt?: string;
  tokenType?: string;
  scope?: string;
};

export type IntegrationConfig = {
  oauth?: StoredOAuth;
  oauthTokens?: StoredOAuthTokens;
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
    case "youtube":
      return {
        clientId: process.env.YOUTUBE_CLIENT_ID?.trim(),
        clientSecret: process.env.YOUTUBE_CLIENT_SECRET?.trim(),
      };
    case "google_ads":
      return {
        clientId: process.env.GOOGLE_ADS_CLIENT_ID?.trim(),
        clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET?.trim(),
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

  const secretProvided = input.clientSecret.trim().length > 0;
  const idProvided = input.clientId.trim().length > 0;
  const credentialsChanged =
    !previous ||
    (idProvided && input.clientId.trim() !== previous.clientId) ||
    (secretProvided && input.clientSecret.trim() !== previous.clientSecret);

  const next: IntegrationConfig = {
    ...config,
    oauth: {
      clientIdEnc: encryptSecret(clientId),
      clientSecretEnc: encryptSecret(clientSecret),
      clientIdLast4: clientId.slice(-4),
      savedAt: new Date().toISOString(),
    },
  };
  if (credentialsChanged) delete next.oauthTokens;
  const configJson = JSON.stringify(next);

  if (existing) {
    await db.integration.updateMany({
      where: { id: existing.id },
      data: {
        configJson,
        ...(storesOAuthTokens(platform) && credentialsChanged ? { enabled: false } : {}),
      },
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
  delete config.oauthTokens;
  if (storesOAuthTokens(platform)) {
    delete config.accountLabel;
    delete config.oauthPending;
    delete config.codeReceivedAt;
    delete config.note;
  }
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

  if (platform === "youtube" || platform === "google_ads") {
    const url = new URL(platform === "youtube" ? YOUTUBE_AUTHORIZE_URL : GOOGLE_ADS_AUTHORIZE_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set(
      "scope",
      platform === "youtube" ? YOUTUBE_OAUTH_SCOPES : GOOGLE_ADS_OAUTH_SCOPE,
    );
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
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

export type GoogleOAuthTokenResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string | null;
      expiresIn: number | null;
      scope: string | null;
      tokenType: string | null;
    }
  | { ok: false; reason: "exchange_failed" };

export type YouTubeTokenResult = GoogleOAuthTokenResult;

type GoogleOAuthPlatform = "youtube" | "google_ads";

/** Exchange an authorization code at Google's token endpoint. */
async function exchangeGoogleAuthorizationCode(
  platform: GoogleOAuthPlatform,
  code: string,
  credentials: OAuthCredentials,
): Promise<GoogleOAuthTokenResult> {
  try {
    const body = new URLSearchParams({
      code,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: oauthCallbackUrl(platform),
      grant_type: "authorization_code",
    });
    const response = await fetch(platform === "youtube" ? YOUTUBE_TOKEN_URL : GOOGLE_ADS_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) return { ok: false, reason: "exchange_failed" };
    const payload = (await response.json()) as {
      access_token?: unknown;
      refresh_token?: unknown;
      expires_in?: unknown;
      scope?: unknown;
      token_type?: unknown;
    };
    if (typeof payload.access_token !== "string" || !payload.access_token) {
      return { ok: false, reason: "exchange_failed" };
    }
    return {
      ok: true,
      accessToken: payload.access_token,
      refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : null,
      expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : null,
      scope: typeof payload.scope === "string" ? payload.scope : null,
      tokenType: typeof payload.token_type === "string" ? payload.token_type : null,
    };
  } catch {
    return { ok: false, reason: "exchange_failed" };
  }
}

/** Persist encrypted Google tokens on the tenant integration row. No schema change. */
async function connectGoogleAccount(
  db: TenantClient,
  tenantId: string,
  platform: GoogleOAuthPlatform,
  code: string,
  credentials: OAuthCredentials,
): Promise<{ ok: true } | { ok: false; reason: "exchange_failed" }> {
  const exchanged = await exchangeGoogleAuthorizationCode(platform, code, credentials);
  if (!exchanged.ok) return exchanged;

  const existing = await db.integration.findFirst({ where: { channel: platform } });
  const config = parseIntegrationConfig(existing?.configJson);
  const expiresAt =
    exchanged.expiresIn && exchanged.expiresIn > 0
      ? new Date(Date.now() + exchanged.expiresIn * 1000).toISOString()
      : undefined;
  const next: IntegrationConfig = {
    ...config,
    oauthPending: false,
    oauthTokens: {
      accessTokenEnc: encryptSecret(exchanged.accessToken),
      ...(exchanged.refreshToken ? { refreshTokenEnc: encryptSecret(exchanged.refreshToken) } : {}),
      ...(expiresAt ? { expiresAt } : {}),
      ...(exchanged.tokenType ? { tokenType: exchanged.tokenType } : {}),
      ...(exchanged.scope ? { scope: exchanged.scope } : {}),
    },
  };
  delete next.note;
  delete next.codeReceivedAt;
  const configJson = JSON.stringify(next);

  if (existing) {
    await db.integration.updateMany({
      where: { id: existing.id },
      data: { enabled: true, configJson },
    });
  } else {
    await db.integration.create({
      data: { tenantId, channel: platform, enabled: true, configJson },
    });
  }
  return { ok: true };
}

/** Exchange a YouTube authorization code at Google's token endpoint. */
export function exchangeYouTubeAuthorizationCode(
  code: string,
  credentials: OAuthCredentials,
): Promise<YouTubeTokenResult> {
  return exchangeGoogleAuthorizationCode("youtube", code, credentials);
}

/** Persist encrypted YouTube tokens on the tenant integration row. No schema change. */
export function connectYouTubeAccount(
  db: TenantClient,
  tenantId: string,
  code: string,
  credentials: OAuthCredentials,
) {
  return connectGoogleAccount(db, tenantId, "youtube", code, credentials);
}

/** Exchange a Google Ads authorization code at Google's token endpoint. */
export function exchangeGoogleAdsAuthorizationCode(
  code: string,
  credentials: OAuthCredentials,
): Promise<GoogleOAuthTokenResult> {
  return exchangeGoogleAuthorizationCode("google_ads", code, credentials);
}

/** Persist encrypted Google Ads tokens on the tenant integration row. No schema change. */
export function connectGoogleAdsAccount(
  db: TenantClient,
  tenantId: string,
  code: string,
  credentials: OAuthCredentials,
) {
  return connectGoogleAccount(db, tenantId, "google_ads", code, credentials);
}

export type PlatformConnectionStatus = "connected" | "disconnected" | "not_configured";

export function connectionLabelKey(status: PlatformConnectionStatus) {
  return status;
}
