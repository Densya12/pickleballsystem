import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/lib/i18n/client";
import { StatusChip } from "./StatusChip";

describe("StatusChip", () => {
  it("one English word per state (default)", () => {
    render(
      <>
        <StatusChip kind="unpaid" />
        <StatusChip kind="resting" />
        <StatusChip kind="notReady" />
        <StatusChip kind="toCheck" />
        <StatusChip kind="paid" />
      </>,
    );
    for (const word of ["Unpaid", "Resting", "Not ready", "To check", "Paid"]) expect(screen.getByText(word)).toBeInTheDocument();
  });

  it("the Taglish words when the device is set to Taglish", () => {
    render(
      <I18nProvider locale="fil">
        <StatusChip kind="unpaid" />
        <StatusChip kind="resting" />
        <StatusChip kind="notReady" />
      </I18nProvider>,
    );
    for (const word of ["Bayad muna", "Pahinga", "Hindi pa handa"]) expect(screen.getByText(word)).toBeInTheDocument();
  });
});
