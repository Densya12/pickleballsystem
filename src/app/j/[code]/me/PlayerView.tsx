"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { MiniCourt } from "@/components/court/MiniCourt";
import { LanguageSwitch } from "@/components/i18n/LanguageSwitch";
import { Button, ListGroup, Notice, PageShell } from "@/components/ui";
import { BellIcon, CheckIcon, ChevronRightIcon, GridIcon, PauseIcon } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/client";
import type { PlayerSessionView } from "@/lib/player/data";
import { playerErrorMessage } from "@/lib/player/messages";
import { callSizeFor, pickPwestoState } from "@/lib/player/state";
import { useCalledAlert } from "@/lib/player/useCalledAlert";
import { useScreenWakeLock } from "@/lib/player/useScreenWakeLock";
import { useSessionSync } from "@/lib/realtime/useSessionSync";
import { courtFormatLabel } from "@/lib/session/validation";
import { createClient } from "@/lib/supabase/client";
import { PaymentRow } from "./PaymentPanel";

type PlayerRpc = "player_pause" | "player_resume" | "player_leave" | "player_not_ready";

/** "My place": in line, called ("You're up"), playing, or resting. Updates live (NF9). */
export function PlayerView({ code, view }: { code: string; view: PlayerSessionView }) {
  const t = useT();
  const router = useRouter();
  const sync = useSessionSync(view.session.id);
  const state = pickPwestoState({
    sessionStatus: view.session.status,
    me: view.me,
    players: view.players,
    games: view.games,
    callSize: callSizeFor(view.courtFormats),
    rules: view.rules,
  });
  const name = view.me?.name ?? "";
  const firstName = name.split(/\s+/)[0] ?? name;

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<"leave" | "not_ready" | null>(null);

  const playingGame = state.kind === "playing" ? state.gameId : null;
  const { acked, acknowledge } = useCalledAlert(playingGame);
  // Screen stays on while waiting or playing; released when resting, left or ended.
  const wakeLock = useScreenWakeLock(state.kind === "queued" || state.kind === "playing");

  async function act(rpc: PlayerRpc) {
    if (!view.me) return;
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc(rpc, { p_player_id: view.me.id });
    setBusy(false);
    setConfirming(null);
    if (rpcError) {
      setError(playerErrorMessage(rpcError, t));
      return;
    }
    if (rpc === "player_leave") {
      router.replace(`/j/${code}/bye`);
      return;
    }
    router.refresh();
  }

  const top = (
    <>
      <span />
      <LanguageSwitch />
    </>
  );
  const notices = (
    <>
      {sync === "lost" && <Notice kind="error">{t.live.connectionLost}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
    </>
  );
  const paymentRow = view.me ? (
    <PaymentRow playerId={view.me.id} fee={view.rules.fee} payFirst={view.rules.payFirst} gcash={view.gcash} payment={view.payment} />
  ) : null;
  const courtsRow = (
    <li>
      <Link
        href={`/j/${code}/courts`}
        className="flex min-h-12 items-center gap-3 px-4 py-3 hover:bg-info focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
      >
        <GridIcon className="size-5 text-muted" />
        <span className="flex-1 font-medium">{t.player.viewCourts}</span>
        <ChevronRightIcon className="size-4 text-[#9aa09c]" />
      </Link>
    </li>
  );
  const keepOpen = (
    <p className="px-6 text-center text-xs text-muted">{wakeLock.supported ? t.player.keepOpen : t.player.keepScreenOn}</p>
  );
  const leave = (
    <Confirmable
      open={confirming === "leave"}
      label={t.player.leave}
      question={t.player.leaveQuestion}
      confirmLabel={busy ? t.player.leaving : t.player.yesLeave}
      busy={busy}
      onOpen={() => setConfirming("leave")}
      onConfirm={() => void act("player_leave")}
      onCancel={() => setConfirming(null)}
    />
  );

  // You're up: a full dark screen until "On my way".
  if (state.kind === "playing" && !acked) {
    const game = view.games.find((g) => g.id === state.gameId);
    return (
      <div className="flex min-h-dvh flex-col bg-primary text-on-primary" data-live-sync={sync} data-state="playing">
        <div className="mx-auto flex w-full max-w-app flex-1 flex-col px-6 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex min-h-11 items-center justify-between">
            <span className="text-sm text-on-dark-muted">{view.session.name}</span>
            <LanguageSwitch />
          </div>
          <div role="alert" className="mt-6 flex flex-col">
            <p className="inline-flex items-center gap-2 self-start rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent">
              <BellIcon className="size-3.5" />
              {t.player.youreUp}
            </p>
            <h1 className="mt-4 font-display text-3xl leading-[1.1] font-semibold tracking-[-0.8px] [overflow-wrap:anywhere]">
              {t.player.yourTurn(firstName)}
            </h1>
            <p className="mt-4 text-body text-on-dark-muted">{t.player.headTo}</p>
            <p className="font-display text-display-court leading-none font-semibold tracking-[-2px] text-accent">{state.courtLabel}</p>
          </div>
          <p className="mt-4 text-sm text-on-dark-muted">{t.player.highlighted(courtFormatLabel(state.format, t))}</p>
          <p className="mt-1 text-body font-semibold" data-testid="my-side">
            {t.player.yourSide(state.side, state.partnerName)}
          </p>
          {game && (
            <MiniCourt
              className="mt-2.5"
              format={game.format}
              players={game.playerIds.map((id) => ({
                id,
                name: view.players.find((p) => p.id === id)?.name ?? "?",
                highlight: id === view.me?.id,
              }))}
            />
          )}
          {notices}
          {state.notReady && (
            <p role="status" className="mt-4 rounded-control bg-surface/10 px-3.5 py-2.5 text-sm">
              {t.player.notReadyNoted}
            </p>
          )}
          <div className="mt-auto flex flex-col items-center gap-2 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <Button variant="lime" size="lg" fullWidth className="min-h-[54px]" onClick={acknowledge}>
              {t.player.onMyWay}
            </Button>
            {!state.notReady &&
              (confirming === "not_ready" ? (
                <div className="flex w-full flex-col gap-2 rounded-control bg-surface/10 p-3">
                  <p className="text-sm">{t.player.notReadyQuestion}</p>
                  <Button variant="secondary" size="md" fullWidth disabled={busy} onClick={() => void act("player_not_ready")}>
                    {busy ? t.player.notifying : t.player.yesNotReady}
                  </Button>
                  <Button variant="ghost" size="md" fullWidth className="text-on-primary hover:bg-surface/10" onClick={() => setConfirming(null)}>
                    {t.common.cancel}
                  </Button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirming("not_ready")} className="min-h-10 text-sm font-medium text-[#e8e8e3]">
                  {t.player.notReadyYet}
                </button>
              ))}
          </div>
        </div>
      </div>
    );
  }

  let body: ReactNode = null;
  let title = "";
  let footer: ReactNode = null;

  if (state.kind === "queued") {
    title = t.player.hi(firstName);
    body = (
      <>
        <div className="flex flex-col items-center rounded-[24px] bg-surface px-5 pt-6 pb-5 text-center">
          <p className="text-sm text-muted">{t.player.yourPlace}</p>
          <p className="mt-0.5 font-display text-display-number leading-none font-semibold tracking-[-2px]" data-testid="position">
            {state.position}
          </p>
          {state.nextUp && (
            <p className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-on-accent-soft">
              <CheckIcon className="size-3.5" />
              {t.player.nextGroup}
            </p>
          )}
          <p className="mt-4 text-sm text-muted" data-testid="ahead">
            {state.ahead.length > 0 ? t.player.aheadOfYou(state.ahead.join(", ")) : t.player.firstInLine}
          </p>
        </div>
        <ListGroup>
          {paymentRow}
          {courtsRow}
        </ListGroup>
        {keepOpen}
      </>
    );
    footer = (
      <div className="flex flex-col items-center gap-1">
        <Button variant="secondary" size="lg" fullWidth disabled={busy} onClick={() => void act("player_pause")}>
          <PauseIcon className="size-[18px]" />
          {t.player.takeBreak}
        </Button>
        {leave}
      </div>
    );
  } else if (state.kind === "paused") {
    title = t.player.restingTitle;
    body = (
      <>
        <Notice kind="info">{t.player.restingBody(state.position)}</Notice>
        <ListGroup>
          {paymentRow}
          {courtsRow}
        </ListGroup>
      </>
    );
    footer = (
      <div className="flex flex-col items-center gap-1">
        <Button size="lg" fullWidth disabled={busy} onClick={() => void act("player_resume")}>
          {t.player.ready}
        </Button>
        {leave}
      </div>
    );
  } else if (state.kind === "playing") {
    const game = view.games.find((g) => g.id === state.gameId);
    title = t.player.playingOn(state.courtLabel);
    body = (
      <>
        {game && (
          <div className="flex flex-col gap-2 rounded-card bg-surface p-3.5">
            <p className="text-xs text-muted">
              {courtFormatLabel(state.format, t)} · {t.player.yourSide(state.side, state.partnerName)}
            </p>
            <MiniCourt
              format={game.format}
              players={game.playerIds.map((id) => ({ id, name: view.players.find((p) => p.id === id)?.name ?? "?", highlight: id === view.me?.id }))}
            />
            <ul className="sr-only" aria-label={state.format === "singles" ? t.player.opponent : t.player.withYou}>
              {state.withNames.map((n, i) => (
                <li key={`${n}-${i}`}>{n}</li>
              ))}
            </ul>
          </div>
        )}
        {state.notReady && <Notice kind="info">{t.player.notReadyNoted}</Notice>}
        <ListGroup>
          {paymentRow}
          {courtsRow}
        </ListGroup>
      </>
    );
    footer = state.notReady ? null : (
      <Confirmable
        open={confirming === "not_ready"}
        label={t.player.notReadyYet}
        question={t.player.notReadyQuestion}
        confirmLabel={busy ? t.player.notifying : t.player.yesNotReady}
        busy={busy}
        onOpen={() => setConfirming("not_ready")}
        onConfirm={() => void act("player_not_ready")}
        onCancel={() => setConfirming(null)}
      />
    );
  }

  return (
    <PageShell top={top} eyebrow={view.session.name} title={title} footer={footer}>
      <div className="flex flex-col gap-3" data-live-sync={sync} data-state={state.kind}>
        {notices}
        {body}
      </div>
    </PageShell>
  );
}

/** A red text button that asks before acting. */
function Confirmable(props: {
  open: boolean;
  label: string;
  question: string;
  confirmLabel: string;
  busy: boolean;
  onOpen: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  if (!props.open) {
    return (
      <Button variant="danger" size="md" disabled={props.busy} onClick={props.onOpen}>
        {props.label}
      </Button>
    );
  }
  return (
    <div role="group" aria-label={props.question} className="flex w-full flex-col gap-2 rounded-group bg-surface p-4">
      <p className="font-medium">{props.question}</p>
      <Button variant="danger-outline" size="md" fullWidth disabled={props.busy} onClick={props.onConfirm}>
        {props.confirmLabel}
      </Button>
      <Button variant="ghost" size="md" fullWidth disabled={props.busy} onClick={props.onCancel}>
        {t.common.cancel}
      </Button>
    </div>
  );
}
