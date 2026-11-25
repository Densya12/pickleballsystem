import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * D19 buttons:
 * - primary: the screen's one main action (ink, 52px, size "lg"), or an ink pill.
 * - lime: the key row action (e.g. "Done", "Received").
 * - secondary: white button on the page background (e.g. "New session").
 * - outline: white with a hairline border, for secondary actions on cards.
 * - ghost / danger: text buttons.
 */
export type ButtonVariant = "primary" | "lime" | "secondary" | "outline" | "ghost" | "danger" | "danger-outline";
/** lg = 52px main button · md = 44px · pill = 40px round · sm = 36px round (44px touch area). */
export type ButtonSize = "lg" | "md" | "pill" | "sm";

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> & {
    href?: undefined;
  };

type ButtonAsLink = BaseProps &
  Omit<ComponentProps<typeof Link>, keyof BaseProps> & {
    href: ComponentProps<typeof Link>["href"];
    /** Links cannot be disabled. Render a <button disabled> instead. */
    disabled?: never;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const base =
  "inline-flex items-center justify-center gap-2 text-center leading-tight select-none whitespace-nowrap " +
  "transition-[background-color,transform] duration-150 active:scale-[0.98] " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary/90",
  lime: "bg-accent text-on-accent hover:bg-accent/85",
  secondary: "bg-surface text-ink hover:bg-subtle",
  outline: "border border-quiet bg-surface text-ink hover:bg-subtle",
  ghost: "bg-transparent text-ink hover:bg-subtle",
  danger: "bg-transparent text-danger hover:bg-danger-soft",
  "danger-outline": "border border-danger bg-surface text-danger hover:bg-danger-soft",
};

const sizes: Record<ButtonSize, string> = {
  lg: "min-h-[52px] rounded-button px-6 text-lg font-semibold",
  md: "min-h-11 rounded-[14px] px-4 text-body font-medium",
  pill: "min-h-10 rounded-full px-5 text-body font-semibold",
  sm: "touch-target min-h-9 rounded-full px-4 text-sm font-semibold",
};

export function buttonClassName({
  variant = "primary",
  size = "lg",
  fullWidth = false,
  className,
}: Pick<BaseProps, "variant" | "size" | "fullWidth" | "className">): string {
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full", className);
}

export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { variant, size, fullWidth, className, children, ...linkProps } = props;
    return (
      <Link className={buttonClassName({ variant, size, fullWidth, className })} {...linkProps}>
        {children}
      </Link>
    );
  }

  const { variant, size, fullWidth, className, children, type = "button", ...buttonProps } = props;
  return (
    <button type={type} className={buttonClassName({ variant, size, fullWidth, className })} {...buttonProps}>
      {children}
    </button>
  );
}
