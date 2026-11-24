"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Button, Card, Input, Notice, PageShell, RadioGroup } from "@/components/ui";
import { saveSettingsAction, signOutAction, type SettingsState } from "./actions";
import { StaffSection } from "./StaffSection";

export type StaffItem = {
  userId: string;
  role: "owner" | "organizer";
  name: string | null;
  email: string | null;
  isMe: boolean;
};

export type InviteItem = { id: string; url: string; expiryText: string };

type ClubValues = {
  name: string;
  city: string;
  gcash_name: string;
  gcash_number: string;
  default_fee: string;
  default_points: string;
  default_rotation: string;
};

type Props = {
  header: ReactNode;
  club: ClubValues;
  isOwner: boolean;
  staff: StaffItem[];
  invites: InviteItem[];
};

const FORM_ID = "club-settings";

const POINTS = [
  { value: "11", label: "11" },
  { value: "15", label: "15" },
  { value: "21", label: "21" },
] as const;

const ROTATIONS = [
  {
    value: "all_off",
    label: "Lahat ng apat aalis",
    description: "Pagkatapos ng laro, babalik sa pila ang apat na naglaro.",
  },
  {
    value: "winners_stay",
    label: "Mananatili ang nanalo",
    description: "Maglalaro ulit ang nanalong pares laban sa susunod.",
  },
] as const;

export function SettingsView({ header, club, isOwner, staff, invites }: Props) {
  const [state, dispatch, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, {
    status: "idle",
  });
  const [editedSinceSubmit, setEditedSinceSubmit] = useState(false);

  const value = (field: keyof ClubValues) => state.values?.[field] ?? club[field];
  const errors = state.fieldErrors ?? {};
  const showResult = !editedSinceSubmit && state.status !== "idle";

  return (
    <PageShell
      header={header}
      footer={
        isOwner ? (
          <div className="flex flex-col gap-2">
            {showResult && state.message && (
              <Notice kind={state.status === "saved" ? "success" : "error"}>{state.message}</Notice>
            )}
            <Button type="submit" form={FORM_ID} size="lg" fullWidth disabled={pending}>
              {pending ? "Sine-save…" : "I-save"}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-8">
        {!isOwner && <Notice kind="info">Ang owner lang ang pwedeng magbago nito.</Notice>}

        <form
          id={FORM_ID}
          noValidate
          action={(formData) => {
            setEditedSinceSubmit(false);
            dispatch(formData);
          }}
          onChange={() => setEditedSinceSubmit(true)}
          className="flex flex-col gap-8"
        >
          <fieldset disabled={!isOwner} className="min-w-0">
            <Section title="Club">
              <Input
                label="Pangalan ng club"
                name="name"
                required
                maxLength={60}
                defaultValue={value("name")}
                error={errors.name}
              />
              <Input
                label="Lungsod (optional)"
                name="city"
                maxLength={60}
                defaultValue={value("city")}
                error={errors.city}
              />
            </Section>
          </fieldset>

          <fieldset disabled={!isOwner} className="min-w-0">
            <Section title="Bayad">
              <Input
                label="Pangalan sa GCash"
                name="gcash_name"
                maxLength={80}
                autoComplete="off"
                defaultValue={value("gcash_name")}
                error={errors.gcash_name}
              />
              <Input
                label="GCash number"
                name="gcash_number"
                inputMode="tel"
                autoComplete="off"
                hint="Hal. 0917 123 4567"
                defaultValue={value("gcash_number")}
                error={errors.gcash_number}
              />
            </Section>
          </fieldset>

          <fieldset disabled={!isOwner} className="min-w-0">
            <Section title="Default na rules">
              <Input
                label="Bayad bawat player (₱)"
                name="default_fee"
                inputMode="numeric"
                pattern="[0-9]*"
                defaultValue={value("default_fee")}
                error={errors.default_fee}
              />
              <RadioGroup
                legend="Points bawat laro"
                name="default_points"
                layout="row"
                options={POINTS}
                defaultValue={value("default_points") as (typeof POINTS)[number]["value"]}
                error={errors.default_points}
              />
              <RadioGroup
                legend="Rotation"
                name="default_rotation"
                options={ROTATIONS}
                defaultValue={value("default_rotation") as (typeof ROTATIONS)[number]["value"]}
                error={errors.default_rotation}
              />
            </Section>
          </fieldset>
        </form>

        <StaffSection isOwner={isOwner} staff={staff} invites={invites} />

        <form action={signOutAction}>
          <Button type="submit" variant="secondary" fullWidth>
            Mag-sign out
          </Button>
        </form>
      </div>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl">{title}</h2>
      <Card className="flex flex-col gap-5">{children}</Card>
    </section>
  );
}
