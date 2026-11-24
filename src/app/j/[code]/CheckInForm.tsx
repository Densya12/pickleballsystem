"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, CopyButton, Input, Notice, RadioGroup, Toggle } from "@/components/ui";
import { formatGcashNumber, formatPeso } from "@/lib/format";
import { normalizeReference, REFERENCE_MESSAGES } from "@/lib/payments/reference";
import { unlockAudio } from "@/lib/player/alert";
import { PLAYER_ERRORS, playerErrorMessage } from "@/lib/player/messages";
import { LEVELS, parseWalkIn, PLAYER_NAME_MAX } from "@/lib/queue/players";
import { createClient } from "@/lib/supabase/client";

export type CheckInPayment = {
  fee: number;
  payFirst: boolean;
  gcashName: string | null;
  gcashNumber: string | null;
};

type Errors = { display_name?: string; reference?: string; form?: string };

export const PAYMENT_CHOICE_REQUIRED = "Ilagay ang GCash reference number, o piliin ang cash.";

export function CheckInForm({ code, payment }: { code: string; payment: CheckInPayment }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [cash, setCash] = useState(false);
  const needsPayment = payment.fee > 0;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Inside the tap: lets the "Ikaw na" chime play later.
    unlockAudio();

    const form = new FormData(event.currentTarget);
    // Level is optional; no answer means "Hindi sigurado".
    if (!form.get("level")) form.set("level", "unsure");
    const parsed = parseWalkIn(form);

    // BR13: with a fee, pick GCash (a reference) or cash.
    let method: "gcash" | "cash" | undefined;
    let reference: string | undefined;
    let referenceError: string | undefined;
    if (needsPayment) {
      const raw = String(form.get("reference") ?? "").trim();
      if (cash) method = "cash";
      else if (!raw) referenceError = PAYMENT_CHOICE_REQUIRED;
      else if (!normalizeReference(raw)) referenceError = REFERENCE_MESSAGES.invalid;
      else {
        method = "gcash";
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
        setErrors({ form: PLAYER_ERRORS.signInFailed });
        return;
      }
    }

    const { error } = await supabase.rpc("join_session", {
      p_join_code: code,
      p_display_name: parsed.data.display_name,
      p_level: parsed.data.level,
      p_method: method,
      p_reference: reference,
    });
    if (error) {
      setPending(false);
      setErrors({ form: playerErrorMessage(error) });
      return;
    }
    router.push(`/j/${code}/me`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {errors.form && <Notice kind="error">{errors.form}</Notice>}
      <Input
        label="Pangalan mo"
        name="display_name"
        required
        maxLength={PLAYER_NAME_MAX}
        autoComplete="nickname"
        placeholder="hal. Tito Boy"
        error={errors.display_name}
      />
      <RadioGroup legend="Level mo? (optional)" name="level" options={LEVELS} />

      {needsPayment && (
        <section aria-labelledby="bayad-heading" className="flex flex-col gap-4 rounded-control border-[1.5px] border-strong p-4">
          <h2 id="bayad-heading" className="text-xl">
            Bayad · {formatPeso(payment.fee)}
          </h2>
          {payment.payFirst && <p className="font-semibold">Kailangang bayad bago matawag.</p>}
          {payment.gcashNumber ? (
            <div className="flex flex-col gap-2">
              <p className="text-muted">I-send sa GCash ng club:</p>
              <p className="text-lg font-semibold [overflow-wrap:anywhere]">
                {payment.gcashName && <span className="block">{payment.gcashName}</span>}
                <span className="font-display text-2xl tracking-wide">{formatGcashNumber(payment.gcashNumber)}</span>
              </p>
              <CopyButton text={payment.gcashNumber} label="Kopyahin ang number" />
            </div>
          ) : (
            <p className="text-muted">Walang GCash number ang club. Cash na lang, o tanungin ang organizer.</p>
          )}
          <Input
            label="GCash reference number"
            name="reference"
            inputMode="numeric"
            autoComplete="off"
            hint={REFERENCE_MESSAGES.hint}
            disabled={cash}
            error={errors.reference}
          />
          <div onChange={(event) => setCash((event.target as HTMLInputElement).checked)}>
            <Toggle label="Cash ang ibabayad ko" description="Ibibigay ko sa organizer" name="pay_cash" />
          </div>
        </section>
      )}

      <div className="flex flex-col gap-1 text-muted">
        <p>Pangalan at level lang ang kinukuha namin, para makita ng organizer kung sino ang nasa pila.</p>
        <p>Walang account o app na kailangan.</p>
      </div>
      <Button type="submit" size="lg" variant="accent" fullWidth disabled={pending}>
        {pending ? "Pumipila…" : "Pumila na"}
      </Button>
    </form>
  );
}
