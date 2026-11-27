"use client";

import { useActionState, useState } from "react";
import { Button, Card, Input, Notice, RadioGroup } from "@/components/ui";
import { matchmakingChoices, POINTS_CHOICES, rotationChoices } from "@/lib/club/options";
import type { Matchmaking, Points, Rotation } from "@/lib/club/validation";
import { useT } from "@/lib/i18n/client";
import { saveSettingsAction, type SettingsState } from "./actions";
import type { ClubValues } from "./data";

const FIELDS: Record<"club" | "payments", (keyof ClubValues)[]> = {
  club: ["name", "city", "default_points", "default_rotation", "default_matchmaking"],
  payments: ["gcash_name", "gcash_number", "default_fee"],
};

/**
 * One Settings page's fields (Club details, or GCash and fee). The other
 * fields go along as hidden inputs, so the save is the same as before.
 */
export function ClubSettingsForm({ section, club, isOwner }: { section: "club" | "payments"; club: ClubValues; isOwner: boolean }) {
  const t = useT();
  const [state, dispatch, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, { status: "idle" });
  const [edited, setEdited] = useState(false);
  const value = (field: keyof ClubValues) => state.values?.[field] ?? club[field];
  const errors = state.fieldErrors ?? {};
  const shown = FIELDS[section];

  return (
    <form
      noValidate
      action={(formData) => {
        setEdited(false);
        dispatch(formData);
      }}
      onChange={() => setEdited(true)}
      className="flex flex-col gap-3"
    >
      {!isOwner && <Notice kind="info">{t.common.ownerOnly}</Notice>}
      {!edited && state.status !== "idle" && state.message && (
        <Notice kind={state.status === "saved" ? "success" : "error"}>{state.message}</Notice>
      )}
      {(Object.keys(club) as (keyof ClubValues)[])
        .filter((field) => !shown.includes(field))
        .map((field) => (
          <input key={field} type="hidden" name={field} value={club[field]} />
        ))}

      <fieldset disabled={!isOwner} className="flex min-w-0 flex-col gap-3">
        {section === "club" ? (
          <>
            <Card className="flex flex-col gap-4">
              <Input label={t.settings.clubName} name="name" required maxLength={60} defaultValue={value("name")} error={errors.name} />
              <Input label={t.settings.city} labelNote={t.common.optional} name="city" maxLength={60} defaultValue={value("city")} error={errors.city} />
            </Card>
            <h2 className="section-label mx-1 mt-3">{t.settings.defaultsSection}</h2>
            <Card className="flex flex-col gap-4">
              <RadioGroup
                legend={t.settings.defaultPoints}
                name="default_points"
                look="segmented"
                options={POINTS_CHOICES}
                defaultValue={value("default_points") as `${Points}`}
                error={errors.default_points}
              />
              <RadioGroup
                legend={t.settings.defaultRotation}
                name="default_rotation"
                options={rotationChoices(t)}
                defaultValue={value("default_rotation") as Rotation}
                error={errors.default_rotation}
              />
              <RadioGroup
                legend={t.settings.defaultMatchmaking}
                name="default_matchmaking"
                options={matchmakingChoices(t)}
                defaultValue={value("default_matchmaking") as Matchmaking}
                error={errors.default_matchmaking}
              />
            </Card>
          </>
        ) : (
          <Card className="flex flex-col gap-4">
            <Input label={t.settings.gcashName} name="gcash_name" maxLength={80} autoComplete="off" defaultValue={value("gcash_name")} error={errors.gcash_name} />
            <Input
              label={t.settings.gcashNumber}
              name="gcash_number"
              inputMode="tel"
              autoComplete="off"
              hint={t.settings.gcashNumberHint}
              defaultValue={value("gcash_number")}
              error={errors.gcash_number}
            />
            <Input
              label={t.settings.defaultFee}
              name="default_fee"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={value("default_fee")}
              error={errors.default_fee}
            />
          </Card>
        )}
      </fieldset>

      {isOwner && (
        <Button type="submit" size="lg" fullWidth disabled={pending} className="mt-2">
          {pending ? t.common.saving : t.common.save}
        </Button>
      )}
    </form>
  );
}
