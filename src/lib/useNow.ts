"use client";

import { useEffect, useState } from "react";

/** The current time, refreshed every `everyMs` (e.g. minutes on a court card). */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}
