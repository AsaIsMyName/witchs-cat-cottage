// Versioned save format for browser local storage. No Phaser.
//
// A save that is missing, corrupt, from another version, or fails the room rules
// loads as null, and the game starts the room fresh instead of crashing.

import type { Placement, RoomState } from "./grid";

// v2: rugs moved to their own layer and the starting tray changed.
// v3: the ¾ room view: 16 columns, 2 wall rows, and 9 floor rows (was 12, 3, and 3), so older rooms start fresh.
// (The floor was 8 rows until the 4a playtest; those v3 saves still fit.)
export const SAVE_VERSION = 3;

export interface SaveData {
  version: typeof SAVE_VERSION;
  rooms: Record<string, RoomState>;
}

/** The parts of `Storage` the save needs, so tests can pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type RoomValidator = (roomId: string, state: RoomState) => boolean;

export function parseSave(text: string | null, validateRoom: RoomValidator): SaveData | null {
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw) || raw.version !== SAVE_VERSION || !isRecord(raw.rooms)) return null;

  const rooms: Record<string, RoomState> = {};
  for (const [roomId, room] of Object.entries(raw.rooms)) {
    if (!isRoomState(room) || !validateRoom(roomId, room)) return null;
    rooms[roomId] = room;
  }
  return { version: SAVE_VERSION, rooms };
}

export function loadSave(store: KeyValueStore | null, key: string, validateRoom: RoomValidator): SaveData | null {
  if (!store) return null;
  try {
    return parseSave(store.getItem(key), validateRoom);
  } catch {
    return null;
  }
}

/** Returns false if storage is unavailable or full; the game keeps running either way. */
export function writeSave(store: KeyValueStore | null, key: string, data: SaveData): boolean {
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isPlacement(x: unknown): x is Placement {
  if (!isRecord(x) || typeof x.uid !== "string" || typeof x.itemId !== "string") return false;
  if (x.layer === "surface") return typeof x.hostUid === "string" && typeof x.slot === "number";
  return (
    (x.layer === "wall" || x.layer === "floor" || x.layer === "rug") && typeof x.col === "number" && typeof x.row === "number"
  );
}

function isRoomState(x: unknown): x is RoomState {
  return (
    isRecord(x) &&
    Array.isArray(x.placements) &&
    x.placements.every(isPlacement) &&
    isRecord(x.inventory) &&
    Object.values(x.inventory).every((n) => typeof n === "number") &&
    typeof x.nextUid === "number"
  );
}
