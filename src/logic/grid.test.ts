import { describe, expect, it } from "vitest";
import {
  canPlace,
  clearRoom,
  dropKind,
  emptyRoom,
  isValidState,
  moveItem,
  placeFromTray,
  planDrop,
  removeToTray,
  surfaceItemsOn,
  type Catalog,
  type RoomShape,
  type RoomState,
} from "./grid";

const room: RoomShape = { columns: 12, wallRows: 3, floorRows: 3 };

const catalog: Catalog = {
  frame: { id: "frame", layer: "wall", width: 1, height: 1 },
  shelf: { id: "shelf", layer: "wall", width: 1, height: 1, hasSurface: true },
  table: { id: "table", layer: "floor", width: 2, height: 1, hasSurface: true },
  rug: { id: "rug", layer: "rug", width: 2, height: 1 },
  bed: { id: "bed", layer: "floor", width: 2, height: 2 },
  stool: { id: "stool", layer: "floor", width: 1, height: 1, hasSurface: true },
  cauldron: { id: "cauldron", layer: "floor", width: 1, height: 1 },
  candle: { id: "candle", layer: "surface", width: 1, height: 1 },
};

function start(): RoomState {
  return emptyRoom({ frame: 2, shelf: 1, table: 2, rug: 1, bed: 1, candle: 3 });
}

function place(state: RoomState, itemId: string, target: Parameters<typeof placeFromTray>[4]): RoomState {
  const next = placeFromTray(room, catalog, state, itemId, target);
  if (!next) throw new Error(`could not place ${itemId}`);
  return next;
}

describe("placeFromTray", () => {
  it("places an item and takes it out of the tray", () => {
    const state = place(start(), "table", { kind: "grid", col: 0, row: 0 });
    expect(state.placements).toEqual([{ uid: "p1", itemId: "table", layer: "floor", col: 0, row: 0 }]);
    expect(state.inventory.table).toBe(1);
    expect(state.nextUid).toBe(2);
  });

  it("refuses when none are left in the tray", () => {
    const state = place(start(), "rug", { kind: "grid", col: 0, row: 0 });
    expect(placeFromTray(room, catalog, state, "rug", { kind: "grid", col: 4, row: 0 })).toBeNull();
  });

  it("refuses unknown items", () => {
    expect(placeFromTray(room, catalog, start(), "ghost", { kind: "grid", col: 0, row: 0 })).toBeNull();
  });
});

describe("canPlace on the grid", () => {
  it("keeps footprints inside the room", () => {
    const s = start();
    expect(canPlace(room, catalog, s, "table", { kind: "grid", col: 10, row: 2 })).toBe(true);
    expect(canPlace(room, catalog, s, "table", { kind: "grid", col: 11, row: 0 })).toBe(false);
    expect(canPlace(room, catalog, s, "bed", { kind: "grid", col: 0, row: 2 })).toBe(false);
    expect(canPlace(room, catalog, s, "frame", { kind: "grid", col: -1, row: 0 })).toBe(false);
    expect(canPlace(room, catalog, s, "frame", { kind: "grid", col: 0, row: 3 })).toBe(false);
  });

  it("rejects non-integer positions", () => {
    expect(canPlace(room, catalog, start(), "frame", { kind: "grid", col: 0.5, row: 0 })).toBe(false);
  });

  it("blocks overlaps on the same layer", () => {
    const s = place(start(), "bed", { kind: "grid", col: 2, row: 0 });
    expect(canPlace(room, catalog, s, "table", { kind: "grid", col: 3, row: 1 })).toBe(false);
    expect(canPlace(room, catalog, s, "table", { kind: "grid", col: 0, row: 1 })).toBe(true);
    expect(canPlace(room, catalog, s, "table", { kind: "grid", col: 4, row: 1 })).toBe(true);
  });

  it("keeps wall and floor as separate grids", () => {
    const s = place(start(), "table", { kind: "grid", col: 0, row: 0 });
    expect(canPlace(room, catalog, s, "frame", { kind: "grid", col: 0, row: 0 })).toBe(true);
  });

  it("does not put grid items on surfaces", () => {
    const s = place(start(), "table", { kind: "grid", col: 0, row: 0 });
    expect(canPlace(room, catalog, s, "frame", { kind: "surface", hostUid: "p1", slot: 0 })).toBe(false);
  });
});

