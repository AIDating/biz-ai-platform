"use client";

import { useActionState } from "react";
import { loginAction, signupAction, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/i18n/ro";

const empty: AuthState = { error: "" };

export function LoginForm({ dict }: { dict: Dictionary }) {
  const [state, action, pending] = useActionState(loginAction, empty);
  return (
    <form action={action} className="space-y-4">
      <Field label={dict.auth.email}>
        {/* type=text so Unicode demo emails (ă) are accepted; browsers reject many IDN addresses in type=email */}
        <Input name="email" type="text" inputMode="email" autoComplete="email" required />
      </Field>
      <Field label={dict.auth.password}>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? dict.auth.working : dict.auth.submitLogin}
      </Button>
    </form>
  );
}

export function SignupForm({ dict }: { dict: Dictionary }) {
  const [state, action, pending] = useActionState(signupAction, empty);
  return (
    <form action={action} className="space-y-4">
      <Field label={dict.auth.name}>
        <Input name="name" autoComplete="name" required minLength={2} maxLength={80} />
      </Field>
      <Field label={dict.auth.business}>
        <Input name="businessName" required minLength={2} maxLength={80} />
      </Field>
      <Field label={dict.auth.email}>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label={dict.auth.password} hint={dict.auth.passwordHint}>
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? dict.auth.working : dict.auth.submitSignup}
      </Button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
