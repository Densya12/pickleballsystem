"use client";

import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import { SessionTabBar, type SessionTab } from "@/components/nav/SessionTabBar";
import { FeedbackBanner, type UndoOffer } from "@/components/session/FeedbackBanner";
import { OfflineNavGuard } from "@/components/session/OfflineNavGuard";
import { OutboxStatus } from "@/components/session/OutboxStatus";
import { BackLink, BottomSheet, Button, ListGroup, ListRow, Notice, PageShell, RadioGroup, Toggle } from "@/components/ui";
import { ChevronRightIcon } from "@/components/ui/icons";
import { rotationChoices, rotationLabel } from "@/lib/club/options";
import type { Rotation } from "@/lib/club/validation";
import { useT } from "@/lib/i18n/client";
import { isNetworkError, type OutboxItem, type OutboxKind } from "@/lib/outbox/rules";
import { useOutbox } from "@/lib/outbox/useOutbox";
import type { LiveCourt } from "@/lib/queue/data";
import { useSessionSync } from "@/lib/realtime/useSessionSync";
import { undoDeadlineFromNow } from "@/lib/undo/countdown";
import { cn } from "@/lib/cn";
import { sendOrganizerAction } from "../_lib/outbox-send";
import { endSessionAction } from "../_lib/session-actions";
import { undoLastAction } from "../_lib/undo-actions";
import { useTagatawag } from "./useTagatawag";

type ActionResult = { error?: string; banner?: string; undo?: { banner: string } };

