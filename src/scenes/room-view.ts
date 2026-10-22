// Room layout and item drawing shared by the Decorate and CatReview scenes.

import * as Phaser from "phaser";
import { CATALOG, type ItemDef } from "../data/items";
import { BEDROOM } from "../data/rooms";
import type { GridLayer, GridPlacement, RoomState } from "../logic/grid";

export const GAME_WIDTH = 768;
export const GAME_HEIGHT = 432;

export const TILE = 48;
export const ROOM_X = (GAME_WIDTH - BEDROOM.columns * TILE) / 2;
export const WALL_Y = 16;
export const FLOOR_Y = WALL_Y + BEDROOM.wallRows * TILE;
export const ROOM_BOTTOM = FLOOR_Y + BEDROOM.floorRows * TILE;
export const TRAY_Y = ROOM_BOTTOM + 12;
export const SURFACE_ITEM_W = 24;
export const SURFACE_ITEM_H = 22;

const DEPTH_WALL = 10;
const DEPTH_RUG = 50;
export const DEPTH_FLOOR = 100;

const COLOR_WALL = 0x3d3357;
const COLOR_FLOOR = 0x5a4632;
const COLOR_TRAY = 0x221d30;
const COLOR_GRID_LINE = 0xffffff;
const COLOR_OUTLINE = 0x1e1a2b;
const COLOR_BOOK_COVER = 0x2b1f33;
const COLOR_BOOK_PAGE = 0x342a48;
const COLOR_BOOK_SPINE = 0x1a1322;
const COLOR_BOOK_TRIM = 0xc9973f;
const SPINE_HALF_W = 5;
export const TEXT_LIGHT = "#f3e6c4";
export const TEXT_MUTED = "#a89cc8";
export const TEXT_OUTLINE = "#1e1a2b";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where an item's visible rectangle sits inside its footprint. */
export function visualBox(def: ItemDef): Box {
  if (def.layer === "surface") return { x: 0, y: 0, w: SURFACE_ITEM_W, h: SURFACE_ITEM_H };
  const w = def.width * TILE;
  const h = def.height * TILE;
  if (def.layer === "wall" && def.visualHeight === undefined) return { x: 3, y: 3, w: w - 6, h: h - 6 };
  const visibleH = Math.round(h * (def.visualHeight ?? 0.9));
  return { x: 3, y: h - visibleH, w: w - 6, h: visibleH };
}

export function gridToWorld(p: { layer: GridLayer; col: number; row: number }): { x: number; y: number } {
  return { x: ROOM_X + p.col * TILE, y: (p.layer === "wall" ? WALL_Y : FLOOR_Y) + p.row * TILE };
}

/** Text style for small monospace labels. */
export function textStyle(fontSize: number, color = TEXT_LIGHT): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: "monospace", fontSize: `${fontSize}px`, color, resolution: 2 };
}

/** One item on screen: a labeled rectangle, or its sprite once one exists. Positioned by footprint top-left. */
export class ItemView {
  readonly body: Phaser.GameObjects.Rectangle;
  private readonly sprite?: Phaser.GameObjects.Image;
  private readonly label?: Phaser.GameObjects.Text;
  readonly box: Box;
  x = 0;
  y = 0;
  private scale = 1;

  constructor(scene: Phaser.Scene, readonly def: ItemDef) {
    this.box = visualBox(def);
    const hasSprite = scene.textures.exists(def.spriteId);
    this.body = scene.add.rectangle(0, 0, this.box.w, this.box.h, def.color, hasSprite ? 0 : 1).setOrigin(0);
    if (hasSprite) {
      this.sprite = scene.add.image(0, 0, def.spriteId).setOrigin(0).setDisplaySize(this.box.w, this.box.h);
    } else {
      this.body.setStrokeStyle(2, COLOR_OUTLINE);
      this.label = scene.add
        .text(0, 0, def.name, {
          ...textStyle(9),
          stroke: TEXT_OUTLINE,
          strokeThickness: 3,
          align: "center",
          wordWrap: { width: Math.max(this.box.w, TILE) },
        })
        .setOrigin(0.5);
    }
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    const { box, scale } = this;
    // A scaled item shrinks toward its visual center; x and y stay the footprint top-left.
    const left = x + box.x + (box.w * (1 - scale)) / 2;
    const top = y + box.y + (box.h * (1 - scale)) / 2;
    this.body.setPosition(left, top);
    this.sprite?.setPosition(left, top);
    this.label?.setPosition(x + box.x + box.w / 2, y + box.y + box.h / 2);
  }

