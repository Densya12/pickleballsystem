"use client";

import { useState } from "react";
import { SaveAsMember } from "@/components/session/SaveAsMember";
import { BottomSheet, Button, EmptyState, ListGroup, Section, StatusChip } from "@/components/ui";
import { PauseIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { courtsLineup, type LineupPlayer, type LinePlayer } from "@/lib/player/courts";
import type { CallRules } from "@/lib/player/state";
import type { LiveState, QueueEntry } from "@/lib/queue/data";
import { LevelBadge } from "@/components/level/LevelBadge";
import { LevelPicker } from "@/components/level/LevelPicker";
import { isNewCheckIn, levelLabel, levelNumber, type Level } from "@/lib/queue/players";
import { playerBand, predictedIds } from "@/lib/queue/preview";
import { useNow } from "@/lib/useNow";
import { useSessionFrame } from "./SessionFrame";

/**
 * Queue tab (D19): "Up next" (the front of the line: the next 4 eligible, or 2
 * when every court is singles, through the last player of the server's next
 * group), "After that", and "On hold" (unpaid under pay first, or resting).
 * Always true queue order with real place numbers: nobody moves (D25). The
 * next group is tagged "Next" in place; a player passed over for level says
 * which group they wait for. Tap a row for its actions.
 */
export function QueueView({ state, rules, sessionId }: { state: LiveState; rules: CallRules; sessionId: string }) {
  const t = useT();
  const now = useNow();
  const [openId, setOpenId] = useState<string | null>(null);
  const byId = new Map(state.queue.map((p) => [p.id, p]));
  const open = openId ? (byId.get(openId) ?? null) : null;
  const lineup = courtsLineup(
    state.queue.map((p) => ({ id: p.id, name: p.name, status: p.status, queuePos: p.position, paymentStatus: p.paymentStatus })),
    state.courts.map((c) => c.format),
    rules,
    Infinity,
    // D25: the group the server will call, tagged in place ([]: no group fits yet).
    predictedIds(state.preview, state.courts.map((c) => c.format)),
  );

  if (state.queue.length === 0) return <EmptyState>{t.live.queueEmpty}</EmptyState>;

  const preset = state.preview?.preset ?? "fair_line";
  const waitingFor = (level: string | undefined) => {
    const band = playerBand(preset, levelNumber(level));
    return band ? t.live.waitingBand(t.levels.groupBand(band[0], band[1])) : t.live.waitingAnyGroup;
  };

  const row = (player: LineupPlayer | LinePlayer, tone: "line" | "hold", reason?: "unpaid" | "resting") => {
    const entry = byId.get(player.id);
    const place = "place" in player ? player : null;
    const next = place?.next ?? false;
    return (
      <li key={player.id} className={cn(next && "bg-accent-faint")}>
        <button
          type="button"
          onClick={() => setOpenId(player.id)}
          className="flex min-h-12 w-full items-center gap-3 px-4 py-[11px] text-left hover:bg-info focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
        >
          {tone === "line" && place && (
            <span
              className={cn(
                "flex size-[26px] shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                next ? "bg-accent text-on-accent" : "bg-subtle text-ink",
              )}
            >
              <span className="sr-only">#</span>
              {place.place}
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium [overflow-wrap:anywhere]">{player.name}</span>
              {next && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent" data-testid="next-tag">
                  {t.live.nextTag}
                </span>
              )}
              {entry && isNewCheckIn(entry, now) && (
                // QA-05: phone check-ins from the last 10 minutes, so a flood is easy to spot.
                // "Next" is the only filled lime pill; "New" is a neutral outline (D26 follow-up).
                <span className="rounded-full border border-field px-2 py-px text-xs font-semibold text-secondary" data-testid="new-tag">
                  {t.live.newPlayer}
                </span>
              )}
            </span>
            {place?.passedOver && (
              <span className="text-sm text-muted" data-testid="waiting-for">
                {waitingFor(entry?.level)}
              </span>
            )}
          </span>
          {entry && <LevelBadge level={entry.level} />}
          {reason && <StatusChip kind={reason} />}
        </button>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {lineup.ready.length > 0 && (
        <Section id="up-next" label={t.live.upNextSection}>
          <ListGroup>{lineup.ready.map((p) => row(p, "line"))}</ListGroup>
        </Section>
      )}
      {lineup.after.length > 0 && (
        <Section id="after-that" label={t.live.afterThat}>
          <ListGroup>{lineup.after.map((p) => row(p, "line"))}</ListGroup>
        </Section>
      )}
      {lineup.notCallable.length > 0 && (
        <Section id="on-hold" label={t.live.onHold}>
          <ListGroup>{lineup.notCallable.map((p) => row(p, "hold", p.reason))}</ListGroup>
        </Section>
      )}

      <PlayerSheet sessionId={sessionId} player={open} onClose={() => setOpenId(null)} />
    </div>
  );
}

/** Pause / Resume, Remove (with confirm), Save as member. */
function PlayerSheet({ sessionId, player, onClose }: { sessionId: string; player: QueueEntry | null; onClose: () => void }) {
  const t = useT();
  const { act, busy } = useSessionFrame();
  const [confirming, setConfirming] = useState(false);
  const [level, setLevel] = useState<Level | null>(null);

  async function saveLevel() {
    if (!player || level === null) return;
    if (await act("set_player_level", { playerId: player.id, level }, t.live.outboxLevel(player.name, levelLabel(level, t)))) close();
  }

  async function run(kind: "pause_player" | "resume_player" | "remove_player") {
    if (!player) return;
    const label =
      kind === "pause_player"
        ? t.live.outboxPause(player.name)
        : kind === "resume_player"
          ? t.live.outboxResume(player.name)
          : t.live.outboxRemove(player.name);
    if (await act(kind, { playerId: player.id }, label)) close();
  }

  function close() {
    setConfirming(false);
    setLevel(null);
    onClose();
  }

  return (
    <BottomSheet
      open={player !== null}
      onClose={close}
      title={player?.name ?? ""}
      subtitle={player ? t.live.placeInLine(player.position, levelLabel(player.level, t)) : undefined}
    >
      {player &&
        (level !== null ? (
          // D25: the organizer sets a player's level mid-session (also saved on their member record).
          <div className="flex flex-col gap-3 rounded-group bg-surface p-4">
            <LevelPicker legend={t.levels.changeTitle(player.name)} name="sheet-level" value={level} onValueChange={setLevel} />
            <Button size="md" fullWidth disabled={busy} onClick={() => void saveLevel()}>
              {t.levels.save}
            </Button>
            <Button variant="ghost" size="md" fullWidth disabled={busy} onClick={() => setLevel(null)}>
              {t.common.cancel}
            </Button>
          </div>
        ) : confirming ? (
          <div className="flex flex-col gap-2 rounded-group bg-surface p-4">
            <p className="font-medium">{t.live.removeQuestion(player.name)}</p>
            <Button variant="danger-outline" size="md" fullWidth disabled={busy} onClick={() => void run("remove_player")}>
              {busy ? t.live.removing : t.live.yesRemove}
            </Button>
            <Button variant="ghost" size="md" fullWidth disabled={busy} onClick={() => setConfirming(false)}>
              {t.common.cancel}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {player.status === "paused" ? (
              <Button size="lg" fullWidth disabled={busy} onClick={() => void run("resume_player")}>
                {t.live.resume}
              </Button>
            ) : (
              <Button size="lg" fullWidth disabled={busy} onClick={() => void run("pause_player")}>
                <PauseIcon className="size-4" />
                {t.live.pause}
              </Button>
            )}
            <Button variant="secondary" size="md" fullWidth onClick={() => setLevel(player.level as Level)}>
              {t.levels.change}
              <LevelBadge level={player.level} />
            </Button>
            <div className="rounded-group bg-surface p-3">
              <SaveAsMember key={player.id} sessionId={sessionId} playerId={player.id} playerName={player.name} isMember={player.memberId !== null} />
            </div>
            <Button variant="danger" size="md" fullWidth className="bg-surface" disabled={busy} onClick={() => setConfirming(true)}>
              {t.live.remove}
            </Button>
            <Button variant="ghost" size="md" fullWidth onClick={close}>
              {t.common.close}
            </Button>
          </div>
        ))}
    </BottomSheet>
  );
}