type SessionContextValue = {
  sessionId: string;
  busy: boolean;
  online: boolean;
  /** Actions waiting for signal (NF10). */
  pending: readonly OutboxItem[];
  /** An organizer action that can wait for signal. Resolves true when done (or saved to the outbox). */
  act: (kind: OutboxKind, args: OutboxItem["args"], label: string) => Promise<boolean>;
  /** An action that needs the internet now (e.g. "Mark as unpaid"). */
  runOnline: (action: () => Promise<ActionResult>) => Promise<boolean>;
  showError: (message: string) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSessionFrame(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSessionFrame must be used inside <SessionFrame>");
  return value;
}

type Props = {
  session: { id: string; fee: number; rotation: string };
  tab: SessionTab;
  title: string;
  subtitle?: ReactNode;
  /** Right side of the top row (QR, Walk-in, Download). */
  actions?: ReactNode;
  /** For Tagatawag (new games are read aloud from any tab). */
  courts: readonly LiveCourt[];
  queueCount: number;
  paymentsBadge: number;
  /** Session details (server-rendered), shown in More. */
  details: ReactNode;
  /** A banner from another page (adding a walk-in), keyed so each one shows once. */
  incomingBanner?: { key: string; text: string } | null;
  /** After the session ends (Payments only): no tab bar; back goes to the summary. */
  ended?: boolean;
  children: ReactNode;
};

/**
 * The frame of a live session's tabs (Courts · Queue · Payments): top row,
 * title, banners (feedback with Undo, offline outbox, connection), the session
 * tab bar and the More sheet. Realtime, the outbox and Tagatawag behave as
 * before, whichever tab is open.
 */
export function SessionFrame({
  session,
  tab,
  title,
  subtitle,
  actions,
  courts,
  queueCount,
  paymentsBadge,
  details,
  incomingBanner,
  ended = false,
  children,
}: Props) {
  const t = useT();
  const sync = useSessionSync(session.id);
  const tagatawag = useTagatawag(courts, sync);
  const outbox = useOutbox(session.id, sendOrganizerAction);
  const [busy, startTransition] = useTransition();
  const [banner, setBanner] = useState<string | null>(incomingBanner?.text ?? null);
  const [shownKey, setShownKey] = useState(incomingBanner?.key ?? null);
  const [undoOffer, setUndoOffer] = useState<UndoOffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  // A new incoming banner (adjusting state during render, not in an effect).
  if (incomingBanner && incomingBanner.key !== shownKey) {
    setShownKey(incomingBanner.key);
    setBanner(incomingBanner.text);
    setUndoOffer(null);
  }

  // The walk-in banner arrives via ?added=…; drop it from the URL so a reload doesn't repeat it.
  useEffect(() => {
    if (incomingBanner && window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, [incomingBanner]);

  function show(result: ActionResult, deadline: number | null) {
    if (result.error) {
      setError(result.error);
      setBanner(null);
      setUndoOffer(null);
    } else {
      setError(null);
      setBanner(result.banner ?? null);
      setUndoOffer(result.undo && deadline ? { deadline, doneBanner: result.undo.banner } : null);
    }
  }

  function act(kind: OutboxKind, args: OutboxItem["args"], label: string): Promise<boolean> {
    const deadline = undoDeadlineFromNow();
    return new Promise((resolve) => {
      startTransition(async () => {
        let outcome;
        try {
          outcome = await outbox.perform({ kind, args, label });
        } catch {
          show({ error: t.live.unexpected }, null);
          resolve(false);
          return;
        }
        if (outcome.queued) {
          // Listed under "Waiting for signal"; counts as done for the screen.
          setError(null);
          setBanner(null);
          setUndoOffer(null);
          resolve(true);
          return;
        }
        show(outcome.result, deadline);
        resolve(!outcome.result.error);
      });
    });
  }

  function runOnline(action: () => Promise<ActionResult>): Promise<boolean> {
    if (!navigator.onLine) {
      show({ error: t.live.onlineOnly }, null);
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      startTransition(async () => {
        try {
          const result = await action();
          show(result, null);
          resolve(!result.error);
        } catch (caught) {
          if (!isNetworkError(caught)) throw caught;
          show({ error: t.live.onlineOnly }, null);
          resolve(false);
        }
      });
    });
  }

  function undo(offer: UndoOffer) {
    void runOnline(async () => {
      const result = await undoLastAction(session.id);
      setUndoOffer(null);
      return result.error ? result : { banner: offer.doneBanner };
    });
  }

  const context: SessionContextValue = {
    sessionId: session.id,
    busy,
    online: outbox.online,
    pending: outbox.pending,
    act,
    runOnline,
    showError: (message) => show({ error: message }, null),
  };

  return (
    <SessionContext.Provider value={context}>
      <PageShell
        top={
          <>
            {ended ? (
              <BackLink href={`/s/${session.id}`} label={t.session.summaryTitle} />
            ) : (
              <BackLink href="/" label={t.live.homeLink} />
            )}
            <div className="flex items-center gap-2">{actions}</div>
          </>
        }
        title={title}
        subtitle={subtitle}
        tabBar={
          ended ? undefined : (
          <SessionTabBar
            sessionId={session.id}
            current={tab}
            queueCount={queueCount}
            paymentsBadge={paymentsBadge}
            showPayments={session.fee > 0}
            onMore={() => setMoreOpen(true)}
          />
          )
        }
      >
        <div className="flex flex-col gap-4" data-live-sync={sync}>
          <div className="flex flex-col gap-2 empty:hidden" aria-live="polite">
            <OutboxStatus online={outbox.online} pending={outbox.pending} failed={outbox.failed} onDiscard={outbox.discardFailed} />
            {sync === "lost" && outbox.online && <Notice kind="error">{t.live.connectionLost}</Notice>}
            {error && <Notice kind="error">{error}</Notice>}
            {banner && (
              <FeedbackBanner
                text={banner}
                onClose={() => {
                  setBanner(null);
                  setUndoOffer(null);
                }}
                undo={undoOffer && { deadline: undoOffer.deadline, onUndo: () => undo(undoOffer), disabled: busy }}
              />
            )}
          </div>
          {children}
        </div>
      </PageShell>

      <OfflineNavGuard aboveTabBar={!ended} />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        sessionId={session.id}
        rotation={session.rotation}
        onRotation={(rotation) => act("set_rotation", { rotation }, t.live.outboxRotation(rotationLabel(rotation, t)))}
        details={details}
        tagatawag={tagatawag}
      />
    </SessionContext.Provider>
  );
}

/** More: Show QR, After a game, Read calls aloud, Session details, End session (with its confirm step). */
function MoreSheet({
  open,
  onClose,
  sessionId,
  rotation,
  onRotation,
  details,
  tagatawag,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  rotation: string;
  /** Resolves true when changed (or saved to the outbox). */
  onRotation: (rotation: Rotation) => Promise<boolean>;
  details: ReactNode;
  tagatawag: ReturnType<typeof useTagatawag>;
}) {
  const t = useT();
  // The choice shows at once; the server's value takes over once it has caught up.
  const [chosen, setChosen] = useState<Rotation | null>(null);
  if (chosen !== null && chosen === rotation) setChosen(null);
  const [showDetails, setShowDetails] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ending, startEnding] = useTransition();

  function close() {
    setShowDetails(false);
    setConfirmEnd(false);
    setError(null);
    onClose();
  }

  function end() {
    // Never queued offline (NF10): ending needs the server's answer now.
    if (!navigator.onLine) {
      setError(t.live.onlineOnly);
      return;
    }
    setError(null);
    startEnding(async () => {
      try {
        const result = await endSessionAction(sessionId);
        if (result?.error) setError(result.error);
      } catch (caught) {
        // Anything else (including Next's redirect to the summary) is handled by Next.
        if (!isNetworkError(caught)) throw caught;
        setError(t.live.onlineOnly);
      }
    });
  }

  return (
    <BottomSheet open={open} onClose={close} title={t.session.moreTitle}>
      <ListGroup>
        <ListRow href={`/s/${sessionId}/qr`}>{t.session.showQr}</ListRow>
        <li className="px-4 py-3">
          <RadioGroup
            legend={t.live.afterGame}
            hint={t.live.afterGameHint}
            name="rotation"
            look="list"
            options={rotationChoices(t)}
            value={chosen ?? (rotation as Rotation)}
            onValueChange={(next) => {
              setChosen(next);
              void onRotation(next).then((ok) => {
                if (!ok) setChosen(null);
              });
            }}
          />
        </li>
        {tagatawag.supported && (
          <li className="px-4">
            <Toggle
              label={t.live.readAloud}
              description={t.live.readAloudDescription}
              checked={tagatawag.enabled}
              onCheckedChange={tagatawag.setEnabled}
            />
          </li>
        )}
        <li>
          <button
            type="button"
            aria-expanded={showDetails}
            onClick={() => setShowDetails((v) => !v)}
            className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left hover:bg-info focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
          >
            <span className="flex-1">{t.session.details}</span>
            <ChevronRightIcon className={cn("size-4 text-[#9aa09c] transition-transform", showDetails && "rotate-90")} />
          </button>
          {showDetails && <div className="border-t border-hairline">{details}</div>}
        </li>
      </ListGroup>

      {error && <Notice kind="error">{error}</Notice>}
      {confirmEnd ? (
        <div role="group" aria-label={t.session.endQuestion} className="flex flex-col gap-2 rounded-group bg-surface p-4">
          <p className="font-medium">{t.session.endQuestion}</p>
          <Button variant="danger-outline" size="md" fullWidth disabled={ending} onClick={end}>
            {ending ? t.session.ending : t.session.yesEnd}
          </Button>
          <Button variant="ghost" size="md" fullWidth disabled={ending} onClick={() => setConfirmEnd(false)}>
            {t.session.keepGoing}
          </Button>
        </div>
      ) : (
        <Button variant="danger" size="md" fullWidth className="bg-surface" onClick={() => setConfirmEnd(true)}>
          {t.session.endSession}
        </Button>
      )}
    </BottomSheet>
  );
}
