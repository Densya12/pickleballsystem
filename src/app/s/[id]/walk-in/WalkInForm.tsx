"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { Button, Card, Input, ListGroup, Notice, RadioGroup } from "@/components/ui";
import { PlusIcon, SearchIcon } from "@/components/ui/icons";
import { formatPeso } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { matchesMember, type Member } from "@/lib/members/members";
import { isNetworkError } from "@/lib/outbox/rules";
import { useOutbox } from "@/lib/outbox/useOutbox";
import {
  levelChoices,
  levelLabel,
  parseWalkIn,
  parseWalkInPayment,
  PLAYER_NAME_MAX,
  walkInPaymentChoices,
  type Level,
  type WalkInPayment,
} from "@/lib/queue/players";
import { sendOrganizerAction } from "../_lib/outbox-send";
import { addWalkInAction, type WalkInRequest } from "../_lib/walk-in-actions";

type Errors = { display_name?: string; level?: string; payment?: string; reference?: string; form?: string };

const MATCHES_SHOWN = 5;
const FORM_ID = "walk-in";

/**
 * BR20 walk-in. "From members" fills the name and level and links the member
 * (one tap plus payment for regulars). With a fee there is no default payment
 * choice (D18). Without signal the walk-in is saved to the outbox (NF10).
 */
export function WalkInForm({ sessionId, fee, members = [] }: { sessionId: string; fee: number; members?: Member[] }) {
  const t = useT();
  const router = useRouter();
  const outbox = useOutbox(sessionId, sendOrganizerAction);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Member | null>(null);
  const [payment, setPayment] = useState<WalkInPayment | null>(null);
  // One id per walk-in on this phone, so a resend never adds the player twice.
  const clientId = useRef<string | null>(null);

  const matches = query.trim() ? members.filter((m) => matchesMember(m, query)).slice(0, MATCHES_SHOWN) : [];

  function backToQueue() {
    // Without signal, only the page already in memory can be shown.
    if (window.history.length > 1) router.back();
    else router.push(`/s/${sessionId}/queue`);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = parseWalkIn(form, t);
    const paid = parseWalkInPayment(fee, String(form.get("payment") ?? ""), String(form.get("reference") ?? ""), t);
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
    const action = { kind: "add_walk_in" as const, args: request, label: t.live.outboxWalkIn(parsed.data.display_name) };
    // No signal, or older actions still waiting: save it behind them (NF10).
    if (!navigator.onLine || outbox.pending.length > 0) {
      outbox.enqueue(action);
      backToQueue();
      return;
    }
    startTransition(async () => {
      let result;
      try {
        // On success the action opens the queue itself (a server redirect, with fresh data).
        result = await addWalkInAction(sessionId, { ...request, openLive: true });
      } catch (caught) {
        if (!isNetworkError(caught)) throw caught;
        outbox.enqueue(action);
        backToQueue();
        return;
      }
      if (result.fieldErrors) setErrors(result.fieldErrors);
      else if (result.error) setErrors({ form: result.error });
    });
  }

  const pickKey = picked?.id ?? "typed";

  return (
    <form id={FORM_ID} onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      {!outbox.online && <Notice kind="warning">{t.live.offline}</Notice>}
      {errors.form && <Notice kind="error">{errors.form}</Notice>}

      <Card className="flex flex-col gap-4">
        {members.length > 0 &&
          (picked ? (
            <div className="flex items-center justify-between gap-3 rounded-control bg-accent-faint px-3.5 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm text-muted">{t.live.pickedMember}</span>
                <span className="font-medium [overflow-wrap:anywhere]">{picked.name}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                {t.live.clearMember}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Input
                label={t.live.fromMembers}
                type="search"
                autoComplete="off"
                placeholder={t.live.searchMembers}
                leading={<SearchIcon className="size-4" />}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
              />
              {query.trim() !== "" &&
                (matches.length > 0 ? (
                  <ListGroup aria-label={t.live.membersMatching} className="border border-hairline">
                    {matches.map((member) => (
                      <li key={member.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPicked(member);
                            setQuery("");
                          }}
                          className="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 py-2 text-left hover:bg-info focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
                        >
                          <span className="font-medium [overflow-wrap:anywhere]">{member.name}</span>
                          <span className="shrink-0 text-sm text-muted">{levelLabel(member.level, t)}</span>
                        </button>
                      </li>
                    ))}
                  </ListGroup>
                ) : (
                  <p className="text-sm text-muted">{t.live.noMatch}</p>
                ))}
            </div>
          ))}

        <Input
          key={`name-${pickKey}`}
          label={t.live.name}
          name="display_name"
          required
          maxLength={PLAYER_NAME_MAX}
          autoComplete="off"
          placeholder={t.live.namePlaceholder}
          defaultValue={picked?.name}
          error={errors.display_name}
        />
        <RadioGroup
          key={`level-${pickKey}`}
          legend={t.live.level}
          name="level"
          look="chips"
          options={levelChoices(t)}
          defaultValue={(picked?.level ?? "unsure") as Level}
          error={errors.level}
        />
      </Card>

      {fee > 0 && (
        <Card className="flex flex-col gap-3">
          <RadioGroup
            legend={t.live.payment(formatPeso(fee))}
            name="payment"
            look="list"
            options={walkInPaymentChoices(t)}
            value={payment}
            onValueChange={(value) => {
              setPayment(value);
              setErrors((current) => ({ ...current, payment: undefined, reference: undefined }));
            }}
            // D18: no default. The organizer must pick, so nobody is held under pay first by accident.
            error={errors.payment}
          />
          {payment === "gcash" && (
            <Input
              label={t.live.reference}
              name="reference"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t.live.referencePlaceholder}
              hint={t.payments.referenceHint}
              error={errors.reference}
            />
          )}
        </Card>
      )}

      <Button type="submit" size="lg" fullWidth disabled={pending} className="mt-2">
        <PlusIcon className="size-4" />
        {pending ? t.live.adding : t.live.addToQueue}
      </Button>
    </form>
  );
}
