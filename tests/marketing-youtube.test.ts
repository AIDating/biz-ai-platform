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

function youtubeRow() {
  return memory.integrations.find((row) => row.channel === "youtube") ?? null;
}

describe("youtube marketing platform", () => {
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

  it("registers youtube as the fourth marketing platform", async () => {
    const { MARKETING_PLATFORMS, isMarketingPlatform } = await import("@/lib/marketing-oauth");
    expect(MARKETING_PLATFORMS).toEqual(["facebook", "instagram", "tiktok", "youtube"]);
    expect(isMarketingPlatform("youtube")).toBe(true);
    expect(isMarketingPlatform("linkedin")).toBe(false);
    expect(CHANNELS).toContain("youtube");
    expect(FUTURE_CHANNELS).toContain("youtube");
    expect(en.marketing.platforms.youtube.name).toBe("YouTube");
    expect(ro.marketing.platforms.youtube.name).toBe("YouTube");
    expect(en.marketing.keys.platforms.youtube.clientSecretLabel).toBe("Client Secret");
    expect(ro.marketing.keys.save).toBe("Salvează cheile");
    expect(en.marketing.keys.save).toBe("Save keys");
    expect(ro.marketing.history.filterYoutube).toBe("YouTube");
  });

  it("builds the Google authorize URL with YouTube scopes", async () => {
    const { buildAuthorizeUrl } = await import("@/lib/marketing-oauth");
    const url = new URL(
      buildAuthorizeUrl("youtube", "state-value", {
        clientId: "yt-client-id",
        clientSecret: "yt-client-secret",
        source: "tenant",
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("yt-client-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:43123/api/marketing/oauth/youtube/callback",
    );
    const scope = url.searchParams.get("scope") ?? "";
    expect(scope).toContain("https://www.googleapis.com/auth/youtube.upload");
    expect(scope).toContain("https://www.googleapis.com/auth/youtube.readonly");

    const facebook = new URL(
      buildAuthorizeUrl("facebook", "state-value", {
        clientId: "fb-app",
        clientSecret: "fb-secret",
        source: "tenant",
      }),
    );
    expect(facebook.hostname).toBe("www.facebook.com");
  });

  it("stores tenant YouTube keys encrypted and prefers them over env", async () => {
    const { savePlatformOAuthKeys, resolveOAuthCredentials, loadPlatformKeyStates, clearPlatformOAuthKeys } =
      await import("@/lib/marketing-oauth");
    process.env.YOUTUBE_CLIENT_ID = "env-youtube-key";
    process.env.YOUTUBE_CLIENT_SECRET = "env-youtube-secret";

    const saved = await savePlatformOAuthKeys(client(), "tenant-1", "youtube", {
      clientId: "tenant-yt-client-id",
      clientSecret: "tenant-yt-client-secret",
    });
    expect(saved).toEqual({ ok: true });

    const row = youtubeRow();
    expect(row?.enabled).toBe(false);
    expect(row?.configJson).not.toContain("tenant-yt-client-secret");
    const stored = JSON.parse(row?.configJson ?? "{}") as {
      oauth: { clientIdEnc: string; clientSecretEnc: string; clientIdLast4: string };
    };
    expect(decryptSecret(stored.oauth.clientIdEnc)).toBe("tenant-yt-client-id");
    expect(decryptSecret(stored.oauth.clientSecretEnc)).toBe("tenant-yt-client-secret");
    expect(stored.oauth.clientIdLast4).toBe("t-id");

    const resolved = await resolveOAuthCredentials("youtube", client());
    expect(resolved).toEqual({
      clientId: "tenant-yt-client-id",
      clientSecret: "tenant-yt-client-secret",
      source: "tenant",
    });

    const states = await loadPlatformKeyStates(client());
    expect(states.find((item) => item.channel === "youtube")).toMatchObject({
      hasKeys: true,
      source: "tenant",
      clientIdMasked: "••••t-id",
      connected: false,
    });

    await clearPlatformOAuthKeys(client(), "youtube");
    const cleared = await resolveOAuthCredentials("youtube", client());
    expect(cleared).toEqual({
      clientId: "env-youtube-key",
      clientSecret: "env-youtube-secret",
      source: "env",
    });
    const afterClear = await loadPlatformKeyStates(client());
    expect(afterClear.find((item) => item.channel === "youtube")).toMatchObject({
      hasKeys: true,
      source: "env",
      clientIdMasked: "••••-key",
      connected: false,
    });
    expect(youtubeRow()?.configJson ?? "").not.toContain("oauthTokens");
  });

  it("falls back to YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET only when the tenant has no keys", async () => {
    const { resolveOAuthCredentials, loadPlatformKeyStates, credentialsFromEnv } = await import(
      "@/lib/marketing-oauth"
    );
    expect(await resolveOAuthCredentials("youtube", client())).toBeNull();
    expect(credentialsFromEnv("youtube")).toBeNull();
    const empty = await loadPlatformKeyStates(client());
    expect(empty.find((item) => item.channel === "youtube")).toMatchObject({
      hasKeys: false,
      source: "none",
      clientIdMasked: null,
      connected: false,
    });

    process.env.YOUTUBE_CLIENT_ID = "env-only-client";
    process.env.YOUTUBE_CLIENT_SECRET = "env-only-secret";
    expect(await resolveOAuthCredentials("youtube", client())).toEqual({
      clientId: "env-only-client",
      clientSecret: "env-only-secret",
      source: "env",
    });
  });

  it("exchanges the YouTube code at oauth2.googleapis.com and stores encrypted tokens", async () => {
    const { savePlatformOAuthKeys, connectYouTubeAccount, YOUTUBE_TOKEN_URL } = await import(
      "@/lib/marketing-oauth"
    );
    await savePlatformOAuthKeys(client(), "tenant-1", "youtube", {
      clientId: "tenant-yt-client-id",
      clientSecret: "tenant-yt-client-secret",
    });

    const calls: Array<{ url: string; body: string }> = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body ?? "") });
      return new Response(
        JSON.stringify({
          access_token: "ya29.youtube-access",
          refresh_token: "1//youtube-refresh",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "https://www.googleapis.com/auth/youtube.upload",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const connected = await connectYouTubeAccount(client(), "tenant-1", "auth-code-1", {
      clientId: "tenant-yt-client-id",
      clientSecret: "tenant-yt-client-secret",
      source: "tenant",
    });
    expect(connected).toEqual({ ok: true });
    expect(calls[0]?.url).toBe(YOUTUBE_TOKEN_URL);
    expect(calls[0]?.url).toBe("https://oauth2.googleapis.com/token");
    expect(calls[0]?.body).toContain("grant_type=authorization_code");
    expect(calls[0]?.body).toContain("code=auth-code-1");
    expect(calls[0]?.body).toContain("client_id=tenant-yt-client-id");
    expect(calls[0]?.body).toContain(
      `redirect_uri=${encodeURIComponent("http://127.0.0.1:43123/api/marketing/oauth/youtube/callback")}`,
    );

    const row = youtubeRow();
    expect(row?.enabled).toBe(true);
    expect(row?.configJson).not.toContain("ya29.youtube-access");
    expect(row?.configJson).not.toContain("1//youtube-refresh");
    const stored = JSON.parse(row?.configJson ?? "{}") as {
      oauthTokens: { accessTokenEnc: string; refreshTokenEnc: string };
    };
    expect(decryptSecret(stored.oauthTokens.accessTokenEnc)).toBe("ya29.youtube-access");
    expect(decryptSecret(stored.oauthTokens.refreshTokenEnc)).toBe("1//youtube-refresh");
  });

  it("leaves YouTube disconnected when Google rejects the code", async () => {
    const { connectYouTubeAccount, loadPlatformKeyStates } = await import("@/lib/marketing-oauth");
    vi.stubGlobal("fetch", async () => new Response("denied", { status: 400 }));
    const result = await connectYouTubeAccount(client(), "tenant-1", "bad-code", {
      clientId: "env-client",
      clientSecret: "env-secret",
      source: "env",
    });
    expect(result).toEqual({ ok: false, reason: "exchange_failed" });
    const state = (await loadPlatformKeyStates(client())).find((item) => item.channel === "youtube");
    expect(state).toMatchObject({ connected: false, hasKeys: false, source: "none" });
  });

  it("reports youtube hasKeys and source from list_marketing", async () => {
    const { savePlatformOAuthKeys } = await import("@/lib/marketing-oauth");
    const { executeOwnerTool } = await import("@/lib/owner-tools");

    await savePlatformOAuthKeys(client(), "tenant-1", "youtube", {
      clientId: "tenant-yt-client-id",
      clientSecret: "tenant-yt-client-secret",
    });
    const created = await executeOwnerTool("tenant-1", "en", {
      name: "create_marketing_draft",
      arguments: { channel: "youtube", text: "Publish the spring offer on YouTube." },
    });
    expect(created.ok).toBe(true);

    const rejected = await executeOwnerTool("tenant-1", "en", {
      name: "create_marketing_draft",
      arguments: { channel: "linkedin", text: "nope" },
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
    expect(data.platforms.map((item) => item.channel)).toEqual(["facebook", "instagram", "tiktok", "youtube"]);
    expect(data.platforms.find((item) => item.channel === "youtube")).toEqual({
      channel: "youtube",
      connected: false,
      accountLabel: null,
      hasKeys: true,
      source: "tenant",
    });
    expect(data.platforms.find((item) => item.channel === "facebook")).toMatchObject({
      hasKeys: false,
      source: "none",
      connected: false,
    });
    expect(data.posts).toEqual([
      expect.objectContaining({
        channel: "youtube",
        text: "Publish the spring offer on YouTube.",
      }),
    ]);
  });
});
