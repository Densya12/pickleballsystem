"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { AlertIcon, MinusIcon, PlusIcon } from "./icons";

export type StepperProps = {
  label: string;
  /** Name of the hidden input that carries the value in the form. */
  name: string;
  min: number;
  max: number;
  defaultValue: number;
  /** How the value reads on screen, e.g. 3 → "3 courts". */
  formatValue?: (value: number) => string;
  hint?: string;
  error?: string;
  className?: string;
};

/**
 * − / + buttons around a number. Each button is 56px tall and labelled with
 * a word ("Bawas", "Dagdag"), not just the symbol. Tap only.
 */
export function Stepper({
  label,
  name,
  min,
  max,
  defaultValue,
  formatValue = String,
  hint,
  error,
  className,
}: StepperProps) {
  const [value, setValue] = useState(() => Math.min(max, Math.max(min, defaultValue)));
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const buttonClass = cn(
    "inline-flex min-h-14 shrink-0 items-center justify-center gap-1.5 rounded-control border-[1.5px] border-ink bg-surface px-3.5",
    "text-body font-semibold text-ink transition-transform active:scale-[0.97] hover:bg-subtle",
    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus",
    "disabled:cursor-not-allowed disabled:border-default disabled:bg-subtle disabled:text-muted disabled:active:scale-100",
  );

  return (
    <fieldset
      className={cn("flex min-w-0 flex-col gap-2", className)}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-1.5 text-body font-semibold text-ink">{label}</legend>
      {hint && (
        <p id={hintId} className="-mt-1 text-base text-muted">
          {hint}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={buttonClass}
          disabled={value <= min}
          onClick={() => setValue((v) => Math.max(min, v - 1))}
        >
          <MinusIcon />
          <span>Bawas</span>
        </button>
        <output aria-live="polite" className="min-w-0 flex-1 text-center font-display text-xl font-semibold whitespace-nowrap text-ink">
          {formatValue(value)}
        </output>
        <button
          type="button"
          className={buttonClass}
          disabled={value >= max}
          onClick={() => setValue((v) => Math.min(max, v + 1))}
        >
          <PlusIcon />
          <span>Dagdag</span>
        </button>
      </div>
      <input type="hidden" name={name} value={value} />
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-base font-medium text-danger">
          <AlertIcon className="mt-0.5 size-[18px] shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}
