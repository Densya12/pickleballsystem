import { useId } from "react";
import { cn } from "@/lib/cn";
import { AlertIcon } from "./icons";

export type RadioOption<V extends string> = {
  value: V;
  label: string;
  /** Optional one-line explanation (secondary hint text). */
  description?: string;
};

export type RadioGroupProps<V extends string> = {
  legend: string;
  name: string;
  options: readonly RadioOption<V>[];
  defaultValue?: V;
  hint?: string;
  error?: string;
  disabled?: boolean;
  /** "row" puts short options side by side (e.g. 11 / 15 / 21). */
  layout?: "row" | "column";
  className?: string;
};

/**
 * Native radio inputs in large tappable cards (≥ 56px). Tap only, no swiping.
 * The whole card is the label, so tapping anywhere on it selects the option.
 */
export function RadioGroup<V extends string>({
  legend,
  name,
  options,
  defaultValue,
  hint,
  error,
  disabled,
  layout = "column",
  className,
}: RadioGroupProps<V>) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset
      className={cn("flex min-w-0 flex-col gap-2", className)}
      aria-describedby={describedBy}
      aria-invalid={error ? true : undefined}
      disabled={disabled}
    >
      <legend className="mb-1.5 text-body font-semibold text-ink">{legend}</legend>
      {hint && (
        <p id={hintId} className="-mt-1 text-base text-muted">
          {hint}
        </p>
      )}
      <div className={cn("grid gap-2", layout === "row" ? "grid-flow-col auto-cols-fr" : "grid-cols-1")}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex min-h-14 cursor-pointer items-center gap-3 rounded-control border-[1.5px] bg-surface px-4 py-3",
              error ? "border-danger" : "border-strong",
              "has-[:checked]:border-ink has-[:checked]:bg-primary-tint",
              "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
              "has-[:disabled]:cursor-not-allowed has-[:disabled]:bg-subtle",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={defaultValue === option.value}
              className="size-5 shrink-0 cursor-pointer [accent-color:var(--text-color-ink)] disabled:cursor-not-allowed"
            />
            <span className="flex flex-col">
              <span className="text-body font-semibold text-ink">{option.label}</span>
              {option.description && <span className="text-sm text-muted">{option.description}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-base font-medium text-danger">
          <AlertIcon className="mt-0.5 size-[18px] shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}
