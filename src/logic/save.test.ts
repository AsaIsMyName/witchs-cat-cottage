import { describe, expect, it } from "vitest";
import { CATALOG } from "../data/items";
import { BEDROOM } from "../data/rooms";
import { isValidState, type RoomState } from "./grid";
import { SAVE_VERSION, loadSave, parseSave, writeSave, type KeyValueStore, type SaveData } from "./save";

const bedroom: RoomState = {
  placements: [
    { uid: "p1", itemId: "table", layer: "floor", col: 0, row: 0 },
    { uid: "p2", itemId: "candle", layer: "surface", hostUid: "p1", slot: 0 },
  ],
  inventory: { table: 0, candle: 1 },
  nextUid: 3,
};
const save: SaveData = { version: SAVE_VERSION, rooms: { bedroom } };
const acceptAll = () => true;

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

const brokenStore: KeyValueStore = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("quota");
  },
};

describe("save", () => {
  it("round-trips through storage", () => {
    const store = memoryStore();
    expect(writeSave(store, "k", save)).toBe(true);
    expect(loadSave(store, "k", acceptAll)).toEqual(save);
  });

  it("loads nothing when there is no save", () => {
    expect(loadSave(memoryStore(), "k", acceptAll)).toBeNull();
    expect(loadSave(null, "k", acceptAll)).toBeNull();
  });

  it("rejects corrupt or wrongly shaped saves", () => {
    expect(parseSave("{not json", acceptAll)).toBeNull();
    expect(parseSave("[]", acceptAll)).toBeNull();
    expect(parseSave(JSON.stringify({ version: SAVE_VERSION, rooms: { bedroom: { placements: "x" } } }), acceptAll)).toBeNull();
    const badPlacement = { ...bedroom, placements: [{ uid: "p1", itemId: "table", layer: "floor" }] };
    expect(parseSave(JSON.stringify({ version: SAVE_VERSION, rooms: { bedroom: badPlacement } }), acceptAll)).toBeNull();
  });

  it("rejects saves from another version", () => {
    expect(parseSave(JSON.stringify({ ...save, version: SAVE_VERSION + 1 }), acceptAll)).toBeNull();
  });

  it("keeps v3 saves from the 8-row room: the 9-row room accepts them as they are", () => {
    // Filled out to the old room's edges: wall corners, and the front floor row (row 7).
    const eightRows: RoomState = {
      placements: [
        { uid: "p1", itemId: "rug", layer: "rug", col: 14, row: 7 },
        { uid: "p2", itemId: "table", layer: "floor", col: 14, row: 7 },
        { uid: "p3", itemId: "candle", layer: "surface", hostUid: "p2", slot: 1 },
        { uid: "p4", itemId: "cauldron", layer: "floor", col: 0, row: 0 },
        { uid: "p5", itemId: "shelf", layer: "wall", col: 15, row: 1 },
        { uid: "p6", itemId: "potion", layer: "surface", hostUid: "p5", slot: 0 },
        { uid: "p7", itemId: "frame", layer: "wall", col: 0, row: 0 },
      ],
      inventory: { candle: 1, potion: 1 },
      nextUid: 8,
    };
    expect(BEDROOM).toMatchObject({ columns: 16, wallRows: 2, floorRows: 9 });
    const text = JSON.stringify({ version: 3, rooms: { bedroom: eightRows } });
    expect(parseSave(text, (_, state) => isValidState(BEDROOM, CATALOG, state))?.rooms.bedroom).toEqual(eightRows);
  });

  it("is on v3, so v2 saves from the front-facing room start fresh", () => {
    expect(SAVE_VERSION).toBe(3);
    expect(parseSave(JSON.stringify({ ...save, version: 2 }), acceptAll)).toBeNull();
  });

  it("rejects rooms that fail the room rules", () => {
    expect(parseSave(JSON.stringify(save), () => false)).toBeNull();
  });

  it("survives storage that throws", () => {
    expect(loadSave(brokenStore, "k", acceptAll)).toBeNull();
    expect(writeSave(brokenStore, "k", save)).toBe(false);
  });
});
