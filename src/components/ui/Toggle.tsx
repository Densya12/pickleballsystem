import { useId } from "react";
import { cn } from "@/lib/cn";

export type ToggleProps = {
  label: string;
  /** One-line explanation (secondary hint text). */
  description?: string;
  name: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * An on/off switch: a native checkbox with role="switch" (sends "on" when
 * checked). The whole row is the tap target, and the state is also written
 * out ("Oo" / "Hindi"), so it never relies on color or knob position alone.
 */
export function Toggle({ label, description, name, defaultChecked, disabled, className }: ToggleProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <label
      className={cn(
        "group flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-control border-[1.5px] border-strong bg-surface px-4 py-3",
        "has-[:checked]:border-ink has-[:checked]:bg-primary-tint",
        "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
        "has-[:disabled]:cursor-not-allowed has-[:disabled]:bg-subtle",
        className,
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span id={labelId} className="text-body font-semibold text-ink">
          {label}
        </span>
        {description && (
          <span id={descriptionId} className="text-sm text-muted">
            {description}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2.5">
        <span aria-hidden="true" className="text-base font-semibold text-muted group-has-[:checked]:hidden">
          Hindi
        </span>
        <span aria-hidden="true" className="hidden text-base font-semibold text-ink group-has-[:checked]:inline">
          Oo
        </span>
        <input
          type="checkbox"
          role="switch"
          name={name}
          defaultChecked={defaultChecked}
          disabled={disabled}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          className={cn(
            "relative h-8 w-14 shrink-0 cursor-pointer appearance-none rounded-full border-[1.5px] border-strong bg-subtle transition-colors",
            "checked:border-ink checked:bg-primary focus-visible:outline-none disabled:cursor-not-allowed",
            "before:absolute before:top-1/2 before:left-[3px] before:size-[22px] before:-translate-y-1/2 before:rounded-full",
            "before:border before:border-strong before:bg-surface before:transition-transform before:content-['']",
            "checked:before:translate-x-6 checked:before:border-surface",
          )}
        />
      </span>
    </label>
  );
}
