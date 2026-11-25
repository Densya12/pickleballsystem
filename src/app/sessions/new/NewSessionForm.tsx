"use client";

import { useActionState, useState } from "react";
import { Button, Card, Input, Notice, RadioGroup, Stepper, Toggle } from "@/components/ui";
import { POINTS_CHOICES, rotationChoices } from "@/lib/club/options";
import type { Points, Rotation } from "@/lib/club/validation";
import { formatGcashNumber } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { COURTS_MAX, COURTS_MIN, type CourtFormat, type SessionField } from "@/lib/session/validation";
import { createSessionAction, type NewSessionState } from "./actions";
import { CourtFormats } from "./CourtFormats";

type Props = {
  defaults: Record<SessionField, string>;
  gcash: { name: string | null; number: string | null };
};

const FORM_ID = "new-session";

/** New session (BR2): grouped cards, then Start (the main button) or Save as draft. */
export function NewSessionForm({ defaults, gcash }: Props) {
  const t = useT();
  const [state, formAction, pending] = useActionState<NewSessionState, FormData>(createSessionAction, {});
  const value = (field: SessionField) => state.values?.[field] ?? defaults[field];
  const errors = state.fieldErrors ?? {};
  const [courtCount, setCourtCount] = useState(() => Number(defaults.courts_count) || COURTS_MIN);
  const [formats, setFormats] = useState<CourtFormat[]>(() => (defaults.court_formats ? defaults.court_formats.split(",") : []) as CourtFormat[]);

  return (
    <form id={FORM_ID} action={formAction} noValidate className="flex flex-col gap-3">
      {state.error && <Notice kind="error">{state.error}</Notice>}
      <Card className="flex flex-col gap-4">
        <Input
          label={t.session.name}
          name="name"
          required
          maxLength={60}
          autoComplete="off"
          placeholder={t.session.namePlaceholder}
          defaultValue={value("name")}
          error={errors.name}
        />
        <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
          <Input label={t.session.startsAt} name="starts_at" type="datetime-local" required defaultValue={value("starts_at")} error={errors.starts_at} />
          <Input label={t.session.endsAt} name="ends_at" type="datetime-local" required defaultValue={value("ends_at")} error={errors.ends_at} />
        </div>
      </Card>

      <Card className="flex flex-col gap-5">
        <Stepper
          label={t.session.courtsCount}
          name="courts_count"
          min={COURTS_MIN}
          max={COURTS_MAX}
          defaultValue={Number(value("courts_count")) || COURTS_MIN}
          decrementLabel={t.session.fewerCourts}
          incrementLabel={t.session.moreCourts}
          formatValue={t.common.courts}
          error={errors.courts_count}
          onValueChange={setCourtCount}
        />
        <CourtFormats
          count={courtCount}
          formats={formats}
          onChange={(index, format) =>
            setFormats((current) => {
              const next = [...current];
              next[index] = format;
              return next;
            })
          }
          error={errors.court_formats}
        />
        <RadioGroup
          legend={t.session.pointsTo}
          name="points_to"
          look="segmented"
          options={POINTS_CHOICES}
          defaultValue={value("points_to") as `${Points}`}
          error={errors.points_to}
        />
        <RadioGroup
          legend={t.session.afterGame}
          name="rotation"
          options={rotationChoices(t)}
          defaultValue={value("rotation") as Rotation}
          error={errors.rotation}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <Toggle label={t.session.payFirst} description={t.session.payFirstDescription} name="pay_first" defaultChecked={value("pay_first") === "on"} />
        <Input label={t.session.fee} name="fee" inputMode="numeric" pattern="[0-9]*" defaultValue={value("fee")} error={errors.fee} />
        <div className="rounded-control bg-info px-3.5 py-2.5">
          <p className="text-sm text-muted">{t.session.clubGcash}</p>
          <p className="font-medium [overflow-wrap:anywhere]">
            {gcash.number ? `${gcash.name ? `${gcash.name} · ` : ""}${formatGcashNumber(gcash.number)}` : t.session.noGcash}
          </p>
          <p className="text-xs text-muted">{t.session.gcashFromSettings}</p>
        </div>
      </Card>

      <div className="mt-2 flex flex-col gap-1">
        <Button type="submit" name="intent" value="start" size="lg" fullWidth disabled={pending}>
          {pending ? t.session.starting : t.session.start}
        </Button>
        <Button type="submit" name="intent" value="draft" variant="ghost" size="md" fullWidth disabled={pending}>
          {t.session.saveDraft}
        </Button>
      </div>
    </form>
  );
}
