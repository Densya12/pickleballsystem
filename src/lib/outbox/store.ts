/**
 * The outbox, per session, in localStorage (wrapped in try/catch: private
 * mode or full storage falls back to memory for this page).
 */
import type { OutboxItem } from "./rules";

const KEY = (sessionId: string) => `opq:outbox:${sessionId}`;
const EVENT = "opq:outbox-change";
const memory = new Map<string, string>();
const EMPTY: OutboxItem[] = [];
const snapshots = new Map<string, { raw: string; items: OutboxItem[] }>();

/** Sessions whose outbox couldn't be saved to localStorage: memory is the truth for this page. */
const memoryOnly = new Set<string>();

function readRaw(sessionId: string): string {
  if (memoryOnly.has(sessionId)) return memory.get(sessionId) ?? "[]";
  try {
    return window.localStorage.getItem(KEY(sessionId)) ?? "[]";
  } catch {
    return memory.get(sessionId) ?? "[]";
  }
}

function writeRaw(sessionId: string, raw: string) {
  memory.set(sessionId, raw);
  try {
    window.localStorage.setItem(KEY(sessionId), raw);
    memoryOnly.delete(sessionId);
  } catch {
    memoryOnly.add(sessionId);
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Stable array per stored value (for useSyncExternalStore). */
export function loadOutbox(sessionId: string): OutboxItem[] {
  const raw = readRaw(sessionId);
  const cached = snapshots.get(sessionId);
  if (cached && cached.raw === raw) return cached.items;
  let items: OutboxItem[] = EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) items = parsed as OutboxItem[];
  } catch {
    items = EMPTY;
  }
  snapshots.set(sessionId, { raw, items });
  return items;
}

export function emptyOutbox(): OutboxItem[] {
  return EMPTY;
}

export function addToOutbox(item: OutboxItem): void {
  writeRaw(item.sessionId, JSON.stringify([...loadOutbox(item.sessionId), item]));
}

export function removeFromOutbox(sessionId: string, itemId: string): void {
  writeRaw(sessionId, JSON.stringify(loadOutbox(sessionId).filter((i) => i.id !== itemId)));
}

export function subscribeOutbox(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