  /** Scales what's drawn around its center, for small pops. Doesn't change x, y, or the footprint. */
  setScale(scale: number): void {
    this.scale = scale;
    this.body.setScale(scale);
    this.sprite?.setDisplaySize(this.box.w * scale, this.box.h * scale);
    this.label?.setScale(scale);
    this.setPosition(this.x, this.y);
  }

  /** Whether the view still exists, i.e. hasn't been destroyed by a re-render. */
  get alive(): boolean {
    return this.body.active;
  }

  setDepth(depth: number): void {
    this.body.setDepth(depth);
    this.sprite?.setDepth(depth);
    this.label?.setDepth(depth + 0.5);
  }

  setAlpha(alpha: number): void {
    this.body.setAlpha(alpha);
    this.sprite?.setAlpha(alpha);
    this.label?.setAlpha(alpha);
  }

  /** Horizontal center of the visible item. */
  get centerX(): number {
    return this.x + this.box.x + this.box.w / 2;
  }

  /** Top edge of the visible item. */
  get top(): number {
    return this.y + this.box.y;
  }

  /** Width of the item in the tray (its footprint, or its visual size for surface items). */
  get trayWidth(): number {
    return this.def.layer === "surface" ? this.box.w : this.def.width * TILE;
  }

  /** Footprint y that puts the item's visible bottom at `bottom`. */
  footprintYForBottom(bottom: number): number {
    return bottom - (this.box.y + this.box.h);
  }

  destroy(): void {
    this.body.destroy();
    this.sprite?.destroy();
    this.label?.destroy();
  }
}

/**
 * A copy of `view`'s look as one container centered on the visible item, so it can spin and
 * shrink. Not interactive and not an item view: the scene and the cat never see it.
 */
export function itemGhost(scene: Phaser.Scene, view: ItemView): Phaser.GameObjects.Container {
  const { def, box } = view;
  const parts: Phaser.GameObjects.GameObject[] = [];
  if (scene.textures.exists(def.spriteId)) {
    parts.push(scene.add.image(0, 0, def.spriteId).setDisplaySize(box.w, box.h));
  } else {
    parts.push(scene.add.rectangle(0, 0, box.w, box.h, def.color).setStrokeStyle(2, COLOR_OUTLINE));
    parts.push(
      scene.add
        .text(0, 0, def.name, {
          ...textStyle(9),
          stroke: TEXT_OUTLINE,
          strokeThickness: 3,
          align: "center",
          wordWrap: { width: Math.max(box.w, TILE) },
        })
        .setOrigin(0.5),
    );
  }
  return scene.add.container(view.centerX, view.top + box.h / 2, parts);
}

export function drawRoom(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const roomW = BEDROOM.columns * TILE;
  g.fillStyle(COLOR_WALL).fillRect(ROOM_X, WALL_Y, roomW, FLOOR_Y - WALL_Y);
  g.fillStyle(COLOR_FLOOR).fillRect(ROOM_X, FLOOR_Y, roomW, ROOM_BOTTOM - FLOOR_Y);
  g.lineStyle(1, COLOR_GRID_LINE, 0.08);
  for (let c = 1; c < BEDROOM.columns; c++) g.lineBetween(ROOM_X + c * TILE, WALL_Y, ROOM_X + c * TILE, ROOM_BOTTOM);
  for (let y = WALL_Y + TILE; y < ROOM_BOTTOM; y += TILE) g.lineBetween(ROOM_X, y, ROOM_X + roomW, y);
  g.lineStyle(2, COLOR_OUTLINE).strokeRect(ROOM_X, WALL_Y, roomW, ROOM_BOTTOM - WALL_Y);
  g.fillStyle(COLOR_TRAY).fillRect(0, TRAY_Y, GAME_WIDTH, GAME_HEIGHT - TRAY_Y);
  drawSpellbook(scene, g);
}

