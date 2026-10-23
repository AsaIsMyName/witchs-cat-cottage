import { describe, expect, it } from "vitest";
import type { Catalog, RoomShape, RoomState } from "./grid";
import { canStand, findRoute, planWalk, type Leg, type Tile } from "./route";

const room: RoomShape = { columns: 12, wallRows: 3, floorRows: 3 };

const catalog: Catalog = {
  table: { id: "table", layer: "floor", width: 2, height: 1, hasSurface: true },
  stool: { id: "stool", layer: "floor", width: 1, height: 1, hasSurface: true },
  cauldron: { id: "cauldron", layer: "floor", width: 1, height: 1 },
  rug: { id: "rug", layer: "rug", width: 2, height: 1 },
  shelf: { id: "shelf", layer: "wall", width: 1, height: 1, hasSurface: true },
  candle: { id: "candle", layer: "surface", width: 1, height: 1 },
};

const options = { climbCost: 4, frontBackHopCost: 0.5 };

/** A room with `items` placed as [itemId, col, row]; uids are p1, p2, … in order. */
function roomWith(...items: [string, number, number][]): RoomState {
  return {
    placements: items.map(([itemId, col, row], i) => ({
      uid: `p${i + 1}`,
      itemId,
      layer: catalog[itemId].layer as "floor" | "rug" | "wall",
      col,
      row,
    })),
    inventory: {},
    nextUid: items.length + 1,
  };
}

/** Every tile the cat steps on, from `from` along the straight legs. */
function walkedTiles(from: Tile, legs: Leg[]): Tile[] {
  const tiles: Tile[] = [];
  let at = from;
  for (const leg of legs) {
    while (at.col !== leg.col || at.row !== leg.row) {
      at = { col: at.col + Math.sign(leg.col - at.col), row: at.row + Math.sign(leg.row - at.row) };
      tiles.push(at);
    }
  }
  return tiles;
}

const has = (tiles: Tile[], col: number, row: number) => tiles.some((t) => t.col === col && t.row === row);

