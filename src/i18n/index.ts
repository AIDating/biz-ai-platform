import { cookies } from "next/headers";
import { en } from "@/i18n/en";
import { ro, type Dictionary } from "@/i18n/ro";

export type Locale = "ro" | "en";

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  return jar.get("locale")?.value === "en" ? "en" : "ro";
}

export async function getDictionary(): Promise<Dictionary> {
  const locale = await getLocale();
  return locale === "en" ? en : ro;
}

export function dictionaryFor(locale: Locale): Dictionary {
  return locale === "en" ? en : ro;
}
