// The cat's walking routes on the floor grid. Plain TypeScript, no Phaser, so it can be unit tested.
//
// The cat walks on floor tiles (columns Ã— floor rows). Tiles under floor-layer items are blocked;
// rugs and the wall layer don't touch its path. Furniture with a top (table, stool) can be climbed:
// each hop up costs extra, so the cat only goes over it when walking around is much longer or
// impossible. Once up, it walks across the top and hops off the edge on its way.

import type { Catalog, RoomShape, RoomState } from "./grid";

export interface Tile {
  col: number;
  row: number;
}

/**
 * One straight stretch of a route, ending at `col`/`row`. `climb` means the cat ends the leg up on
 * the furniture `on`; a leg that changes between floor and top (or between two tops) is a hop.
 */
export interface Leg extends Tile {
  climb: boolean;
  on?: string;
}

export interface Route {
  legs: Leg[];
  /** Where the route ends: the destination, or the nearest tile the cat could get to. */
  reached: Tile;
}

export interface RouteOptions {
  /** Extra cost, in steps, of each hop up onto furniture (or from one top onto another). */
  climbCost: number;
  /** Extra cost of a hop on or off from behind or in front, so the cat prefers hopping from the side. */
  frontBackHopCost?: number;
  /** The cat starts up on the furniture at `from` (mid-route), not on the floor. */
  onTop?: boolean;
  /** The destination is a perch on top of furniture: end up there instead of on the floor nearby. */
  endOnTop?: boolean;
}

/** What's on a floor tile: nothing (rugs count as nothing), climbable furniture, or a solid item. */
type Cell = { kind: "free" } | { kind: "top"; uid: string } | { kind: "solid" };

/**
 * A route from `from` to `to`. Diagonal steps need both orthogonal neighbours free (no corner
 * cutting) and never happen on furniture. A start on a blocked tile first steps off to the nearest
 * free tile; an unreachable destination ends at the nearest free tile the cat can reach.
 */
export function findRoute(
  room: RoomShape,
  catalog: Catalog,
  state: RoomState,
  from: Tile,
  to: Tile,
  options: RouteOptions,
): Route {
  const cells = floorCells(room, catalog, state);
  const cell = (t: Tile) => cells[t.row][t.col];
  const start = clampTile(room, from);
  const goal = clampTile(room, to);

  const legs: Leg[] = [];
  let origin = start;
  const onTop = options.onTop === true && cell(start).kind === "top";
  if (cell(start).kind !== "free" && !onTop) {
    const off = stepOff(room, cells, start, goal);
    if (!off) return { legs: [], reached: start };
    legs.push({ ...off, climb: false });
    origin = off;
  }

  const { cost, prev } = search(room, cells, origin, options.climbCost, options.frontBackHopCost ?? 0);
  const endsHere = (t: Tile) => {
    const kind = cell(t).kind;
    return kind === "free" || (kind === "top" && options.endOnTop === true);
  };
  let end: Tile | undefined = endsHere(goal) && cost[key(room, goal)] < Infinity ? goal : undefined;
  end ??= nearestReachable(room, cells, cost, goal);
  end ??= origin;

  const path: Tile[] = [];
  for (let k: number | undefined = key(room, end); k !== undefined && k !== key(room, origin); k = prev[k]) {
    path.unshift(tileOf(room, k));
  }
  legs.push(...collapse(cells, origin, path));
  return { legs, reached: end };
}

function floorCells(room: RoomShape, catalog: Catalog, state: RoomState): Cell[][] {
  const cells: Cell[][] = Array.from({ length: room.floorRows }, () =>
    Array.from({ length: room.columns }, (): Cell => ({ kind: "free" })),
  );
  for (const p of state.placements) {
    if (p.layer !== "floor") continue;
    const item = catalog[p.itemId];
    if (!item) continue;
    const c: Cell = item.hasSurface ? { kind: "top", uid: p.uid } : { kind: "solid" };
    for (let row = p.row; row < p.row + item.height && row < room.floorRows; row++) {
      for (let col = p.col; col < p.col + item.width && col < room.columns; col++) cells[row][col] = c;
    }
  }
  return cells;
}

