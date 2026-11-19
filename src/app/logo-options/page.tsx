import Link from "next/link";
import { Logo, LogoMark, type LogoVariant } from "@/components/logo";

export const instant = false;

const OPTIONS: { id: LogoVariant; name: string; idea: string }[] = [
  {
    id: "cut",
    name: "A — Cut",
    idea: "R solid, tăiat de o singură linie roșie continuă. Clar, dens, ușor de citit mic.",
  },
  {
    id: "signal",
    name: "B — Signal",
    idea: "R desenat dintr-o linie deschisă; linia roșie e singurul accent greu. Mai aerisit.",
  },
  {
    id: "frame",
    name: "C — Frame",
    idea: "R într-un pătrat subțire; linia roșie sparge cadrul de la o margine la alta.",
  },
];

export default function LogoOptionsPage() {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-10">
      <header className="flex items-center justify-between gap-3 border-b pb-6">
        <Logo />
        <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Înapoi
        </Link>
      </header>

      <main className="py-12">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Logo</p>
        <h1 className="mt-3 text-4xl text-balance">Trei variante pentru semnul R</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Spuneți A, B sau C. Până alegeți, în aplicație rulează varianta A (Cut).
        </p>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {OPTIONS.map((option) => (
            <article key={option.id} className="border border-[#ececec] bg-white p-6">
              <p className="text-[11px] font-medium tracking-[0.18em] text-[#E10600]">{option.name}</p>
              <div className="mt-8 flex items-center justify-center border border-dashed border-[#ececec] bg-[#fafafa] py-10">
                <LogoMark className="h-24 w-24" variant={option.id} />
              </div>
              <div className="mt-6 flex items-center gap-3">
                <LogoMark className="h-8 w-8" variant={option.id} />
                <LogoMark className="h-6 w-6" variant={option.id} />
                <span className="text-[13px] font-semibold tracking-[0.26em] text-[#E10600]">REDLINE</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{option.idea}</p>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
