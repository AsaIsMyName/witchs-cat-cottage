import { describe, expect, it } from "vitest";
import {
  changedItems,
  displaced,
  facingFor,
  facingSign,
  facingStep,
  movedOrRemoved,
  pickIdle,
  slotSide,
  toBack,
  reactionFor,
  type CatBehavior,
  type TaggedCatalog,
} from "./cat";
import { emptyRoom, moveItem, placeFromTray, removeToTray, type RoomShape, type RoomState, type Target } from "./grid";

const room: RoomShape = { columns: 12, wallRows: 3, floorRows: 3 };

const catalog: TaggedCatalog = {
  shelf: { id: "shelf", layer: "wall", width: 1, height: 1, hasSurface: true, tags: ["tall"] },
  clock: { id: "clock", layer: "wall", width: 1, height: 1, tags: ["shiny"] },
  chart: { id: "chart", layer: "wall", width: 1, height: 1, tags: ["spooky"] },
  frame: { id: "frame", layer: "wall", width: 1, height: 1, tags: ["cozy"] },
  table: { id: "table", layer: "floor", width: 2, height: 1, hasSurface: true, tags: ["cozy"] },
  cauldron: { id: "cauldron", layer: "floor", width: 1, height: 1, tags: ["warm", "spooky"] },
  rug: { id: "rug", layer: "rug", width: 2, height: 1, tags: ["soft"] },
  candle: { id: "candle", layer: "surface", width: 1, height: 1, tags: ["warm", "shiny"] },
  potion: { id: "potion", layer: "surface", width: 1, height: 1, tags: ["shiny", "fragile"] },
};

const behavior: CatBehavior = {
  rules: [
    { reaction: "nap", tags: ["soft"] },
    { reaction: "paw-up", tags: ["shiny", "fragile"], on: ["high", "wall"] },
    { reaction: "warm", tags: ["warm"] },
    { reaction: "bat", tags: ["shiny"] },
    { reaction: "loaf", hasSurface: true, on: ["floor"] },
    { reaction: "stare", tags: ["spooky"] },
  ],
  cozyReactions: ["nap", "warm", "loaf"],
  cozyChance: 0.5,
};

const grid = (col: number, row: number): Target => ({ kind: "grid", col, row });
const on = (hostUid: string, slot = 0): Target => ({ kind: "surface", hostUid, slot });

function build(steps: [string, Target][]): RoomState {
  let s = emptyRoom(Object.fromEntries(Object.keys(catalog).map((id) => [id, 3])));
  for (const [itemId, target] of steps) {
    const next = placeFromTray(room, catalog, s, itemId, target);
    if (!next) throw new Error(`could not place ${itemId}`);
    s = next;
  }
  return s;
}

