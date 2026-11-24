"use client";

import { useActionState } from "react";
import { Button, Input, Notice, RadioGroup } from "@/components/ui";
import { PlusIcon } from "@/components/ui/icons";
import { formatPeso } from "@/lib/format";
import { REFERENCE_MESSAGES } from "@/lib/payments/reference";
import { LEVELS, PLAYER_NAME_MAX } from "@/lib/queue/players";
import { addWalkInAction, type WalkInState } from "./actions";

const PAYMENT_OPTIONS = [
  { value: "cash_received", label: "Cash, natanggap na" },
  { value: "gcash", label: "GCash", description: "Ilagay ang reference number sa ibaba" },
  { value: "later", label: "Mamaya na magbabayad" },
] as const;

export function WalkInForm({ sessionId, fee }: { sessionId: string; fee: number }) {
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
      {fee > 0 && (
        <>
          <RadioGroup
            legend={`Bayad · ${formatPeso(fee)}`}
            name="payment"
            options={PAYMENT_OPTIONS}
            // Quick by default: "later" (unpaid). Under pay_first the walk-in shows as held until paid.
            defaultValue={(state.values?.payment || "later") as (typeof PAYMENT_OPTIONS)[number]["value"]}
            error={state.fieldErrors?.payment}
          />
          <Input
            label="GCash reference number (kung GCash)"
            name="reference"
            inputMode="numeric"
            autoComplete="off"
            hint={REFERENCE_MESSAGES.hint}
            defaultValue={state.values?.reference}
            error={state.fieldErrors?.reference}
          />
        </>
      )}
      <Button type="submit" size="lg" fullWidth disabled={pending}>
        <PlusIcon />
        {pending ? "Inilalagay…" : "Ilagay sa pila"}
      </Button>
    </form>
  );
}
