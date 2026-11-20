import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHANNELS, FUTURE_CHANNELS } from "@/lib/channels";
import { en } from "@/i18n/en";
import { ro } from "@/i18n/ro";
import { decryptSecret } from "@/lib/secret-crypto";
import type { TenantClient } from "@/lib/tenant-db";

type IntegrationRow = {
  id: string;
  tenantId: string;
  channel: string;
  enabled: boolean;
  configJson: string;
};

type ProposalRow = {
  id: string;
  tenantId: string;
  channel: string;
  title: string;
  status: string;
  body: string;
};

const memory = vi.hoisted(() => {
  const integrations: IntegrationRow[] = [];
  const proposals: ProposalRow[] = [];
  let seq = 0;
  const db = {
    integration: {
      async findFirst(args?: { where?: { channel?: string; id?: string } }) {
        const where = args?.where ?? {};
        return (
          integrations.find((row) => {
            if (where.channel && row.channel !== where.channel) return false;
            if (where.id && row.id !== where.id) return false;
            return true;
          }) ?? null
        );
      },
      async findMany(args?: { where?: { channel?: { in?: string[] } } }) {
        const allowed = args?.where?.channel?.in;
        return integrations.filter((row) => !allowed || allowed.includes(row.channel));
      },
      async updateMany(args: {
        where: { id: string };
        data: Partial<Pick<IntegrationRow, "configJson" | "enabled">>;
      }) {
        const row = integrations.find((item) => item.id === args.where.id);
        if (!row) return { count: 0 };
        if (args.data.configJson !== undefined) row.configJson = args.data.configJson;
        if (args.data.enabled !== undefined) row.enabled = args.data.enabled;
        return { count: 1 };
      },
      async create(args: { data: Omit<IntegrationRow, "id"> }) {
        const row: IntegrationRow = { id: `int-${++seq}`, ...args.data };
        integrations.push(row);
        return row;
      },
    },
    contentProposal: {
      async findMany(args?: { where?: { channel?: { in?: string[] } } }) {
        const allowed = args?.where?.channel?.in;
        return proposals.filter((row) => !allowed || allowed.includes(row.channel));
      },
      async findFirst() {
        return null;
      },
      async create(args: { data: Omit<ProposalRow, "id"> }) {
        const row: ProposalRow = { id: `post-${++seq}`, ...args.data };
        proposals.push(row);
        return row;
      },
    },
    agentProfile: {
      async findFirst() {
        return { timezone: "Europe/Bucharest" };
      },
    },
  };
  return { integrations, proposals, db };
});

vi.mock("@/lib/db", () => ({
  basePrisma: {},
  ensureConstraints: async () => {},
}));

vi.mock("@/lib/tenant-db", () => {
  class TenantScopeError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "TenantScopeError";
    }
  }
  return {
    TenantScopeError,
    tenantDb: () => memory.db,
  };
});

const ENV_KEYS = [
  "SESSION_SECRET",
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "YOUTUBE_CLIENT_ID",
  "YOUTUBE_CLIENT_SECRET",
  "FACEBOOK_CLIENT_ID",
  "FACEBOOK_APP_ID",
  "FACEBOOK_CLIENT_SECRET",
  "FACEBOOK_APP_SECRET",
  "INSTAGRAM_CLIENT_ID",
  "INSTAGRAM_CLIENT_SECRET",
  "TIKTOK_CLIENT_KEY",
  "TIKTOK_CLIENT_ID",
  "TIKTOK_CLIENT_SECRET",
  "APP_URL",
  "NEXT_PUBLIC_APP_URL",
  "VERCEL_URL",
] as const;

const previousEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function client() {
  return memory.db as unknown as TenantClient;
}

function googleAdsRow() {
  return memory.integrations.find((row) => row.channel === "google_ads") ?? null;
}

