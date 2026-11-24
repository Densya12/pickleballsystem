"use client";

import { useActionState } from "react";
import { Button, Input, Notice, RadioGroup } from "@/components/ui";
import { PlusIcon } from "@/components/ui/icons";
import { LEVELS, PLAYER_NAME_MAX } from "@/lib/queue/players";
import { addWalkInAction, type WalkInState } from "./actions";

export function WalkInForm({ sessionId }: { sessionId: string }) {
  const [state, formAction, pending] = useActionState<WalkInState, FormData>(
    addWalkInAction.bind(null, sessionId),
    {},
  );

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.error && <Notice kind="error">{state.error}</Notice>}
      <Input
        label="Pangalan"
        name="display_name"
        required
        maxLength={PLAYER_NAME_MAX}
        autoComplete="off"
        placeholder="hal. Tito Boy"
        defaultValue={state.values?.display_name}
        error={state.fieldErrors?.display_name}
      />
      <RadioGroup
        legend="Level"
        name="level"
        options={LEVELS}
        defaultValue={(state.values?.level || "unsure") as (typeof LEVELS)[number]["value"]}
        error={state.fieldErrors?.level}
      />
      <Button type="submit" size="lg" fullWidth disabled={pending}>
        <PlusIcon />
        {pending ? "Inilalagay…" : "Ilagay sa pila"}
      </Button>
    </form>
  );
}
