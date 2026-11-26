"use client";

import { useActionState } from "react";
import { Button, Card, Input, Notice, RadioGroup } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { duesChoices, NOTES_MAX, type DuesStatus, type Member } from "@/lib/members/members";
import { LevelPicker } from "@/components/level/LevelPicker";
import { PLAYER_NAME_MAX, type Level } from "@/lib/queue/players";
import { saveMemberAction, type MemberFormState } from "./actions";

/** Add or edit a member: name, level, dues, notes; one main button. */
export function MemberForm({ member }: { member: Member | null }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<MemberFormState, FormData>(saveMemberAction.bind(null, member?.id ?? null), {});
  const value = (field: "display_name" | "level" | "dues_status" | "notes", fallback: string) => state.values?.[field] ?? fallback;
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      {state.error && <Notice kind="error">{state.error}</Notice>}
      <Card className="flex flex-col gap-4">
        <Input
          label={t.members.name}
          name="display_name"
          required
          maxLength={PLAYER_NAME_MAX}
          autoComplete="off"
          defaultValue={value("display_name", member?.name ?? "")}
          error={errors.display_name}
        />
        <LevelPicker
          legend={t.members.level}
          name="level"
          defaultValue={value("level", member?.level ?? "unsure") as Level}
          error={errors.level}
        />
        <RadioGroup
          legend={t.members.dues}
          name="dues_status"
          look="segmented"
          options={duesChoices(t)}
          defaultValue={value("dues_status", member?.duesStatus ?? "none") as DuesStatus}
          error={errors.dues_status}
        />
        <Input
          label={t.members.notes}
          labelNote={t.common.optional}
          name="notes"
          maxLength={NOTES_MAX}
          autoComplete="off"
          placeholder={t.members.notesPlaceholder}
          defaultValue={value("notes", member?.notes ?? "")}
          error={errors.notes}
        />
      </Card>
      <Button type="submit" size="lg" fullWidth disabled={pending} className="mt-2">
        {pending ? t.common.saving : t.common.save}
      </Button>
    </form>
  );
}
