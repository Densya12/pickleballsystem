"use client";

import { useActionState } from "react";
import { Button, Input, Notice, RadioGroup } from "@/components/ui";
import { DUES_CHOICES, NOTES_MAX, type Member } from "@/lib/members/members";
import { LEVELS, PLAYER_NAME_MAX } from "@/lib/queue/players";
import { saveMemberAction, type MemberFormState } from "./actions";

/** Add or edit a member: name, level, dues, notes. */
export function MemberForm({ member }: { member: Member | null }) {
  const [state, formAction, pending] = useActionState<MemberFormState, FormData>(
    saveMemberAction.bind(null, member?.id ?? null),
    {},
  );
  const value = (field: "display_name" | "level" | "dues_status" | "notes", fallback: string) =>
    state.values?.[field] ?? fallback;
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.error && <Notice kind="error">{state.error}</Notice>}
      <Input
        label="Pangalan"
        name="display_name"
        required
        maxLength={PLAYER_NAME_MAX}
        autoComplete="off"
        defaultValue={value("display_name", member?.name ?? "")}
        error={errors.display_name}
      />
      <RadioGroup
        legend="Level"
        name="level"
        options={LEVELS}
        defaultValue={value("level", member?.level ?? "unsure") as (typeof LEVELS)[number]["value"]}
        error={errors.level}
      />
      <RadioGroup
        legend="Dues"
        name="dues_status"
        options={DUES_CHOICES}
        defaultValue={value("dues_status", member?.duesStatus ?? "none") as (typeof DUES_CHOICES)[number]["value"]}
        error={errors.dues_status}
      />
      <Input
        label="Notes (optional)"
        name="notes"
        maxLength={NOTES_MAX}
        autoComplete="off"
        placeholder="hal. Tuwing Biyernes, may sariling paddle"
        defaultValue={value("notes", member?.notes ?? "")}
        error={errors.notes}
      />
      <Button type="submit" size="lg" fullWidth disabled={pending}>
        {pending ? "Sine-save…" : "I-save"}
      </Button>
    </form>
  );
}
