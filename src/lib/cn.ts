/** Joins class names, skipping falsy values. Kept tiny on purpose (no extra libraries). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
