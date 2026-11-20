import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  buildAuthorizeUrl,
  createOAuthState,
  isMarketingPlatform,
  isOAuthConfigured,
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
  const db = tenantDb(user.tenantId);
  const credentials = await resolveOAuthCredentials(platform, db);

  if (!isOAuthConfigured(platform, credentials) || !credentials) {
    const dest = new URL("/dashboard/marketing", origin);
    dest.searchParams.set("platform", platform);
    dest.searchParams.set("error", "missing_config");
    return NextResponse.redirect(dest);
  }

  const state = createOAuthState({ platform, tenantId: user.tenantId, userId: user.id });
  const authorizeUrl = buildAuthorizeUrl(platform, state, credentials);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(`oauth_${platform}`, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "1" || process.env.VERCEL === "1",
    path: "/",
    maxAge: 15 * 60,
  });
  return response;
}
