import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isPlatformAdmin } from "@/lib/admin-access";
import { PLAN_MONTHLY_PENCE } from "@/lib/billing";
import { basePrisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { FUTURE_CHANNELS } from "@/lib/channels";
import { uniqueSlug } from "@/lib/tenants";

const COOKIE = "redline_session";
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  tenantName: string;
  publicKey: string;
};

function sessionSecret() {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be at least 16 characters.");
    }
    return "dev-only-session-secret";
  }
  return secret;
}

function hashToken(token: string) {
  return createHmac("sha256", sessionSecret()).update(token).digest("hex");
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await basePrisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { tenant: true } } },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  const { user } = session;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId ?? "",
    tenantName: user.tenant?.name ?? "",
    publicKey: user.tenant?.publicKey ?? "",
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Pages and server actions. Anonymous users go to login. Owners are sent back to their dashboard. */
export async function requirePlatformAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isPlatformAdmin(user)) redirect("/dashboard");
  return user;
}

export { isPlatformAdmin };

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await basePrisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + FOURTEEN_DAYS),
    },
  });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Secure cookies are dropped on plain http://127.0.0.1. Enable on Vercel/HTTPS.
    secure: process.env.COOKIE_SECURE === "1" || process.env.VERCEL === "1",
    path: "/",
    expires: new Date(Date.now() + FOURTEEN_DAYS),
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await basePrisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(COOKIE);
}

export async function registerBusiness(input: {
  name: string;
  email: string;
  password: string;
  businessName: string;
  greeting: string;
}) {
  const email = input.email.trim().toLowerCase();
  const existing = await basePrisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false as const, error: "email_taken" as const };
  const passwordHash = await hashPassword(input.password);
  const slug = await uniqueSlug(input.businessName);
  const publicKey = `pk_${randomBytes(18).toString("base64url")}`;
  const user = await basePrisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.businessName.trim(),
        slug,
        publicKey,
        subscriptionPlan: "start",
        subscriptionStatus: "trial",
        monthlyPricePence: PLAN_MONTHLY_PENCE.start,
        currency: "GBP",
      },
    });
    const created = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email,
        name: input.name.trim(),
        passwordHash,
        role: "owner",
      },
    });
    await tx.agentProfile.create({
      data: {
        tenantId: tenant.id,
        businessName: input.businessName.trim(),
        greeting: input.greeting,
        description: "",
        tone: "prietenos",
        enabled: true,
      },
    });
    for (const day of [0, 1, 2, 3, 4, 5, 6]) {
      const open = day >= 1 && day <= 5;
      await tx.availabilityRule.create({
        data: {
          tenantId: tenant.id,
          dayOfWeek: day,
          startMin: 9 * 60,
          endMin: 17 * 60,
          enabled: open,
        },
      });
    }
    for (const channel of FUTURE_CHANNELS) {
      await tx.integration.create({
        data: { tenantId: tenant.id, channel, enabled: false, configJson: "{}" },
      });
    }
    return created;
  });
  await createSession(user.id);
  return { ok: true as const };
}

export async function loginWithPassword(email: string, password: string) {
  // NFC so Unicode demo emails (e.g. dentară) match the seeded value even if the
  // browser/OS submits a decomposed (NFD) form.
  const normalized = email.trim().toLowerCase().normalize("NFC");
  const user = await basePrisma.user.findUnique({ where: { email: normalized } });
  if (!user) return { ok: false as const };
  const matches = await verifyPassword(password, user.passwordHash);
  if (!matches) return { ok: false as const };
  await createSession(user.id);
  return { ok: true as const, email: user.email, role: user.role };
}

export function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}