/** The inventory, drawn as an open spellbook: a trimmed cover, two pages, and a dark spine. */
function drawSpellbook(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics): void {
  const coverX = 4;
  const coverY = TRAY_Y + 2;
  const coverW = GAME_WIDTH - 8;
  const coverH = GAME_HEIGHT - TRAY_Y - 6;
  g.fillStyle(COLOR_BOOK_COVER).fillRoundedRect(coverX, coverY, coverW, coverH, 6);
  g.lineStyle(2, COLOR_BOOK_TRIM).strokeRoundedRect(coverX, coverY, coverW, coverH, 6);

  const pageY = coverY + 5;
  const pageH = coverH - 10;
  const spineX = GAME_WIDTH / 2;
  const pageW = spineX - SPINE_HALF_W - (coverX + 6);
  for (const pageX of [coverX + 6, spineX + SPINE_HALF_W]) {
    g.fillStyle(COLOR_BOOK_PAGE).fillRect(pageX, pageY, pageW, pageH);
    g.lineStyle(1, COLOR_BOOK_TRIM, 0.45).strokeRect(pageX + 3, pageY + 3, pageW - 6, pageH - 6);
  }
  g.fillStyle(COLOR_BOOK_SPINE).fillRect(spineX - SPINE_HALF_W, coverY, SPINE_HALF_W * 2, coverH);
  g.lineStyle(1, COLOR_BOOK_TRIM, 0.6).lineBetween(spineX, coverY + 2, spineX, coverY + coverH - 2);

  scene.add.text(coverX + 14, TRAY_Y + 10, "magic inventory", textStyle(10, TEXT_MUTED));
}

/**
 * Creates and positions a view for every placed item. `createView` lets a scene add its own
 * behavior (e.g. dragging). Returns the views by placement uid.
 */
export function layoutPlacements(
  state: RoomState,
  createView: (def: ItemDef, uid: string) => ItemView,
): Map<string, ItemView> {
  const views = new Map<string, ItemView>();
  for (const p of state.placements) {
    if (p.layer === "surface") continue;
    const view = createView(CATALOG[p.itemId], p.uid);
    const { x, y } = gridToWorld(p);
    view.setPosition(x, y);
    view.setDepth(depthOf(p));
    views.set(p.uid, view);
  }
  for (const p of state.placements) {
    if (p.layer !== "surface") continue;
    const host = views.get(p.hostUid);
    if (!host) continue;
    const view = createView(CATALOG[p.itemId], p.uid);
    const pos = surfaceSlotPosition(host, p.slot);
    view.setPosition(pos.x, pos.y);
    view.setDepth(host.body.depth + 2);
    views.set(p.uid, view);
  }
  return views;
}

/** Footprint top-left for a surface item in `slot` on the host view. */
export function surfaceSlotPosition(host: ItemView, slot: number): { x: number; y: number } {
  return { x: host.x + slot * TILE + (TILE - SURFACE_ITEM_W) / 2, y: host.top - SURFACE_ITEM_H };
}

function depthOf(p: GridPlacement): number {
  // Rugs always draw under furniture. Floor items closer to the front (higher row) draw on top.
  if (p.layer === "wall") return DEPTH_WALL;
  if (p.layer === "rug") return DEPTH_RUG + p.row;
  return DEPTH_FLOOR + (p.row + CATALOG[p.itemId].height - 1) * 10;
}
