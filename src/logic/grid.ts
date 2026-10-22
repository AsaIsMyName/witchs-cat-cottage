// Room grid placement rules. Plain TypeScript, no Phaser, so it can be unit tested.
//
// Wall, floor, and rug are separate grids, so items only block items on the same layer.
// Rugs share the floor's rows and sit under furniture. Surface items have no grid
// position; they sit in a slot on top of a wall or floor item that has a surface.

export type Layer = "wall" | "floor" | "rug" | "surface";
export type GridLayer = Exclude<Layer, "surface">;

export interface ItemShape {
  id: string;
  layer: Layer;
  /** Footprint in tiles. Surface items are always 1×1. */
  width: number;
  height: number;
  /** Wall and floor items only: has a top with one surface slot per tile of width. */
  hasSurface?: boolean;
}

export interface RoomShape {
  columns: number;
  wallRows: number;
  floorRows: number;
}

export type Catalog = Record<string, ItemShape>;

export interface GridPlacement {
  uid: string;
  itemId: string;
  layer: GridLayer;
  col: number;
  row: number;
}

export interface SurfacePlacement {
  uid: string;
  itemId: string;
  layer: "surface";
  hostUid: string;
  slot: number;
}

export type Placement = GridPlacement | SurfacePlacement;

export type Target =
  | { kind: "grid"; col: number; row: number }
  | { kind: "surface"; hostUid: string; slot: number };

export interface RoomState {
  placements: Placement[];
  /** Items in the tray, by item id. */
  inventory: Record<string, number>;
  /** Placement uids are `p<n>`; this is the next n. */
  nextUid: number;
}

export function emptyRoom(inventory: Record<string, number>): RoomState {
  return { placements: [], inventory: { ...inventory }, nextUid: 1 };
}

/** Can `itemId` go at `target`? `ignoreUid` is the placement being moved, if any. */
export function canPlace(
  room: RoomShape,
  catalog: Catalog,
  state: RoomState,
  itemId: string,
  target: Target,
  ignoreUid?: string,
): boolean {
  const item = catalog[itemId];
  if (!item) return false;

  if (item.layer === "surface") {
    if (target.kind !== "surface") return false;
    const host = state.placements.find((p) => p.uid === target.hostUid);
    if (!host || host.uid === ignoreUid || host.layer === "surface") return false;
    const hostItem = catalog[host.itemId];
    if (!hostItem?.hasSurface) return false;
    if (!Number.isInteger(target.slot) || target.slot < 0 || target.slot >= hostItem.width) return false;
    return !state.placements.some(
      (p) => p.uid !== ignoreUid && p.layer === "surface" && p.hostUid === target.hostUid && p.slot === target.slot,
    );
  }

  if (target.kind !== "grid") return false;
  const { col, row } = target;
  if (!Number.isInteger(col) || !Number.isInteger(row)) return false;
  const rows = item.layer === "wall" ? room.wallRows : room.floorRows;
  if (col < 0 || row < 0 || col + item.width > room.columns || row + item.height > rows) return false;

  return !state.placements.some((p) => {
    if (p.uid === ignoreUid || p.layer === "surface" || p.layer !== item.layer) return false;
    const other = catalog[p.itemId];
    if (!other) return false;
    return col < p.col + other.width && p.col < col + item.width && row < p.row + other.height && p.row < row + item.height;
  });
}

/**
 * What a drop at `target` would do when it lands on an occupied surface slot:
 * - "swap": the dropped item came from the room and the item already there can take its old spot.
 * - "replace": otherwise, the item already there goes back to the tray.
 */
export type DropKind = "place" | "swap" | "replace" | "blocked";

/** `movingUid` is the placement being moved, or undefined for an item coming from the tray. */
export function dropKind(
  room: RoomShape,
  catalog: Catalog,
  state: RoomState,
  itemId: string,
  target: Target,
  movingUid?: string,
): DropKind {
  if (canPlace(room, catalog, state, itemId, target, movingUid)) return "place";
  const occupant = occupantAt(state, target, movingUid);
  if (!occupant) return "blocked";
  if (movingUid !== undefined && swapWith(room, catalog, state, movingUid, target, occupant)) return "swap";
  return canPlace(room, catalog, removeToTray(state, occupant.uid), itemId, target, movingUid) ? "replace" : "blocked";
}

/** Place an item from the tray, replacing a surface item if needed. Returns null if it doesn't fit or none are left. */
export function placeFromTray(
  room: RoomShape,
  catalog: Catalog,
  state: RoomState,
  itemId: string,
  target: Target,
): RoomState | null {
  if ((state.inventory[itemId] ?? 0) <= 0 || dropKind(room, catalog, state, itemId, target) === "blocked") return null;
  const base = clearSlot(state, target);
  const uid = `p${base.nextUid}`;
  return {
    placements: [...base.placements, toPlacement(uid, itemId, catalog[itemId].layer, target)],
    inventory: { ...base.inventory, [itemId]: (base.inventory[itemId] ?? 0) - 1 },
    nextUid: base.nextUid + 1,
  };
}

