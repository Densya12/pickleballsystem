import { describe, expect, it } from "vitest";
import { en, fil } from "@/lib/i18n/dictionary";
import { CSV_BOM, csvCell, formatDuration, sessionSummary, summaryCsv, summaryFileName, toCsv, type SummaryPlayer } from "./summary";

function player(over: Partial<SummaryPlayer> & { name: string }): SummaryPlayer {
  return {
    id: over.name.toLowerCase(),
    status: "left",
    paymentStatus: "unpaid",
    method: null,
    referenceDigits: null,
    amount: null,
    level: "unsure",
    isWalkIn: true,
    gamesPlayed: 0,
    checkedInAt: "2026-11-24T10:00:00Z",
    memberId: null,
    ...over,
  };
}

const GCASH = { method: "gcash" as const, otherName: null };

const PLAYERS = [
  player({ name: "Ana", gamesPlayed: 3, paymentStatus: "confirmed", method: "gcash", referenceDigits: "1234567890", amount: 150, isWalkIn: false, checkedInAt: "2026-11-24T10:01:00Z" }),
  player({ name: "Ben", gamesPlayed: 5, paymentStatus: "confirmed", method: "cash", amount: 150, checkedInAt: "2026-11-24T10:02:00Z" }),
  player({ name: "Carlo", gamesPlayed: 3, paymentStatus: "pending", method: "gcash", referenceDigits: "5555555555", isWalkIn: false, checkedInAt: "2026-11-24T10:03:00Z" }),
  player({ name: "Dina", gamesPlayed: 1, paymentStatus: "unpaid", method: "cash", checkedInAt: "2026-11-24T10:04:00Z" }),
];

describe("sessionSummary", () => {
  it("totals: duration, players, games, and games per player (highest first, ties by name)", () => {
    const summary = sessionSummary({
      startedAt: "2026-11-24T10:00:00Z",
      endedAt: "2026-11-24T12:15:00Z",
      fee: 150,
      players: PLAYERS,
      gamesCount: 4,
    });
    expect(summary.durationMinutes).toBe(135);
    expect(summary.playerCount).toBe(4);
    expect(summary.totalGames).toBe(4);
    expect(summary.gamesPerPlayer.map((p) => p.name)).toEqual(["Ben", "Ana", "Carlo", "Dina"]);
    expect(summary.payments.confirmedTotal).toBe(300);
    expect(summary.payments.expectedTotal).toBe(600);
    expect(summary.payments.unpaid.map((p) => p.name)).toEqual(["Dina"]);
    expect(summary.payments.pending.map((p) => p.name)).toEqual(["Carlo"]);
  });

  it("no start/end time: no duration", () => {
    expect(sessionSummary({ startedAt: null, endedAt: null, fee: 0, players: [], gamesCount: 0 }).durationMinutes).toBeNull();
  });

  it("a player who never played and never paid isn't expected to pay", () => {
    const players = [...PLAYERS, player({ name: "Eli", gamesPlayed: 0 })];
    const summary = sessionSummary({ startedAt: null, endedAt: null, fee: 150, players, gamesCount: 0 });
    expect(summary.payments.counted.map((p) => p.name)).toEqual(["Ana", "Ben", "Carlo", "Dina"]);
    expect(summary.payments.unpaid.map((p) => p.name)).toEqual(["Dina"]);
  });
});

describe("formatDuration", () => {
  it("says hours and minutes in the device's language", () => {
    expect(formatDuration(135, en)).toBe("2 h 15 min");
    expect(formatDuration(60, en)).toBe("1 h");
    expect(formatDuration(45, en)).toBe("45 min");
    expect(formatDuration(0, en)).toBe("0 min");
    expect(formatDuration(135, fil)).toBe("2 oras 15 minuto");
  });
});

describe("CSV", () => {
  it("escapes commas, quotes and line breaks", () => {
    expect(csvCell("Dela Cruz, Juan")).toBe('"Dela Cruz, Juan"');
    expect(csvCell('Juan "JD" Cruz')).toBe('"Juan ""JD"" Cruz"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell(" spaced ")).toBe('" spaced "');
    expect(csvCell("Niño")).toBe("Niño");
    expect(csvCell(3)).toBe("3");
    expect(csvCell(null)).toBe("");
  });

  it("stops Excel formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+63")).toBe("'+63");
    expect(csvCell("-Ana")).toBe("'-Ana");
    expect(csvCell("@x")).toBe("'@x");
  });

  it("starts with the BOM and ends rows with CRLF", () => {
    const csv = toCsv([["a", "b"], ["c", "d"]]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toBe(`${CSV_BOM}a,b\r\nc,d\r\n`);
  });

  it("one row per player in check-in order, then the totals row", () => {
    const csv = summaryCsv([PLAYERS[3], PLAYERS[0], PLAYERS[2], PLAYERS[1], player({ name: "Niño, Jr.", checkedInAt: "2026-11-24T10:05:00Z" })], 150, GCASH, en);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe("Name,Level,Joined by,Games,Payment,Method,Reference number,Checked in");
    expect(lines.slice(1, -1)).toEqual([
      "Ana,Not set,Phone,3,Paid,GCash,1234567890,2026-11-24 18:01",
      "Ben,Not set,Walk-in,5,Paid,Cash,,2026-11-24 18:02",
      "Carlo,Not set,Phone,3,To check,GCash,5555555555,2026-11-24 18:03",
      "Dina,Not set,Walk-in,1,Unpaid,Cash,,2026-11-24 18:04",
      '"Niño, Jr.",Not set,Walk-in,0,Unpaid,,,2026-11-24 18:05',
    ]);
    expect(lines.at(-1)).toBe("Total,,5 players,12,2 paid · 1 to check · 1 unpaid,₱300 of ₱600,,");
  });

  it("the Method column names the club's method (Maya, Other), never GCash", () => {
    const maya = summaryCsv(PLAYERS, 150, { method: "maya", otherName: null }, en);
    expect(maya).toContain("Ana,Not set,Phone,3,Paid,Maya,1234567890,");
    expect(maya).not.toMatch(/gcash/i);
    expect(summaryCsv(PLAYERS, 150, { method: "other", otherName: "ShopeePay" }, en)).toContain(",To check,ShopeePay,5555555555,");
  });

  it("Taglish column names and words when the device is set to Taglish", () => {
    const csv = summaryCsv([PLAYERS[1]], 150, GCASH, fil);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe("Pangalan,Level,Paano pumila,Laro,Bayad,Paraan,Reference number,Oras ng check-in");
    expect(lines[1]).toBe("Ben,Wala pang level,Walk-in,5,Bayad na,Cash,,2026-11-24 18:02");
    expect(lines.at(-1)).toBe("Kabuuan,,1 players,5,1 bayad · 0 i-check · 0 hindi pa,₱150 sa ₱150,,");
  });

  it("free sessions say Libre (Taglish)", () => {
    const csv = summaryCsv([player({ name: "Ana", gamesPlayed: 2 })], 0, GCASH, fil);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[1]).toContain(",Libre,");
    expect(lines.at(-1)).toBe("Kabuuan,,1 players,2,Libre,,,");
  });

  it("file name: slug and Manila date", () => {
    expect(summaryFileName("Friday Night Open Play!", "2026-11-24T17:00:00Z", en)).toBe("summary-friday-night-open-play-2026-11-25.csv");
    expect(summaryFileName("Ñino's ✨", "2026-11-24T01:00:00Z", fil)).toBe("buod-nino-s-2026-11-24.csv");
    expect(summaryFileName("✨✨", "2026-11-24T01:00:00Z", en)).toBe("summary-session-2026-11-24.csv");
  });
});
