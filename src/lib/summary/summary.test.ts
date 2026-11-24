import { describe, expect, it } from "vitest";
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
  it("says hours and minutes in Taglish", () => {
    expect(formatDuration(135)).toBe("2 oras 15 minuto");
    expect(formatDuration(60)).toBe("1 oras");
    expect(formatDuration(45)).toBe("45 minuto");
    expect(formatDuration(0)).toBe("0 minuto");
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
    const csv = summaryCsv([PLAYERS[3], PLAYERS[0], PLAYERS[2], PLAYERS[1], player({ name: "Niño, Jr.", checkedInAt: "2026-11-24T10:05:00Z" })], 150);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe("Pangalan,Level,Paano pumila,Laro,Bayad,Paraan,Reference,Oras ng check-in");
    expect(lines.slice(1, -1)).toEqual([
      "Ana,Hindi sigurado,Phone,3,Bayad na,GCash,1234567890,2026-11-24 18:01",
      "Ben,Hindi sigurado,Walk-in,5,Bayad na,Cash,,2026-11-24 18:02",
      "Carlo,Hindi sigurado,Phone,3,I-check,GCash,5555555555,2026-11-24 18:03",
      "Dina,Hindi sigurado,Walk-in,1,Hindi pa bayad,Cash,,2026-11-24 18:04",
      '"Niño, Jr.",Hindi sigurado,Walk-in,0,Hindi pa bayad,,,2026-11-24 18:05',
    ]);
    expect(lines.at(-1)).toBe("Kabuuan,,5 players,12,2 bayad · 1 i-check · 1 hindi pa,₱300 sa ₱600,,");
  });

  it("free sessions say Libre", () => {
    const csv = summaryCsv([player({ name: "Ana", gamesPlayed: 2 })], 0);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[1]).toContain(",Libre,");
    expect(lines.at(-1)).toBe("Kabuuan,,1 players,2,Libre,,,");
  });

  it("file name: slug and Manila date", () => {
    expect(summaryFileName("Friday Night Open Play!", "2026-11-24T17:00:00Z")).toBe("buod-friday-night-open-play-2026-11-25.csv");
    expect(summaryFileName("Ñino's ✨", "2026-11-24T01:00:00Z")).toBe("buod-nino-s-2026-11-24.csv");
    expect(summaryFileName("✨✨", "2026-11-24T01:00:00Z")).toBe("buod-session-2026-11-24.csv");
  });
});
