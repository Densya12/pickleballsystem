import { afterEach, describe, expect, it, vi } from "vitest";
import { AnnouncementQueue, announcementText, createSpeaker, pickVoice, readTagatawagEnabled, SPEECH_RATE, writeTagatawagEnabled } from "./announce";
import { takeNewCalls } from "./newCalls";

describe("announcementText", () => {
  it("doubles: the four names, with 'at' before the last", () => {
    expect(announcementText("Court 2", ["Ana", "Ben", "Carlo", "Dina"])).toBe("Court 2: Ana, Ben, Carlo, at Dina.");
  });
  it("singles: two names", () => {
    expect(announcementText("Court 2", ["Ana", "Ben"])).toBe("Court 2: Ana at Ben.");
  });
  it("handles one or no names", () => {
    expect(announcementText("Court 1", ["Ana"])).toBe("Court 1: Ana.");
    expect(announcementText("Court 1", [])).toBe("Court 1.");
  });
});

describe("pickVoice", () => {
  const v = (lang: string) => ({ lang, name: lang });
  it("prefers Filipino (fil-PH or tl)", () => {
    expect(pickVoice([v("en-US"), v("en-PH"), v("fil-PH")])?.lang).toBe("fil-PH");
    expect(pickVoice([v("en-PH"), v("tl-PH")])?.lang).toBe("tl-PH");
    expect(pickVoice([v("fil_PH")])?.lang).toBe("fil_PH");
    expect(pickVoice([v("tl")])?.lang).toBe("tl");
  });
  it("then English (Philippines)", () => {
    expect(pickVoice([v("en-US"), v("en-PH")])?.lang).toBe("en-PH");
  });
  it("then the default (null)", () => {
    expect(pickVoice([v("en-US"), v("ja-JP")])).toBeNull();
    expect(pickVoice([])).toBeNull();
  });
  it("doesn't mistake other languages for Filipino", () => {
    expect(pickVoice([v("fi-FI"), v("th-TH")])).toBeNull();
  });
});

describe("AnnouncementQueue", () => {
  it("speaks one at a time, in order", () => {
    const calls: { text: string; done: () => void }[] = [];
    const queue = new AnnouncementQueue((text, done) => calls.push({ text, done }));
    queue.enqueue("Court 1: A, B, C, at D.");
    queue.enqueue("Court 2: E at F.");
    expect(calls.map((c) => c.text)).toEqual(["Court 1: A, B, C, at D."]);
    expect(queue.pending).toBe(2);
    calls[0].done();
    expect(calls.map((c) => c.text)).toEqual(["Court 1: A, B, C, at D.", "Court 2: E at F."]);
    calls[1].done();
    expect(queue.pending).toBe(0);
  });

  it("ignores a second done() for the same announcement", () => {
    const calls: { text: string; done: () => void }[] = [];
    const queue = new AnnouncementQueue((text, done) => calls.push({ text, done }));
    queue.enqueue("one");
    queue.enqueue("two");
    queue.enqueue("three");
    calls[0].done();
    calls[0].done();
    expect(calls.map((c) => c.text)).toEqual(["one", "two"]);
  });

  it("clear() drops what hasn't started", () => {
    const calls: { text: string; done: () => void }[] = [];
    const queue = new AnnouncementQueue((text, done) => calls.push({ text, done }));
    queue.enqueue("one");
    queue.enqueue("two");
    queue.clear();
    calls[0].done();
    expect(calls).toHaveLength(1);
  });
});

describe("createSpeaker", () => {
  afterEach(() => vi.useRealTimers());

  class FakeUtterance {
    voice: unknown = null;
    lang = "";
    rate = 1;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }

  it("uses the chosen voice, a slower rate, and finishes on end", () => {
    const spoken: FakeUtterance[] = [];
    const synth = { speak: (u: SpeechSynthesisUtterance) => spoken.push(u as unknown as FakeUtterance), getVoices: () => [{ lang: "fil-PH" }] as SpeechSynthesisVoice[] };
    const done = vi.fn();
    createSpeaker(synth, FakeUtterance as unknown as typeof SpeechSynthesisUtterance)("Court 1: A at B.", done);
    expect(spoken[0].text).toBe("Court 1: A at B.");
    expect(spoken[0].lang).toBe("fil-PH");
    expect(spoken[0].rate).toBe(SPEECH_RATE);
    spoken[0].onend?.();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("moves on if the browser never says it finished", () => {
    vi.useFakeTimers();
    const synth = { speak: () => {}, getVoices: () => [] };
    const done = vi.fn();
    createSpeaker(synth, FakeUtterance as unknown as typeof SpeechSynthesisUtterance)("Court 1: A at B.", done);
    vi.advanceTimersByTime(10_000);
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe("Tagatawag setting", () => {
  it("is ON by default and remembered per device", () => {
    window.localStorage.clear();
    expect(readTagatawagEnabled()).toBe(true);
    writeTagatawagEnabled(false);
    expect(readTagatawagEnabled()).toBe(false);
    writeTagatawagEnabled(true);
    expect(readTagatawagEnabled()).toBe(true);
  });
});


describe("takeNewCalls", () => {
  const call = (key: string, courtNumber: number) => ({ key, courtNumber, text: `Court ${courtNumber}` });

  it("returns only games not seen before, in court order, once", () => {
    const seen = new Set(["g1"]);
    expect(takeNewCalls(seen, [call("g3", 3), call("g1", 1), call("g2", 2)]).map((c) => c.key)).toEqual(["g2", "g3"]);
    expect(takeNewCalls(seen, [call("g3", 3), call("g1", 1), call("g2", 2)])).toEqual([]);
  });

  it("a swapped player on the same game is a new call", () => {
    const seen = new Set(["g1:a,b,c,d"]);
    expect(takeNewCalls(seen, [call("g1:a,e,c,d", 1)]).map((c) => c.key)).toEqual(["g1:a,e,c,d"]);
  });
});
