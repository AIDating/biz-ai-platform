"use client";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-3xl border bg-card p-6">
      <h1 className="font-display text-3xl">Nu am putut încărca pagina.</h1>
      <p className="mt-2 text-sm text-muted-foreground">The page could not be loaded.</p>
      <button type="button" onClick={reset} className="mt-4 underline">
        Reîncearcă / Try again
      </button>
    </div>
  );
}
