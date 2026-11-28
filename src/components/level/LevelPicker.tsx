"use client";

import { useId, useState } from "react";
import { AlertIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { LEVEL_NUMBERS, levelDescription, levelNumber, type Level } from "@/lib/queue/players";
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
 * Level 1-5 (D25) and "Not sure". Each level is a row with its pickleball
 * rating (filled up to the level) and what it means (D30), so players and
 * organizers rate the same way; the chosen level's meaning repeats under the
 * picker. Native radio buttons (arrow keys and screen readers work as usual);
 * each is labelled "Level N" and described by its meaning. Text wraps at
 * 360 px; nothing is cut off.
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
  const chosen = levelDescription(t, n);

  // A sibling of the input (peer-checked fills it), like the "list" RadioGroup.
  const dot = (className?: string) => (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-field peer-checked:border-ink peer-checked:bg-primary peer-checked:[&>span]:block",
        className,
      )}
    >
      <span className="hidden size-2 rounded-full bg-surface" />
    </span>
  );
  const row = cn(
    "relative flex min-h-12 cursor-pointer items-start gap-3 py-2.5",
    "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-focus",
  );

  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-1.5", className)} aria-describedby={[hintId, errorId].filter(Boolean).join(" ")}>
      <legend className="mb-1.5 text-sm font-medium text-secondary">{legend}</legend>
      <div className={cn("flex flex-col divide-y divide-hairline", error && "rounded-control outline outline-1 outline-danger")} data-level-picker="">
        {LEVEL_NUMBERS.map((level) => (
          <label key={level} className={row}>
            <input
              type="radio"
              name={name}
              value={String(level)}
              aria-label={t.levels.level(level)}
              aria-describedby={`${id}-d${level}`}
              checked={current === String(level)}
              onChange={() => pick(String(level) as Level)}
              className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0"
            />
            {dot("mt-0.5")}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-body font-medium text-ink">{t.levels.level(level)}</span>
                <span aria-hidden="true" className="flex items-center gap-px">
                  {LEVEL_NUMBERS.map((ball) => (
                    <LevelBall key={ball} filled={ball <= level} className="size-3.5" />
                  ))}
                </span>
              </span>
              <span id={`${id}-d${level}`} className="text-sm text-muted [overflow-wrap:anywhere]">
                {levelDescription(t, level)}
              </span>
            </span>
          </label>
        ))}
        <label className={cn(row, "items-center")}>
          <input
            type="radio"
            name={name}
            value="unsure"
            checked={current === "unsure"}
            onChange={() => pick("unsure")}
            className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0"
          />
          {dot()}
          <span className="text-body font-medium text-ink">{t.levels.unsure}</span>
        </label>
      </div>
      {/* D30: the chosen level's meaning, under the picker. */}
      <p className="text-sm text-secondary empty:hidden" data-testid="level-description" aria-live="polite">
        {chosen ? `${t.levels.level(n!)}: ${chosen}` : ""}
      </p>
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
