"use client";

import { useId, useState } from "react";
import { AlertIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { LEVEL_NUMBERS, levelNumber, type Level } from "@/lib/queue/players";
import { LevelBall } from "./LevelBall";

type Props = {
  legend: string;
  name: string;
  /** Starting value; none selected when omitted. */
  defaultValue?: Level;
  /** Controlled use (e.g. the organizer's level sheet). */
  value?: Level;
  onValueChange?: (level: Level) => void;
  error?: string;
  className?: string;
};

/**
 * Level 1-5 (D25), like a star rating: five pickleballs (filled up to the
 * choice) and "Not sure". Native radio buttons, so arrow keys and screen
 * readers work as usual; each ball is labelled "Level N".
 */
export function LevelPicker({ legend, name, defaultValue, value, onValueChange, error, className }: Props) {
  const t = useT();
  const id = useId();
  const [inner, setInner] = useState<Level | undefined>(defaultValue);
  const current = value ?? inner;
  const n = levelNumber(current);
  const pick = (level: Level) => {
    setInner(level);
    onValueChange?.(level);
  };
  const hintId = `${id}-hint`;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <fieldset className={cn("flex flex-col gap-1.5", className)} aria-describedby={[hintId, errorId].filter(Boolean).join(" ")}>
      <legend className="mb-1.5 text-sm font-medium text-secondary">{legend}</legend>
      <div className="flex flex-wrap items-center gap-x-0.5 gap-y-2" data-level-picker="">
        {LEVEL_NUMBERS.map((level) => (
          <label key={level} className="relative inline-flex size-11 cursor-pointer items-center justify-center">
            <input
              type="radio"
              name={name}
              value={String(level)}
              aria-label={t.levels.level(level)}
              checked={current === String(level)}
              onChange={() => pick(String(level) as Level)}
              className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
            />
            <span className="pointer-events-none flex size-10 items-center justify-center rounded-full peer-focus-visible:outline-3 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-focus">
              <LevelBall filled={n !== null && level <= n} className="size-8" />
            </span>
          </label>
        ))}
        <label className="relative ml-1 inline-flex min-h-11 cursor-pointer items-center">
          <input
            type="radio"
            name={name}
            value="unsure"
            checked={current === "unsure"}
            onChange={() => pick("unsure")}
            className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
          />
          <span
            className={cn(
              "pointer-events-none inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium peer-focus-visible:outline-3 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-focus",
              current === "unsure" ? "border-ink bg-primary text-on-primary" : "border-field bg-surface text-ink",
            )}
          >
            {t.levels.unsure}
          </span>
        </label>
      </div>
      <p id={hintId} className="text-xs text-muted">
        {t.levels.hint}
      </p>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <AlertIcon className="mt-px size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}
