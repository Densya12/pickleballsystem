"use client";

import { useEffect, useRef, useState } from "react";
import { Notice } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/** Which link was tapped, in words ("Queue", "Show QR", "Home"). */
export function navLabelOf(link: HTMLAnchorElement): string {
  const label = link.dataset.navLabel ?? link.getAttribute("aria-label") ?? link.textContent ?? "";
  return label.replace(/\s+/g, " ").trim();
}

/**
 * True when a click on this link should be held back because there's no
 * signal: a same-site page (or file) that the browser would have to fetch.
 */
export function shouldHoldNavigation(link: HTMLAnchorElement, online: boolean, origin: string): boolean {
  if (online) return false;
  if (link.target && link.target !== "_self") return false;
  const href = link.getAttribute("href");
  if (!href || href.startsWith("#")) return false;
  try {
    return new URL(href, origin).origin === origin;
  } catch {
    return false;
  }
}

/**
 * QA-01 (NF10): without signal, an in-session link (tab bar, Home, Show QR,
 * Walk-in, More, Download) would load the browser's offline page and leave the
 * app. Hold the tap and say why instead. Saved taps stay in the outbox.
 *
 * A capture listener on the document runs before Next's <Link> handler, so the
 * navigation never starts.
 */
export function OfflineNavGuard({ aboveTabBar = false }: { aboveTabBar?: boolean }) {
  const t = useT();
  const [blocked, setBlocked] = useState<{ label: string; at: number } | null>(null);
  const toast = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (!shouldHoldNavigation(link, navigator.onLine, window.location.origin)) return;
      event.preventDefault();
      event.stopPropagation();
      setBlocked({ label: navLabelOf(link), at: Date.now() });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Hide after a while, and as soon as the signal is back.
  useEffect(() => {
    if (!blocked) return;
    const timer = setTimeout(() => setBlocked(null), 6000);
    const online = () => setBlocked(null);
    window.addEventListener("online", online);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", online);
    };
  }, [blocked]);

  // A manual popover sits in the top layer, so the notice also shows above an
  // open sheet (More is a modal <dialog>). Without popover support it's a fixed box.
  useEffect(() => {
    const el = toast.current;
    if (blocked && el && typeof el.showPopover === "function" && !el.matches(":popover-open")) el.showPopover();
  }, [blocked]);

  if (!blocked) return null;
  return (
    <div
      ref={toast}
      popover="manual"
      className={
        "fixed inset-x-0 top-auto z-40 m-0 mx-auto w-full max-w-app border-0 bg-transparent p-0 px-4 " +
        (aboveTabBar ? "bottom-[calc(6.5rem+env(safe-area-inset-bottom))]" : "bottom-[max(1rem,env(safe-area-inset-bottom))]")
      }
      aria-live="assertive"
    >
      <Notice kind="warning" key={blocked.at}>
        {t.live.needsSignal(blocked.label)}
      </Notice>
    </div>
  );
}
