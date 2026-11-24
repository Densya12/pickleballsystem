"use client";

import { useActionState, type ReactNode } from "react";
import { Button, Card, Input, Notice, PageShell, RadioGroup, Stepper, Toggle } from "@/components/ui";
import { POINTS_CHOICES, ROTATION_CHOICES } from "@/lib/club/options";
import { formatCourts, formatGcashNumber } from "@/lib/format";
import { COURTS_MAX, COURTS_MIN, type SessionField } from "@/lib/session/validation";
import { createSessionAction, type NewSessionState } from "./actions";

type Props = {
  header: ReactNode;
  defaults: Record<SessionField, string>;
  gcash: { name: string | null; number: string | null };
};

const FORM_ID = "new-session";

export function NewSessionForm({ header, defaults, gcash }: Props) {
  const [state, formAction, pending] = useActionState<NewSessionState, FormData>(createSessionAction, {});
  const value = (field: SessionField) => state.values?.[field] ?? defaults[field];
  const errors = state.fieldErrors ?? {};

  return (
    <PageShell
      header={header}
      footer={
        <div className="flex flex-col gap-2">
          {state.error && <Notice kind="error">{state.error}</Notice>}
          <Button type="submit" form={FORM_ID} name="intent" value="start" size="lg" fullWidth disabled={pending}>
            {pending ? "Sandali lang…" : "Simulan ang session"}
          </Button>
          <Button type="submit" form={FORM_ID} name="intent" value="draft" variant="secondary" fullWidth disabled={pending}>
            I-save muna
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} action={formAction} noValidate className="flex flex-col gap-5">
        <Card className="flex flex-col gap-5">
          <Input
            label="Pangalan ng session"
            name="name"
            required
            maxLength={60}
            autoComplete="off"
            placeholder="hal. Friday Night Open Play"
            defaultValue={value("name")}
            error={errors.name}
          />
          <Input
            label="Simula"
            name="starts_at"
            type="datetime-local"
            required
            defaultValue={value("starts_at")}
            error={errors.starts_at}
          />
          <Input
            label="Tapos"
            name="ends_at"
            type="datetime-local"
            required
            defaultValue={value("ends_at")}
            error={errors.ends_at}
          />
        </Card>

        <Card className="flex flex-col gap-6">
          <Stepper
            label="Ilang court?"
            name="courts_count"
            min={COURTS_MIN}
            max={COURTS_MAX}
            defaultValue={Number(value("courts_count")) || COURTS_MIN}
            formatValue={formatCourts}
            error={errors.courts_count}
          />
          <RadioGroup
            legend="Hanggang ilang points?"
            name="points_to"
            layout="row"
            options={POINTS_CHOICES}
            defaultValue={value("points_to") as (typeof POINTS_CHOICES)[number]["value"]}
            error={errors.points_to}
          />
          <RadioGroup
            legend="Pagkatapos ng laro"
            name="rotation"
            options={ROTATION_CHOICES}
            defaultValue={value("rotation") as (typeof ROTATION_CHOICES)[number]["value"]}
            error={errors.rotation}
          />
        </Card>

        <Card className="flex flex-col gap-5">
          <Toggle
            label="Bayad muna bago pumila"
            description="Lalaktawan ang hindi pa bayad"
            name="pay_first"
            defaultChecked={value("pay_first") === "on"}
          />
          <Input
            label="Bayad bawat player (₱)"
            name="fee"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={value("fee")}
            error={errors.fee}
          />
          <div className="flex flex-col gap-1 rounded-control bg-subtle px-4 py-3">
            <p className="font-semibold">GCash ng club</p>
            {gcash.number ? (
              <p className="[overflow-wrap:anywhere]">
                {gcash.name ? `${gcash.name} · ` : ""}
                {formatGcashNumber(gcash.number)}
              </p>
            ) : (
              <p>Wala pang GCash number.</p>
            )}
            <p className="text-sm text-muted">
              Galing sa Settings ng club. Ise-save ito kasama ng session.
            </p>
          </div>
        </Card>
      </form>
    </PageShell>
  );
}