/** Dijkstra over the floor tiles. 36 tiles, so a plain scan for the cheapest open tile is plenty. */
function search(room: RoomShape, cells: Cell[][], origin: Tile, climbCost: number, frontBackHopCost: number) {
  const n = room.columns * room.floorRows;
  const cost = new Array<number>(n).fill(Infinity);
  const prev = new Array<number | undefined>(n).fill(undefined);
  const done = new Array<boolean>(n).fill(false);
  cost[key(room, origin)] = 0;
  for (;;) {
    let k = -1;
    for (let i = 0; i < n; i++) if (!done[i] && cost[i] < Infinity && (k < 0 || cost[i] < cost[k])) k = i;
    if (k < 0) break;
    done[k] = true;
    const here = tileOf(room, k);
    const hereCell = cells[here.row][here.col];
    const hereFree = hereCell.kind === "free";
    const hereOn = hereCell.kind === "top" ? hereCell.uid : undefined;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const next = { col: here.col + dc, row: here.row + dr };
        if (!inRoom(room, next)) continue;
        const target = cells[next.row][next.col];
        if (target.kind === "solid") continue;
        let step = 1;
        if (dr !== 0 && dc !== 0) {
          // Diagonals only between free tiles, past free corners.
          const free = (t: Tile) => cells[t.row][t.col].kind === "free";
          if (!hereFree || target.kind !== "free") continue;
          if (!free({ col: here.col + dc, row: here.row }) || !free({ col: here.col, row: here.row + dr })) continue;
          step = Math.SQRT2;
        }
        // A hop: onto a top, off it, or from one top to another. Hops are never diagonal.
        const nextOn = target.kind === "top" ? target.uid : undefined;
        if (nextOn !== hereOn) {
          if (nextOn !== undefined) step += climbCost;
          if (dr !== 0) step += frontBackHopCost;
        }
        const j = key(room, next);
        if (cost[k] + step < cost[j]) {
          cost[j] = cost[k] + step;
          prev[j] = k;
        }
      }
    }
  }
  return { cost, prev };
}

/**
 * The nearest free tile to a blocked start. The cat stands at the front edge of its tile, so on a
 * tie it prefers not to step back through the item, then the tile closer to where it's going.
 */
function stepOff(room: RoomShape, cells: Cell[][], start: Tile, goal: Tile): Tile | undefined {
  let best: { tile: Tile; score: number[] } | undefined;
  forEachTile(room, (tile) => {
    if (cells[tile.row][tile.col].kind !== "free") return;
    const score = [distance(tile, start), tile.row < start.row ? 1 : 0, distance(tile, goal)];
    if (!best || lessThan(score, best.score)) best = { tile, score };
  });
  return best?.tile;
}

/** The reachable free tile nearest to `goal`, preferring the cheaper route on a tie. */
function nearestReachable(room: RoomShape, cells: Cell[][], cost: number[], goal: Tile): Tile | undefined {
  let best: { tile: Tile; score: number[] } | undefined;
  forEachTile(room, (tile) => {
    const c = cost[key(room, tile)];
    if (cells[tile.row][tile.col].kind !== "free" || c === Infinity) return;
    const score = [distance(tile, goal), c];
    if (!best || lessThan(score, best.score)) best = { tile, score };
  });
  return best?.tile;
}

/**
 * Turns a tile-by-tile path into legs: straight runs on the floor, or on the same furniture top,
 * become one leg. Hops (floor to top, top to floor, top to another top) are always legs of their own.
 */
function collapse(cells: Cell[][], origin: Tile, path: Tile[]): Leg[] {
  const legs: Leg[] = [];
  const onOf = (t: Tile) => {
    const c = cells[t.row][t.col];
    return c.kind === "top" ? c.uid : undefined;
  };
  let from = origin;
  let lastKind: string | undefined;
  let lastDir: string | undefined;
  for (const tile of path) {
    const a = onOf(from);
    const b = onOf(tile);
    const kind = a === b ? (b === undefined ? "walk" : `top:${b}`) : "hop";
    const dir = `${tile.col - from.col},${tile.row - from.row}`;
    const leg: Leg = b === undefined ? { ...tile, climb: false } : { ...tile, climb: true, on: b };
    if (kind !== "hop" && kind === lastKind && dir === lastDir) legs[legs.length - 1] = leg;
    else legs.push(leg);
    lastKind = kind;
    lastDir = dir;
    from = tile;
  }
  return legs;
}

function clampTile(room: RoomShape, t: Tile): Tile {
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, Math.round(v)));
  return { col: clamp(t.col, room.columns - 1), row: clamp(t.row, room.floorRows - 1) };
}

function inRoom(room: RoomShape, t: Tile): boolean {
  return t.col >= 0 && t.row >= 0 && t.col < room.columns && t.row < room.floorRows;
}

function forEachTile(room: RoomShape, fn: (tile: Tile) => void): void {
  for (let row = 0; row < room.floorRows; row++) for (let col = 0; col < room.columns; col++) fn({ col, row });
}

function key(room: RoomShape, t: Tile): number {
  return t.row * room.columns + t.col;
}

function tileOf(room: RoomShape, k: number): Tile {
  return { col: k % room.columns, row: Math.floor(k / room.columns) };
}

function distance(a: Tile, b: Tile): number {
  return Math.hypot(a.col - b.col, a.row - b.row);
}

function lessThan(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}
