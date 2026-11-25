import { describe, expect, it } from "vitest";
import { en, fil } from "./dictionary";

/** Every key path, with the kind of value at the end (string, function, array). */
function shape(value: unknown, path = ""): string[] {
  if (typeof value === "function") return [`${path}:fn`];
  if (typeof value === "string") return [`${path}:string`];
  if (Array.isArray(value)) return [`${path}:array`];
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .flatMap((key) => shape((value as Record<string, unknown>)[key], path ? `${path}.${key}` : key));
  }
  return [`${path}:${typeof value}`];
}

describe("dictionaries", () => {
  it("English and Taglish have exactly the same keys, with the same kinds of values", () => {
    expect(shape(fil)).toEqual(shape(en));
  });

  it("no string is empty in either language", () => {
    const empty = (d: unknown, path = ""): string[] =>
      typeof d === "string"
        ? d.trim() === ""
          ? [path]
          : []
        : d && typeof d === "object"
          ? Object.entries(d).flatMap(([k, v]) => empty(v, `${path}.${k}`))
          : [];
    expect(empty(en)).toEqual([]);
    expect(empty(fil)).toEqual([]);
  });

  it("functions take the same number of arguments in both languages", () => {
    const arity = (d: unknown, path = ""): string[] =>
      typeof d === "function"
        ? [`${path}/${d.length}`]
        : d && typeof d === "object" && !Array.isArray(d)
          ? Object.entries(d).flatMap(([k, v]) => arity(v, `${path}.${k}`))
          : [];
    expect(arity(fil)).toEqual(arity(en));
  });

  it("guide sections line up (same count, items per section)", () => {
    expect(fil.guide.sections.map((s) => s.items.length)).toEqual(en.guide.sections.map((s) => s.items.length));
    expect(fil.payments.csvHeader).toHaveLength(en.payments.csvHeader.length);
  });
});
