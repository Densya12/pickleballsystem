"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TABLES = ["session_players", "courts", "games", "payments"] as const;

export type SyncStatus = "connecting" | "connected" | "lost";

/**
 * NF9: keeps a session screen current (the organizer's session tabs and the
 * player's My place and Courts). Subscribes to this session's rows (RLS decides what
 * arrives) and refetches the page on any change. Reports when the channel
 * drops, and refetches whenever the channel (re)joins.
 */
export function useSessionSync(sessionId: string): SyncStatus {
  const router = useRouter();
  const [status, setStatus] = useState<SyncStatus>("connecting");

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    // One action changes several rows; refetch once for the burst. Never while
    // offline: a failed refresh makes Next load the whole page, which shows the
    // browser's offline error. The "online" handler below refetches instead.
    const refetch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (navigator.onLine) router.refresh();
      }, 150);
    };
    const lost = () => setStatus("lost");

    void (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;

      // A topic of its own: supabase-js hands back an existing channel with the
      // same topic, so a new tab could get the one the old tab is removing.
      channel = supabase.channel(`live:${sessionId}:${crypto.randomUUID()}`);
      for (const table of TABLES) {
        channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `session_id=eq.${sessionId}` }, refetch);
      }
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` }, refetch)
        .subscribe((state) => {
          if (cancelled) return;
          if (state === "SUBSCRIBED") {
            setStatus("connected");
            // Refetch on every join, not only after a drop: a session tab shown
            // again (Courts · Queue · Payments are separate pages) was not
            // subscribed while hidden, and a change can land before the join.
            refetch();
          } else {
            lost();
          }
        });
    })();

    // Back online: refetch what was missed. If the socket survived, the channel
    // is still joined and no new SUBSCRIBED event will come, so clear the notice here.
    const online = () => {
      refetch();
      if (channel?.state === "joined") setStatus("connected");
    };

    // Back in the foreground (phones pause background pages): refetch at once,
    // so a player called meanwhile sees "You're up" immediately.
    const visible = () => {
      if (document.visibilityState === "visible") refetch();
    };

    window.addEventListener("offline", lost);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("offline", lost);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [sessionId, router]);

  return status;
}
