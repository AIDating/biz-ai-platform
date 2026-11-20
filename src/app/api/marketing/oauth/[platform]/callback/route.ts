import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import {
  isMarketingPlatform,
  isOAuthConfigured,
  parseIntegrationConfig,
  parseOAuthState,
  resolveOAuthCredentials,
} from "@/lib/marketing-oauth";
import { tenantDb } from "@/lib/tenant-db";

type Params = { params: Promise<{ platform: string }> };

export async function GET(request: Request, { params }: Params) {
  const user = await requireUser();
  const origin = new URL(request.url).origin;
  const { platform: raw } = await params;

  if (!isMarketingPlatform(raw)) {
    return NextResponse.redirect(new URL("/dashboard/marketing", origin));
  }
  const platform = raw;
  const url = new URL(request.url);
  const dest = new URL("/dashboard/marketing", origin);
  dest.searchParams.set("platform", platform);

  if (url.searchParams.get("error")) {
    dest.searchParams.set("error", "oauth_denied");
    return NextResponse.redirect(dest);
  }

  const db = tenantDb(user.tenantId);
  const credentials = await resolveOAuthCredentials(platform, db);
  if (!isOAuthConfigured(platform, credentials)) {
    dest.searchParams.set("error", "missing_config");
    return NextResponse.redirect(dest);
  }

  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  const parsed = parseOAuthState(state);
  const jar = await cookies();
  const cookieState = jar.get(`oauth_${platform}`)?.value;

  if (!parsed || parsed.platform !== platform || parsed.tenantId !== user.tenantId || state !== cookieState) {
    dest.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(dest);
  }

  if (!code) {
    dest.searchParams.set("error", "missing_code");
    return NextResponse.redirect(dest);
  }

  // Secrets exist (tenant or env), but full token exchange is a later Premium slice.
  // Persist a pending flag only — never invent access tokens.
  const existing = await db.integration.findFirst({ where: { channel: platform } });
  const config = parseIntegrationConfig(existing?.configJson);
  const configJson = JSON.stringify({
    ...config,
    oauthPending: true,
    codeReceivedAt: new Date().toISOString(),
    note: "OAuth code received; token exchange not completed in this build.",
  });
  if (existing) {
    await db.integration.updateMany({
      where: { id: existing.id },
      data: { enabled: false, configJson },
    });
  } else {
    await db.integration.create({
      data: { tenantId: user.tenantId, channel: platform, enabled: false, configJson },
    });
  }

  jar.delete(`oauth_${platform}`);
  dest.searchParams.set("error", "exchange_pending");
  return NextResponse.redirect(dest);
}
