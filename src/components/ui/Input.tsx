import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { AlertIcon } from "./icons";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  /** Always-visible label (never placeholder-only). */
  label: string;
  hint?: string;
  error?: string;
};

export function Input({
  label,
  hint,
  error,
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
      <label htmlFor={inputId} className="text-body font-semibold text-ink">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-base text-muted">
          {hint}
        </p>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-14 w-full rounded-control border-[1.5px] bg-surface px-4 text-body text-ink",
          "placeholder:text-placeholder",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus",
          "disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted",
          error ? "border-danger" : "border-strong focus:border-ink",
        )}
        {...props}
      />
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-base font-medium text-danger">
          <AlertIcon className="mt-0.5 size-[18px] shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
