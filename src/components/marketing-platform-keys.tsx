"use client";

import { useActionState } from "react";
import {
  clearPlatformKeysAction,
  savePlatformKeysAction,
  type MarketingActionState,
} from "@/app/dashboard/marketing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/i18n/ro";
import type { MarketingPlatform } from "@/lib/marketing-platforms";

const initial: MarketingActionState = { ok: false };

export function MarketingPlatformKeys({
  platform,
  hasKeys,
  clientIdMasked,
  source,
  dict,
}: {
  platform: MarketingPlatform;
  hasKeys: boolean;
  clientIdMasked: string | null;
  source: "tenant" | "env" | "none";
  dict: Dictionary["marketing"]["keys"];
}) {
  const [state, action, pending] = useActionState(savePlatformKeysAction, initial);
  const platformCopy = dict.platforms[platform];

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div>
        <p className="text-sm font-medium">{dict.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{dict.subtitle}</p>
      </div>

      {hasKeys ? (
        <p className="text-xs text-muted-foreground">
          {source === "tenant"
            ? dict.savedTenant.replaceAll("{id}", clientIdMasked ?? "••••")
            : dict.savedEnv.replaceAll("{id}", clientIdMasked ?? "••••")}
        </p>
      ) : (
        <p className="text-xs text-[#e10600]">{dict.missing}</p>
      )}

      <form action={action} className="space-y-3">
        <input type="hidden" name="platform" value={platform} />
        <div className="space-y-1.5">
          <Label htmlFor={`${platform}-client-id`}>{platformCopy.clientIdLabel}</Label>
          <Input
            id={`${platform}-client-id`}
            name="clientId"
            autoComplete="off"
            placeholder={hasKeys ? clientIdMasked ?? "••••" : platformCopy.clientIdPlaceholder}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${platform}-client-secret`}>{platformCopy.clientSecretLabel}</Label>
          <Input
            id={`${platform}-client-secret`}
            name="clientSecret"
            type="password"
            autoComplete="new-password"
            placeholder={hasKeys ? dict.secretPlaceholderKeep : platformCopy.clientSecretPlaceholder}
          />
          {hasKeys ? <p className="text-[11px] text-muted-foreground">{dict.secretHint}</p> : null}
        </div>
        {state.error ? <p className="text-sm text-[#e10600]">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-muted-foreground">{dict.saved}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="brass" size="sm" disabled={pending}>
            {pending ? dict.saving : dict.save}
          </Button>
        </div>
      </form>

      {source === "tenant" ? (
        <form action={clearPlatformKeysAction}>
          <input type="hidden" name="platform" value={platform} />
          <Button type="submit" variant="outline" size="sm">
            {dict.clear}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
