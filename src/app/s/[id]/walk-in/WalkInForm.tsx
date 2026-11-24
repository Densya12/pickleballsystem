"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Button, Input, Notice, RadioGroup } from "@/components/ui";
import { PlusIcon } from "@/components/ui/icons";
import { formatPeso } from "@/lib/format";
import { REFERENCE_MESSAGES } from "@/lib/payments/reference";
import { LEVELS, parseWalkInPayment, PLAYER_NAME_MAX, WALK_IN_PAYMENT_CHOICES } from "@/lib/queue/players";
import { addWalkInAction, type WalkInState } from "./actions";

type PaymentErrors = { payment?: string; reference?: string };

export function WalkInForm({ sessionId, fee }: { sessionId: string; fee: number }) {
  const [state, formAction, pending] = useActionState<WalkInState, FormData>(
    addWalkInAction.bind(null, sessionId),
    {},
  );
  // Checked here first so the organizer sees the message without a round trip;
  // the Server Action checks the same rule again.
  const [paymentErrors, setPaymentErrors] = useState<PaymentErrors | null>(null);
  const errors = paymentErrors ?? state.fieldErrors ?? {};

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const result = parseWalkInPayment(fee, String(form.get("payment") ?? ""), String(form.get("reference") ?? ""));
    if (!result.ok) {
      // Stops the form action from running.
      event.preventDefault();
      setPaymentErrors(result.errors);
      return;
    }
    setPaymentErrors(null);
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
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
        <div className="flex flex-col gap-5" onChange={() => setPaymentErrors(null)}>
          <RadioGroup
            legend={`Bayad · ${formatPeso(fee)}`}
            name="payment"
            options={WALK_IN_PAYMENT_CHOICES}
            // D18: no default. The organizer must pick, so nobody is held under pay_first by accident.
            defaultValue={(state.values?.payment || undefined) as (typeof WALK_IN_PAYMENT_CHOICES)[number]["value"] | undefined}
            error={errors.payment}
          />
          <Input
            label="GCash reference number (kung GCash)"
            name="reference"
            inputMode="numeric"
            autoComplete="off"
            hint={REFERENCE_MESSAGES.hint}
            defaultValue={state.values?.reference}
            error={errors.reference}
          />
        </div>
      )}
      <Button type="submit" size="lg" fullWidth disabled={pending}>
        <PlusIcon />
        {pending ? "Inilalagay…" : "Ilagay sa pila"}
      </Button>
    </form>
  );
}
