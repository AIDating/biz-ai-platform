"use client";

import { useActionState } from "react";
import {
  clearKlingKeyAction,
  saveKlingKeyAction,
  type AiStudioActionState,
} from "@/app/dashboard/ai-studio/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/i18n/ro";

const initial: AiStudioActionState = { ok: false };

export function AiStudioKlingKeys({
  hasKey,
  apiKeyMasked,
  dict,
}: {
  hasKey: boolean;
  apiKeyMasked: string | null;
  dict: Dictionary["aiStudio"]["kling"];
}) {
  const [state, action, pending] = useActionState(saveKlingKeyAction, initial);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{dict.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{dict.subtitle}</p>
        <p className="mt-2 border-l-2 border-[#e10600] px-3 py-1 text-xs text-muted-foreground">{dict.billingNote}</p>
      </div>

      {hasKey ? (
        <p className="text-xs text-muted-foreground">
          {dict.saved.replaceAll("{id}", apiKeyMasked ?? "••••")}
        </p>
      ) : (
        <p className="text-xs text-[#e10600]">{dict.missing}</p>
      )}

      <form action={action} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="kling-api-key">{dict.apiKeyLabel}</Label>
          <Input
            id="kling-api-key"
            name="apiKey"
            type="password"
            autoComplete="new-password"
            placeholder={hasKey ? dict.secretPlaceholderKeep : dict.apiKeyPlaceholder}
          />
          {hasKey ? <p className="text-[11px] text-muted-foreground">{dict.secretHint}</p> : null}
        </div>
        {state.error ? <p className="text-sm text-[#e10600]">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-muted-foreground">{dict.savedOk}</p> : null}
        <Button type="submit" variant="brass" size="sm" disabled={pending}>
          {pending ? dict.saving : dict.save}
        </Button>
      </form>

      {hasKey ? (
        <form action={clearKlingKeyAction}>
          <Button type="submit" variant="outline" size="sm">
            {dict.clear}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
