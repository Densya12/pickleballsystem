"use client";

import { useActionState } from "react";
import { Button, Card, Input, Notice } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { createClubAction, type CreateClubState } from "./actions";

export function CreateClubForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState<CreateClubState, FormData>(createClubAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      {state.error && <Notice kind="error">{state.error}</Notice>}
      <Card className="flex flex-col gap-4">
        <Input
          label={t.club.name}
          name="name"
          required
          maxLength={60}
          autoComplete="organization"
          placeholder={t.club.namePlaceholder}
          defaultValue={state.values?.name}
          error={state.fieldErrors?.name}
        />
        <Input
          label={t.club.city}
          labelNote={t.common.optional}
          name="city"
          maxLength={60}
          autoComplete="address-level2"
          placeholder={t.club.cityPlaceholder}
          defaultValue={state.values?.city}
          error={state.fieldErrors?.city}
        />
      </Card>
      <Button type="submit" size="lg" fullWidth disabled={pending} className="mt-2">
        {pending ? t.club.creating : t.club.create}
      </Button>
    </form>
  );
}