describe("findRoute", () => {
  it("walks a straight line as one leg", () => {
    const route = findRoute(room, catalog, roomWith(), { col: 0, row: 1 }, { col: 5, row: 1 }, options);
    expect(route.legs).toEqual([{ col: 5, row: 1, climb: false }]);
    expect(route.reached).toEqual({ col: 5, row: 1 });
  });

  it("walks a clear diagonal as one leg", () => {
    const route = findRoute(room, catalog, roomWith(), { col: 0, row: 0 }, { col: 2, row: 2 }, options);
    expect(route.legs).toEqual([{ col: 2, row: 2, climb: false }]);
  });

  it("goes around a table instead of over it", () => {
    const from = { col: 1, row: 1 };
    const route = findRoute(room, catalog, roomWith(["table", 3, 1]), from, { col: 6, row: 1 }, options);
    const tiles = walkedTiles(from, route.legs);
    expect(route.reached).toEqual({ col: 6, row: 1 });
    expect(route.legs.every((leg) => !leg.climb)).toBe(true);
    expect(has(tiles, 3, 1) || has(tiles, 4, 1)).toBe(false);
    expect(route.legs.length).toBeLessThanOrEqual(4);
  });

  it("never cuts a corner past a blocked tile", () => {
    const from = { col: 1, row: 1 };
    const route = findRoute(room, catalog, roomWith(["cauldron", 2, 1]), from, { col: 2, row: 2 }, options);
    expect(route.legs).toEqual([
      { col: 1, row: 2, climb: false },
      { col: 2, row: 2, climb: false },
    ]);
  });

  it("climbs over tables when they wall it in, then hops down", () => {
    const state = roomWith(["table", 3, 0], ["table", 3, 1], ["table", 3, 2]);
    const route = findRoute(room, catalog, state, { col: 1, row: 1 }, { col: 7, row: 1 }, options);
    expect(route.legs).toEqual([
      { col: 2, row: 1, climb: false },
      { col: 3, row: 1, climb: true, on: "p2" },
      { col: 4, row: 1, climb: true, on: "p2" },
      { col: 5, row: 1, climb: false },
      { col: 7, row: 1, climb: false },
    ]);
    expect(route.reached).toEqual({ col: 7, row: 1 });
  });

  it("hops between two tops as a leg of its own", () => {
    const state = roomWith(["stool", 3, 0], ["stool", 3, 1], ["stool", 3, 2], ["stool", 4, 0], ["stool", 4, 1], ["stool", 4, 2]);
    const route = findRoute(room, catalog, state, { col: 2, row: 1 }, { col: 5, row: 1 }, options);
    expect(route.legs).toEqual([
      { col: 3, row: 1, climb: true, on: "p2" },
      { col: 4, row: 1, climb: true, on: "p5" },
      { col: 5, row: 1, climb: false },
    ]);
  });

  it("never crosses a cauldron, and stops at the nearest tile instead", () => {
    const from = { col: 1, row: 1 };
    const state = roomWith(["cauldron", 4, 0], ["cauldron", 4, 1], ["cauldron", 4, 2]);
    const route = findRoute(room, catalog, state, from, { col: 7, row: 1 }, options);
    expect(route.reached).toEqual({ col: 3, row: 1 });
    expect(walkedTiles(from, route.legs).some((t) => t.col >= 4)).toBe(false);
  });

  it("goes as close as it can to a boxed-in spot", () => {
    const box: [string, number, number][] = [
      ["cauldron", 9, 0], ["cauldron", 9, 1], ["cauldron", 9, 2],
      ["cauldron", 10, 0], ["cauldron", 10, 2],
      ["cauldron", 11, 0], ["cauldron", 11, 1], ["cauldron", 11, 2],
    ];
    const route = findRoute(room, catalog, roomWith(...box), { col: 1, row: 1 }, { col: 10, row: 1 }, options);
    expect(route.reached).toEqual({ col: 8, row: 1 });
    expect(route.legs.at(-1)).toEqual({ col: 8, row: 1, climb: false });
  });

  it("stops beside a destination that's under a cauldron", () => {
    const route = findRoute(room, catalog, roomWith(["cauldron", 4, 1]), { col: 0, row: 1 }, { col: 4, row: 1 }, options);
    expect(route.reached).toEqual({ col: 3, row: 1 });
  });

  it("walks over rugs and ignores wall items", () => {
    const state = roomWith(["rug", 3, 1], ["shelf", 4, 0]);
    const route = findRoute(room, catalog, state, { col: 1, row: 1 }, { col: 6, row: 1 }, options);
    expect(route.legs).toEqual([{ col: 6, row: 1, climb: false }]);
  });

  it("ends on a table top when that's the destination", () => {
    const state = roomWith(["table", 5, 1]);
    const route = findRoute(room, catalog, state, { col: 1, row: 1 }, { col: 6, row: 1 }, { ...options, endOnTop: true });
    expect(route.reached).toEqual({ col: 6, row: 1 });
    expect(route.legs.at(-1)).toEqual({ col: 6, row: 1, climb: true, on: "p1" });
    expect(route.legs.filter((leg) => leg.climb).every((leg) => leg.on === "p1")).toBe(true);
  });

  it("stops on the floor next to a table top unless it's a perch", () => {
    const state = roomWith(["table", 5, 1]);
    const route = findRoute(room, catalog, state, { col: 1, row: 1 }, { col: 6, row: 1 }, options);
    expect(route.legs.every((leg) => !leg.climb)).toBe(true);
    expect(Math.hypot(route.reached.col - 6, route.reached.row - 1)).toBe(1);
  });

  it("steps off a blocked start tile first, forward or sideways rather than back", () => {
    const route = findRoute(room, catalog, roomWith(["cauldron", 3, 1]), { col: 3, row: 1 }, { col: 8, row: 1 }, options);
    expect(route.legs).toEqual([
      { col: 4, row: 1, climb: false },
      { col: 8, row: 1, climb: false },
    ]);
  });

  it("doesn't step back through furniture it just hopped down in front of", () => {
    const route = findRoute(room, catalog, roomWith(["stool", 3, 1]), { col: 3, row: 1 }, { col: 3, row: 0 }, options);
    expect(route.legs).toEqual([
      { col: 2, row: 1, climb: false },
      { col: 2, row: 0, climb: false },
      { col: 3, row: 0, climb: false },
    ]);
    expect(route.reached).toEqual({ col: 3, row: 0 });
  });

  it("stays put on a blocked start with no free tile beside it, even a free diagonal past blocked corners", () => {
    // Cat under the cauldron at (3,1); (2,0) is free but both corners to it are blocked.
    const state = roomWith(["cauldron", 3, 1], ["cauldron", 3, 0], ["cauldron", 2, 1], ["cauldron", 4, 1], ["cauldron", 3, 2]);
    const route = findRoute(room, catalog, state, { col: 3, row: 1 }, { col: 0, row: 0 }, options);
    expect(route).toEqual({ legs: [], reached: { col: 3, row: 1 } });
  });

  it("never walks through an item to step off onto a free tile two away", () => {
    const ring: [string, number, number][] = [
      ["cauldron", 3, 1],
      ["cauldron", 2, 0], ["cauldron", 3, 0], ["cauldron", 4, 0],
      ["cauldron", 2, 1], ["cauldron", 4, 1],
      ["cauldron", 2, 2], ["cauldron", 3, 2], ["cauldron", 4, 2],
    ];
    const route = findRoute(room, catalog, roomWith(...ring), { col: 3, row: 1 }, { col: 0, row: 1 }, options);
    expect(route).toEqual({ legs: [], reached: { col: 3, row: 1 } });
  });

  it("walks around rather than climbing when both cost exactly the same", () => {
    // climbCost 2: over the stool is 1 + (1 + 2) + 1 = 4, around through the front row is 4 straight steps.
    // The climb's tile comes first in the scan, so without a tie-break it would win.
    const state = roomWith(["stool", 3, 1], ["cauldron", 3, 0]);
    const route = findRoute(room, catalog, state, { col: 2, row: 1 }, { col: 4, row: 1 }, { climbCost: 2, frontBackHopCost: 0.5 });
    expect(route.legs).toEqual([
      { col: 2, row: 2, climb: false },
      { col: 4, row: 2, climb: false },
      { col: 4, row: 1, climb: false },
    ]);
  });

  it("climbs at that cost once walking around is longer", () => {
    const state = roomWith(["stool", 3, 1], ["cauldron", 3, 0]);
    const route = findRoute(room, catalog, state, { col: 2, row: 1 }, { col: 4, row: 1 }, { climbCost: 1.9, frontBackHopCost: 0.5 });
    expect(route.legs).toEqual([
      { col: 3, row: 1, climb: true, on: "p1" },
      { col: 4, row: 1, climb: false },
    ]);
  });

  it("falls back to the nearest reachable floor tile for a boxed-in perch", () => {
    const box: [string, number, number][] = [
      ["table", 9, 1],
      ["cauldron", 8, 0], ["cauldron", 8, 1], ["cauldron", 8, 2],
      ["cauldron", 9, 0], ["cauldron", 10, 0], ["cauldron", 9, 2], ["cauldron", 10, 2],
      ["cauldron", 11, 0], ["cauldron", 11, 1], ["cauldron", 11, 2],
    ];
    const route = findRoute(room, catalog, roomWith(...box), { col: 1, row: 1 }, { col: 9, row: 1 }, { ...options, endOnTop: true });
    expect(route.reached).toEqual({ col: 7, row: 1 });
    expect(route.legs.every((leg) => !leg.climb)).toBe(true);
    expect(route.legs.at(-1)).toEqual({ col: 7, row: 1, climb: false });
  });

  it("ignores onTop when the start tile isn't a top", () => {
    const free = findRoute(room, catalog, roomWith(), { col: 1, row: 1 }, { col: 5, row: 1 }, { ...options, onTop: true });
    expect(free.legs).toEqual([{ col: 5, row: 1, climb: false }]);
    const state = roomWith(["cauldron", 3, 1]);
    const solid = findRoute(room, catalog, state, { col: 3, row: 1 }, { col: 8, row: 1 }, { ...options, onTop: true });
    expect(solid).toEqual(findRoute(room, catalog, state, { col: 3, row: 1 }, { col: 8, row: 1 }, options));
  });

  it("pays the climb cost again hopping from one top onto another", () => {
    // Over the table (one hop up) costs 9; across the two stools (two hops up) would cost 11, or 7 if
    // the second hop were free.
    const state = roomWith(["table", 3, 0], ["stool", 3, 1], ["stool", 4, 1], ["cauldron", 3, 2], ["cauldron", 4, 2]);
    const route = findRoute(room, catalog, state, { col: 2, row: 1 }, { col: 5, row: 1 }, options);
    expect(route.legs).toEqual([
      { col: 2, row: 0, climb: false },
      { col: 3, row: 0, climb: true, on: "p1" },
      { col: 4, row: 0, climb: true, on: "p1" },
      { col: 5, row: 0, climb: false },
      { col: 5, row: 1, climb: false },
    ]);
  });

  it("charges nothing extra for hopping from behind when frontBackHopCost is omitted", () => {
    // From behind and from the side then cost the same, and the tile behind is scanned first.
    const state = roomWith(["stool", 5, 1]);
    const route = findRoute(room, catalog, state, { col: 4, row: 0 }, { col: 5, row: 1 }, { climbCost: 4, endOnTop: true });
    expect(route.legs).toEqual([
      { col: 5, row: 0, climb: false },
      { col: 5, row: 1, climb: true, on: "p1" },
    ]);
  });

  it("starting on a table, walks to the edge it's heading for and hops off there", () => {
    const state = roomWith(["table", 3, 1]);
    const route = findRoute(room, catalog, state, { col: 3, row: 1 }, { col: 8, row: 1 }, { ...options, onTop: true });
    expect(route.legs).toEqual([
      { col: 4, row: 1, climb: true, on: "p1" },
      { col: 5, row: 1, climb: false },
      { col: 8, row: 1, climb: false },
    ]);
  });

  it("hops off toward the goal, not back the way it came", () => {
    const state = roomWith(["table", 5, 1]);
    const route = findRoute(room, catalog, state, { col: 6, row: 1 }, { col: 1, row: 1 }, { ...options, onTop: true });
    expect(route.legs).toEqual([
      { col: 5, row: 1, climb: true, on: "p1" },
      { col: 4, row: 1, climb: false },
      { col: 1, row: 1, climb: false },
    ]);
  });

  it("hops onto the near edge of a 2×1 table from the side, then walks across to the loaf spot", () => {
    const state = roomWith(["table", 5, 1]);
    const route = findRoute(room, catalog, state, { col: 1, row: 1 }, { col: 6, row: 1 }, { ...options, endOnTop: true });
    expect(route.legs).toEqual([
      { col: 4, row: 1, climb: false },
      { col: 5, row: 1, climb: true, on: "p1" },
      { col: 6, row: 1, climb: true, on: "p1" },
    ]);
  });

  it("prefers hopping up from the side over from behind", () => {
    const state = roomWith(["stool", 5, 1]);
    const route = findRoute(room, catalog, state, { col: 4, row: 0 }, { col: 5, row: 1 }, { ...options, endOnTop: true });
    expect(route.legs).toEqual([
      { col: 4, row: 1, climb: false },
      { col: 5, row: 1, climb: true, on: "p1" },
    ]);
  });

  it("hops up from in front when that's the only way", () => {
    const state = roomWith(["stool", 5, 2], ["cauldron", 4, 2], ["cauldron", 6, 2]);
    const route = findRoute(room, catalog, state, { col: 5, row: 0 }, { col: 5, row: 2 }, { ...options, endOnTop: true });
    expect(route.legs).toEqual([
      { col: 5, row: 1, climb: false },
      { col: 5, row: 2, climb: true, on: "p1" },
    ]);
  });

  it("gets on and off a stool in single hops", () => {
    const state = roomWith(["stool", 5, 1]);
    const up = findRoute(room, catalog, state, { col: 1, row: 1 }, { col: 5, row: 1 }, { ...options, endOnTop: true });
    expect(up.legs).toEqual([
      { col: 4, row: 1, climb: false },
      { col: 5, row: 1, climb: true, on: "p1" },
    ]);
    const off = findRoute(room, catalog, state, { col: 5, row: 1 }, { col: 9, row: 1 }, { ...options, onTop: true });
    expect(off.legs).toEqual([
      { col: 6, row: 1, climb: false },
      { col: 9, row: 1, climb: false },
    ]);
  });

  it("carries on across furniture when it starts on top and there's no way around", () => {
    const state = roomWith(["table", 3, 0], ["table", 3, 1], ["table", 3, 2]);
    const route = findRoute(room, catalog, state, { col: 3, row: 1 }, { col: 8, row: 1 }, { ...options, onTop: true });
    expect(route.legs).toEqual([
      { col: 4, row: 1, climb: true, on: "p2" },
      { col: 5, row: 1, climb: false },
      { col: 8, row: 1, climb: false },
    ]);
  });

  it("stays put when it's already there", () => {
    const route = findRoute(room, catalog, roomWith(), { col: 2, row: 2 }, { col: 2, row: 2 }, options);
    expect(route).toEqual({ legs: [], reached: { col: 2, row: 2 } });
  });
});