describe("surfaces", () => {
  const withTable = () => place(start(), "table", { kind: "grid", col: 0, row: 0 });

  it("gives a 2-wide table two slots", () => {
    let s = withTable();
    s = place(s, "candle", { kind: "surface", hostUid: "p1", slot: 0 });
    s = place(s, "candle", { kind: "surface", hostUid: "p1", slot: 1 });
    expect(surfaceItemsOn(s, "p1")).toHaveLength(2);
    expect(canPlace(room, catalog, s, "candle", { kind: "surface", hostUid: "p1", slot: 2 })).toBe(false);
  });

  it("blocks an occupied slot", () => {
    const s = place(withTable(), "candle", { kind: "surface", hostUid: "p1", slot: 0 });
    expect(canPlace(room, catalog, s, "candle", { kind: "surface", hostUid: "p1", slot: 0 })).toBe(false);
  });

  it("only allows furniture that has a top", () => {
    const s = place(start(), "rug", { kind: "grid", col: 0, row: 0 });
    expect(canPlace(room, catalog, s, "candle", { kind: "surface", hostUid: "p1", slot: 0 })).toBe(false);
    expect(canPlace(room, catalog, s, "candle", { kind: "surface", hostUid: "missing", slot: 0 })).toBe(false);
  });

  it("keeps surface items off the grid", () => {
    expect(canPlace(room, catalog, start(), "candle", { kind: "grid", col: 0, row: 0 })).toBe(false);
  });

  it("lets a shelf hold one item and carry it when moved", () => {
    let s = place(start(), "shelf", { kind: "grid", col: 3, row: 1 });
    s = place(s, "candle", { kind: "surface", hostUid: "p1", slot: 0 });
    expect(canPlace(room, catalog, s, "candle", { kind: "surface", hostUid: "p1", slot: 1 })).toBe(false);
    const moved = moveItem(room, catalog, s, "p1", { kind: "grid", col: 7, row: 0 });
    expect(moved && surfaceItemsOn(moved, "p1")).toHaveLength(1);
  });
});

