"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button, Card, CopyButton, Input, Notice, RadioGroup } from "@/components/ui";
import { formatGcashNumber, formatPeso } from "@/lib/format";
import { useFocusFirstError } from "@/lib/forms/useFocusFirstError";
import { useT } from "@/lib/i18n/client";
import { normalizeReference, REFERENCE_MAX, REFERENCE_MIN } from "@/lib/payments/reference";
import { unlockAudio } from "@/lib/player/alert";
import { playerErrorMessage } from "@/lib/player/messages";
import { LevelBadge } from "@/components/level/LevelBadge";
import { LevelPicker } from "@/components/level/LevelPicker";
import { parseWalkIn, PLAYER_NAME_MAX } from "@/lib/queue/players";
import { createClient } from "@/lib/supabase/client";

export type CheckInPayment = {
  fee: number;
  payFirst: boolean;
  gcashName: string | null;
  gcashNumber: string | null;
};

/** A returning player's name and level from their last row in this club (my_last_profile). */
export type LastProfile = { name: string; level: string };

type Errors = { display_name?: string; reference?: string; form?: string };

/** Check-in (D19): name, level, payment; one main button. */
export function CheckInForm({ code, payment, lastProfile = null }: { code: string; payment: CheckInPayment; lastProfile?: LastProfile | null }) {
  const t = useT();
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  // Errors show at the top; on a phone the Join button is far below (QA-04, QA-05).
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(formRef, errors, Object.values(errors).some(Boolean));
  const [pending, setPending] = useState(false);
  const [method, setMethod] = useState<"gcash" | "cash">("gcash");
  // D18: a returning player checks in with one tap; "Not {name}?" shows the empty form.
  const [returning, setReturning] = useState(lastProfile !== null);
  const remembered = returning ? lastProfile : null;
  const needsPayment = payment.fee > 0;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Inside the tap: lets the "You're up" chime play later.
    unlockAudio();

    const form = new FormData(event.currentTarget);
    if (remembered) {
      form.set("display_name", remembered.name);
      form.set("level", remembered.level);
    }
    // Level is optional; no answer means "Not sure".
    if (!form.get("level")) form.set("level", "unsure");
    const parsed = parseWalkIn(form, t);

    // BR13: with a fee, a GCash reference or cash.
    let payWith: "gcash" | "cash" | undefined;
    let reference: string | undefined;
    let referenceError: string | undefined;
    if (needsPayment) {
      const raw = String(form.get("reference") ?? "").trim();
      if (method === "cash") payWith = "cash";
      else if (!raw) referenceError = t.player.referenceOrCash;
      else if (!normalizeReference(raw)) referenceError = t.payments.invalidReference(REFERENCE_MIN, REFERENCE_MAX);
      else {
        payWith = "gcash";
        reference = raw;
      }
    }

    if (!parsed.ok || referenceError) {
      setErrors({ display_name: parsed.ok ? undefined : parsed.errors.display_name, reference: referenceError });
      return;
    }

    setErrors({});
    setPending(true);
    const supabase = createClient();
    // Sign in only now, and only if this phone has no session yet.
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        setPending(false);
        setErrors({ form: t.player.signInFailed });
        return;
      }
    }

    const { error } = await supabase.rpc("join_session", {
      p_join_code: code,
      p_display_name: parsed.data.display_name,
      p_level: parsed.data.level,
      p_method: payWith,
      p_reference: reference,
    });
    if (error) {
      setPending(false);
      // QA-05: a name already in line is a problem with the name field (unless it's the remembered name).
      if (error.message === "name_taken" && !remembered) setErrors({ display_name: t.player.nameTaken });
      else setErrors({ form: playerErrorMessage(error, t) });
      return;
    }
    router.push(`/j/${code}/me`);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      {errors.form && (
        <Notice kind="error" tabIndex={-1} data-form-error>
          {errors.form}
        </Notice>
      )}
      <Card className="flex flex-col gap-4">
        {remembered ? (
          <div className="flex flex-col">
            <p className="text-sm text-muted">{t.player.rememberedAs}</p>
            <p className="text-lg font-semibold [overflow-wrap:anywhere]">{remembered.name}</p>
            <LevelBadge level={remembered.level} className="mt-0.5" />
          </div>
        ) : (
          <>
            <Input
              label={t.player.name}
              name="display_name"
              required
              maxLength={PLAYER_NAME_MAX}
              autoComplete="nickname"
              placeholder={t.player.namePlaceholder}
              error={errors.display_name}
            />
            <LevelPicker legend={`${t.player.level} ${t.common.optional}`} name="level" />
          </>
        )}
      </Card>

      {needsPayment && (
        <section aria-labelledby="payment-heading" className="flex flex-col gap-3 rounded-card bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <h2 id="payment-heading" className="font-semibold">
              {t.player.payment}
            </h2>
            <p className="font-semibold">{formatPeso(payment.fee)}</p>
          </div>
          {payment.payFirst && <p className="text-sm font-medium text-warn">{t.player.payFirstNote}</p>}
          <RadioGroup
            legend={t.player.paymentMethod}
            legendHidden
            name="pay_method"
            look="segmented"
            options={[
              { value: "gcash", label: t.player.gcash },
              { value: "cash", label: t.player.cash },
            ]}
            value={method}
            onValueChange={(value) => {
              setMethod(value as "gcash" | "cash");
              setErrors((current) => ({ ...current, reference: undefined }));
            }}
          />
          {method === "gcash" ? (
            <>
              {payment.gcashNumber ? (
                <div className="flex items-center justify-between gap-3 rounded-control bg-info px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-muted [overflow-wrap:anywhere]">{t.player.sendTo(payment.gcashName)}</p>
                    <p className="font-medium tracking-[0.3px]">{formatGcashNumber(payment.gcashNumber)}</p>
                  </div>
                  <CopyButton text={payment.gcashNumber} label={t.player.copyNumber} />
                </div>
              ) : (
                <p className="text-sm text-muted">{t.player.noGcash}</p>
              )}
              <Input
                label={t.player.reference}
                name="reference"
                inputMode="numeric"
                autoComplete="off"
                placeholder={t.player.referencePlaceholder}
                hint={t.payments.referenceHint}
                error={errors.reference}
              />
            </>
          ) : (
            <p className="text-sm text-muted">{t.player.cashNote}</p>
          )}
        </section>
      )}

      <div className="mt-2 flex flex-col items-center gap-1.5">
        <Button type="submit" size="lg" fullWidth disabled={pending}>
          {pending ? t.player.joining : remembered ? t.player.joinAs(remembered.name) : t.player.join}
        </Button>
        {remembered && (
          <Button
            variant="ghost"
            size="md"
            disabled={pending}
            onClick={() => {
              setErrors({});
              setReturning(false);
            }}
          >
            {t.player.notMe(remembered.name)}
          </Button>
        )}
        <p className="px-4 text-center text-xs text-muted">{t.player.privacy}</p>
      </div>
    </form>
  );
}
