"use client";

import { useActionState } from "react";
import { saveMarketingBriefAction, type MarketingActionState } from "@/app/dashboard/marketing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/ro";

const initial: MarketingActionState = { ok: false };

export function MarketingBriefForm({
  dict,
  initialPromote,
  initialBudget,
  initialStyle,
}: {
  dict: Dictionary["marketing"]["brief"];
  initialPromote: string;
  initialBudget: string;
  initialStyle: string;
}) {
  const [state, action, pending] = useActionState(saveMarketingBriefAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="promote">{dict.promoteLabel}</Label>
        <Textarea
          id="promote"
          name="promote"
          required
          defaultValue={initialPromote}
          placeholder={dict.promotePlaceholder}
        />
        <p className="text-xs text-muted-foreground">{dict.promoteHint}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="budget">{dict.budgetLabel}</Label>
        <Input
          id="budget"
          name="budget"
          required
          defaultValue={initialBudget}
          placeholder={dict.budgetPlaceholder}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="style">{dict.styleLabel}</Label>
        <Textarea
          id="style"
          name="style"
          required
          defaultValue={initialStyle}
          placeholder={dict.stylePlaceholder}
        />
        <p className="text-xs text-muted-foreground">{dict.styleHint}</p>
      </div>
      {state.error ? <p className="text-sm text-[#e10600]">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-muted-foreground">{dict.saved}</p> : null}
      <Button type="submit" variant="brass" disabled={pending}>
        {pending ? dict.saving : dict.submit}
      </Button>
    </form>
  );
}
