"use client";

import { useActionState } from "react";
import { Button, Input, Notice } from "@/components/ui";
import { createClubAction, type CreateClubState } from "./actions";

export function CreateClubForm() {
  const [state, formAction, pending] = useActionState<CreateClubState, FormData>(
    createClubAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error && <Notice kind="error">{state.error}</Notice>}
      <Input
        label="Pangalan ng club"
        name="name"
        required
        maxLength={60}
        autoComplete="organization"
        placeholder="hal. Makati Picklers"
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
      />
      <Input
        label="Lungsod (optional)"
        name="city"
        maxLength={60}
        autoComplete="address-level2"
        placeholder="hal. Makati"
        defaultValue={state.values?.city}
        error={state.fieldErrors?.city}
      />
      <Button type="submit" size="lg" fullWidth disabled={pending}>
        {pending ? "Ginagawa ang club…" : "Gawin ang club"}
      </Button>
    </form>
  );
}