describe("replacing surface items", () => {
  const catalogWithPotion: Catalog = { ...catalog, potion: { id: "potion", layer: "surface", width: 1, height: 1 } };
  const setup = () => {
    let s = emptyRoom({ shelf: 1, table: 1, candle: 1, potion: 2 });
    s = placeFromTray(room, catalogWithPotion, s, "shelf", { kind: "grid", col: 0, row: 0 })!;
    s = placeFromTray(room, catalogWithPotion, s, "table", { kind: "grid", col: 0, row: 0 })!;
    return placeFromTray(room, catalogWithPotion, s, "potion", { kind: "surface", hostUid: "p1", slot: 0 })!;
  };

  it("reports a drop on an occupied slot as a replace", () => {
    const s = setup();
    expect(dropKind(room, catalogWithPotion, s, "candle", { kind: "surface", hostUid: "p1", slot: 0 })).toBe("replace");
    expect(dropKind(room, catalogWithPotion, s, "candle", { kind: "surface", hostUid: "p2", slot: 0 })).toBe("place");
    expect(dropKind(room, catalogWithPotion, s, "candle", { kind: "surface", hostUid: "p1", slot: 1 })).toBe("blocked");
  });

  it("swaps a tray item in and sends the old one to the tray", () => {
    const s = placeFromTray(room, catalogWithPotion, setup(), "candle", { kind: "surface", hostUid: "p1", slot: 0 });
    expect(s && surfaceItemsOn(s, "p1").map((p) => p.itemId)).toEqual(["candle"]);
    expect(s?.inventory).toMatchObject({ candle: 0, potion: 2 });
  });

  it("swaps in the same kind of item without changing the tray count", () => {
    const s = placeFromTray(room, catalogWithPotion, setup(), "potion", { kind: "surface", hostUid: "p1", slot: 0 });
    expect(s && surfaceItemsOn(s, "p1")).toHaveLength(1);
    expect(s?.inventory.potion).toBe(1);
  });

  it("swaps places when moving one room item onto another", () => {
    const before = placeFromTray(room, catalogWithPotion, setup(), "candle", { kind: "surface", hostUid: "p2", slot: 1 })!;
    const onShelf = { kind: "surface", hostUid: "p1", slot: 0 } as const;
    expect(dropKind(room, catalogWithPotion, before, "candle", onShelf, "p4")).toBe("swap");
    const s = moveItem(room, catalogWithPotion, before, "p4", onShelf)!;
    expect(surfaceItemsOn(s, "p1")).toEqual([{ uid: "p4", itemId: "candle", layer: "surface", hostUid: "p1", slot: 0 }]);
    expect(surfaceItemsOn(s, "p2")).toEqual([{ uid: "p3", itemId: "potion", layer: "surface", hostUid: "p2", slot: 1 }]);
    expect(s.inventory).toEqual(before.inventory);
  });

  it("swaps two items on the same table", () => {
    let s = placeFromTray(room, catalogWithPotion, setup(), "candle", { kind: "surface", hostUid: "p2", slot: 0 })!;
    s = placeFromTray(room, catalogWithPotion, s, "potion", { kind: "surface", hostUid: "p2", slot: 1 })!;
    s = moveItem(room, catalogWithPotion, s, "p4", { kind: "surface", hostUid: "p2", slot: 1 })!;
    expect(surfaceItemsOn(s, "p2").map((p) => [p.itemId, p.slot])).toEqual([
      ["candle", 1],
      ["potion", 0],
    ]);
  });

  it("still sends the old item to the tray when the new one comes from the tray", () => {
    expect(dropKind(room, catalogWithPotion, setup(), "candle", { kind: "surface", hostUid: "p1", slot: 0 })).toBe("replace");
  });

  it("treats dropping an item back on its own slot as a normal place", () => {
    const s = setup();
    expect(dropKind(room, catalogWithPotion, s, "potion", { kind: "surface", hostUid: "p1", slot: 0 }, "p3")).toBe("place");
    expect(moveItem(room, catalogWithPotion, s, "p3", { kind: "surface", hostUid: "p1", slot: 0 })).toEqual(s);
  });
});

