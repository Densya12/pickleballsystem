"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";
import { AlertIcon, MinusIcon, PlusIcon } from "./icons";

export type StepperProps = {
  label: string;
  /** Name of the hidden input that carries the value in the form. */
  name: string;
  min: number;
  max: number;
  defaultValue: number;
  /** aria-labels of the − and + buttons, e.g. "Fewer courts", "More courts". */
  decrementLabel: string;
  incrementLabel: string;
  /** How the value reads on screen, e.g. 3 → "3 courts". */
  formatValue?: (value: number) => string;
  error?: string;
  /** Called after each step (e.g. to show one row per court). */
  onValueChange?: (value: number) => void;
  className?: string;
};

/** − value + with round icon buttons; the value has its own space, so it never runs under a button. */
export function Stepper({
  label,
  name,
  min,
  max,
  defaultValue,
  decrementLabel,
  incrementLabel,
  formatValue = String,
  error,
  onValueChange,
  className,
}: StepperProps) {
  const [value, setValue] = useState(() => Math.min(max, Math.max(min, defaultValue)));
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;

  function step(next: number) {
    setValue(next);
    onValueChange?.(next);
  }

  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-1.5", className)} aria-describedby={errorId} aria-invalid={error ? true : undefined}>
      <legend className="mb-1.5 text-sm font-medium text-secondary">{label}</legend>
      <div className="flex items-center gap-3">
        <IconButton label={decrementLabel} look="outline" disabled={value <= min} onClick={() => step(Math.max(min, value - 1))}>
          <MinusIcon className="size-4" />
        </IconButton>
        <output aria-live="polite" className="min-w-0 flex-1 text-center font-display text-xl font-semibold text-ink">
          {formatValue(value)}
        </output>
        <IconButton label={incrementLabel} look="outline" disabled={value >= max} onClick={() => step(Math.min(max, value + 1))}>
          <PlusIcon className="size-4" />
        </IconButton>
      </div>
      <input type="hidden" name={name} value={value} />
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <AlertIcon className="mt-px size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}