/** Returns the given values in order, like a scripted Math.random. */
function scripted(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("reactionFor", () => {
  const s = build([
    ["rug", grid(0, 2)], // p1
    ["shelf", grid(3, 0)], // p2
    ["potion", on("p2")], // p3: fragile, high
    ["table", grid(5, 1)], // p4
    ["potion", on("p4", 0)], // p5: shiny, low
    ["candle", on("p4", 1)], // p6: warm + shiny, low
    ["cauldron", grid(9, 2)], // p7
    ["clock", grid(8, 0)], // p8
    ["chart", grid(9, 0)], // p9
    ["frame", grid(10, 0)], // p10
  ]);
  const reaction = (uid: string) => reactionFor(catalog, s, s.placements.find((p) => p.uid === uid)!, behavior.rules);

  it.each([
    ["p1", "nap", "naps on a rug"],
    ["p3", "paw-up", "paws at a potion on a shelf"],
    ["p4", "loaf", "loafs on a table"],
    ["p5", "bat", "bats at a potion within reach"],
    ["p6", "warm", "warms up by a candle"],
    ["p7", "warm", "warms up by the cauldron before staring at it"],
    ["p8", "paw-up", "reaches up to a shiny clock on the wall"],
    ["p9", "stare", "stares at spooky things"],
    ["p10", "sniff", "sniffs anything else"],
    ["p2", "sniff", "sniffs a shelf, since only floor furniture is loafed on"],
  ])("%s → %s (%s)", (uid, expected) => {
    expect(reaction(uid)).toBe(expected);
  });

  it("paws at a candle on a shelf instead of warming up", () => {
    const t = build([
      ["shelf", grid(0, 0)],
      ["candle", on("p1")],
    ]);
    expect(reactionFor(catalog, t, t.placements[1], behavior.rules)).toBe("paw-up");
  });
});

describe("pickIdle", () => {
  it("wanders anywhere on the floor in an empty room", () => {
    const plan = pickIdle(catalog, emptyRoom({}), room, behavior, scripted(0.99, 0.5, 0.4));
    expect(plan).toEqual({ kind: "wander", col: 11, row: 1, action: "groom" });
  });

  it("sometimes drifts to a cozy spot", () => {
    const s = build([
      ["frame", grid(0, 0)],
      ["rug", grid(4, 2)],
    ]);
    expect(pickIdle(catalog, s, room, behavior, scripted(0.1, 0))).toEqual({ kind: "visit", uid: "p2", reaction: "nap" });
    expect(pickIdle(catalog, s, room, behavior, scripted(0.9, 0, 0, 0)).kind).toBe("wander");
  });

  it("wanders across the whole of a 16×9 floor, not just the old 3 rows", () => {
    const big: RoomShape = { columns: 16, wallRows: 2, floorRows: 9 };
    expect(pickIdle(catalog, emptyRoom({}), big, behavior, scripted(0.999, 0.999, 0))).toMatchObject({ col: 15, row: 8 });
    expect(pickIdle(catalog, emptyRoom({}), big, behavior, scripted(0, 0.5, 0))).toMatchObject({ col: 0, row: 4 });
  });
});

describe("facingFor", () => {
  it("faces along a straight move", () => {
    expect(facingFor(10, 0, "down")).toBe("right");
    expect(facingFor(-10, 0, "down")).toBe("left");
    expect(facingFor(0, -10, "down")).toBe("up");
    expect(facingFor(0, 10, "up")).toBe("down");
  });

  it("uses the dominant axis on a diagonal", () => {
    expect(facingFor(20, -5, "down")).toBe("right");
    expect(facingFor(-5, -20, "down")).toBe("up");
    expect(facingFor(3, 32, "left")).toBe("down");
    expect(facingFor(-32, 31, "up")).toBe("left");
  });

  it("prefers left or right on a tie", () => {
    expect(facingFor(16, 16, "up")).toBe("right");
    expect(facingFor(-16, -16, "down")).toBe("left");
    expect(facingFor(-16, 16, "up")).toBe("left");
  });

  it("keeps the current way with no movement, or inside the dead zone", () => {
    expect(facingFor(0, 0, "up")).toBe("up");
    expect(facingFor(0, 0, "left")).toBe("left");
    expect(facingFor(3, -2, "down", 4)).toBe("down");
    expect(facingFor(5, -2, "down", 4)).toBe("right");
    expect(facingFor(1, -6, "down", 4)).toBe("up");
  });
});

describe("facingStep and facingSign", () => {
  it("step toward what the cat faces, and flip only when facing left", () => {
    expect(facingStep("left")).toEqual({ x: -1, y: 0 });
    expect(facingStep("right")).toEqual({ x: 1, y: 0 });
    expect(facingStep("up")).toEqual({ x: 0, y: -1 });
    expect(facingStep("down")).toEqual({ x: 0, y: 1 });
    expect([facingSign("left"), facingSign("right"), facingSign("up"), facingSign("down")]).toEqual([-1, 1, 1, 1]);
  });
});

describe("changedItems", () => {
  it("finds new, moved, and swapped items", () => {
    const before = build([
      ["table", grid(0, 0)], // p1
      ["cauldron", grid(5, 0)], // p2
      ["frame", grid(0, 0)], // p3
    ]);
    expect(changedItems(before, before)).toEqual([]);

    const placed = placeFromTray(room, catalog, before, "rug", grid(8, 2))!;
    expect(changedItems(before, placed)).toEqual(["p4"]);

    const moved = moveItem(room, catalog, before, "p3", grid(4, 1))!;
    expect(changedItems(before, moved)).toEqual(["p3"]);

    const swapped = moveItem(room, catalog, before, "p2", grid(0, 0))!;
    expect(changedItems(before, swapped)).toEqual(["p1", "p2"]);
  });

  it("does not count items that ride along on moved furniture", () => {
    const before = build([
      ["table", grid(0, 0)],
      ["candle", on("p1")],
    ]);
    const moved = moveItem(room, catalog, before, "p1", grid(6, 2))!;
    expect(changedItems(before, moved)).toEqual(["p1"]);
  });
});

describe("movedOrRemoved", () => {
  const before = build([
    ["rug", grid(2, 1)], // p1
    ["table", grid(2, 1)], // p2, standing on the rug
    ["rug", grid(8, 2)], // p3
  ]);

  it("is false while the item stays put, even if things around it change", () => {
    expect(movedOrRemoved(before, before, "p1")).toBe(false);
    const tableMoved = moveItem(room, catalog, before, "p2", grid(6, 0))!;
    expect(movedOrRemoved(before, tableMoved, "p1")).toBe(false);
  });

  it("is true when the item is moved, swapped, or removed", () => {
    const moved = moveItem(room, catalog, before, "p1", grid(5, 0))!;
    expect(movedOrRemoved(before, moved, "p1")).toBe(true);
    const swapped = moveItem(room, catalog, before, "p1", grid(8, 2))!;
    expect(movedOrRemoved(before, swapped, "p1")).toBe(true);
    expect(movedOrRemoved(before, removeToTray(before, "p1"), "p1")).toBe(true);
  });
});

describe("displaced", () => {
  const before = build([
    ["table", grid(0, 0)], // p1
    ["candle", on("p1", 0)], // p2
    ["cauldron", grid(6, 0)], // p3
  ]);

  it("is false when only other things change", () => {
    expect(displaced(before, before, "p2")).toBe(false);
    expect(displaced(before, moveItem(room, catalog, before, "p3", grid(8, 2))!, "p2")).toBe(false);
  });

  it("is true when the item moves to another slot or is removed", () => {
    expect(displaced(before, moveItem(room, catalog, before, "p2", on("p1", 1))!, "p2")).toBe(true);
    expect(displaced(before, removeToTray(before, "p2"), "p2")).toBe(true);
  });

  it("is true when its furniture is moved or removed, carrying it along", () => {
    expect(displaced(before, moveItem(room, catalog, before, "p1", grid(2, 2))!, "p2")).toBe(true);
    expect(displaced(before, removeToTray(before, "p1"), "p2")).toBe(true);
  });
});

describe("toBack", () => {
  it("moves an item behind everything else pending", () => {
    expect(toBack(["p1", "p2", "p3"], "p1", true)).toEqual(["p2", "p3", "p1"]);
    expect(toBack(["p2"], "p1", true)).toEqual(["p2", "p1"]);
  });

  it("drops an item that is gone", () => {
    expect(toBack(["p1", "p2"], "p1", false)).toEqual(["p2"]);
  });
});

describe("slotSide", () => {
  it("puts slot 0 of a 2-wide host on the left and slot 1 on the right", () => {
    expect(slotSide(0, 2)).toBe("left");
    expect(slotSide(1, 2)).toBe("right");
  });

  it("has no preference for a 1-slot host", () => {
    expect(slotSide(0, 1)).toBeUndefined();
  });

  it("uses the half a slot is in on wider hosts", () => {
    expect(slotSide(0, 3)).toBe("left");
    expect(slotSide(1, 3)).toBeUndefined();
    expect(slotSide(2, 3)).toBe("right");
    expect(slotSide(1, 4)).toBe("left");
    expect(slotSide(2, 4)).toBe("right");
  });
});
