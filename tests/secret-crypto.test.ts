import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskSecretHint } from "@/lib/secret-crypto";

describe("secret-crypto", () => {
  const previous = process.env.SESSION_SECRET;

  afterEach(() => {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  });

  it("round-trips AES-256-GCM payloads", () => {
    process.env.SESSION_SECRET = "test-session-secret-value";
    const sealed = encryptSecret("facebook-app-secret-value");
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(decryptSecret(sealed)).toBe("facebook-app-secret-value");
  });

  it("rejects tampered ciphertext", () => {
    process.env.SESSION_SECRET = "test-session-secret-value";
    const sealed = encryptSecret("tiktok-client-secret");
    const parts = sealed.split(":");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(decryptSecret(parts.join(":"))).toBeNull();
  });

  it("masks identifiers without revealing the full value", () => {
    expect(maskSecretHint("1234567890")).toBe("••••7890");
    expect(maskSecretHint("ab")).toBe("••••");
  });
});
