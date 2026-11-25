"use client";

import { useEffect, type RefObject } from "react";

/**
 * QA-04: after a failed submit, bring the problem into view. The form's
 * submit button is at the bottom, its fields and alert at the top, so on a
 * phone the error was off-screen and nothing seemed to happen. Focuses the
 * first invalid field (aria-invalid), or else the form's alert
 * ([data-form-error]), and scrolls it to the middle of the screen.
 *
 * `result` is the action state: a new object after every submit, so the
 * same error shows again after another failed tap.
 */
export function useFocusFirstError(formRef: RefObject<HTMLFormElement | null>, result: unknown, hasErrors: boolean) {
  useEffect(() => {
    if (!hasErrors) return;
    const form = formRef.current;
    if (!form) return;
    const target =
      form.querySelector<HTMLElement>('[aria-invalid="true"]') ?? form.querySelector<HTMLElement>("[data-form-error]");
    if (!target) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    target.scrollIntoView?.({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    target.focus({ preventScroll: true });
  }, [formRef, result, hasErrors]);
}
