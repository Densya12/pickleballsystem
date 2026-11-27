"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Button, Card, Input, Notice, RadioGroup, Stepper, Toggle } from "@/components/ui";
import { useFocusFirstError } from "@/lib/forms/useFocusFirstError";
import { callModeChoices, matchmakingChoices, POINTS_CHOICES, rotationChoices } from "@/lib/club/options";
import type { CallMode, Matchmaking, Points, Rotation } from "@/lib/club/validation";
import { useT } from "@/lib/i18n/client";
import { accountLine, methodName, type PayTo } from "@/lib/payments/method";
import { COURTS_MAX, COURTS_MIN, type CourtFormat, type SessionField } from "@/lib/session/validation";
import { createSessionAction, type NewSessionState } from "./actions";
import { CourtFormats } from "./CourtFormats";

type Props = {
  defaults: Record<SessionField, string>;
  /** The club's payment method and account (Settings › Club details), copied to the session. */
  payTo: PayTo;
  /** BR1: the club's live session, if any (only one can be live). */
  liveSession?: { id: string; name: string } | null;
};

const FORM_ID = "new-session";

/** New session (BR2): grouped cards, then Start (the main button) or Save as draft. */
export function NewSessionForm({ defaults, payTo, liveSession = null }: Props) {
  const t = useT();
  const [state, formAction, pending] = useActionState<NewSessionState, FormData>(createSessionAction, {});
  const value = (field: SessionField) => state.values?.[field] ?? defaults[field];
  const errors = state.fieldErrors ?? {};
  const [courtCount, setCourtCount] = useState(() => Number(defaults.courts_count) || COURTS_MIN);
  const [formats, setFormats] = useState<CourtFormat[]>(() => (defaults.court_formats ? defaults.court_formats.split(",") : []) as CourtFormat[]);
  // QA-04: after a failed submit, focus the first invalid field (or the alert).
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(formRef, state, Boolean(state.error) || Object.values(errors).some(Boolean));

  return (
    <form ref={formRef} id={FORM_ID} action={formAction} noValidate className="flex flex-col gap-3">
      {liveSession && (
        // BR1, before anyone fills in the form: only one session can be live.
        <Notice kind="warning">
          <span className="block">{t.session.liveNow(liveSession.name)}</span>
          <Link href={`/s/${liveSession.id}`} className="mt-1 inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
            {t.home.openSession(liveSession.name)}
          </Link>
        </Notice>
      )}
      {state.error && (
        <Notice kind="error" tabIndex={-1} data-form-error>
          {state.error}
        </Notice>
      )}
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
          options={rotationChoices(t, Array.from({ length: courtCount }, (_, i) => formats[i] ?? "doubles"))}
          defaultValue={value("rotation") as Rotation}
          error={errors.rotation}
        />
        <RadioGroup
          legend={t.session.callMode}
          name="call_mode"
          options={callModeChoices(t)}
          defaultValue={value("call_mode") as CallMode}
          error={errors.call_mode}
        />
        <RadioGroup
          legend={t.session.matchmaking}
          name="matchmaking"
          options={matchmakingChoices(t)}
          defaultValue={value("matchmaking") as Matchmaking}
          error={errors.matchmaking}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <Toggle label={t.session.payFirst} description={t.session.payFirstDescription} name="pay_first" defaultChecked={value("pay_first") === "on"} />
        <Input label={t.session.fee} name="fee" inputMode="numeric" pattern="[0-9]*" defaultValue={value("fee")} error={errors.fee} />
        <div className="rounded-control bg-info px-3.5 py-2.5" data-testid="session-payment">
          <p className="text-sm text-muted">{t.session.clubPayment}</p>
          <p className="font-medium [overflow-wrap:anywhere]">
            {methodName(t, payTo)} · {accountLine(payTo) ?? t.session.noAccount}
          </p>
          <p className="text-sm text-muted">{payTo.cashAccepted ? t.session.cashAccepted : t.session.cashNotAccepted}</p>
          <p className="text-xs text-muted">{t.session.paymentFromSettings}</p>
        </div>
      </Card>

      <div className="mt-2 flex flex-col gap-1">
        {/* QA-04: the same message right where the user tapped (quiet copy; the alert above is announced). */}
        {state.error && (
          <Notice kind="error" live={false} className="mb-1">
            {state.error}
          </Notice>
        )}
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