/**
 * Move a placed item. On an occupied surface slot it swaps places with the item there,
 * or sends that item to the tray if it can't take the old spot. Anything on top of a moved
 * item stays on it. Returns null if it doesn't fit.
 */
export function moveItem(
  room: RoomShape,
  catalog: Catalog,
  state: RoomState,
  uid: string,
  target: Target,
): RoomState | null {
  const current = state.placements.find((p) => p.uid === uid);
  if (!current) return null;
  const kind = dropKind(room, catalog, state, current.itemId, target, uid);
  if (kind === "blocked") return null;
  const occupant = occupantAt(state, target, uid);
  if (kind === "swap" && occupant) return swapWith(room, catalog, state, uid, target, occupant);
  const base = clearSlot(state, target, uid);
  const moved = toPlacement(uid, current.itemId, current.layer, target);
  return { ...base, placements: base.placements.map((p) => (p.uid === uid ? moved : p)) };
}

/** Put a placed item back in the tray, along with anything sitting on it. */
export function removeToTray(state: RoomState, uid: string): RoomState {
  const removed = state.placements.filter((p) => p.uid === uid || (p.layer === "surface" && p.hostUid === uid));
  if (removed.length === 0) return state;
  const inventory = { ...state.inventory };
  for (const p of removed) inventory[p.itemId] = (inventory[p.itemId] ?? 0) + 1;
  return { ...state, placements: state.placements.filter((p) => !removed.includes(p)), inventory };
}

/** Put everything in the room back in the tray. */
export function clearRoom(state: RoomState): RoomState {
  const inventory = { ...state.inventory };
  for (const p of state.placements) inventory[p.itemId] = (inventory[p.itemId] ?? 0) + 1;
  return { ...state, placements: [], inventory };
}

export function surfaceItemsOn(state: RoomState, hostUid: string): SurfacePlacement[] {
  return state.placements.filter((p): p is SurfacePlacement => p.layer === "surface" && p.hostUid === hostUid);
}

/** Checks a state (e.g. from a save) against the placement rules. */
export function isValidState(room: RoomShape, catalog: Catalog, state: RoomState): boolean {
  if (!Number.isInteger(state.nextUid) || state.nextUid < 1) return false;
  for (const [itemId, count] of Object.entries(state.inventory)) {
    if (!catalog[itemId] || !Number.isInteger(count) || count < 0) return false;
  }
  const seen = new Set<string>();
  for (const p of state.placements) {
    const match = /^p(\d+)$/.exec(p.uid);
    if (!match || Number(match[1]) >= state.nextUid || seen.has(p.uid)) return false;
    seen.add(p.uid);
    if (catalog[p.itemId]?.layer !== p.layer) return false;
    if (!canPlace(room, catalog, state, p.itemId, targetOf(p), p.uid)) return false;
  }
  return true;
}

export function targetOf(p: Placement): Target {
  return p.layer === "surface"
    ? { kind: "surface", hostUid: p.hostUid, slot: p.slot }
    : { kind: "grid", col: p.col, row: p.row };
}

/** The surface item in a surface target's slot, other than `ignoreUid`. */
function occupantAt(state: RoomState, target: Target, ignoreUid?: string): SurfacePlacement | undefined {
  if (target.kind !== "surface") return undefined;
  return surfaceItemsOn(state, target.hostUid).find((p) => p.slot === target.slot && p.uid !== ignoreUid);
}

/** Sends whatever sits in a surface target's slot (other than `ignoreUid`) back to the tray. */
function clearSlot(state: RoomState, target: Target, ignoreUid?: string): RoomState {
  const occupant = occupantAt(state, target, ignoreUid);
  return occupant ? removeToTray(state, occupant.uid) : state;
}

/** Moves `uid` to `target` and `occupant` to the old spot of `uid`, or null if either doesn't fit. */
function swapWith(
  room: RoomShape,
  catalog: Catalog,
  state: RoomState,
  uid: string,
  target: Target,
  occupant: Placement,
): RoomState | null {
  const current = state.placements.find((p) => p.uid === uid);
  if (!current) return null;
  const oldSpot = targetOf(current);
  const next: RoomState = {
    ...state,
    placements: state.placements.map((p) => {
      if (p.uid === uid) return toPlacement(uid, current.itemId, current.layer, target);
      if (p.uid === occupant.uid) return toPlacement(occupant.uid, occupant.itemId, occupant.layer, oldSpot);
      return p;
    }),
  };
  const fits =
    canPlace(room, catalog, next, current.itemId, target, uid) &&
    canPlace(room, catalog, next, occupant.itemId, oldSpot, occupant.uid);
  return fits ? next : null;
}

function toPlacement(uid: string, itemId: string, layer: Layer, target: Target): Placement {
  if (target.kind === "surface") return { uid, itemId, layer: "surface", hostUid: target.hostUid, slot: target.slot };
  return { uid, itemId, layer: layer as GridLayer, col: target.col, row: target.row };
}