describe("google ads marketing platform", () => {
  beforeEach(() => {
    memory.integrations.length = 0;
    memory.proposals.length = 0;
    for (const key of ENV_KEYS) {
      previousEnv[key] = process.env[key];
      delete process.env[key];
    }
    process.env.SESSION_SECRET = "test-session-secret-value";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const prior = previousEnv[key];
      if (prior === undefined) delete process.env[key];
      else process.env[key] = prior;
    }
    vi.unstubAllGlobals();
  });

  it("registers google_ads as the fifth marketing platform", async () => {
    const { MARKETING_PLATFORMS, isMarketingPlatform } = await import("@/lib/marketing-oauth");
    expect(MARKETING_PLATFORMS).toEqual(["facebook", "instagram", "tiktok", "youtube", "google_ads"]);
    expect(isMarketingPlatform("google_ads")).toBe(true);
    expect(isMarketingPlatform("google-ads")).toBe(false);
    expect(CHANNELS).toContain("google_ads");
    expect(FUTURE_CHANNELS).toContain("google_ads");
    expect(en.marketing.platforms.google_ads.name).toBe("Google Ads");
    expect(ro.marketing.platforms.google_ads.name).toBe("Google Ads");
    expect(en.marketing.keys.platforms.google_ads.clientSecretLabel).toBe("Client Secret");
    expect(ro.marketing.keys.platforms.google_ads.clientIdLabel).toBe("Client ID");
    expect(ro.marketing.keys.save).toBe("Salvează cheile");
    expect(en.marketing.keys.save).toBe("Save keys");
    expect(ro.marketing.keys.clear).toBe("Șterge cheile salvate");
    expect(en.marketing.history.filterGoogleAds).toBe("Google Ads");
    expect(ro.marketing.history.filterGoogleAds).toBe("Google Ads");
  });

  it("builds the Google authorize URL with the Google Ads scope", async () => {
    const { buildAuthorizeUrl, GOOGLE_ADS_AUTHORIZE_URL, GOOGLE_ADS_OAUTH_SCOPE } = await import(
      "@/lib/marketing-oauth"
    );
    const url = new URL(
      buildAuthorizeUrl("google_ads", "state-value", {
        clientId: "ads-client-id",
        clientSecret: "ads-client-secret",
        source: "tenant",
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(GOOGLE_ADS_AUTHORIZE_URL);
    expect(`${url.origin}${url.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("ads-client-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("state-value");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:43123/api/marketing/oauth/google_ads/callback",
    );
    expect(url.searchParams.get("scope")).toBe(GOOGLE_ADS_OAUTH_SCOPE);
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/adwords");

    const youtube = new URL(
      buildAuthorizeUrl("youtube", "state-value", {
        clientId: "yt-client",
        clientSecret: "yt-secret",
        source: "tenant",
      }),
    );
    expect(youtube.searchParams.get("scope")).not.toContain("adwords");
  });

  it("stores tenant Google Ads keys encrypted and prefers them over env", async () => {
    const { savePlatformOAuthKeys, resolveOAuthCredentials, loadPlatformKeyStates, clearPlatformOAuthKeys } =
      await import("@/lib/marketing-oauth");
    process.env.GOOGLE_ADS_CLIENT_ID = "env-ads-key";
    process.env.GOOGLE_ADS_CLIENT_SECRET = "env-ads-secret";

    const saved = await savePlatformOAuthKeys(client(), "tenant-1", "google_ads", {
      clientId: "tenant-ads-client-id",
      clientSecret: "tenant-ads-client-secret",
    });
    expect(saved).toEqual({ ok: true });

    const row = googleAdsRow();
    expect(row?.enabled).toBe(false);
    expect(row?.configJson).not.toContain("tenant-ads-client-secret");
    expect(row?.configJson).not.toContain("tenant-ads-client-id");
    const stored = JSON.parse(row?.configJson ?? "{}") as {
      oauth: { clientIdEnc: string; clientSecretEnc: string; clientIdLast4: string };
    };
    expect(decryptSecret(stored.oauth.clientIdEnc)).toBe("tenant-ads-client-id");
    expect(decryptSecret(stored.oauth.clientSecretEnc)).toBe("tenant-ads-client-secret");
    expect(stored.oauth.clientIdLast4).toBe("t-id");

    const resolved = await resolveOAuthCredentials("google_ads", client());
    expect(resolved).toEqual({
      clientId: "tenant-ads-client-id",
      clientSecret: "tenant-ads-client-secret",
      source: "tenant",
    });

    const states = await loadPlatformKeyStates(client());
    expect(states.find((item) => item.channel === "google_ads")).toMatchObject({
      hasKeys: true,
      source: "tenant",
      clientIdMasked: "••••t-id",
      connected: false,
    });

    await clearPlatformOAuthKeys(client(), "google_ads");
    const cleared = await resolveOAuthCredentials("google_ads", client());
    expect(cleared).toEqual({
      clientId: "env-ads-key",
      clientSecret: "env-ads-secret",
      source: "env",
    });
    const afterClear = await loadPlatformKeyStates(client());
    expect(afterClear.find((item) => item.channel === "google_ads")).toMatchObject({
      hasKeys: true,
      source: "env",
      clientIdMasked: "••••-key",
      connected: false,
    });
    expect(googleAdsRow()?.configJson ?? "").not.toContain("oauthTokens");
    expect(googleAdsRow()?.enabled).toBe(false);
  });

  it("falls back to GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET only when the tenant has no keys", async () => {
    const { resolveOAuthCredentials, loadPlatformKeyStates, credentialsFromEnv } = await import(
      "@/lib/marketing-oauth"
    );
    expect(await resolveOAuthCredentials("google_ads", client())).toBeNull();
    expect(credentialsFromEnv("google_ads")).toBeNull();
    const empty = await loadPlatformKeyStates(client());
    expect(empty.find((item) => item.channel === "google_ads")).toMatchObject({
      hasKeys: false,
      source: "none",
      clientIdMasked: null,
      connected: false,
    });

    process.env.GOOGLE_ADS_CLIENT_ID = "env-only-client";
    process.env.GOOGLE_ADS_CLIENT_SECRET = "env-only-secret";
    expect(await resolveOAuthCredentials("google_ads", client())).toEqual({
      clientId: "env-only-client",
      clientSecret: "env-only-secret",
      source: "env",
    });
    expect(credentialsFromEnv("google_ads")?.source).toBe("env");

    delete process.env.GOOGLE_ADS_CLIENT_SECRET;
    expect(await resolveOAuthCredentials("google_ads", client())).toBeNull();
    expect(credentialsFromEnv("google_ads")).toBeNull();
  });

  it("exchanges the Google Ads code at oauth2.googleapis.com and stores encrypted tokens", async () => {
    const { savePlatformOAuthKeys, connectGoogleAdsAccount, GOOGLE_ADS_TOKEN_URL } = await import(
      "@/lib/marketing-oauth"
    );
    await savePlatformOAuthKeys(client(), "tenant-1", "google_ads", {
      clientId: "tenant-ads-client-id",
      clientSecret: "tenant-ads-client-secret",
    });

    const calls: Array<{ url: string; body: string }> = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body ?? "") });
      return new Response(
        JSON.stringify({
          access_token: "ya29.google-ads-access",
          refresh_token: "1//google-ads-refresh",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "https://www.googleapis.com/auth/adwords",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const connected = await connectGoogleAdsAccount(client(), "tenant-1", "auth-code-ads", {
      clientId: "tenant-ads-client-id",
      clientSecret: "tenant-ads-client-secret",
      source: "tenant",
    });
    expect(connected).toEqual({ ok: true });
    expect(calls[0]?.url).toBe(GOOGLE_ADS_TOKEN_URL);
    expect(calls[0]?.url).toBe("https://oauth2.googleapis.com/token");
    expect(calls[0]?.body).toContain("grant_type=authorization_code");
    expect(calls[0]?.body).toContain("code=auth-code-ads");
    expect(calls[0]?.body).toContain("client_id=tenant-ads-client-id");
    expect(calls[0]?.body).toContain("client_secret=tenant-ads-client-secret");
    expect(calls[0]?.body).toContain(
      `redirect_uri=${encodeURIComponent("http://127.0.0.1:43123/api/marketing/oauth/google_ads/callback")}`,
    );

    const row = googleAdsRow();
    expect(row?.enabled).toBe(true);
    expect(row?.configJson).not.toContain("ya29.google-ads-access");
    expect(row?.configJson).not.toContain("1//google-ads-refresh");
    expect(row?.configJson).not.toContain("tenant-ads-client-secret");
    const stored = JSON.parse(row?.configJson ?? "{}") as {
      oauthTokens: { accessTokenEnc: string; refreshTokenEnc: string; scope: string };
    };
    expect(decryptSecret(stored.oauthTokens.accessTokenEnc)).toBe("ya29.google-ads-access");
    expect(decryptSecret(stored.oauthTokens.refreshTokenEnc)).toBe("1//google-ads-refresh");
    expect(stored.oauthTokens.scope).toBe("https://www.googleapis.com/auth/adwords");

    const state = (await (await import("@/lib/marketing-oauth")).loadPlatformKeyStates(client())).find(
      (item) => item.channel === "google_ads",
    );
    expect(state).toMatchObject({
      hasKeys: true,
      source: "tenant",
      connected: true,
      clientIdMasked: "••••t-id",
    });
  });

  it("disconnects Google Ads when saved keys change and when Google rejects the code", async () => {
    const { savePlatformOAuthKeys, connectGoogleAdsAccount, loadPlatformKeyStates } = await import(
      "@/lib/marketing-oauth"
    );
    await savePlatformOAuthKeys(client(), "tenant-1", "google_ads", {
      clientId: "tenant-ads-client-id",
      clientSecret: "tenant-ads-client-secret",
    });
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            access_token: "ya29.keep",
            refresh_token: "1//keep",
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    await connectGoogleAdsAccount(client(), "tenant-1", "ok-code", {
      clientId: "tenant-ads-client-id",
      clientSecret: "tenant-ads-client-secret",
      source: "tenant",
    });
    expect(googleAdsRow()?.enabled).toBe(true);

    await savePlatformOAuthKeys(client(), "tenant-1", "google_ads", {
      clientId: "rotated-ads-client-id",
      clientSecret: "rotated-ads-client-secret",
    });
    const rotated = JSON.parse(googleAdsRow()?.configJson ?? "{}") as { oauthTokens?: unknown };
    expect(googleAdsRow()?.enabled).toBe(false);
    expect(rotated.oauthTokens).toBeUndefined();

    vi.stubGlobal("fetch", async () => new Response("denied", { status: 400 }));
    const rejected = await connectGoogleAdsAccount(client(), "tenant-1", "bad-code", {
      clientId: "rotated-ads-client-id",
      clientSecret: "rotated-ads-client-secret",
      source: "tenant",
    });
    expect(rejected).toEqual({ ok: false, reason: "exchange_failed" });
    const state = (await loadPlatformKeyStates(client())).find((item) => item.channel === "google_ads");
    expect(state).toMatchObject({
      connected: false,
      hasKeys: true,
      source: "tenant",
    });
  });

  it("reports google_ads hasKeys and source from list_marketing", async () => {
    const { savePlatformOAuthKeys } = await import("@/lib/marketing-oauth");
    const { executeOwnerTool, OWNER_TOOL_DEFINITIONS } = await import("@/lib/owner-tools");

    const listTool = OWNER_TOOL_DEFINITIONS.find((tool) => tool.function.name === "list_marketing");
    expect(listTool?.function.description).toContain("google_ads");

    await savePlatformOAuthKeys(client(), "tenant-1", "google_ads", {
      clientId: "tenant-ads-client-id",
      clientSecret: "tenant-ads-client-secret",
    });
    const created = await executeOwnerTool("tenant-1", "en", {
      name: "create_marketing_draft",
      arguments: { channel: "google_ads", text: "Promote the spring offer on Google Ads." },
    });
    expect(created.ok).toBe(true);

    const rejected = await executeOwnerTool("tenant-1", "en", {
      name: "create_marketing_draft",
      arguments: { channel: "google-ads", text: "nope" },
    });
    expect(rejected.ok).toBe(false);

    const listed = await executeOwnerTool("tenant-1", "ro", {
      name: "list_marketing",
      arguments: {},
    });
    expect(listed.ok).toBe(true);
    const data = listed.data as {
      platforms: Array<{ channel: string; hasKeys: boolean; source: string; connected: boolean }>;
      posts: Array<{ channel: string; text: string }>;
    };
    expect(data.platforms.map((item) => item.channel)).toEqual([
      "facebook",
      "instagram",
      "tiktok",
      "youtube",
      "google_ads",
    ]);
    expect(data.platforms.find((item) => item.channel === "google_ads")).toEqual({
      channel: "google_ads",
      connected: false,
      accountLabel: null,
      hasKeys: true,
      source: "tenant",
    });
    expect(data.platforms.find((item) => item.channel === "youtube")).toMatchObject({
      hasKeys: false,
      source: "none",
      connected: false,
    });
    expect(data.posts).toEqual([
      expect.objectContaining({
        channel: "google_ads",
        text: "Promote the spring offer on Google Ads.",
      }),
    ]);
  });
});
