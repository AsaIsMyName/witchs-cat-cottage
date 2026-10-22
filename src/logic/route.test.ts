import { describe, expect, it } from "vitest";
import type { Catalog, RoomShape, RoomState } from "./grid";
import { findRoute, type Leg, type Tile } from "./route";

const room: RoomShape = { columns: 12, wallRows: 3, floorRows: 3 };

const catalog: Catalog = {
  table: { id: "table", layer: "floor", width: 2, height: 1, hasSurface: true },
  stool: { id: "stool", layer: "floor", width: 1, height: 1, hasSurface: true },
  cauldron: { id: "cauldron", layer: "floor", width: 1, height: 1 },
  rug: { id: "rug", layer: "rug", width: 2, height: 1 },
  shelf: { id: "shelf", layer: "wall", width: 1, height: 1, hasSurface: true },
  candle: { id: "candle", layer: "surface", width: 1, height: 1 },
};

const options = { climbCost: 4 };

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
    expect(route.legs[0].row).toBeGreaterThanOrEqual(1);
    expect(route.reached).toEqual({ col: 3, row: 0 });
  });

  it("hops straight down when it starts on top of furniture it doesn't need to cross", () => {
    const state = roomWith(["table", 3, 1]);
    const route = findRoute(room, catalog, state, { col: 3, row: 1 }, { col: 8, row: 1 }, { ...options, onTop: true });
    expect(route.legs[0].climb).toBe(false);
    expect(route.legs.every((leg) => !leg.climb)).toBe(true);
    expect(route.reached).toEqual({ col: 8, row: 1 });
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
