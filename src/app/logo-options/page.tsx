import Link from "next/link";
import { Logo } from "@/components/logo";
import {
  LogoMarkById,
  RedLineWordmark,
  type LegacyLogoVariant,
  type NewLogoVariant,
} from "@/components/logo-marks";

export const instant = false;

const NEW_OPTIONS: { id: NewLogoVariant; name: string; idea: string }[] = [
  {
    id: "arc",
    name: "D — Arc",
    idea: "R geometric rotunjit; linia e o diagonală care taie bolul, nu o bară prin mijloc.",
  },
  {
    id: "stencil",
    name: "E — Stencil",
    idea: "R tip stencil (goluri în stem); linia e o sublinie întreruptă sub literă.",
  },
  {
    id: "sweep",
    name: "F — Sweep",
    idea: "R italic, dinamic; linia continuă piciorul literei într-o curbă lungă.",
  },
  {
    id: "stroke",
    name: "G — Stroke",
    idea: "Monogramă dintr-o singură trăsătură; sublinie punctată (dashed) ca redline.",
  },
  {
    id: "outline",
    name: "H — Outline",
    idea: "R doar din contur; linia e un arc exterior pe dreapta, ca un semnal.",
  },
  {
    id: "kick",
    name: "I — Kick",
    idea: "R bloc; piciorul „lovește” într-o linie orizontală lungă pe linia de bază.",
  },
];

const OLD_OPTIONS: { id: LegacyLogoVariant; name: string; idea: string }[] = [
  {
    id: "cut",
    name: "A — Cut (vechi)",
    idea: "R solid cu bară orizontală prin mijloc — respins.",
  },
  {
    id: "signal",
    name: "B — Signal (vechi)",
    idea: "R monoline cu bară orizontală — respins.",
  },
  {
    id: "frame",
    name: "C — Frame (vechi)",
    idea: "R în pătrat cu bară orizontală — respins.",
  },
];

export default function LogoOptionsPage() {
  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-10">
      <header className="flex items-center justify-between gap-3 border-b pb-6">
        <Logo />
        <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Înapoi
        </Link>
      </header>

      <main className="py-12">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Logo</p>
        <h1 className="mt-3 text-4xl text-balance">Variante noi pentru R + RedLine</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Alegeți D–I. Wordmark-ul e „RedLine” (R/L majuscule, ed/ine minuscule; Red roșu, Line negru). Logo-ul
          din aplicație rămâne neschimbat până decideți.
        </p>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {NEW_OPTIONS.map((option) => (
            <article key={option.id} className="border border-[#ececec] bg-white p-6">
              <p className="text-[11px] font-medium tracking-[0.18em] text-[#E10600]">{option.name}</p>
              <div className="mt-8 flex items-center justify-center border border-dashed border-[#ececec] bg-[#fafafa] py-10">
                <LogoMarkById id={option.id} className="h-24 w-24" />
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <LogoMarkById id={option.id} className="h-9 w-9" />
                <LogoMarkById id={option.id} className="h-6 w-6" />
                <RedLineWordmark className="text-[18px]" />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{option.idea}</p>
            </article>
          ))}
        </div>

        <h2 className="mt-20 text-2xl text-muted-foreground">Variante vechi (A–C)</h2>
        <p className="mt-2 text-sm text-muted-foreground">Păstrate doar ca referință — nu mai sunt propuneri active.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {OLD_OPTIONS.map((option) => (
            <article key={option.id} className="border border-dashed border-[#ddd] bg-[#fafafa] p-5 opacity-70">
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground">{option.name}</p>
              <div className="mt-6 flex items-center justify-center py-6">
                <LogoMarkById id={option.id} className="h-16 w-16" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{option.idea}</p>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
