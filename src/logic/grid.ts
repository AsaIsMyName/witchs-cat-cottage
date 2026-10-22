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

/** Place an item from the tray. Returns the new state, or null if it doesn't fit or none are left. */
export function placeFromTray(
  room: RoomShape,
  catalog: Catalog,
  state: RoomState,
  itemId: string,
  target: Target,
): RoomState | null {
  const count = state.inventory[itemId] ?? 0;
  if (count <= 0 || !canPlace(room, catalog, state, itemId, target)) return null;
  const uid = `p${state.nextUid}`;
  return {
    placements: [...state.placements, toPlacement(uid, itemId, catalog[itemId].layer, target)],
    inventory: { ...state.inventory, [itemId]: count - 1 },
    nextUid: state.nextUid + 1,
  };
}

/** Move a placed item. Anything on top of a moved floor item stays on it. Returns null if it doesn't fit. */
export function moveItem(
  room: RoomShape,
  catalog: Catalog,
  state: RoomState,
  uid: string,
  target: Target,
): RoomState | null {
  const current = state.placements.find((p) => p.uid === uid);
  if (!current || !canPlace(room, catalog, state, current.itemId, target, uid)) return null;
  const moved = toPlacement(uid, current.itemId, current.layer, target);
  return { ...state, placements: state.placements.map((p) => (p.uid === uid ? moved : p)) };
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

function toPlacement(uid: string, itemId: string, layer: Layer, target: Target): Placement {
  if (target.kind === "surface") return { uid, itemId, layer: "surface", hostUid: target.hostUid, slot: target.slot };
  return { uid, itemId, layer: layer as GridLayer, col: target.col, row: target.row };
}
