type Bucket = { count: number; reset: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now > current.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true as const, retryAfterSec: 0 };
  }
  if (current.count >= limit) {
    return {
      ok: false as const,
      retryAfterSec: Math.max(1, Math.ceil((current.reset - now) / 1000)),
    };
  }
  current.count += 1;
  return { ok: true as const, retryAfterSec: 0 };
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "local";
  return request.headers.get("x-real-ip") ?? "local";
}
