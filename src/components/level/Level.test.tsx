import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/dictionary";
import { I18nProvider } from "@/lib/i18n/client";
import { LevelBadge } from "./LevelBadge";
import { LevelPicker } from "./LevelPicker";

const filledBalls = () => document.querySelectorAll("[data-level-picker] svg circle[stroke='#111412']").length;

describe("LevelPicker (D25)", () => {
  it("is a group of radios: Level 1 to Level 5 and Not sure, with the hint", () => {
    render(<LevelPicker legend="Level" name="level" />);
    const group = screen.getByRole("group", { name: "Level" });
    expect(group).toHaveAccessibleDescription("Same as your stars in your club app.");
    for (const n of [1, 2, 3, 4, 5]) expect(screen.getByRole("radio", { name: `Level ${n}` })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Not sure" })).toBeInTheDocument();
  });

  it("D30: each level shows its rating (balls up to the level) and what it means", () => {
    render(<LevelPicker legend="Level" name="level" />);
    // Rows 1-5 show 1+2+3+4+5 filled balls; nothing is chosen yet.
    expect(filledBalls()).toBe(15);
    expect(screen.getByRole("radio", { name: "Level 1" })).toHaveAccessibleDescription(en.levels.descriptions[0]);
    expect(screen.getByRole("radio", { name: "Level 5" })).toHaveAccessibleDescription("Tournament level: plays in leagues or tournaments.");
    for (const text of en.levels.descriptions) expect(screen.getByText(text)).toBeVisible();
    expect(screen.getByTestId("level-description")).toBeEmptyDOMElement();
  });

  it("D30: the chosen level's meaning shows under the picker; Not sure has none", async () => {
    render(<LevelPicker legend="Level" name="level" />);
    await userEvent.click(screen.getByRole("radio", { name: "Level 3" }));
    expect(screen.getByRole("radio", { name: "Level 3" })).toBeChecked();
    expect(screen.getByTestId("level-description")).toHaveTextContent("Level 3: Steady rallies; dinks and plays at the net on purpose.");
    await userEvent.click(screen.getByRole("radio", { name: "Not sure" }));
    expect(screen.getByTestId("level-description")).toBeEmptyDOMElement();
  });

  it("D30: Taglish descriptions when the device is set to Taglish", async () => {
    render(
      <I18nProvider locale="fil">
        <LevelPicker legend="Level" name="level" defaultValue="1" />
      </I18nProvider>,
    );
    expect(screen.getByTestId("level-description")).toHaveTextContent("Level 1: Bago pa lang: nag-aaral pa mag-serve at magtuloy ng rally.");
    expect(screen.getByRole("radio", { name: "Hindi sigurado" })).toBeInTheDocument();
  });

  it("works from the keyboard: Tab in, arrow keys move the choice", async () => {
    render(<LevelPicker legend="Level" name="level" defaultValue="2" />);
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Level 2" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Level 3" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Level 3" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Level 1" })).toBeChecked();
    expect(screen.getByTestId("level-description")).toHaveTextContent(/^Level 1: New to pickleball/);
  });

  it("posts the level as the form value", async () => {
    const { container } = render(
      <form>
        <LevelPicker legend="Level" name="level" />
      </form>,
    );
    await userEvent.click(screen.getByRole("radio", { name: "Level 5" }));
    expect(new FormData(container.querySelector("form")!).get("level")).toBe("5");
  });
});

describe("LevelBadge", () => {
  it("shows a ball and the number, read as 'Level 3'", () => {
    render(<LevelBadge level="3" />);
    const badge = document.querySelector("[data-level]")!;
    expect(badge).toHaveAttribute("data-level", "3");
    // Screen readers get "Level 3"; the eye gets the ball and "3".
    expect(screen.getByText("Level 3")).toHaveClass("sr-only");
    expect(screen.getByText("3")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows an outline ball and 'Not set' when there is no level (not 'Not sure', which read like a status)", () => {
    render(<LevelBadge level="unsure" />);
    expect(document.querySelector("[data-level]")).toHaveAttribute("data-level", "none");
    expect(screen.getByText("Not set")).toBeVisible();
    expect(screen.queryByText("Not sure")).not.toBeInTheDocument();
  });
});
