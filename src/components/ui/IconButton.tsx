import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Look = "surface" | "outline";

type Common = {
  /** Required: an icon button has no visible text. */
  label: string;
  look?: Look;
  /** 40px (default) or 36px; both keep a 44px touch area. */
  size?: "md" | "sm";
  className?: string;
  children: ReactNode;
};

const looks: Record<Look, string> = {
  surface: "bg-surface text-ink hover:bg-subtle",
  outline: "border border-input bg-surface text-ink hover:bg-subtle",
};

function classes({ look = "surface", size = "md", className }: Pick<Common, "look" | "size" | "className">) {
  return cn(
    "touch-target inline-flex shrink-0 items-center justify-center rounded-full",
    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50",
    size === "md" ? "size-10" : "size-9",
    looks[look],
    className,
  );
}

/** Round icon button (D19) with an aria-label. */
export function IconButton({
  label,
  look,
  size,
  className,
  children,
  type = "button",
  ...props
}: Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label">) {
  return (
    <button type={type} aria-label={label} title={label} className={classes({ look, size, className })} {...props}>
      {children}
    </button>
  );
}

export function IconLink({
  label,
  look,
  size,
  className,
  children,
  ...props
}: Common & Omit<ComponentProps<typeof Link>, "children" | "aria-label">) {
  return (
    <Link aria-label={label} title={label} className={classes({ look, size, className })} {...props}>
      {children}
    </Link>
  );
}
