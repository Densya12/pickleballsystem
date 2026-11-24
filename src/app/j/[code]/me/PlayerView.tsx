"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button, Card, Notice, PageShell } from "@/components/ui";
import { BallIcon, PauseIcon } from "@/components/ui/icons";
import { playCalledAlert, unlockAudio } from "@/lib/player/alert";
import type { PlayerSessionView } from "@/lib/player/data";
import { playerErrorMessage } from "@/lib/player/messages";
import { callSizeFor, pickPwestoState } from "@/lib/player/state";
import { useSessionSync } from "@/lib/realtime/useSessionSync";
import { createClient } from "@/lib/supabase/client";

type PlayerRpc = "player_pause" | "player_resume" | "player_leave" | "player_not_ready";

const ACK_KEY = (gameId: string) => `opq:ack:${gameId}`;

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readAck(gameId: string): boolean {
  try {
    return window.localStorage.getItem(ACK_KEY(gameId)) === "1";
  } catch {
    return false;
  }
}

/** "Pwesto sa pila": queued, called/playing, or paused. Updates live (NF9). */
export function PlayerView({ code, view }: { code: string; view: PlayerSessionView }) {
  const router = useRouter();
  const sync = useSessionSync(view.session.id);
  const state = pickPwestoState({
    sessionStatus: view.session.status,
    me: view.me,
    players: view.players,
    games: view.games,
    callSize: callSizeFor(view.courtFormats),
  });
  const name = view.me?.name ?? "";

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<"leave" | "not_ready" | null>(null);
  const [acked, setAcked] = useState<Record<string, boolean>>({});

  const playingGame = state.kind === "playing" ? state.gameId : null;
  // "Papunta na ako" is remembered per game on this phone, so a reload doesn't alert again.
  const storedAck = useSyncExternalStore(
    subscribeToStorage,
    () => (playingGame ? readAck(playingGame) : false),
    () => false,
  );
  const isAcked = playingGame ? (acked[playingGame] ?? false) || storedAck : false;

  // A reload loses the audio unlock from "Pumila na"; any tap here restores it.
  useEffect(() => {
    window.addEventListener("pointerdown", unlockAudio);
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, []);

  // Called: chime and vibrate once per game, unless already acknowledged.
  const alertedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!playingGame || alertedFor.current === playingGame) return;
    alertedFor.current = playingGame;
    if (!readAck(playingGame)) playCalledAlert();
  }, [playingGame]);

  async function act(rpc: PlayerRpc) {
    if (!view.me) return;
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc(rpc, { p_player_id: view.me.id });
    setBusy(false);
    setConfirming(null);
    if (rpcError) {
      setError(playerErrorMessage(rpcError));
      return;
    }
    if (rpc === "player_leave") {
      router.replace(`/j/${code}/bye`);
      return;
    }
    router.refresh();
  }

  function acknowledge(gameId: string) {
    try {
      window.localStorage.setItem(ACK_KEY(gameId), "1");
    } catch {
      // Remembered for this page view only.
    }
    setAcked((current) => ({ ...current, [gameId]: true }));
  }

  const leaveButtons = (
    <ConfirmableButton
      open={confirming === "leave"}
      label="Aalis na ako"
      question="Aalis ka na sa pila? Kung babalik ka, sa dulo ka na ng pila."
      confirmLabel={busy ? "Umaalis…" : "Oo, aalis na ako"}
      busy={busy}
      onOpen={() => setConfirming("leave")}
      onConfirm={() => void act("player_leave")}
      onCancel={() => setConfirming(null)}
    />
  );

  let body: ReactNode = null;
  if (state.kind === "queued") {
    body = (
      <>
        <Header eyebrow={view.session.name} title={`Hi, ${name}!`} />
        <Card className="flex flex-col gap-2 text-center">
          <p className="text-muted">Ikaw ay</p>
          <p className="font-display text-6xl font-bold" data-testid="position">
            #{state.position}
          </p>
          <p className="text-muted">sa pila</p>
        </Card>
        {state.nextUp && <Notice kind="success">Sa susunod na bakanteng court ka na</Notice>}
        {state.ahead.length > 0 && (
          <section aria-labelledby="ahead-heading" className="flex flex-col gap-2">
            <h2 id="ahead-heading" className="text-xl">
              Mga nauuna sa iyo
            </h2>
            <ul className="flex flex-col divide-y divide-default rounded-card border border-default bg-surface">
              {state.ahead.map((aheadName, index) => (
                <li key={`${aheadName}-${index}`} className="px-4 py-3 font-semibold [overflow-wrap:anywhere]">
                  {aheadName}
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="text-muted">Kapag tinawag ka, tutunog ang phone mo at lalabas dito ang court mo.</p>
        <div className="flex flex-col gap-3">
          <Button variant="secondary" size="lg" fullWidth disabled={busy} onClick={() => void act("player_pause")}>
            <PauseIcon />
            Pahinga muna
          </Button>
          {leaveButtons}
        </div>
      </>
    );
  } else if (state.kind === "paused") {
    body = (
      <>
        <Header eyebrow={view.session.name} title="Nagpapahinga ka" />
        <Notice kind="info">
          Naka-hold ang pwesto mo (#{state.position}). Hindi ka muna tatawagin hangga&apos;t hindi ka bumabalik.
        </Notice>
        <div className="flex flex-col gap-3">
          <Button size="lg" fullWidth disabled={busy} onClick={() => void act("player_resume")}>
            Handa na ulit akong maglaro
          </Button>
          {leaveButtons}
        </div>
      </>
    );
  } else if (state.kind === "playing") {
    body = (
      <>
        {isAcked ? (
          <Header eyebrow={view.session.name} title={`Naglalaro ka sa ${state.courtLabel}`} />
        ) : (
          <div role="alert" className="flex flex-col gap-3 rounded-card border-[1.5px] border-ink bg-accent p-5">
            <p className="inline-flex items-center gap-2 text-lg font-bold">
              <BallIcon />
              Ikaw na, {name}!
            </p>
            <p className="font-display text-3xl font-bold">Pumunta ka na sa {state.courtLabel}</p>
          </div>
        )}
        {state.format === "singles" ? (
          <p className="rounded-control bg-primary-tint px-4 py-3 text-xl font-semibold [overflow-wrap:anywhere]">
            Kalaban mo: {state.withNames[0]}
          </p>
        ) : (
          <section aria-labelledby="with-heading" className="flex flex-col gap-2">
            <h2 id="with-heading" className="text-xl">
              Kasama mo sa court:
            </h2>
            <ul className="grid grid-cols-1 gap-2">
              {state.withNames.map((withName, index) => (
                <li key={`${withName}-${index}`} className="rounded-control bg-primary-tint px-4 py-3 font-semibold [overflow-wrap:anywhere]">
                  {withName}
                </li>
              ))}
            </ul>
          </section>
        )}
        {state.notReady && (
          <Notice kind="info">Sinabihan na ang organizer. Hintayin mong palitan ka; babalik ka sa unahan ng pila.</Notice>
        )}
        <div className="flex flex-col gap-3">
          {!isAcked && (
            <Button size="lg" fullWidth onClick={() => acknowledge(state.gameId)}>
              Papunta na ako
            </Button>
          )}
          {!state.notReady && (
            <ConfirmableButton
              open={confirming === "not_ready"}
              label="Hindi pa ako handa (ibalik sa pila)"
              question="Ibalik ka sa pila? Papalitan ka ng susunod, at ikaw ang mauuna pagkatapos."
              confirmLabel={busy ? "Sinasabihan ang organizer…" : "Oo, hindi pa ako handa"}
              busy={busy}
              onOpen={() => setConfirming("not_ready")}
              onConfirm={() => void act("player_not_ready")}
              onCancel={() => setConfirming(null)}
            />
          )}
        </div>
      </>
    );
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-5 pt-6" data-live-sync={sync} data-state={state.kind}>
        {sync === "lost" && <Notice kind="error">Nawalan ng koneksyon. Sinusubukang kumonekta ulit…</Notice>}
        {error && <Notice kind="error">{error}</Notice>}
        {body}
      </div>
    </PageShell>
  );
}

function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted [overflow-wrap:anywhere]">{eyebrow}</p>
      <h1 className="text-3xl [overflow-wrap:anywhere]">{title}</h1>
    </div>
  );
}

function ConfirmableButton(props: {
  open: boolean;
  label: string;
  question: string;
  confirmLabel: string;
  busy: boolean;
  onOpen: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!props.open) {
    return (
      <Button variant="danger-outline" fullWidth disabled={props.busy} onClick={props.onOpen}>
        {props.label}
      </Button>
    );
  }
  return (
    <div role="group" aria-label={props.question} className="flex flex-col gap-2 rounded-control border-[1.5px] border-ink bg-surface p-4">
      <p className="font-semibold">{props.question}</p>
      <Button variant="danger-outline" fullWidth disabled={props.busy} onClick={props.onConfirm}>
        {props.confirmLabel}
      </Button>
      <Button variant="secondary" fullWidth disabled={props.busy} onClick={props.onCancel}>
        Huwag
      </Button>
    </div>
  );
}
