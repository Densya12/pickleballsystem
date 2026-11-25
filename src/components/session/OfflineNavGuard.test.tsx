import { fireEvent, render, screen } from "@testing-library/react";
import Link from "next/link";
import { afterEach, describe, expect, it } from "vitest";
import { OfflineNavGuard, shouldHoldNavigation } from "./OfflineNavGuard";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => value });
}
afterEach(() => setOnline(true));

const anchor = (href: string, attrs: Record<string, string> = {}) => {
  const a = document.createElement("a");
  a.setAttribute("href", href);
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  return a;
};

describe("QA-01: offline in-session links", () => {
  it("holds same-site links only while offline", () => {
    const origin = "http://localhost:3000";
    expect(shouldHoldNavigation(anchor("/s/1/queue"), false, origin)).toBe(true);
    expect(shouldHoldNavigation(anchor("/s/1/export", { download: "" }), false, origin)).toBe(true);
    expect(shouldHoldNavigation(anchor("/s/1/queue"), true, origin)).toBe(false);
    expect(shouldHoldNavigation(anchor("https://forms.example.com/feedback"), false, origin)).toBe(false);
    expect(shouldHoldNavigation(anchor("/s/1/queue", { target: "_blank" }), false, origin)).toBe(false);
    expect(shouldHoldNavigation(anchor("#top"), false, origin)).toBe(false);
  });

  it("offline: the tap doesn't navigate and the notice names the tab (plain name, not 'Queue · 8')", () => {
    setOnline(false);
    render(
      <>
        <OfflineNavGuard />
        <Link href="/s/1/queue" data-nav-label="Queue" aria-label="Queue · 8">
          Queue · 8
        </Link>
      </>,
    );
    const link = screen.getByRole("link");
    const clicked = fireEvent.click(link);
    expect(clicked).toBe(false); // default prevented
    // (jsdom has no popover support, so query the text rather than the role.)
    expect(
      screen.getByText("Needs signal to open Queue. Your taps are saved and will send when you're back online."),
    ).toBeInTheDocument();
  });

  it("online: links work as usual", () => {
    render(
      <>
        <OfflineNavGuard />
        <Link href="/s/1/queue">Queue</Link>
      </>,
    );
    expect(fireEvent.click(screen.getByRole("link"))).toBe(true);
    expect(screen.queryByText(/Needs signal/)).not.toBeInTheDocument();
  });
});
