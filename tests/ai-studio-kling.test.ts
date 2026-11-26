import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/en";
import { ro } from "@/i18n/ro";
import {
  clearKlingApiKey,
  KLING_CHANNEL,
  loadKlingKeyState,
  resolveKlingApiKey,
  saveKlingApiKey,
} from "@/lib/ai-studio-kling";
import {
  createVideoJob,
  decideVideoPublish,
  proposeVideoPublish,
  refreshVideoJob,
} from "@/lib/ai-studio";
import {
  KLING_API_BASE,
  KLING_IMAGE_TO_VIDEO_PATH,
  KLING_TASKS_PATH,
  KLING_TEXT_TO_VIDEO_PATH,
} from "@/lib/kling-constants";
import { decryptSecret } from "@/lib/secret-crypto";
import type { TenantClient } from "@/lib/tenant-db";

type IntegrationRow = {
  id: string;
  tenantId: string;
  channel: string;
  enabled: boolean;
  configJson: string;
};

type VideoJobRow = {
  id: string;
  tenantId: string;
  mode: string;
  prompt: string;
  imageUrl: string;
  aspectRatio: string;
  resolution: string;
  durationSec: number;
  status: string;
  klingTaskId: string;
  videoUrl: string;
  watermarkUrl: string;
  errorMessage: string;
  publishStatus: string;
  publishChannel: string;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  proposalId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProposalRow = {
  id: string;
  tenantId: string;
  channel: string;
  title: string;
  status: string;
  body: string;
  decidedAt: Date | null;
};

const memory = vi.hoisted(() => {
  const integrations: IntegrationRow[] = [];
  const jobs: VideoJobRow[] = [];
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
    aiVideoJob: {
      async create(args: { data: Partial<VideoJobRow> & { tenantId: string; mode: string; prompt: string } }) {
        const now = new Date();
        const row: VideoJobRow = {
          id: `job-${++seq}`,
          tenantId: args.data.tenantId,
          mode: args.data.mode,
          prompt: args.data.prompt,
          imageUrl: args.data.imageUrl ?? "",
          aspectRatio: args.data.aspectRatio ?? "16:9",
          resolution: args.data.resolution ?? "720p",
          durationSec: args.data.durationSec ?? 5,
          status: args.data.status ?? "submitted",
          klingTaskId: args.data.klingTaskId ?? "",
          videoUrl: args.data.videoUrl ?? "",
          watermarkUrl: args.data.watermarkUrl ?? "",
          errorMessage: args.data.errorMessage ?? "",
          publishStatus: args.data.publishStatus ?? "none",
          publishChannel: args.data.publishChannel ?? "",
          scheduledAt: args.data.scheduledAt ?? null,
          publishedAt: args.data.publishedAt ?? null,
          proposalId: args.data.proposalId ?? null,
          createdAt: now,
          updatedAt: now,
        };
        jobs.push(row);
        return row;
      },
      async findFirst(args?: { where?: { id?: string } }) {
        const id = args?.where?.id;
        return jobs.find((row) => !id || row.id === id) ?? null;
      },
      async findMany() {
        return [...jobs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      },
      async updateMany(args: { where: { id: string }; data: Partial<VideoJobRow> }) {
        const row = jobs.find((item) => item.id === args.where.id);
        if (!row) return { count: 0 };
        Object.assign(row, args.data, { updatedAt: new Date() });
        return { count: 1 };
      },
    },
    contentProposal: {
      async create(args: { data: Omit<ProposalRow, "id" | "decidedAt"> & { decidedAt?: Date | null } }) {
        const row: ProposalRow = {
          id: `prop-${++seq}`,
          decidedAt: args.data.decidedAt ?? null,
          ...args.data,
        };
        proposals.push(row);
        return row;
      },
      async findFirst(args?: { where?: { id?: string } }) {
        const id = args?.where?.id;
        return proposals.find((row) => !id || row.id === id) ?? null;
      },
      async updateMany(args: { where: { id: string }; data: Partial<ProposalRow> }) {
        const row = proposals.find((item) => item.id === args.where.id);
        if (!row) return { count: 0 };
        Object.assign(row, args.data);
        return { count: 1 };
      },
    },
  };
  return { integrations, jobs, proposals, db };
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

const ENV_KEYS = ["SESSION_SECRET"] as const;
const previousEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    previousEnv[key] = process.env[key];
  }
  process.env.SESSION_SECRET = "ai-studio-test-secret-value";
  memory.integrations.length = 0;
  memory.jobs.length = 0;
  memory.proposals.length = 0;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  }
  vi.restoreAllMocks();
});

