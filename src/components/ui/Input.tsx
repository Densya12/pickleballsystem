import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { AlertIcon } from "./icons";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  /** Always-visible label (never placeholder-only). */
  label: string;
  /** e.g. "(optional)", shown after the label in a lighter weight. */
  labelNote?: ReactNode;
  hint?: string;
  error?: string;
  /** Something inside the field on the left (e.g. a search icon). */
  leading?: ReactNode;
};

export function Input({
  label,
  labelNote,
  hint,
  error,
  leading,
  id,
  className,
  "aria-describedby": describedByProp,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [describedByProp, hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-secondary">
        {label}
        {labelNote && <span className="font-normal text-muted"> {labelNote}</span>}
      </label>
      <div className="relative">
        {leading && <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">{leading}</span>}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-[46px] w-full rounded-control border bg-surface px-3.5 text-body text-ink placeholder:text-placeholder",
            "focus:border-ink focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-focus",
            "disabled:cursor-not-allowed disabled:bg-info disabled:text-muted",
            Boolean(leading) && "pl-10",
            error ? "border-danger" : "border-field",
          )}
          {...props}
        />
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <AlertIcon className="mt-px size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
