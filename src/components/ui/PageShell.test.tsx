import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageShell } from "./PageShell";

describe("PageShell", () => {
  it("renders header, main and sticky footer landmarks", () => {
    render(
      <PageShell header={<h1>Pila</h1>} footer={<button type="button">Sumali</button>}>
        <p>Laman</p>
      </PageShell>,
    );
    expect(screen.getByRole("banner")).toHaveTextContent("Pila");
    expect(screen.getByRole("main")).toHaveTextContent("Laman");
    expect(screen.getByRole("contentinfo")).toHaveClass("sticky", "bottom-0");
  });

  it("omits header and footer when not given", () => {
    render(<PageShell>Laman</PageShell>);
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveClass("max-w-app");
  });
});
