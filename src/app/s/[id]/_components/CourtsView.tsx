"use client";

import { chipLabels } from "@/components/court/MiniCourt";
import { useT } from "@/lib/i18n/client";
import { courtsLineup } from "@/lib/player/courts";
import { bandText, nextPreview, noGroupText, predictedIds, type FormatPreview } from "@/lib/queue/preview";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { CallRules } from "@/lib/player/state";
import type { LiveState } from "@/lib/queue/data";
import { courtFormatLabel } from "@/lib/session/validation";
import { useNow } from "@/lib/useNow";
import { useState } from "react";
import { swapSidesAction } from "../_lib/queue-actions";
import { CourtCard } from "./CourtCard";
import { useSessionFrame } from "./SessionFrame";

/** Courts tab (D19): one card per court, then who's up next. */
export function CourtsView({ state, rotation, rules }: { state: LiveState; rotation: string; rules: CallRules }) {
  const t = useT();
  const now = useNow();
  const { act, busy, pending, showError, runOnline, sessionId } = useSessionFrame();
  const courtById = new Map(state.courts.map((c) => [c.id, c]));
  const nameOf = (playerId: string) =>
    state.courts.flatMap((c) => c.game?.players ?? []).find((p) => p.id === playerId)?.name ?? "player";
  // Courts with an action waiting for signal: their buttons wait too, so nobody taps twice.
  const waitingCourts = new Set(pending.map((item) => item.args.courtId).filter((id): id is string => typeof id === "string"));
  const next = nextPreview(state.preview, state.courts.map((c) => c.format));
  const lineup = courtsLineup(
    state.queue.map((p) => ({ id: p.id, name: p.name, status: p.status, queuePos: p.position, paymentStatus: p.paymentStatus })),
    state.courts.map((c) => c.format),
    rules,
    undefined,
    predictedIds(state.preview, state.courts.map((c) => c.format)),
  );
  const noGroup = next?.status === "no_group" ? next : null;

  // Games on screen when it opened; any other game started since, and its card is highlighted once.
  const [initialGames] = useState(() => new Set(state.courts.flatMap((c) => (c.game ? [c.game.id] : []))));

  return (
    <div className="flex flex-col gap-2.5">
      {state.courts.map((court) => (
        <CourtCard
          key={`${court.id}:${court.game?.id ?? "empty"}`}
          fresh={Boolean(court.game && !initialGames.has(court.game.id))}
          court={court}
          rotation={rotation}
          eligibleCount={state.eligibleCount}
          now={now}
          busy={busy}
          waiting={waitingCourts.has(court.id)}
          preview={state.preview?.formats[court.format] ?? null}
          onCall={(courtId) => void act("call_next", { courtId }, t.live.outboxCall(courtById.get(courtId)?.label ?? "court"))}
          onCallMixed={(courtId) => void act("call_mixed", { courtId }, t.live.outboxCallMixed(courtById.get(courtId)?.label ?? "court"))}
          onNeedMore={(needed) => showError(t.live.needMoreMessage(needed))}
          onFinish={(courtId, gameId, winners) =>
            void act("finish_game", { courtId, gameId, winnerIds: winners }, t.live.outboxFinish(court.game?.number ?? "?", court.label))
          }
          onSwap={(courtId, playerId) => void act("swap_not_ready", { courtId, playerId }, t.live.outboxSwap(nameOf(playerId), court.label))}
          onSwapSides={(courtId, playerId, otherId) =>
            // Not queued: a resend would swap them back. Needs signal (like Undo).
            void runOnline(() => swapSidesAction(sessionId, courtId, playerId, otherId))
          }
          onSetFormat={(courtId, format) =>
            void act("set_court_format", { courtId, format }, t.live.outboxFormat(courtFormatLabel(format, t), court.label))
          }
        />
      ))}
      <p className="flex flex-wrap items-baseline gap-x-2.5 px-1.5 pt-1 text-sm">
        <span className="text-muted">{t.live.upNext}</span>
        <span className="font-medium">
          {lineup.ready.length > 0
            ? chipLabels(lineup.ready.map((p) => p.name)).join(", ") + explainBand(t, next)
            : noGroup
              ? noGroupText(t, noGroup)
              : t.live.nobodyWaiting}
        </span>
      </p>
    </div>
  );
}

/** " · levels 2–4" after the Up next names (Mixed / Same level). */
function explainBand(t: Dictionary, preview: FormatPreview | null): string {
  const band = preview ? bandText(t, preview.lo, preview.hi) : null;
  return band ? ` · ${band}` : "";
}
