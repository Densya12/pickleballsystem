"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TABLES = ["session_players", "courts", "games", "payments"] as const;

export type SyncStatus = "connecting" | "connected" | "lost";

/**
 * NF9: keeps a session screen current (the organizer's Live screen and the
 * player's Pwesto screen). Subscribes to this session's rows (RLS decides what
 * arrives) and refetches the page on any change. Reports when the channel
 * drops, and refetches once it is back.
 */
export function useSessionSync(sessionId: string): SyncStatus {
  const router = useRouter();
  const [status, setStatus] = useState<SyncStatus>("connecting");

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let missedUpdates = false;

    // One action changes several rows; refetch once for the burst.
    const refetch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 150);
    };
    const lost = () => {
      missedUpdates = true;
      setStatus("lost");
    };

    void (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;

      channel = supabase.channel(`live:${sessionId}`);
      for (const table of TABLES) {
        channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `session_id=eq.${sessionId}` }, refetch);
      }
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` }, refetch)
        .subscribe((state) => {
          if (cancelled) return;
          if (state === "SUBSCRIBED") {
            setStatus("connected");
            if (missedUpdates) {
              missedUpdates = false;
              refetch();
            }
          } else {
            lost();
          }
        });
    })();

    // Back online: refetch what was missed. If the socket survived, the channel
    // is still joined and no new SUBSCRIBED event will come, so clear the notice here.
    const online = () => {
      refetch();
      if (channel?.state === "joined") {
        missedUpdates = false;
        setStatus("connected");
      }
    };

    // Back in the foreground (phones pause background pages): refetch at once,
    // so a player called meanwhile sees "Ikaw na!" immediately.
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
