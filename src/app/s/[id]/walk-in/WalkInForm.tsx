"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { Button, Input, Notice, RadioGroup } from "@/components/ui";
import { PlusIcon } from "@/components/ui/icons";
import { formatPeso } from "@/lib/format";
import { matchesMember, type Member } from "@/lib/members/members";
import { isNetworkError } from "@/lib/outbox/rules";
import { useOutbox } from "@/lib/outbox/useOutbox";
import { REFERENCE_MESSAGES } from "@/lib/payments/reference";
import {
  levelLabel,
  LEVELS,
  parseWalkIn,
  parseWalkInPayment,
  PLAYER_NAME_MAX,
  WALK_IN_PAYMENT_CHOICES,
} from "@/lib/queue/players";
import { sendOrganizerAction } from "../outbox-send";
import { addWalkInAction, type WalkInRequest } from "./actions";

type Errors = { display_name?: string; level?: string; payment?: string; reference?: string; form?: string };

const MATCHES_SHOWN = 5;

/**
 * BR20 walk-in. "Pumili sa members" fills the name and level and links the
 * member (one tap plus payment for regulars). Without signal the walk-in is
 * saved to the outbox and added when the signal returns (NF10).
 */
export function WalkInForm({ sessionId, fee, members = [] }: { sessionId: string; fee: number; members?: Member[] }) {
  const router = useRouter();
  const outbox = useOutbox(sessionId, sendOrganizerAction);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Member | null>(null);
  // One id per walk-in on this phone, so a resend never adds the player twice.
  const clientId = useRef<string | null>(null);

  const matches = query.trim() ? members.filter((m) => matchesMember(m, query)).slice(0, MATCHES_SHOWN) : [];

  function backToLive() {
    // Without signal, only the page already in memory can be shown.
    if (window.history.length > 1) router.back();
    else router.push(`/s/${sessionId}/live`);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = parseWalkIn(form);
    const paid = parseWalkInPayment(fee, String(form.get("payment") ?? ""), String(form.get("reference") ?? ""));
    if (!parsed.ok || !paid.ok) {
      setErrors({ ...(parsed.ok ? {} : parsed.errors), ...(paid.ok ? {} : paid.errors) });
      return;
    }
    setErrors({});
    clientId.current ??= crypto.randomUUID();
    const request: Omit<WalkInRequest, "openLive"> = {
      display_name: parsed.data.display_name,
      level: parsed.data.level,
      payment: paid.payment ?? "",
      reference: String(form.get("reference") ?? ""),
      clientId: clientId.current,
      memberId: picked?.id ?? null,
    };

    const action = { kind: "add_walk_in" as const, args: request, label: `Walk-in: ${parsed.data.display_name}` };
    // No signal, or older actions still waiting: save it behind them (NF10).
    if (!navigator.onLine || outbox.pending.length > 0) {
      outbox.enqueue(action);
      backToLive();
      return;
    }
    startTransition(async () => {
      let result;
      try {
        // On success the action opens Live itself (a server redirect, with fresh data).
        result = await addWalkInAction(sessionId, { ...request, openLive: true });
      } catch (caught) {
        if (!isNetworkError(caught)) throw caught;
        outbox.enqueue(action);
        backToLive();
        return;
      }
      if (result.fieldErrors) setErrors(result.fieldErrors);
      else if (result.error) setErrors({ form: result.error });
    });
  }

  const pickKey = picked?.id ?? "typed";

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {!outbox.online && <Notice kind="info">Offline — ise-save pagbalik ng signal.</Notice>}
      {errors.form && <Notice kind="error">{errors.form}</Notice>}

      {members.length > 0 &&
        (picked ? (
          <div className="flex items-center justify-between gap-3 rounded-control bg-primary-tint px-4 py-3">
            <span className="min-w-0">
              <span className="block text-muted">Napiling member</span>
              <span className="font-semibold [overflow-wrap:anywhere]">{picked.name}</span>
            </span>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="min-h-12 shrink-0 rounded-control px-3 font-semibold underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-focus"
            >
              Alisin
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Input
              label="Pumili sa members"
              type="search"
              autoComplete="off"
              placeholder="Hanapin ang pangalan"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
            />
            {query.trim() !== "" &&
              (matches.length > 0 ? (
                <ul aria-label="Mga member na tugma" className="flex flex-col divide-y divide-default rounded-control border border-default bg-surface">
                  {matches.map((member) => (
                    <li key={member.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPicked(member);
                          setQuery("");
                        }}
                        className="flex min-h-12 w-full flex-col items-start justify-center px-4 py-2 text-left hover:bg-subtle focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
                      >
                        <span className="font-semibold [overflow-wrap:anywhere]">{member.name}</span>
                        <span className="text-sm text-muted">{levelLabel(member.level)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">Walang tugma. I-type na lang ang pangalan sa ibaba.</p>
              ))}
          </div>
        ))}

      <Input
        key={`name-${pickKey}`}
        label="Pangalan"
        name="display_name"
        required
        maxLength={PLAYER_NAME_MAX}
        autoComplete="off"
        placeholder="hal. Tito Boy"
        defaultValue={picked?.name}
        error={errors.display_name}
      />
      <RadioGroup
        key={`level-${pickKey}`}
        legend="Level"
        name="level"
        options={LEVELS}
        defaultValue={(picked?.level ?? "unsure") as (typeof LEVELS)[number]["value"]}
        error={errors.level}
      />
      {fee > 0 && (
        <div
          className="flex flex-col gap-5"
          onChange={() => setErrors((current) => ({ ...current, payment: undefined, reference: undefined }))}
        >
          <RadioGroup
            legend={`Bayad · ${formatPeso(fee)}`}
            name="payment"
            options={WALK_IN_PAYMENT_CHOICES}
            // D18: no default. The organizer must pick, so nobody is held under pay_first by accident.
            error={errors.payment}
          />
          <Input
            label="GCash reference number (kung GCash)"
            name="reference"
            inputMode="numeric"
            autoComplete="off"
            hint={REFERENCE_MESSAGES.hint}
            error={errors.reference}
          />
        </div>
      )}
      <Button type="submit" size="lg" fullWidth disabled={pending}>
        <PlusIcon />
        {pending ? "Inilalagay…" : "Ilagay sa pila"}
      </Button>
    </form>
  );
}
