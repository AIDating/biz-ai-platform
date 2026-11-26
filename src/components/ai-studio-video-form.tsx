"use client";

import { useActionState, useState } from "react";
import {
  createVideoJobAction,
  type AiStudioActionState,
} from "@/app/dashboard/ai-studio/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/ro";
import { KLING_ASPECT_RATIOS, KLING_DURATIONS, KLING_RESOLUTIONS } from "@/lib/kling-constants";

const initial: AiStudioActionState = { ok: false };

export function AiStudioVideoForm({
  disabled,
  dict,
}: {
  disabled: boolean;
  dict: Dictionary["aiStudio"]["video"];
}) {
  const [mode, setMode] = useState<"text_to_video" | "image_to_video">("text_to_video");
  const [state, action, pending] = useActionState(createVideoJobAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "text_to_video" ? "brass" : "outline"}
          onClick={() => setMode("text_to_video")}
          disabled={disabled || pending}
        >
          {dict.modeText}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "image_to_video" ? "brass" : "outline"}
          onClick={() => setMode("image_to_video")}
          disabled={disabled || pending}
        >
          {dict.modeImage}
        </Button>
      </div>
      <input type="hidden" name="mode" value={mode} />

      <div className="space-y-1.5">
        <Label htmlFor="ai-studio-prompt">{dict.promptLabel}</Label>
        <Textarea
          id="ai-studio-prompt"
          name="prompt"
          rows={4}
          maxLength={2500}
          placeholder={dict.promptPlaceholder}
          disabled={disabled || pending}
          required
        />
      </div>

      {mode === "image_to_video" ? (
        <div className="space-y-1.5">
          <Label htmlFor="ai-studio-image">{dict.imageLabel}</Label>
          <Input
            id="ai-studio-image"
            name="imageUrl"
            type="url"
            placeholder={dict.imagePlaceholder}
            disabled={disabled || pending}
            required
          />
          <p className="text-[11px] text-muted-foreground">{dict.imageHint}</p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ai-studio-aspect">{dict.aspectLabel}</Label>
          <select
            id="ai-studio-aspect"
            name="aspectRatio"
            className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
            disabled={disabled || pending || mode === "image_to_video"}
            defaultValue="16:9"
          >
            {KLING_ASPECT_RATIOS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {mode === "image_to_video" ? (
            <p className="text-[11px] text-muted-foreground">{dict.aspectImageNote}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-studio-resolution">{dict.resolutionLabel}</Label>
          <select
            id="ai-studio-resolution"
            name="resolution"
            className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
            disabled={disabled || pending}
            defaultValue="720p"
          >
            {KLING_RESOLUTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-studio-duration">{dict.durationLabel}</Label>
          <select
            id="ai-studio-duration"
            name="durationSec"
            className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
            disabled={disabled || pending}
            defaultValue="5"
          >
            {KLING_DURATIONS.map((value) => (
              <option key={value} value={value}>
                {value}s
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.error ? <p className="text-sm text-[#e10600]">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-muted-foreground">{dict.submitted}</p> : null}

      <Button type="submit" variant="brass" disabled={disabled || pending}>
        {pending ? dict.submitting : dict.submit}
      </Button>
    </form>
  );
}
