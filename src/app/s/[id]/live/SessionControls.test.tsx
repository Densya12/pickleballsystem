import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  startSessionAction: vi.fn(),
  endSessionAction: vi.fn(),
  deleteDraftSessionAction: vi.fn(),
}));
vi.mock("./actions", () => actions);

import { SessionControls } from "./SessionControls";

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset().mockResolvedValue({});
});

describe("SessionControls", () => {
  it("draft: starts with one tap", async () => {
    render(<SessionControls sessionId="s1" status="draft" />);
    await userEvent.click(screen.getByRole("button", { name: "Simulan ang session" }));
    expect(actions.startSessionAction).toHaveBeenCalledWith("s1");
  });

  it("draft: deleting asks first", async () => {
    render(<SessionControls sessionId="s1" status="draft" />);
    await userEvent.click(screen.getByRole("button", { name: "Burahin" }));
    expect(actions.deleteDraftSessionAction).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Oo, burahin" }));
    expect(actions.deleteDraftSessionAction).toHaveBeenCalledWith("s1");
  });

  it("live: ending needs the confirmation step", async () => {
    render(<SessionControls sessionId="s1" status="live" />);
    expect(screen.queryByRole("button", { name: "Simulan ang session" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tapusin ang session" }));
    expect(screen.getByText("Sigurado ka? Magsasara ang check-in.")).toBeInTheDocument();
    expect(actions.endSessionAction).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Huwag muna" }));
    expect(screen.getByRole("button", { name: "Tapusin ang session" })).toBeInTheDocument();
    expect(actions.endSessionAction).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Tapusin ang session" }));
    await userEvent.click(screen.getByRole("button", { name: "Oo, tapusin" }));
    expect(actions.endSessionAction).toHaveBeenCalledWith("s1");
  });

  it("shows the action's error", async () => {
    actions.startSessionAction.mockResolvedValue({
      error: "May live na session pa. Tapusin muna iyon bago magsimula ng bago.",
    });
    render(<SessionControls sessionId="s1" status="draft" />);
    await userEvent.click(screen.getByRole("button", { name: "Simulan ang session" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("May live na session pa.");
  });

  it("ended: no buttons", () => {
    const { container } = render(<SessionControls sessionId="s1" status="ended" />);
    expect(container).toBeEmptyDOMElement();
  });
});
