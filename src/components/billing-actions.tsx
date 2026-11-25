"use client";

import { useState } from "react";

export function BillingActions({ currentPlan, hasCustomer, hasSubscription }: { currentPlan: string; hasCustomer: boolean; hasSubscription: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function go(endpoint: string, plan?: string) {
    setBusy(plan ?? endpoint);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        ...(plan ? { body: JSON.stringify({ plan }) } : {}),
      });
      const data = await response.json();
      if (!response.ok || (!data.url && !data.ok)) throw new Error("Nu am putut iniția sesiunea Stripe. Verifică configurarea.");
      if (data.url) window.location.assign(data.url);
      else window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "A apărut o eroare.");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {([
          ["start", "Start", "£49"],
          ["business", "Business", "£99"],
          ["premium", "Premium", "£199"],
        ] as const).map(([id, label, price]) => (
          <div key={id} className="border border-[#e5e5e5] bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#777]">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{price}<span className="text-sm font-normal text-[#777]"> / lună</span></p>
            <button
              className="mt-5 w-full bg-[#e10600] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              disabled={Boolean(busy) || (currentPlan === id && hasSubscription)}
              onClick={() => go(hasSubscription ? "/api/billing/change-plan" : "/api/billing/checkout", id)}
            >
              {busy === id ? "Se procesează…" : currentPlan === id ? "Plan curent" : hasSubscription ? "Schimbă planul" : "Alege planul"}
            </button>
          </div>
        ))}
      </div>
      {hasCustomer ? (
        <button className="border border-[#222] px-4 py-3 text-sm font-semibold disabled:opacity-50" disabled={Boolean(busy)} onClick={() => go("/api/billing/portal")}>
          {busy === "/api/billing/portal" ? "Se deschide…" : "Gestionează abonamentul în Stripe"}
        </button>
      ) : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
