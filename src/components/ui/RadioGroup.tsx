"use client";

import { useId, type ChangeEvent } from "react";
import { cn } from "@/lib/cn";
import { AlertIcon } from "./icons";

export type RadioOption<V extends string> = {
  value: V;
  label: string;
  /** Optional one-line explanation ("list" look only). */
  description?: string;
  /** Optional caution under the description ("list" look only), e.g. a trade-off of this choice. */
  note?: string;
};

export type RadioGroupProps<V extends string> = {
  legend: string;
  /** Hide the legend visually (it stays for screen readers). */
  legendHidden?: boolean;
  name: string;
  options: readonly RadioOption<V>[];
  defaultValue?: V;
  /** Controlled use. */
  value?: V | null;
  onValueChange?: (value: V) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
  /**
   * list: rows with a radio dot (longer choices) · segmented: a two- or
   * three-way switch · chips: small round pills (e.g. levels).
   */
  look?: "list" | "segmented" | "chips";
  className?: string;
};

/**
 * Native radio inputs (keyboard, screen readers and forms work as usual),
 * drawn in the D19 styles. The input covers its whole option, so a tap
 * anywhere on it selects it.
 */
export function RadioGroup<V extends string>({
  legend,
  legendHidden,
  name,
  options,
  defaultValue,
  value,
  onValueChange,
  hint,
  error,
  disabled,
  look = "list",
  className,
}: RadioGroupProps<V>) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const controlled = value !== undefined;

  const inputProps = (option: RadioOption<V>) => ({
    type: "radio" as const,
    name,
    value: option.value,
    ...(controlled
      ? { checked: value === option.value, onChange: (e: ChangeEvent<HTMLInputElement>) => onValueChange?.(e.target.value as V) }
      : {
          defaultChecked: defaultValue === option.value,
          onChange: (e: ChangeEvent<HTMLInputElement>) => onValueChange?.(e.target.value as V),
        }),
  });

  return (
    <fieldset
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      disabled={disabled}
    >
      <legend className={cn("mb-1.5 text-sm font-medium text-secondary", legendHidden && "sr-only")}>{legend}</legend>
      {hint && (
        <p id={hintId} className="-mt-1 text-xs text-muted">
          {hint}
        </p>
      )}

      {look === "segmented" && (
        <div className={cn("flex rounded-control bg-subtle p-[3px]", error && "outline outline-1 outline-danger")}>
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                "relative flex min-h-9 flex-1 cursor-pointer items-center justify-center rounded-[10px] px-2 text-center text-sm font-medium text-secondary",
                "has-[:checked]:bg-surface has-[:checked]:text-ink has-[:checked]:shadow-[0_1px_2px_rgba(17,20,18,0.08)]",
                "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-focus",
                "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
              )}
            >
              <input {...inputProps(option)} className="absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed" />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}

      {look === "chips" && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                "touch-target relative flex h-[34px] cursor-pointer items-center rounded-full border bg-surface px-3 text-sm text-ink",
                error ? "border-danger" : "border-field",
                "has-[:checked]:border-ink has-[:checked]:bg-primary has-[:checked]:text-on-primary",
                "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
              )}
            >
              <input {...inputProps(option)} className="absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none rounded-full opacity-0" />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}

      {look === "list" && (
        <div className={cn("flex flex-col divide-y divide-hairline", error && "rounded-control outline outline-1 outline-danger")}>
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                "relative flex min-h-12 cursor-pointer items-center gap-3 py-2.5",
                "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-focus",
                "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
              )}
            >
              <input {...inputProps(option)} className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0" />
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-field peer-checked:border-ink peer-checked:bg-primary peer-checked:[&>span]:block"
              >
                <span className="hidden size-2 rounded-full bg-surface" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-body font-medium text-ink">{option.label}</span>
                {option.description && <span className="text-sm text-muted">{option.description}</span>}
                {option.note && <span className="mt-0.5 text-xs text-muted">{option.note}</span>}
              </span>
            </label>
          ))}
        </div>
      )}

      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <AlertIcon className="mt-px size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}
