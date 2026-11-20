export type AdminActor = {
  role: string;
  email: string;
};

export type AdminAccess = { ok: true } | { ok: false; status: 401 | 403 };

/**
 * Comma-separated allow-list. Missing, empty, or blank values grant nobody.
 * The variable is optional: the app builds and runs when it is unset.
 */
export function parsePlatformAdminEmails(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part.length > 0),
  );
}

/**
 * Platform admins are users with role `admin`.
 * `PLATFORM_ADMIN_EMAILS` is a fallback for an owner email that should also be staff.
 */
export function isPlatformAdmin(
  user: AdminActor,
  adminEmails: string | undefined = process.env.PLATFORM_ADMIN_EMAILS,
): boolean {
  if (user.role === "admin") return true;
  return parsePlatformAdminEmails(adminEmails).has(user.email.trim().toLowerCase());
}

/** Anonymous callers are 401. Signed-in non-admins are 403. */
export function authorizeAdmin(
  user: AdminActor | null,
  adminEmails: string | undefined = process.env.PLATFORM_ADMIN_EMAILS,
): AdminAccess {
  if (!user) return { ok: false, status: 401 };
  if (!isPlatformAdmin(user, adminEmails)) return { ok: false, status: 403 };
  return { ok: true };
}