describe("swapping wall and floor items", () => {
  it("swaps 1×1 wall items, and a shelf's item rides along", () => {
    let s = place(start(), "frame", { kind: "grid", col: 0, row: 0 });
    s = place(s, "shelf", { kind: "grid", col: 3, row: 1 });
    s = place(s, "candle", { kind: "surface", hostUid: "p2", slot: 0 });
    expect(dropKind(room, catalog, s, "shelf", { kind: "grid", col: 0, row: 0 }, "p2")).toBe("swap");
    s = moveItem(room, catalog, s, "p2", { kind: "grid", col: 0, row: 0 })!;
    expect(s.placements).toEqual([
      { uid: "p1", itemId: "frame", layer: "wall", col: 3, row: 1 },
      { uid: "p2", itemId: "shelf", layer: "wall", col: 0, row: 0 },
      { uid: "p3", itemId: "candle", layer: "surface", hostUid: "p2", slot: 0 },
    ]);
  });

  it("swaps an empty shelf with a shelf holding an item", () => {
    let s = emptyRoom({ shelf: 2, candle: 1 });
    s = place(s, "shelf", { kind: "grid", col: 0, row: 0 });
    s = place(s, "shelf", { kind: "grid", col: 5, row: 2 });
    s = place(s, "candle", { kind: "surface", hostUid: "p1", slot: 0 });
    s = moveItem(room, catalog, s, "p2", { kind: "grid", col: 0, row: 0 })!;
    expect(s.placements.slice(0, 2).map((p) => p.layer !== "surface" && [p.uid, p.col, p.row])).toEqual([
      ["p1", 5, 2],
      ["p2", 0, 0],
    ]);
    expect(surfaceItemsOn(s, "p1")).toHaveLength(1);
  });

  it("snaps a half-overlapping drop onto the other item's exact spot", () => {
    let s = place(start(), "table", { kind: "grid", col: 0, row: 0 });
    s = place(s, "table", { kind: "grid", col: 4, row: 2 });
    const plan = planDrop(room, catalog, s, "table", { kind: "grid", col: 5, row: 2 }, "p1");
    expect(plan).toMatchObject({ kind: "swap", target: { kind: "grid", col: 4, row: 2 } });
    s = moveItem(room, catalog, s, "p1", { kind: "grid", col: 5, row: 2 })!;
    expect(s.placements).toMatchObject([
      { uid: "p1", col: 4, row: 2 },
      { uid: "p2", col: 0, row: 0 },
    ]);
  });

  it("swaps rugs with rugs", () => {
    let s = emptyRoom({ rug: 2 });
    s = place(s, "rug", { kind: "grid", col: 0, row: 0 });
    s = place(s, "rug", { kind: "grid", col: 6, row: 1 });
    expect(dropKind(room, catalog, s, "rug", { kind: "grid", col: 6, row: 1 }, "p1")).toBe("swap");
  });

  it("blocks drops covering two items and drops from the tray", () => {
    const s = place(start(), "table", { kind: "grid", col: 4, row: 0 });
    expect(dropKind(room, catalog, s, "table", { kind: "grid", col: 4, row: 0 })).toBe("blocked");

    let t = emptyRoom({ table: 3 });
    t = place(t, "table", { kind: "grid", col: 0, row: 0 });
    t = place(t, "table", { kind: "grid", col: 2, row: 0 });
    t = place(t, "table", { kind: "grid", col: 6, row: 0 });
    expect(dropKind(room, catalog, t, "table", { kind: "grid", col: 1, row: 0 }, "p3")).toBe("blocked");
  });
});

