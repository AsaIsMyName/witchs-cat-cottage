// Loads and saves the bedroom in browser local storage.

import { CATALOG, STARTING_INVENTORY } from "../data/items";
import { BEDROOM, ROOMS } from "../data/rooms";
import { emptyRoom, isValidState, type RoomState } from "../logic/grid";
import { SAVE_VERSION, loadSave, writeSave, type KeyValueStore } from "../logic/save";

const SAVE_KEY = "witchs-cat-cottage/save";

export function loadRoom(): RoomState {
  const save = loadSave(storage(), SAVE_KEY, (roomId, state) => {
    const room = ROOMS[roomId];
    return room !== undefined && isValidState(room, CATALOG, state);
  });
  return save?.rooms[BEDROOM.id] ?? emptyRoom(STARTING_INVENTORY);
}

export function saveRoom(state: RoomState): void {
  writeSave(storage(), SAVE_KEY, { version: SAVE_VERSION, rooms: { [BEDROOM.id]: state } });
}

function storage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
