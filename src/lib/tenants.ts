import { basePrisma } from "@/lib/db";

export async function findTenantByPublicKey(publicKey: string) {
  if (!/^pk_[A-Za-z0-9_-]{6,70}$/.test(publicKey)) return null;
  return basePrisma.tenant.findUnique({
    where: { publicKey },
    select: { id: true, name: true, publicKey: true, slug: true },
  });
}

export function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || "afacere";
}

export async function uniqueSlug(name: string) {
  const base = slugify(name);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const existing = await basePrisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}