describe("swapping different footprints", () => {
  const setup = () => {
    let s = emptyRoom({ table: 1, stool: 1, cauldron: 2, candle: 1 });
    s = place(s, "table", { kind: "grid", col: 0, row: 0 });
    s = place(s, "candle", { kind: "surface", hostUid: "p1", slot: 1 });
    return s;
  };

  it("drops the stool on the table and fits the table where the stool was", () => {
    const s = place(setup(), "stool", { kind: "grid", col: 5, row: 1 });
    const plan = planDrop(room, catalog, s, "stool", { kind: "grid", col: 1, row: 0 }, "p3");
    expect(plan).toMatchObject({
      kind: "swap",
      target: { kind: "grid", col: 1, row: 0 },
      otherTarget: { kind: "grid", col: 5, row: 1 },
    });
    const after = moveItem(room, catalog, s, "p3", { kind: "grid", col: 1, row: 0 })!;
    expect(after.placements).toMatchObject([
      { uid: "p1", itemId: "table", col: 5, row: 1 },
      { uid: "p2", itemId: "candle", hostUid: "p1", slot: 1 },
      { uid: "p3", itemId: "stool", col: 1, row: 0 },
    ]);
  });

  it("drops the table on the stool and moves the stool into the table's old spot", () => {
    const s = place(setup(), "stool", { kind: "grid", col: 5, row: 1 });
    const after = moveItem(room, catalog, s, "p1", { kind: "grid", col: 5, row: 1 })!;
    expect(after.placements).toMatchObject([
      { uid: "p1", itemId: "table", col: 5, row: 1 },
      { uid: "p2", itemId: "candle", hostUid: "p1" },
      { uid: "p3", itemId: "stool", col: 0, row: 0 },
    ]);
  });

  it("shifts the table left when the stool was against the right wall", () => {
    const s = place(setup(), "stool", { kind: "grid", col: 11, row: 2 });
    const plan = planDrop(room, catalog, s, "stool", { kind: "grid", col: 0, row: 0 }, "p3");
    expect(plan).toMatchObject({ kind: "swap", otherTarget: { kind: "grid", col: 10, row: 2 } });
  });

  it("shifts the table left when something blocks its right side", () => {
    let s = place(setup(), "stool", { kind: "grid", col: 5, row: 1 });
    s = place(s, "cauldron", { kind: "grid", col: 6, row: 1 });
    const plan = planDrop(room, catalog, s, "stool", { kind: "grid", col: 0, row: 0 }, "p3");
    expect(plan).toMatchObject({ kind: "swap", otherTarget: { kind: "grid", col: 4, row: 1 } });
  });

  it("blocks the swap when the table can't fit on either side", () => {
    let s = place(setup(), "stool", { kind: "grid", col: 5, row: 1 });
    s = place(s, "cauldron", { kind: "grid", col: 4, row: 1 });
    s = place(s, "cauldron", { kind: "grid", col: 6, row: 1 });
    expect(dropKind(room, catalog, s, "stool", { kind: "grid", col: 0, row: 0 }, "p3")).toBe("blocked");
  });

  it("swaps a 2×2 item with a 2×1 item", () => {
    let s = emptyRoom({ bed: 1, table: 1 });
    s = place(s, "bed", { kind: "grid", col: 0, row: 0 });
    s = place(s, "table", { kind: "grid", col: 6, row: 2 });
    const after = moveItem(room, catalog, s, "p1", { kind: "grid", col: 6, row: 1 })!;
    expect(after.placements).toMatchObject([
      { uid: "p1", col: 6, row: 1 },
      { uid: "p2", col: 0, row: 0 },
    ]);
  });
});

describe("rugs", () => {
  it("go under furniture", () => {
    let s = place(start(), "table", { kind: "grid", col: 0, row: 1 });
    expect(canPlace(room, catalog, s, "rug", { kind: "grid", col: 0, row: 1 })).toBe(true);
    s = place(s, "rug", { kind: "grid", col: 1, row: 1 });
    expect(canPlace(room, catalog, s, "bed", { kind: "grid", col: 2, row: 0 })).toBe(true);
  });

  it("do not overlap other rugs", () => {
    const twoRugs = emptyRoom({ rug: 2 });
    const s = place(twoRugs, "rug", { kind: "grid", col: 0, row: 0 });
    expect(canPlace(room, catalog, s, "rug", { kind: "grid", col: 1, row: 0 })).toBe(false);
  });

  it("slide out from under furniture without moving it", () => {
    let s = place(start(), "rug", { kind: "grid", col: 0, row: 2 });
    s = place(s, "table", { kind: "grid", col: 0, row: 2 });
    const moved = moveItem(room, catalog, s, "p1", { kind: "grid", col: 6, row: 0 });
    expect(moved?.placements).toEqual([
      { uid: "p1", itemId: "rug", layer: "rug", col: 6, row: 0 },
      { uid: "p2", itemId: "table", layer: "floor", col: 0, row: 2 },
    ]);
  });

  it("have no surface", () => {
    const s = place(start(), "rug", { kind: "grid", col: 0, row: 0 });
    expect(canPlace(room, catalog, s, "candle", { kind: "surface", hostUid: "p1", slot: 0 })).toBe(false);
  });
});

