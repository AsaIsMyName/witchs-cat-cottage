import { describe, expect, it } from "vitest";
import { applyKnockovers, heartsFor, reviewRoom, visitOrder, type CatPrefs, type TaggedCatalog } from "./cat";
import { emptyRoom, placeFromTray, type RoomShape, type RoomState, type Target } from "./grid";

const room: RoomShape = { columns: 12, wallRows: 3, floorRows: 3 };

const catalog: TaggedCatalog = {
  shelf: { id: "shelf", layer: "wall", width: 1, height: 1, hasSurface: true, tags: ["tall"] },
  frame: { id: "frame", layer: "wall", width: 1, height: 1, tags: ["cozy"] },
  table: { id: "table", layer: "floor", width: 2, height: 1, hasSurface: true, tags: ["cozy"] },
  rug: { id: "rug", layer: "rug", width: 2, height: 1, tags: ["soft"] },
  candle: { id: "candle", layer: "surface", width: 1, height: 1, tags: ["warm", "shiny"] },
  potion: { id: "potion", layer: "surface", width: 1, height: 1, tags: ["shiny", "fragile"] },
};

const prefs: CatPrefs = {
  likes: ["soft", "warm", "shiny"],
  dislikes: [{ tag: "fragile", on: ["high"] }],
  points: { liked: 15, disliked: -20 },
};

function build(steps: [string, Target][]): RoomState {
  let s = emptyRoom({ shelf: 2, frame: 1, table: 1, rug: 1, candle: 3, potion: 3 });
  for (const [itemId, target] of steps) {
    const next = placeFromTray(room, catalog, s, itemId, target);
    if (!next) throw new Error(`could not place ${itemId}`);
    s = next;
  }
  return s;
}

const grid = (col: number, row: number): Target => ({ kind: "grid", col, row });
const on = (hostUid: string, slot = 0): Target => ({ kind: "surface", hostUid, slot });

describe("reviewRoom reactions", () => {
  it("likes items with a liked tag", () => {
    const review = reviewRoom(catalog, build([["rug", grid(0, 0)]]), prefs);
    expect(review.visits).toEqual([{ uid: "p1", itemId: "rug", reaction: "like", tag: "soft" }]);
  });

  it("sniffs items with no liked tag", () => {
    const review = reviewRoom(catalog, build([["frame", grid(0, 0)]]), prefs);
    expect(review.visits[0].reaction).toBe("neutral");
  });

  it("dislikes a fragile item on a shelf but likes it on a table", () => {
    const s = build([
      ["shelf", grid(0, 0)],
      ["potion", on("p1")],
      ["table", grid(4, 2)],
      ["potion", on("p3")],
    ]);
    const reactions = Object.fromEntries(reviewRoom(catalog, s, prefs).visits.map((v) => [v.uid, [v.reaction, v.tag]]));
    expect(reactions.p2).toEqual(["dislike", "fragile"]);
    expect(reactions.p4).toEqual(["like", "shiny"]);
  });

  it("lets a dislike rule with no spot apply anywhere", () => {
    const strict: CatPrefs = { ...prefs, dislikes: [{ tag: "cozy" }] };
    const review = reviewRoom(catalog, build([["frame", grid(0, 0)]]), strict);
    expect(review.visits[0]).toMatchObject({ reaction: "dislike", tag: "cozy" });
  });
});

describe("reviewRoom score", () => {
  it("is 0 for an empty room", () => {
    expect(reviewRoom(catalog, emptyRoom({}), prefs)).toEqual({ visits: [], score: 0 });
  });

  it("adds likes and subtracts dislikes", () => {
    const s = build([
      ["rug", grid(0, 0)],
      ["table", grid(4, 0)],
      ["candle", on("p2", 0)],
      ["shelf", grid(8, 0)],
      ["potion", on("p4")],
    ]);
    // Likes: rug, candle (+30). Neutral: table, shelf. Dislike: potion on shelf (-20).
    expect(reviewRoom(catalog, s, prefs).score).toBe(10);
  });

  it("stays between 0 and 100", () => {
    const s = build([
      ["shelf", grid(0, 0)],
      ["potion", on("p1")],
    ]);
    expect(reviewRoom(catalog, s, prefs).score).toBe(0);
    const generous: CatPrefs = { ...prefs, points: { liked: 500, disliked: -20 } };
    expect(reviewRoom(catalog, build([["rug", grid(0, 0)]]), generous).score).toBe(100);
  });
});

describe("visitOrder", () => {
  it("walks left to right, floor before wall, rugs first", () => {
    const s = build([
      ["frame", grid(0, 0)], // p1, x 0.5, wall
      ["rug", grid(0, 2)], // p2, x 1, rug
      ["table", grid(0, 1)], // p3, x 1, floor
      ["candle", on("p3", 1)], // p4, x 1.5, low surface
      ["shelf", grid(5, 1)], // p5, x 5.5, wall
      ["potion", on("p5")], // p6, x 5.5, high surface
    ]);
    expect(visitOrder(catalog, s).map((p) => p.itemId)).toEqual(["frame", "rug", "table", "candle", "shelf", "potion"]);
  });
});

describe("applyKnockovers", () => {
  it("sends disliked items back to the tray and keeps the rest", () => {
    const s = build([
      ["shelf", grid(0, 0)],
      ["potion", on("p1")],
      ["rug", grid(0, 2)],
    ]);
    const after = applyKnockovers(s, reviewRoom(catalog, s, prefs));
    expect(after.placements.map((p) => p.itemId)).toEqual(["shelf", "rug"]);
    expect(after.inventory.potion).toBe(3);
  });
});

describe("heartsFor", () => {
  it("rounds to half hearts out of 5", () => {
    expect([0, 10, 24, 25, 70, 100].map(heartsFor)).toEqual([0, 0.5, 1, 1.5, 3.5, 5]);
  });
});
