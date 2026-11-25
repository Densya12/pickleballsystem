import type { Page } from "@playwright/test";

/**
 * Facts about what is visible on a screen, measured in the browser from
 * computed styles (not from class names), so they match what is rendered.
 *
 * Definitions (also in docs/ui-audit/README.md):
 * - button: a visible <button>, [role=button], or a link styled as a button
 *   (inline-flex/flex, centered, min height >= 44px, with a background or border).
 * - primary (filled): a button whose background is the primary (ink) or accent (lime) color.
 * - card/box: a visible non-button, non-form element with radius >= 8px, height >= 40px,
 *   and a border or a background different from its parent (chips with a full radius excluded).
 * - option card: a bordered radio/switch row (a form <label>), counted apart from cards.
 * - text element: an element with its own non-empty text (screen-reader-only text excluded).
 * - hint line: a text element in the muted color, outside buttons and links.
 */
export type ScreenMetrics = {
  screen: string;
  file: string;
  viewport: string;
  pageHeight: number;
  /** Wider than the viewport (sideways scrolling). */
  horizontalOverflow: boolean;
  /** Radio / switch rows drawn as bordered cards (form <label>s). */
  optionCards: number;
  /** Text fields. */
  inputs: number;
  buttons: number;
  primaryButtons: number;
  buttonLabels: string[];
  primaryLabels: string[];
  cards: number;
  chips: number;
  fontSizes: string[];
  textColors: string[];
  hintLines: number;
  headings: { tag: string; size: string; text: string }[];
  radii: string[];
  borderWidths: string[];
  buttonStyles: string[];
  icons: number;
  backLinks: string[];
  largestInFirstViewport: { text: string; size: string } | null;
  repeatedTexts: string[];
};

const TOKEN_NAMES: Record<string, string> = {
  "rgb(17, 20, 18)": "ink",
  "rgb(95, 101, 97)": "muted",
  "rgb(113, 119, 115)": "placeholder",
  "rgb(255, 255, 255)": "white (on-primary)",
  "rgb(45, 59, 11)": "on-accent-soft",
  "rgb(47, 90, 18)": "success",
  "rgb(138, 75, 8)": "warn",
  "rgb(180, 35, 24)": "danger",
  "rgb(246, 246, 243)": "page",
  "rgb(242, 242, 238)": "subtle",
  "rgb(243, 246, 234)": "primary-tint",
  "rgb(201, 242, 107)": "accent",
  "rgb(241, 249, 220)": "accent-soft",
  "rgb(238, 245, 228)": "success-bg",
  "rgb(251, 238, 220)": "warn-bg",
  "rgb(236, 236, 231)": "border-default",
  "rgb(140, 145, 141)": "border-strong",
  // v5 "Clean 2026" tokens (src/app/globals.css)
  "rgb(107, 113, 109)": "muted",
  "rgb(77, 83, 80)": "secondary",
  "rgb(184, 189, 185)": "on-dark-muted",
  "rgb(30, 42, 6)": "on-accent",
  "rgb(63, 122, 18)": "success",
  "rgb(244, 244, 241)": "page",
  "rgb(241, 241, 237)": "subtle",
  "rgb(247, 247, 244)": "info",
  "rgb(238, 247, 214)": "accent-soft",
  "rgb(247, 251, 234)": "accent-faint",
  "rgb(251, 239, 223)": "warn-bg",
  "rgb(239, 239, 235)": "chip",
  "rgb(94, 159, 28)": "live",
  "rgb(180, 83, 9)": "badge",
  "rgb(238, 238, 234)": "hairline",
  "rgb(218, 218, 212)": "input-border",
  "rgba(0, 0, 0, 0)": "transparent",
};

