import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "accent" | "danger-outline";
export type ButtonSize = "md" | "lg";

type BaseProps = {
  variant?: ButtonVariant;
  /** md = 48px, lg = 56px minimum height. Both meet the 48px tap-target rule. */
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
  "inline-flex items-center justify-center gap-2 rounded-control px-5 py-2 text-center font-semibold leading-tight " +
  "transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] select-none " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus " +
  "disabled:cursor-not-allowed disabled:border-default disabled:bg-subtle disabled:text-muted disabled:active:scale-100";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary/88",
  secondary: "border-[1.5px] border-ink bg-surface text-ink hover:bg-subtle",
  accent: "bg-accent text-ink hover:bg-accent/80",
  "danger-outline": "border-[1.5px] border-danger bg-surface text-danger hover:bg-subtle",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-12 text-body",
  lg: "min-h-14 px-6 text-lg",
};

export function buttonClassName({
  variant = "primary",
  size = "md",
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
    <button
      type={type}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
