import { setLocale } from "@/app/actions/locale";
import type { Locale } from "@/i18n";

export function LocaleSwitch({ locale, label }: { locale: Locale; label: string }) {
  return (
    <div className="flex items-center gap-4 text-[11px] font-medium tracking-[0.16em]" aria-label={label}>
      <form action={setLocale.bind(null, "ro")}>
        <button
          type="submit"
          className={locale === "ro" ? "border-b-2 border-[#e10600] pb-0.5 text-foreground" : "pb-0.5 text-muted-foreground"}
        >
          RO
        </button>
      </form>
      <form action={setLocale.bind(null, "en")}>
        <button
          type="submit"
          className={locale === "en" ? "border-b-2 border-[#e10600] pb-0.5 text-foreground" : "pb-0.5 text-muted-foreground"}
        >
          EN
        </button>
      </form>
    </div>
  );
}
