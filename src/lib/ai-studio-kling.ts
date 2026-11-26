import "server-only";
import { decryptSecret, encryptSecret, maskSecretHint } from "@/lib/secret-crypto";
import type { TenantClient } from "@/lib/tenant-db";

/** Integration.channel for the tenant's Kling API key. Client pays Kling; RedLine never funds credits. */
export const KLING_CHANNEL = "kling" as const;

export type KlingCredentials = {
  apiKey: string;
  source: "tenant";
};

type StoredKling = {
  apiKeyEnc: string;
  apiKeyLast4: string;
  savedAt: string;
};

export type KlingConfig = {
  kling?: StoredKling;
  note?: string;
  [key: string]: unknown;
};

export type KlingKeyPublicState = {
  hasKey: boolean;
  apiKeyMasked: string | null;
  connected: boolean;
  source: "tenant" | "none";
};

export function parseKlingConfig(configJson: string | null | undefined): KlingConfig {
  if (!configJson) return {};
  try {
    return JSON.parse(configJson) as KlingConfig;
  } catch {
    return {};
  }
}

function readTenantKey(config: KlingConfig): KlingCredentials | null {
  const stored = config.kling;
  if (!stored?.apiKeyEnc) return null;
  const apiKey = decryptSecret(stored.apiKeyEnc);
  if (!apiKey) return null;
  return { apiKey, source: "tenant" };
}

export async function loadKlingKeyState(db: TenantClient): Promise<KlingKeyPublicState> {
  const row = await db.integration.findFirst({ where: { channel: KLING_CHANNEL } });
  const config = parseKlingConfig(row?.configJson);
  const tenant = readTenantKey(config);
  return {
    hasKey: Boolean(tenant),
    apiKeyMasked: tenant ? `••••${config.kling?.apiKeyLast4 || ""}` : null,
    connected: Boolean(row?.enabled && tenant),
    source: tenant ? "tenant" : "none",
  };
}

export async function resolveKlingApiKey(db: TenantClient): Promise<string | null> {
  const row = await db.integration.findFirst({ where: { channel: KLING_CHANNEL } });
  const tenant = readTenantKey(parseKlingConfig(row?.configJson));
  return tenant?.apiKey ?? null;
}

export async function saveKlingApiKey(
  db: TenantClient,
  tenantId: string,
  input: { apiKey: string },
) {
  const existing = await db.integration.findFirst({ where: { channel: KLING_CHANNEL } });
  const config = parseKlingConfig(existing?.configJson);
  const previous = readTenantKey(config);
  const apiKey = input.apiKey.trim() || previous?.apiKey || "";
  if (!apiKey) {
    return { ok: false as const, reason: "required" as const };
  }

  const next: KlingConfig = {
    ...config,
    kling: {
      apiKeyEnc: encryptSecret(apiKey),
      apiKeyLast4: apiKey.slice(-4),
      savedAt: new Date().toISOString(),
    },
  };
  const configJson = JSON.stringify(next);

  if (existing) {
    await db.integration.updateMany({
      where: { id: existing.id },
      data: { configJson, enabled: true },
    });
  } else {
    await db.integration.create({
      data: { tenantId, channel: KLING_CHANNEL, enabled: true, configJson },
    });
  }
  return { ok: true as const };
}

export async function clearKlingApiKey(db: TenantClient) {
  const existing = await db.integration.findFirst({ where: { channel: KLING_CHANNEL } });
  if (!existing) return;
  const config = parseKlingConfig(existing.configJson);
  delete config.kling;
  await db.integration.updateMany({
    where: { id: existing.id },
    data: { configJson: JSON.stringify(config), enabled: false },
  });
}

export function maskKlingHint(apiKey: string): string {
  return maskSecretHint(apiKey);
}