describe("planWalk", () => {
  it("already on the goal tile, walks the last few pixels to the exact spot", () => {
    const walk = planWalk(room, catalog, roomWith(), { col: 2, row: 2 }, { col: 2, row: 2 }, options);
    expect(walk).toEqual({ legs: [{ col: 2, row: 2, climb: false }], reached: { col: 2, row: 2 }, exact: true });
  });

  it("perched with the goal on that perch, walks across the top to the exact spot", () => {
    const state = roomWith(["table", 5, 1]);
    const walk = planWalk(room, catalog, state, { col: 6, row: 1 }, { col: 6, row: 1 }, { ...options, onTop: true, endOnTop: true });
    expect(walk.legs).toEqual([{ col: 6, row: 1, climb: true, on: "p1" }]);
    expect(walk.exact).toBe(true);
  });

  it("off center on a top and hopping straight off, first walks to its tile's center", () => {
    const state = roomWith(["table", 3, 1]);
    const opts = { ...options, onTop: true };
    const centered = planWalk(room, catalog, state, { col: 4, row: 1 }, { col: 8, row: 1 }, opts);
    expect(centered.legs).toEqual([
      { col: 5, row: 1, climb: false },
      { col: 8, row: 1, climb: false },
    ]);
    const off = planWalk(room, catalog, state, { col: 4, row: 1 }, { col: 8, row: 1 }, { ...opts, offCenter: true });
    expect(off.legs).toEqual([
      { col: 4, row: 1, climb: true, on: "p1" },
      { col: 5, row: 1, climb: false },
      { col: 8, row: 1, climb: false },
    ]);
  });

  it("off center but walking across the top first, adds nothing", () => {
    const state = roomWith(["table", 3, 1]);
    const walk = planWalk(room, catalog, state, { col: 3, row: 1 }, { col: 8, row: 1 }, { ...options, onTop: true, offCenter: true });
    expect(walk.legs).toEqual(findRoute(room, catalog, state, { col: 3, row: 1 }, { col: 8, row: 1 }, { ...options, onTop: true }).legs);
  });

  it("ending with a hop up, hops onto the tile and then walks to the exact spot", () => {
    const state = roomWith(["stool", 5, 1]);
    const walk = planWalk(room, catalog, state, { col: 1, row: 1 }, { col: 5, row: 1 }, { ...options, endOnTop: true });
    expect(walk.legs).toEqual([
      { col: 4, row: 1, climb: false },
      { col: 5, row: 1, climb: true, on: "p1" },
      { col: 5, row: 1, climb: true, on: "p1" },
    ]);
    expect(walk.exact).toBe(true);
  });

  it("ending by walking across a top after the hop, adds nothing", () => {
    const state = roomWith(["table", 5, 1]);
    const walk = planWalk(room, catalog, state, { col: 1, row: 1 }, { col: 6, row: 1 }, { ...options, endOnTop: true });
    expect(walk.legs).toEqual([
      { col: 4, row: 1, climb: false },
      { col: 5, row: 1, climb: true, on: "p1" },
      { col: 6, row: 1, climb: true, on: "p1" },
    ]);
  });

  it("short of the goal, ends at the tile it reached, not an exact spot", () => {
    const walk = planWalk(room, catalog, roomWith(["cauldron", 4, 1]), { col: 0, row: 1 }, { col: 4, row: 1 }, options);
    expect(walk.exact).toBe(false);
    expect(walk.legs).toEqual([{ col: 3, row: 1, climb: false }]);
  });
});

describe("canStand", () => {
  const state = roomWith(["table", 5, 1], ["cauldron", 2, 1], ["rug", 7, 1]);

  it("is true on free tiles and rugs", () => {
    expect(canStand(room, catalog, state, { col: 0, row: 0 })).toBe(true);
    expect(canStand(room, catalog, state, { col: 8, row: 1 })).toBe(true);
  });

  it("is false under a solid item, and on a top unless it's the cat's perch", () => {
    expect(canStand(room, catalog, state, { col: 2, row: 1 })).toBe(false);
    expect(canStand(room, catalog, state, { col: 6, row: 1 })).toBe(false);
    expect(canStand(room, catalog, state, { col: 6, row: 1 }, "p1")).toBe(true);
  });
});
