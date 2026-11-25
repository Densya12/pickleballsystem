import { describe, expect, it } from "vitest";
import { courtCards, courtsLineup } from "./courts";
import type { QueuePlayer } from "./state";

let pos = 0;
function p(name: string, status = "queued", paymentStatus = "unpaid"): QueuePlayer {
  pos += 1;
  return { id: name.toLowerCase(), name, status, queuePos: pos, paymentStatus };
}
const FREE = { payFirst: false, fee: 0 };
const RELAXED = { payFirst: false, fee: 150 };
const PAY_FIRST = { payFirst: true, fee: 150 };
const names = (list: { name: string }[]) => list.map((x) => x.name);

describe("courtsLineup", () => {
  const queue = [
    p("Ana"),
    p("Ben"),
    p("Cara"),
    p("Dino"),
    p("Ella"),
    p("Fely"),
    p("Gabe"),
    p("Hana", "playing"),
    p("Ivan", "left"),
  ];

  it("doubles: the next 4 get ready, then the 2 after them", () => {
    const lineup = courtsLineup(queue, ["doubles", "doubles"], FREE);
    expect(names(lineup.ready)).toEqual(["Ana", "Ben", "Cara", "Dino"]);
    expect(names(lineup.after)).toEqual(["Ella", "Fely"]);
    expect(lineup.notCallable).toEqual([]);
  });

  it("every court singles: the next 2, then 2 after", () => {
    const lineup = courtsLineup(queue, ["singles", "singles"], FREE);
    expect(names(lineup.ready)).toEqual(["Ana", "Ben"]);
    expect(names(lineup.after)).toEqual(["Cara", "Dino"]);
  });

  it("mixed courts: any doubles court means 4", () => {
    const lineup = courtsLineup(queue, ["singles", "doubles"], FREE);
    expect(names(lineup.ready)).toEqual(["Ana", "Ben", "Cara", "Dino"]);
  });

  it("follows queue_pos, not array order", () => {
    const shuffled = [...queue].reverse();
    expect(names(courtsLineup(shuffled, ["doubles"], FREE).ready)).toEqual(["Ana", "Ben", "Cara", "Dino"]);
  });

  it("pay_first on: unpaid players are skipped and listed as 'unpaid'; pending counts as paid", () => {
    const list = [p("Ana", "queued", "unpaid"), p("Ben", "queued", "pending"), p("Cara", "queued", "confirmed"),
      p("Dino", "paused", "confirmed"), p("Ella"), p("Fely", "queued", "confirmed"), p("Gabe", "queued", "pending"),
      p("Hana", "queued", "confirmed")];
    const lineup = courtsLineup(list, ["doubles"], PAY_FIRST);
    expect(names(lineup.ready)).toEqual(["Ben", "Cara", "Fely", "Gabe"]);
    expect(names(lineup.after)).toEqual(["Hana"]);
    expect(lineup.notCallable).toEqual([
      { id: "ana", name: "Ana", reason: "unpaid" },
      { id: "dino", name: "Dino", reason: "resting" },
      { id: "ella", name: "Ella", reason: "unpaid" },
    ]);
  });

  it("pay_first off (with a fee): nobody is held", () => {
    const list = [p("Ana"), p("Ben", "paused"), p("Cara")];
    const lineup = courtsLineup(list, ["doubles"], RELAXED);
    expect(names(lineup.ready)).toEqual(["Ana", "Cara"]);
    expect(lineup.notCallable).toEqual([{ id: "ben", name: "Ben", reason: "resting" }]);
  });

  it("pay_first with fee 0: nobody is held", () => {
    const lineup = courtsLineup([p("Ana"), p("Ben")], ["doubles"], { payFirst: true, fee: 0 });
    expect(names(lineup.ready)).toEqual(["Ana", "Ben"]);
    expect(lineup.notCallable).toEqual([]);
  });

  it("an empty queue gives empty lists", () => {
    expect(courtsLineup([], ["doubles"], FREE)).toEqual({ ready: [], after: [], notCallable: [] });
  });
});

describe("courtCards", () => {
  it("lists each court in order, with players in call order, or Bakante", () => {
    const players = [p("Ana", "playing"), p("Ben", "playing")];
    const cards = courtCards(
      [
        { id: "c1", label: "Court 1", format: "singles" },
        { id: "c2", label: "Court 2", format: "doubles" },
      ],
      [{ id: "g1", number: 3, courtId: "c1", playerIds: ["ben", "ana"] }],
      players,
    );
    expect(cards).toEqual([
      { id: "c1", label: "Court 1", format: "singles", game: { number: 3, players: [{ id: "ben", name: "Ben" }, { id: "ana", name: "Ana" }] } },
      { id: "c2", label: "Court 2", format: "doubles", game: null },
    ]);
  });
});
