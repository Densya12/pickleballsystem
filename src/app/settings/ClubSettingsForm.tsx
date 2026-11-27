"use client";

import { useActionState, useState } from "react";
import { Button, Card, Input, Notice, RadioGroup } from "@/components/ui";
import { callModeChoices, matchmakingChoices, POINTS_CHOICES, rotationChoices } from "@/lib/club/options";
import { OTHER_NAME_MAX, paymentMethodChoices, usesMobileNumber, type PaymentMethod } from "@/lib/payments/method";
import type { CallMode, Matchmaking, Points, Rotation } from "@/lib/club/validation";
import { useT } from "@/lib/i18n/client";
import { saveSettingsAction, type SettingsState } from "./actions";
import type { ClubValues } from "./data";

/** Settings › Club details: the club, its defaults for new sessions, and how players pay. */
export function ClubSettingsForm({ club, isOwner }: { club: ClubValues; isOwner: boolean }) {
  const t = useT();
  const [state, dispatch, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, { status: "idle" });
  const [edited, setEdited] = useState(false);
  const value = (field: keyof ClubValues) => state.values?.[field] ?? club[field];
  const errors = state.fieldErrors ?? {};
  // Shows the Other name field and the right number hint as the method changes.
  const [method, setMethod] = useState<PaymentMethod>(value("payment_method") as PaymentMethod);
  const mobile = usesMobileNumber(method);

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

      <fieldset disabled={!isOwner} className="flex min-w-0 flex-col gap-3">
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
                legend={t.settings.defaultCallMode}
                name="default_call_mode"
                options={callModeChoices(t)}
                defaultValue={value("default_call_mode") as CallMode}
                error={errors.default_call_mode}
              />
              <RadioGroup
                legend={t.settings.defaultMatchmaking}
                name="default_matchmaking"
                options={matchmakingChoices(t)}
                defaultValue={value("default_matchmaking") as Matchmaking}
                error={errors.default_matchmaking}
              />
            </Card>
            <h2 id="payment" className="section-label mx-1 mt-3 scroll-mt-4">
              {t.settings.paymentSection}
            </h2>
            <Card className="flex flex-col gap-4">
              <Input
                label={t.settings.defaultFee}
                name="default_fee"
                inputMode="numeric"
                pattern="[0-9]*"
                defaultValue={value("default_fee")}
                error={errors.default_fee}
              />
              <RadioGroup
                legend={t.settings.paymentMethod}
                name="payment_method"
                look="chips"
                options={paymentMethodChoices(t)}
                value={method}
                onValueChange={setMethod}
                error={errors.payment_method}
              />
              {method === "other" && (
                <Input
                  label={t.settings.otherMethodName}
                  name="payment_method_other"
                  maxLength={OTHER_NAME_MAX}
                  autoComplete="off"
                  hint={t.settings.otherMethodHint}
                  defaultValue={value("payment_method_other")}
                  error={errors.payment_method_other}
                />
              )}
              <Input label={t.settings.accountName} name="gcash_name" maxLength={80} autoComplete="off" defaultValue={value("gcash_name")} error={errors.gcash_name} />
              <Input
                label={t.settings.accountNumber}
                name="gcash_number"
                inputMode={mobile ? "tel" : "numeric"}
                autoComplete="off"
                hint={mobile ? t.settings.mobileNumberHint : t.settings.accountNumberHint}
                defaultValue={value("gcash_number")}
                error={errors.gcash_number}
              />
              <RadioGroup
                legend={t.settings.cashAccepted}
                name="cash_accepted"
                look="segmented"
                options={[
                  { value: "on", label: t.settings.on },
                  { value: "off", label: t.settings.off },
                ]}
                defaultValue={value("cash_accepted") as "on" | "off"}
                error={errors.cash_accepted}
              />
            </Card>
          </>
      </fieldset>

      {isOwner && (
        <Button type="submit" size="lg" fullWidth disabled={pending} className="mt-2">
          {pending ? t.common.saving : t.common.save}
        </Button>
      )}
    </form>
  );
}
