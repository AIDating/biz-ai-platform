import "server-only";
import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin-access";
import { getCurrentUser, type SessionUser } from "@/lib/auth";

export async function requirePlatformAdminApi(): Promise<
  { user: SessionUser; response: null } | { user: null; response: NextResponse }
> {
  const user = await getCurrentUser();
  const access = authorizeAdmin(user);
  if (!access.ok || !user) {
    const status = access.ok ? 401 : access.status;
    return {
      user: null,
      response: NextResponse.json({ error: status === 401 ? "unauthorized" : "forbidden" }, { status }),
    };
  }
  return { user, response: null };
}
