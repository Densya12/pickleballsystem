"use client";

import { useId, type ChangeEvent } from "react";
import { cn } from "@/lib/cn";

export type ToggleProps = {
  label: string;
  /** One-line explanation (secondary text). */
  description?: string;
  name?: string;
  defaultChecked?: boolean;
  /** Controlled use. */
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * A switch row: a native checkbox with role="switch" (sends "on" when
 * checked in a form). The whole row is the tap target; the knob's position
 * shows the state, not color alone.
 */
export function Toggle({ label, description, name, defaultChecked, checked, onCheckedChange, disabled, className }: ToggleProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = description ? `${id}-description` : undefined;
  const control =
    checked !== undefined
      ? { checked, onChange: (e: ChangeEvent<HTMLInputElement>) => onCheckedChange?.(e.target.checked) }
      : { defaultChecked, onChange: (e: ChangeEvent<HTMLInputElement>) => onCheckedChange?.(e.target.checked) };

  return (
    <label
      className={cn(
        "flex min-h-12 cursor-pointer items-center justify-between gap-3 py-2.5",
        "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
        className,
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span id={labelId} className="text-body text-ink">
          {label}
        </span>
        {description && (
          <span id={descriptionId} className="text-sm text-muted">
            {description}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        role="switch"
        name={name}
        disabled={disabled}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        {...control}
        className={cn(
          "relative h-[30px] w-[50px] shrink-0 cursor-pointer appearance-none rounded-full bg-[#d7d7d1] transition-colors",
          "checked:bg-live focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed",
          "before:absolute before:top-[3px] before:left-[3px] before:size-6 before:rounded-full before:bg-surface before:shadow-sm before:transition-transform before:content-['']",
          "checked:before:translate-x-5",
        )}
      />
    </label>
  );
}
