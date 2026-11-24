"use client";

import { useActionState } from "react";
import { Button, Notice } from "@/components/ui";
import { acceptInviteAction, type JoinState } from "./actions";

export function JoinForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<JoinState, FormData>(
    acceptInviteAction.bind(null, token),
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error && <Notice kind="error">{state.error}</Notice>}
      <Button type="submit" size="lg" fullWidth disabled={pending}>
        {pending ? "Sumasali…" : "Sumali"}
      </Button>
    </form>
  );
}
