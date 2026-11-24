import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const addWalkInAction = vi.fn();
vi.mock("./actions", () => ({
  addWalkInAction: (...args: unknown[]) => addWalkInAction(...args),
}));

import { WalkInForm } from "./WalkInForm";

beforeEach(() => {
  addWalkInAction.mockReset().mockResolvedValue({});
});

describe("WalkInForm", () => {
  it("has no payment choice picked when there is a fee", () => {
    render(<WalkInForm sessionId="s1" fee={150} />);
    const group = screen.getByRole("group", { name: "Bayad · ₱150" });
    expect(group).toBeInTheDocument();
    for (const name of ["Nagbayad ng cash", "GCash", "Mamaya na magbabayad"]) {
      expect(screen.getByRole("radio", { name: new RegExp(`^${name}`) })).not.toBeChecked();
    }
  });

  it("won't add the walk-in until a payment choice is picked", async () => {
    render(<WalkInForm sessionId="s1" fee={150} />);
    await userEvent.type(screen.getByLabelText("Pangalan"), "Tito Boy");
    await userEvent.click(screen.getByRole("button", { name: "Ilagay sa pila" }));

    expect(screen.getByRole("group", { name: "Bayad · ₱150" })).toHaveAccessibleDescription("Pumili kung paano magbabayad.");
    expect(addWalkInAction).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("radio", { name: "Nagbayad ng cash" }));
    expect(screen.queryByText("Pumili kung paano magbabayad.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ilagay sa pila" }));
    expect(addWalkInAction).toHaveBeenCalledTimes(1);
    const form = addWalkInAction.mock.calls[0][2] as FormData;
    expect(form.get("payment")).toBe("cash_received");
    expect(form.get("display_name")).toBe("Tito Boy");
  });

  it("GCash needs a valid reference before submitting", async () => {
    render(<WalkInForm sessionId="s1" fee={150} />);
    await userEvent.type(screen.getByLabelText("Pangalan"), "Ana");
    await userEvent.click(screen.getByRole("radio", { name: /^GCash/ }));
    await userEvent.click(screen.getByRole("button", { name: "Ilagay sa pila" }));
    expect(screen.getByText(/Mukhang mali ang reference number/)).toBeInTheDocument();
    expect(addWalkInAction).not.toHaveBeenCalled();
  });

  it("a free session has no payment step", async () => {
    render(<WalkInForm sessionId="s1" fee={0} />);
    expect(screen.queryByRole("group", { name: /Bayad/ })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Pangalan"), "Libre Lito");
    await userEvent.click(screen.getByRole("button", { name: "Ilagay sa pila" }));
    expect(addWalkInAction).toHaveBeenCalledTimes(1);
  });
});