export async function measure(page: Page, screen: string, file: string): Promise<ScreenMetrics> {
  const raw = await page.evaluate(() => {
    // Visible, and not screen-reader-only text (sr-only is clipped to 1px).
    const visible = (el: Element) =>
      el.getClientRects().length > 0 &&
      el.getBoundingClientRect().width > 1 &&
      el.getBoundingClientRect().height > 1 &&
      (el as HTMLElement).checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) !== false;
    const all = [...document.body.querySelectorAll("*")].filter((el) => visible(el) && !el.closest("#__next-route-announcer__, nextjs-portal"));
    const css = (el: Element) => getComputedStyle(el);
    const hasPaint = (el: Element) => {
      const s = css(el);
      const bg = s.backgroundColor;
      const parentBg = el.parentElement ? css(el.parentElement).backgroundColor : "";
      return parseFloat(s.borderTopWidth) > 0 || (bg !== "rgba(0, 0, 0, 0)" && bg !== parentBg);
    };
    const isButton = (el: Element) => {
      if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") return true;
      if (el.tagName !== "A") return false;
      const s = css(el);
      return (
        (s.display.includes("flex")) &&
        s.justifyContent === "center" &&
        el.getBoundingClientRect().height >= 44 &&
        hasPaint(el)
      );
    };
    const buttons = all.filter(isButton);
    const filled = new Set(["rgb(17, 20, 18)", "rgb(201, 242, 107)"]);
    const primary = buttons.filter((b) => filled.has(css(b).backgroundColor));
    const label = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60);

    const formTags = new Set(["INPUT", "LABEL", "SELECT", "TEXTAREA", "svg", "path", "SVG", "FIELDSET", "LEGEND"]);
    const boxes = all.filter((el) => {
      if (isButton(el) || formTags.has(el.tagName) || el.closest("button")) return false;
      const s = css(el);
      const radius = parseFloat(s.borderTopLeftRadius);
      const h = el.getBoundingClientRect().height;
      return radius >= 8 && hasPaint(el) && (h >= 40 || radius < 100);
    });
    const chips = boxes.filter((el) => parseFloat(css(el).borderTopLeftRadius) >= 100);
    const cards = boxes.filter((el) => parseFloat(css(el).borderTopLeftRadius) < 100 && el.getBoundingClientRect().height >= 40);

    const ownText = (el: Element) =>
      [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "");
    const texts = all.filter(ownText);
    // Muted grey: the pre-v5 value (before) and the v5 token (after).
    const muted = new Set(["rgb(95, 101, 97)", "rgb(107, 113, 109)"]);
    const hints = texts.filter((el) => muted.has(css(el).color) && !el.closest("button, a"));

    const firstViewport = texts.filter((el) => el.getBoundingClientRect().top < window.innerHeight);
    const largest = firstViewport.reduce<Element | null>((best, el) => {
      if (!best) return el;
      const a = parseFloat(css(el).fontSize) * (parseInt(css(el).fontWeight, 10) / 400);
      const b = parseFloat(css(best).fontSize) * (parseInt(css(best).fontWeight, 10) / 400);
      return a > b ? el : best;
    }, null);

    const counts = new Map<string, number>();
    for (const el of texts) {
      const t = label(el);
      if (t.length >= 2 && !el.closest("ul, ol") ) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    // Repeated anywhere (including list items), for "the same thing shown twice".
    const anyCounts = new Map<string, number>();
    for (const el of texts) {
      const t = label(el);
      if (t.length >= 2) anyCounts.set(t, (anyCounts.get(t) ?? 0) + 1);
    }

    const optionCards = all.filter(
      (el) => el.tagName === "LABEL" && parseFloat(css(el).borderTopWidth) > 0 && parseFloat(css(el).borderTopLeftRadius) >= 8,
    );

    return {
      pageHeight: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      optionCards: optionCards.length,
      inputs: all.filter((el) => el.tagName === "INPUT" && !["radio", "checkbox", "hidden"].includes((el as HTMLInputElement).type)).length,
      buttons: buttons.length,
      primaryButtons: primary.length,
      buttonLabels: buttons.map(label),
      primaryLabels: primary.map(label),
      cards: cards.length,
      chips: chips.length,
      fontSizes: [...new Set(texts.map((el) => css(el).fontSize))].sort((a, b) => parseFloat(a) - parseFloat(b)),
      textColors: [...new Set(texts.map((el) => css(el).color))],
      hintLines: hints.length,
      headings: [...document.querySelectorAll("h1, h2, h3")]
        .filter(visible)
        .map((h) => ({ tag: h.tagName.toLowerCase(), size: css(h).fontSize, text: label(h) })),
      radii: [...new Set([...cards, ...buttons].map((el) => css(el).borderTopLeftRadius))],
      borderWidths: [...new Set([...cards, ...buttons].map((el) => css(el).borderTopWidth).filter((w) => w !== "0px"))],
      buttonStyles: [
        ...new Set(
          buttons.map((b) => {
            const s = css(b);
            return `${s.backgroundColor}|${s.borderTopWidth} ${s.borderTopColor}|${Math.round(b.getBoundingClientRect().height)}px|${s.fontSize}`;
          }),
        ),
      ],
      icons: all.filter((el) => el.tagName.toLowerCase() === "svg" && el.getAttribute("aria-hidden") === "true").length,
      backLinks: all.filter((el) => el.tagName === "A" && /Bumalik/.test(el.textContent ?? "")).map(label),
      largestInFirstViewport: largest ? { text: label(largest), size: css(largest).fontSize } : null,
      repeatedTexts: [...anyCounts.entries()].filter(([, n]) => n > 1).map(([t, n]) => `${t} ×${n}`),
    };
  });

  const name = (c: string) => TOKEN_NAMES[c] ?? c;
  const viewport = page.viewportSize();
  return {
    screen,
    file,
    viewport: viewport ? `${viewport.width}×${viewport.height}` : "?",
    ...raw,
    textColors: raw.textColors.map(name),
    buttonStyles: raw.buttonStyles.map((s) => {
      const [bg, border, ...rest] = s.split("|");
      const [width, ...color] = border.split(" ");
      return [name(bg), `${width} ${name(color.join(" "))}`, ...rest].join(" | ");
    }),
  };
}