describe("AI Studio Kling keys", () => {
  it("encrypts the API key and never stores plaintext in configJson", async () => {
    const db = memory.db as unknown as TenantClient;
    const result = await saveKlingApiKey(db, "tenant-a", { apiKey: "kling-secret-key-9876" });
    expect(result).toEqual({ ok: true });

    const row = memory.integrations.find((item) => item.channel === KLING_CHANNEL);
    expect(row?.enabled).toBe(true);
    expect(row?.configJson).not.toContain("kling-secret-key-9876");
    const parsed = JSON.parse(row!.configJson) as { kling: { apiKeyEnc: string; apiKeyLast4: string } };
    expect(parsed.kling.apiKeyLast4).toBe("9876");
    expect(decryptSecret(parsed.kling.apiKeyEnc)).toBe("kling-secret-key-9876");

    const state = await loadKlingKeyState(db);
    expect(state).toMatchObject({ hasKey: true, connected: true, source: "tenant" });
    expect(state.apiKeyMasked).toBe("••••9876");
    expect(await resolveKlingApiKey(db)).toBe("kling-secret-key-9876");
  });

  it("keeps the previous key when the form secret is left blank", async () => {
    const db = memory.db as unknown as TenantClient;
    await saveKlingApiKey(db, "tenant-a", { apiKey: "first-key-aaaa" });
    await saveKlingApiKey(db, "tenant-a", { apiKey: "   " });
    expect(await resolveKlingApiKey(db)).toBe("first-key-aaaa");
  });

  it("clears the tenant key and disables the integration", async () => {
    const db = memory.db as unknown as TenantClient;
    await saveKlingApiKey(db, "tenant-a", { apiKey: "to-clear-1111" });
    await clearKlingApiKey(db);
    expect(await resolveKlingApiKey(db)).toBeNull();
    const state = await loadKlingKeyState(db);
    expect(state.hasKey).toBe(false);
    expect(state.connected).toBe(false);
    expect(memory.integrations[0]?.enabled).toBe(false);
  });
});

