import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: {
    default: "REDLINE",
    template: "%s · REDLINE",
  },
  description: "REDLINE — agent AI pentru afacerile mici: chat pe site, clienți și programări.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${outfit.variable} h-full`}>
      <body className="min-h-full bg-white antialiased">{children}</body>
    </html>
  );
}
