"use client";

import { useActionState, useState } from "react";
import { decideProposalAction, regenerateDraftAction, type MarketingActionState } from "@/app/dashboard/marketing/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/ro";

const initial: MarketingActionState = { ok: false };

export type ProposalCardModel = {
  id: string;
  channel: string;
  channelLabel: string;
  status: string;
  statusLabel: string;
  text: string;
  revisionNote: string;
  scheduleMode: "now" | "scheduled";
  scheduledAtLocal: string;
  canDecide: boolean;
  canRegenerate: boolean;
};

export function MarketingProposalCard({
  proposal,
  dict,
}: {
  proposal: ProposalCardModel;
  dict: Dictionary["marketing"];
}) {
  const [state, action, pending] = useActionState(decideProposalAction, initial);
  const [scheduleMode, setScheduleMode] = useState<"now" | "scheduled">(proposal.scheduleMode);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-xl">{proposal.channelLabel}</CardTitle>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{proposal.text}</p>
          {proposal.revisionNote ? (
            <p className="mt-2 border-l-2 border-[#e10600] px-3 text-sm text-muted-foreground">
              {dict.proposals.revisionLabel}: {proposal.revisionNote}
            </p>
          ) : null}
        </div>
        <Badge tone={proposal.status === "published" ? "good" : proposal.status === "rejected" ? "bad" : "warn"}>
          {proposal.statusLabel}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {proposal.canDecide ? (
          <form action={action} className="space-y-4">
            <input type="hidden" name="id" value={proposal.id} />
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{dict.schedule.title}</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scheduleMode"
                  value="now"
                  checked={scheduleMode === "now"}
                  onChange={() => setScheduleMode("now")}
                />
                {dict.schedule.now}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scheduleMode"
                  value="scheduled"
                  checked={scheduleMode === "scheduled"}
                  onChange={() => setScheduleMode("scheduled")}
                />
                {dict.schedule.later}
              </label>
              {scheduleMode === "scheduled" ? (
                <div className="space-y-1 pl-6">
                  <Label htmlFor={`when-${proposal.id}`}>{dict.schedule.when}</Label>
                  <Input
                    id={`when-${proposal.id}`}
                    name="scheduledAt"
                    type="datetime-local"
                    defaultValue={proposal.scheduledAtLocal}
                    required={scheduleMode === "scheduled"}
                  />
                </div>
              ) : (
                <input type="hidden" name="scheduledAt" value="" />
              )}
              <p className="text-xs text-muted-foreground">{dict.schedule.hint}</p>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor={`rev-${proposal.id}`}>{dict.proposals.revisionLabel}</Label>
              <Textarea
                id={`rev-${proposal.id}`}
                name="revisionNote"
                placeholder={dict.proposals.revisionPlaceholder}
                className="min-h-20"
              />
            </div>

            {state.error ? <p className="text-sm text-[#e10600]">{state.error}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" name="decision" value="approve" variant="brass" size="sm" disabled={pending}>
                {dict.proposals.approve}
              </Button>
              <Button type="submit" name="decision" value="revise" variant="outline" size="sm" disabled={pending}>
                {dict.proposals.revise}
              </Button>
              <Button type="submit" name="decision" value="reject" variant="destructive" size="sm" disabled={pending}>
                {dict.proposals.reject}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{dict.proposals.approvalGate}</p>
          </form>
        ) : null}

        {proposal.canRegenerate ? (
          <form action={regenerateDraftAction}>
            <input type="hidden" name="id" value={proposal.id} />
            <Button type="submit" variant="outline" size="sm">
              {dict.proposals.regenerate}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