describe("AI Studio video + publish", () => {
  it("creates a text-to-video job via documented Kling endpoint", async () => {
    const db = memory.db as unknown as TenantClient;
    await saveKlingApiKey(db, "tenant-a", { apiKey: "kling-key" });

    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(url).toBe(`${KLING_API_BASE}${KLING_TEXT_TO_VIDEO_PATH}`);
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer kling-key");
      const body = JSON.parse(String(init?.body)) as {
        prompt: string;
        settings: { aspect_ratio: string; resolution: string; duration: number };
      };
      expect(body.prompt).toBe("A red neon salon window at dusk");
      expect(body.settings).toMatchObject({
        aspect_ratio: "9:16",
        resolution: "1080p",
        duration: 10,
      });
      return new Response(
        JSON.stringify({
          code: 0,
          data: { id: "kling-task-1", status: "submitted" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const result = await createVideoJob(
      db,
      "tenant-a",
      {
        mode: "text_to_video",
        prompt: "A red neon salon window at dusk",
        aspectRatio: "9:16",
        resolution: "1080p",
        durationSec: 10,
      },
      fetchImpl as unknown as typeof fetch,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.klingTaskId).toBe("kling-task-1");
    expect(memory.jobs[0]?.klingTaskId).toBe("kling-task-1");
    expect(memory.jobs[0]?.status).toBe("submitted");
  });

  it("creates an image-to-video job via documented Kling endpoint", async () => {
    const db = memory.db as unknown as TenantClient;
    await saveKlingApiKey(db, "tenant-a", { apiKey: "kling-key" });

    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(`${KLING_API_BASE}${KLING_IMAGE_TO_VIDEO_PATH}`);
      const body = JSON.parse(String(init?.body)) as {
        contents: Array<{ type: string; text?: string; url?: string }>;
      };
      expect(body.contents).toEqual([
        { type: "prompt", text: "Camera slowly pushes in" },
        { type: "first_frame", url: "https://cdn.example.com/frame.jpg" },
      ]);
      return new Response(
        JSON.stringify({ code: 0, data: { id: "kling-img-1", status: "processing" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const result = await createVideoJob(
      db,
      "tenant-a",
      {
        mode: "image_to_video",
        prompt: "Camera slowly pushes in",
        imageUrl: "https://cdn.example.com/frame.jpg",
      },
      fetchImpl as unknown as typeof fetch,
    );
    expect(result.ok).toBe(true);
    expect(memory.jobs[0]?.mode).toBe("image_to_video");
  });

  it("refreshes job status and stores the video URL", async () => {
    const db = memory.db as unknown as TenantClient;
    await saveKlingApiKey(db, "tenant-a", { apiKey: "kling-key" });
    const job = await memory.db.aiVideoJob.create({
      data: {
        tenantId: "tenant-a",
        mode: "text_to_video",
        prompt: "test",
        status: "processing",
        klingTaskId: "task-42",
      },
    });

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain(`${KLING_API_BASE}${KLING_TASKS_PATH}?task_ids=task-42`);
      return new Response(
        JSON.stringify({
          code: 0,
          data: [
            {
              id: "task-42",
              status: "succeeded",
              outputs: [{ type: "video", url: "https://cdn.kling.example/out.mp4" }],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const result = await refreshVideoJob(db, job.id, fetchImpl as unknown as typeof fetch);
    expect(result.ok).toBe(true);
    expect(memory.jobs[0]?.status).toBe("succeeded");
    expect(memory.jobs[0]?.videoUrl).toBe("https://cdn.kling.example/out.mp4");
  });

  it("supports propose → approve scheduled social publish after generation", async () => {
    const db = memory.db as unknown as TenantClient;
    const job = await memory.db.aiVideoJob.create({
      data: {
        tenantId: "tenant-a",
        mode: "text_to_video",
        prompt: "Salon reel",
        status: "succeeded",
        videoUrl: "https://cdn.kling.example/out.mp4",
      },
    });

    const proposed = await proposeVideoPublish(db, "tenant-a", {
      jobId: job.id,
      channel: "instagram",
      caption: "New look this week",
    });
    expect(proposed.ok).toBe(true);
    expect(memory.jobs[0]?.publishStatus).toBe("pending_approval");
    expect(memory.proposals[0]?.channel).toBe("instagram");
    expect(memory.proposals[0]?.status).toBe("pending_approval");

    const when = new Date(Date.now() + 3_600_000).toISOString();
    const decided = await decideVideoPublish(db, {
      jobId: job.id,
      decision: "approve",
      scheduleMode: "scheduled",
      scheduledAt: when,
    });
    expect(decided.ok).toBe(true);
    expect(memory.jobs[0]?.publishStatus).toBe("scheduled");
    expect(memory.proposals[0]?.status).toBe("scheduled");
  });

  it("refuses generation without a tenant Kling key", async () => {
    const db = memory.db as unknown as TenantClient;
    const result = await createVideoJob(db, "tenant-a", {
      mode: "text_to_video",
      prompt: "no key",
    });
    expect(result).toEqual({ ok: false, reason: "missing_key" });
    expect(memory.jobs).toHaveLength(0);
  });
});

describe("AI Studio i18n + nav copy", () => {
  it("exposes matching RO/EN AI Studio dictionaries", () => {
    expect(ro.nav.aiStudio).toBe("AI Studio");
    expect(en.nav.aiStudio).toBe("AI Studio");
    expect(ro.aiStudio.kling.billingNote).toContain("RedLine");
    expect(en.aiStudio.kling.billingNote).toContain("RedLine");
    expect(ro.aiStudio.stubs.imagesTitle).toBeTruthy();
    expect(en.aiStudio.stubs.contentTitle).toBeTruthy();
  });
});