describe("moveItem", () => {
  it("moves an item, including onto part of its own old footprint", () => {
    const s = place(start(), "table", { kind: "grid", col: 0, row: 0 });
    const moved = moveItem(room, catalog, s, "p1", { kind: "grid", col: 1, row: 0 });
    expect(moved?.placements[0]).toMatchObject({ col: 1, row: 0 });
  });

  it("refuses a blocked spot", () => {
    let s = place(start(), "table", { kind: "grid", col: 0, row: 0 });
    s = place(s, "table", { kind: "grid", col: 2, row: 0 });
    s = place(s, "bed", { kind: "grid", col: 6, row: 0 });
    expect(moveItem(room, catalog, s, "p3", { kind: "grid", col: 1, row: 0 })).toBeNull();
  });

  it("carries surface items along with their furniture", () => {
    let s = place(start(), "table", { kind: "grid", col: 0, row: 0 });
    s = place(s, "candle", { kind: "surface", hostUid: "p1", slot: 1 });
    const moved = moveItem(room, catalog, s, "p1", { kind: "grid", col: 6, row: 2 });
    expect(moved && surfaceItemsOn(moved, "p1")).toEqual([
      { uid: "p2", itemId: "candle", layer: "surface", hostUid: "p1", slot: 1 },
    ]);
  });

  it("moves a surface item between slots and tables", () => {
    let s = place(start(), "table", { kind: "grid", col: 0, row: 0 });
    s = place(s, "table", { kind: "grid", col: 4, row: 0 });
    s = place(s, "candle", { kind: "surface", hostUid: "p1", slot: 0 });
    const moved = moveItem(room, catalog, s, "p3", { kind: "surface", hostUid: "p2", slot: 1 });
    expect(moved?.placements[2]).toMatchObject({ hostUid: "p2", slot: 1 });
  });
});

describe("removeToTray", () => {
  it("returns furniture and everything on it to the tray", () => {
    let s = place(start(), "table", { kind: "grid", col: 0, row: 0 });
    s = place(s, "candle", { kind: "surface", hostUid: "p1", slot: 0 });
    s = place(s, "frame", { kind: "grid", col: 0, row: 0 });
    s = removeToTray(s, "p1");
    expect(s.placements.map((p) => p.itemId)).toEqual(["frame"]);
    expect(s.inventory).toMatchObject({ table: 2, candle: 3, frame: 1 });
  });

  it("ignores unknown uids", () => {
    const s = start();
    expect(removeToTray(s, "nope")).toBe(s);
  });
});

describe("clearRoom", () => {
  it("returns everything to the tray", () => {
    let s = place(start(), "table", { kind: "grid", col: 0, row: 0 });
    s = place(s, "candle", { kind: "surface", hostUid: "p1", slot: 0 });
    s = place(s, "rug", { kind: "grid", col: 0, row: 0 });
    s = clearRoom(s);
    expect(s.placements).toEqual([]);
    expect(s.inventory).toEqual(start().inventory);
  });
});

describe("isValidState", () => {
  it("accepts states built by the placement functions", () => {
    let s = place(start(), "table", { kind: "grid", col: 0, row: 0 });
    s = place(s, "candle", { kind: "surface", hostUid: "p1", slot: 0 });
    expect(isValidState(room, catalog, s)).toBe(true);
  });

  it("rejects overlaps, unknown items, layer mismatches, and bad uids", () => {
    const table = { itemId: "table", layer: "floor" as const, col: 0, row: 0 };
    const base = { inventory: {}, nextUid: 3 };
    expect(isValidState(room, catalog, { ...base, placements: [{ uid: "p1", ...table }, { uid: "p2", ...table }] })).toBe(false);
    expect(isValidState(room, catalog, { ...base, placements: [{ uid: "p1", ...table, itemId: "ghost" }] })).toBe(false);
    expect(isValidState(room, catalog, { ...base, placements: [{ uid: "p1", ...table, layer: "wall" }] })).toBe(false);
    expect(isValidState(room, catalog, { ...base, placements: [{ uid: "p9", ...table }] })).toBe(false);
    expect(isValidState(room, catalog, { ...base, placements: [], inventory: { table: -1 } })).toBe(false);
  });
});
