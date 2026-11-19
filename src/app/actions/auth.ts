"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDictionary, getLocale } from "@/i18n";
import { loginWithPassword, registerBusiness } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { loginSchema, signupSchema } from "@/lib/validators";

export type AuthState = { error: string };

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const dict = await getDictionary();
  const headerList = await headers();
  const ip = clientIp(new Request("http://local", { headers: headerList }));
  if (!rateLimit(`login:${ip}`, 8, 60_000).ok) return { error: dict.auth.rate };

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: dict.auth.invalid };
  const ok = await loginWithPassword(parsed.data.email, parsed.data.password);
  if (!ok) return { error: dict.auth.invalid };
  redirect("/dashboard");
}

export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const dict = await getDictionary();
  const locale = await getLocale();
  const headerList = await headers();
  const ip = clientIp(new Request("http://local", { headers: headerList }));
  if (!rateLimit(`signup:${ip}`, 5, 60_000).ok) return { error: dict.auth.rate };

  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    businessName: formData.get("businessName"),
  });
  if (!parsed.success) return { error: dict.auth.passwordHint };
  const greeting =
    locale === "en"
      ? `Hello, this is the desk at ${parsed.data.businessName}. How can I help?`
      : `Bună! Sunt recepția ${parsed.data.businessName}. Cu ce vă pot ajuta?`;
  const result = await registerBusiness({ ...parsed.data, greeting });
  if (!result.ok) return { error: dict.auth.emailTaken };
  redirect("/dashboard/agent");
}
