import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionTabBar } from "@/components/nav/SessionTabBar";
import { I18nProvider } from "@/lib/i18n/client";
import { PageShell } from "./PageShell";
import { Skeleton, SkeletonCard, SkeletonCircle, SkeletonCourt, SkeletonField, SkeletonLine, SkeletonRegion } from "./Skeleton";

const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

describe("Skeleton shapes", () => {
  it("are decorative: every shape is aria-hidden and uses the skeleton class", () => {
    const { container } = render(
      <SkeletonCard>
        <Skeleton width={86} height={40} rounded="full" />
        <SkeletonLine size="lg" width={68} />
        <SkeletonCircle size={26} />
        <SkeletonCourt />
        <SkeletonField />
      </SkeletonCard>,
    );
    const shapes = container.querySelectorAll(".skeleton");
    expect(shapes.length).toBeGreaterThanOrEqual(6);
    for (const shape of shapes) expect(shape.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(container.textContent).toBe("");
  });

  it("keep the sizes they are given (court: the mini court's 440×200)", () => {
    const { container } = render(
      <>
        <Skeleton width={86} height={40} rounded="full" />
        <SkeletonCircle size={26} />
        <SkeletonCourt />
      </>,
    );
    const [pill, circle, court] = [...container.querySelectorAll<HTMLElement>(".skeleton")];
    expect([pill.style.width, pill.style.height]).toEqual(["86px", "40px"]);
    expect(pill).toHaveClass("rounded-full");
    expect([circle.style.width, circle.style.height]).toEqual(["26px", "26px"]);
    expect(court.style.aspectRatio).toBe("440 / 200");
  });

  it("a line takes the line box of its text size", () => {
    const { container } = render(<SkeletonLine size="3xl" width={140} />);
    expect(container.firstElementChild).toHaveClass("text-3xl");
    expect(container.querySelector<HTMLElement>(".skeleton")!.style.width).toBe("140px");
  });
});

describe("SkeletonRegion", () => {
  it("is aria-busy with a visually hidden 'Loading…' (English by default)", () => {
    render(
      <SkeletonRegion>
        <SkeletonLine />
      </SkeletonRegion>,
    );
    const label = screen.getByText("Loading…");
    expect(label).toHaveClass("sr-only");
    expect(label.parentElement).toHaveAttribute("aria-busy", "true");
  });

  it("says it in Taglish when the device is set to Taglish", () => {
    render(
      <I18nProvider locale="fil">
        <SkeletonRegion>
          <SkeletonLine />
        </SkeletonRegion>
      </I18nProvider>,
    );
    expect(screen.getByText("Sandali lang…")).toHaveClass("sr-only");
  });
});

describe("skeleton CSS", () => {
  const rule = (selector: string, from = 0) => {
    const start = css.indexOf(`${selector} {`, from);
    return css.slice(start, css.indexOf("}", start) + 1);
  };

  it("appears after 150 ms (no flash on fast loads) and pulses slowly", () => {
    const skeleton = rule(".skeleton");
    expect(skeleton).toContain("opacity: 0");
    expect(skeleton).toMatch(/skeleton-in 200ms ease-out 150ms forwards/);
    expect(skeleton).toMatch(/skeleton-pulse 1\.4s/);
  });

  it("reduced motion: no pulse and no fade, static blocks", () => {
    const media = css.indexOf("@media (prefers-reduced-motion: reduce) {\n  .skeleton");
    expect(media).toBeGreaterThan(-1);
    const reduced = rule(".skeleton", media);
    expect(reduced).toContain("animation: skeleton-in 0s linear 150ms forwards;");
    expect(reduced).not.toContain("skeleton-pulse");
  });
});

describe("loading shell", () => {
  it("PageShell: a title skeleton keeps the title's line box without an empty heading", () => {
    const { container } = render(<PageShell titleSkeleton="60%">{null}</PageShell>);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(container.querySelector(".title-large .skeleton")).not.toBeNull();
  });

  it("session tab bar while loading: Queue without a count, More disabled, links work", () => {
    render(<SessionTabBar sessionId="s1" current="courts" queueCount={null} paymentsBadge={0} showPayments />);
    expect(screen.getByRole("link", { name: "Queue" })).toHaveAttribute("href", "/s/s1/queue");
    expect(screen.getByRole("link", { name: "Payments" })).toHaveAttribute("href", "/s/s1/payments");
    expect(screen.getByRole("button", { name: "More" })).toBeDisabled();
  });
});
