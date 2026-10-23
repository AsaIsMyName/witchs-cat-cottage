// Room layout and item drawing for the Decorate scene, in the ¾ top-down view (see CLAUDE.md, "Room view").

import * as Phaser from "phaser";
import { CATALOG, ITEMS, type ItemDef } from "../data/items";
import { BEDROOM } from "../data/rooms";
import type { GridLayer, GridPlacement, RoomState } from "../logic/grid";
import { standShape } from "../logic/stand";

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Screen px per tile: 16px art drawn at 2×. */
export const TILE = 32;
export const SURFACE_ITEM_W = 16;
export const SURFACE_ITEM_H = 20;
/** The lighter cap on a surface item's placeholder. */
const SURFACE_TOP_H = 5;
/** A shelf is a ledge along the bottom of its wall slot, with a thin top for surface items. */
const LEDGE_H = 10;
const LEDGE_TOP_H = 4;
/** Placeholders sit this far inside their footprint, so neighbours stay apart. */
const INSET = 2;
/** Surface items (and a loafing cat) stand this far back into their host's top face, from its back edge. */
const SEAT_DEPTH = 0.65;
/** The wall's top edge, seen from above, drawn over the wall face. */
const WALL_CAP = 8;

// Spellbook geometry. The book is sized to fit its contents and sits at the bottom of the screen;
// the room fills the space above it. Drawing the book and laying out its items both read these,
// so they can't drift apart.
const BOOK_MARGIN = 4;
const PAGE_TRIM_INSET = 3;
const PAGE_PADDING = 8;
/** Room at the top of a page's item area, so the tallest item clears the heading. */
const TRAY_HEADING_SPACE = 10;
/** Gap between an item's bottom and its ×N count. */
export const TRAY_COUNT_GAP = 6;
/** Room under the items for the count: the gap, one 10px text line, and a little slack. */
const TRAY_COUNT_SPACE = TRAY_COUNT_GAP + 16;
/** The tallest item drawn in the book (today the cauldron). */
const TRAY_TALLEST = Math.max(...ITEMS.map((def) => visualBox(def).h));
const PAGE_H = TRAY_HEADING_SPACE + TRAY_TALLEST + TRAY_COUNT_SPACE + (PAGE_TRIM_INSET + PAGE_PADDING) * 2;
const BOOK_COVER: Box = { x: 4, y: GAME_HEIGHT - BOOK_MARGIN - (PAGE_H + 10), w: GAME_WIDTH - 8, h: PAGE_H + 10 };
/** Top of the inventory: dropping an item below this sends it back. */
export const TRAY_Y = BOOK_COVER.y - 2;

// The room, above the book.
export const ROOM_X = (GAME_WIDTH - BEDROOM.columns * TILE) / 2;
export const ROOM_BOTTOM = TRAY_Y - 12;
export const FLOOR_Y = ROOM_BOTTOM - BEDROOM.floorRows * TILE;
/** Top of the wall face (its first row of wall slots). The wall's top edge is drawn just above. */
export const WALL_Y = FLOOR_Y - BEDROOM.wallRows * TILE;

const DEPTH_WALL = 10;
const DEPTH_RUG = 50;
export const DEPTH_FLOOR = 100;

const COLOR_WALL = 0x3d3357;
const COLOR_WALL_CAP = 0x2a2340;
const COLOR_FLOOR = 0x6b5539;
const COLOR_TRAY = 0x221d30;
const COLOR_GRID_LINE = 0xffffff;
const COLOR_OUTLINE = 0x1e1a2b;
const COLOR_BOOK_COVER = 0x2b1f33;
const COLOR_BOOK_PAGE = 0x342a48;
const COLOR_BOOK_SPINE = 0x1a1322;
const COLOR_BOOK_TRIM = 0xc9973f;
/** A placeholder's front face is its color darkened to this; its top face is the color itself. */
const FRONT_SHADE = 0.7;
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

/** What an item draws, relative to its footprint's top-left: a lighter top face of `topH` over a darker front face. */
export interface ItemBox extends Box {
  topH: number;
}

/**
 * Where an item's drawn shape sits relative to its footprint's top-left. Floor items rise above
 * their footprint by their stand height; rugs are their footprint seen from above; wall items fill
 * their slot (shelves are a ledge); surface items have a fixed size.
 */
export function visualBox(def: ItemDef): ItemBox {
  if (def.layer === "surface") return { x: 0, y: 0, w: SURFACE_ITEM_W, h: SURFACE_ITEM_H, topH: SURFACE_TOP_H };
  if (def.layer === "wall") {
    if (def.hasSurface) return { x: 1, y: TILE - LEDGE_H - INSET, w: TILE - 2, h: LEDGE_H, topH: LEDGE_TOP_H };
    return { x: INSET, y: INSET, w: TILE - INSET * 2, h: TILE - INSET * 2, topH: 0 };
  }
  const w = def.width * TILE - INSET * 2;
  const shape = standShape(def);
  if (shape.frontFace === 0) {
    const h = def.height * TILE - INSET * 2;
    return { x: INSET, y: INSET, w, h, topH: h };
  }
  const top = Math.round(shape.top * TILE);
  return { x: INSET, y: top, w, h: shape.bottom * TILE - top, topH: shape.topFace * TILE };
}

/** How far below a host's drawn top its surface items (and a loafing cat) stand. */
export function seatOffset(box: ItemBox): number {
  return Math.round(box.topH * SEAT_DEPTH);
}

export function gridToWorld(p: { layer: GridLayer; col: number; row: number }): { x: number; y: number } {
  return { x: ROOM_X + p.col * TILE, y: (p.layer === "wall" ? WALL_Y : FLOOR_Y) + p.row * TILE };
}

/**
 * Draw order on the floor: floor items, surface items, and the cat sort by their bottom edge
 * (screen y of a footprint's front edge, or the cat's feet), so whatever is nearer the front hides
 * what's behind it. Rugs and wall items always draw underneath.
 */
export function depthForBottom(bottom: number): number {
  return DEPTH_FLOOR + bottom;
}

/** Text style for small monospace labels. */
export function textStyle(fontSize: number, color = TEXT_LIGHT): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: "monospace", fontSize: `${fontSize}px`, color, resolution: 2 };
}

/** Placeholder colors: the whole shape (the front face, darker when there's a top face over it) and the top face, if any. */
function faceColors(def: ItemDef, box: ItemBox): { body: number; top?: number } {
  const hasTop = box.topH > 0 && box.topH < box.h;
  return hasTop ? { body: shade(def.color, FRONT_SHADE), top: def.color } : { body: def.color };
}

function shade(color: number, k: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  return Phaser.Display.Color.GetColor(Math.round(c.red * k), Math.round(c.green * k), Math.round(c.blue * k));
}

function placeholderLabel(scene: Phaser.Scene, def: ItemDef, box: ItemBox): Phaser.GameObjects.Text {
  return scene.add
    .text(0, 0, def.name, {
      ...textStyle(9),
      stroke: TEXT_OUTLINE,
      strokeThickness: 3,
      align: "center",
      wordWrap: { width: Math.max(box.w, TILE) },
    })
    .setOrigin(0.5);
}

/**
 * One item on screen: a labeled placeholder (top face over front face), or its sprite once one
 * exists. Positioned by footprint top-left. `body` covers the whole drawn shape, so it's the hit area.
 */
export class ItemView {
  readonly body: Phaser.GameObjects.Rectangle;
  private readonly topFace?: Phaser.GameObjects.Rectangle;
  private readonly sprite?: Phaser.GameObjects.Image;
  private readonly label?: Phaser.GameObjects.Text;
  readonly box: ItemBox;
  x = 0;
  y = 0;
  private scale = 1;

  constructor(scene: Phaser.Scene, readonly def: ItemDef) {
    this.box = visualBox(def);
    const { w, h, topH } = this.box;
    const hasSprite = scene.textures.exists(def.spriteId);
    const colors = faceColors(def, this.box);
    this.body = scene.add.rectangle(0, 0, w, h, colors.body, hasSprite ? 0 : 1).setOrigin(0);
    if (hasSprite) {
      this.sprite = scene.add.image(0, 0, def.spriteId).setOrigin(0).setDisplaySize(w, h);
    } else {
      this.body.setStrokeStyle(2, COLOR_OUTLINE);
      if (colors.top !== undefined) {
        this.topFace = scene.add.rectangle(0, 0, w, topH, colors.top).setOrigin(0).setStrokeStyle(2, COLOR_OUTLINE);
      }
      this.label = placeholderLabel(scene, def, this.box);
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
    this.topFace?.setPosition(left, top);
    this.sprite?.setPosition(left, top);
    this.label?.setPosition(this.centerX, this.centerY);
  }

  /** Scales what's drawn around its center, for small pops. Doesn't change x, y, or the footprint. */
  setScale(scale: number): void {
    this.scale = scale;
    this.body.setScale(scale);
    this.topFace?.setScale(scale);
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
    this.topFace?.setDepth(depth + 0.1);
    this.sprite?.setDepth(depth);
    this.label?.setDepth(depth + 0.5);
  }

  setAlpha(alpha: number): void {
    this.body.setAlpha(alpha);
    this.topFace?.setAlpha(alpha);
    this.sprite?.setAlpha(alpha);
    this.label?.setAlpha(alpha);
  }

  /** Horizontal center of the drawn item. */
  get centerX(): number {
    return this.x + this.box.x + this.box.w / 2;
  }

  /** Vertical center of the drawn item. */
  get centerY(): number {
    return this.top + this.box.h / 2;
  }

  /** Top edge of the drawn item (above the footprint for a floor item that stands up). */
  get top(): number {
    return this.y + this.box.y;
  }

  /** Where surface items, and a cat loafing up here, stand on this item's top. */
  get seatY(): number {
    return this.top + seatOffset(this.box);
  }

  /** Width of the item in the tray (its footprint, or its visual size for surface items). */
  get trayWidth(): number {
    return this.def.layer === "surface" ? this.box.w : this.def.width * TILE;
  }

  /** Footprint y that puts the item's drawn bottom at `bottom`. */
  footprintYForBottom(bottom: number): number {
    return bottom - (this.box.y + this.box.h);
  }

  destroy(): void {
    this.body.destroy();
    this.topFace?.destroy();
    this.sprite?.destroy();
    this.label?.destroy();
  }
}

/**
 * A copy of `view`'s look as one container centered on the drawn item, so it can spin and
 * shrink. Not interactive and not an item view: the scene and the cat never see it.
 */
export function itemGhost(scene: Phaser.Scene, view: ItemView): Phaser.GameObjects.Container {
  const { def, box } = view;
  const parts: Phaser.GameObjects.GameObject[] = [];
  if (scene.textures.exists(def.spriteId)) {
    parts.push(scene.add.image(0, 0, def.spriteId).setDisplaySize(box.w, box.h));
  } else {
    const colors = faceColors(def, box);
    parts.push(scene.add.rectangle(0, 0, box.w, box.h, colors.body).setStrokeStyle(2, COLOR_OUTLINE));
    if (colors.top !== undefined) {
      const topY = (box.topH - box.h) / 2;
      parts.push(scene.add.rectangle(0, topY, box.w, box.topH, colors.top).setStrokeStyle(2, COLOR_OUTLINE));
    }
    parts.push(placeholderLabel(scene, def, box));
  }
  return scene.add.container(view.centerX, view.centerY, parts);
}

/** The wall band across the top (a wall face with its top edge above), and the floor seen from above. */
export function drawRoom(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const roomW = BEDROOM.columns * TILE;
  const capY = WALL_Y - WALL_CAP;
  g.fillStyle(COLOR_WALL_CAP).fillRect(ROOM_X, capY, roomW, WALL_CAP);
  g.fillStyle(COLOR_WALL).fillRect(ROOM_X, WALL_Y, roomW, FLOOR_Y - WALL_Y);
  g.fillStyle(COLOR_FLOOR).fillRect(ROOM_X, FLOOR_Y, roomW, ROOM_BOTTOM - FLOOR_Y);
  // Faint wall slots, and a slightly clearer tile grid on the floor.
  g.lineStyle(1, COLOR_GRID_LINE, 0.05);
  for (let c = 1; c < BEDROOM.columns; c++) g.lineBetween(ROOM_X + c * TILE, WALL_Y, ROOM_X + c * TILE, FLOOR_Y);
  for (let r = 1; r < BEDROOM.wallRows; r++) g.lineBetween(ROOM_X, WALL_Y + r * TILE, ROOM_X + roomW, WALL_Y + r * TILE);
  g.lineStyle(1, COLOR_GRID_LINE, 0.08);
  for (let c = 1; c < BEDROOM.columns; c++) g.lineBetween(ROOM_X + c * TILE, FLOOR_Y, ROOM_X + c * TILE, ROOM_BOTTOM);
  for (let r = 1; r < BEDROOM.floorRows; r++) g.lineBetween(ROOM_X, FLOOR_Y + r * TILE, ROOM_X + roomW, FLOOR_Y + r * TILE);
  // Where the wall meets the floor, and the wall's top edge.
  g.lineStyle(2, COLOR_OUTLINE).lineBetween(ROOM_X, FLOOR_Y, ROOM_X + roomW, FLOOR_Y);
  g.lineStyle(1, COLOR_OUTLINE).lineBetween(ROOM_X, WALL_Y, ROOM_X + roomW, WALL_Y);
  g.lineStyle(2, COLOR_OUTLINE).strokeRect(ROOM_X, capY, roomW, ROOM_BOTTOM - capY);
  g.fillStyle(COLOR_TRAY).fillRect(0, TRAY_Y, GAME_WIDTH, GAME_HEIGHT - TRAY_Y);
  drawSpellbook(scene, g);
}

const SPINE_X = GAME_WIDTH / 2;

/** The spellbook's two pages, left then right, either side of the spine. */
export const BOOK_PAGES: Box[] = (() => {
  const y = BOOK_COVER.y + 5;
  const h = BOOK_COVER.h - 10;
  const left = BOOK_COVER.x + 6;
  const w = SPINE_X - SPINE_HALF_W - left;
  return [
    { x: left, y, w, h },
    { x: SPINE_X + SPINE_HALF_W, y, w, h },
  ];
})();

/** Where items may sit on a page: inside its faint trim line, with padding. */
export function pageItemArea(page: Box): Box {
  const inset = PAGE_TRIM_INSET + PAGE_PADDING;
  return { x: page.x + inset, y: page.y + inset, w: page.w - inset * 2, h: page.h - inset * 2 };
}

/** The heading and "reset room" share this text top, above the item row. */
export const TRAY_HEADING_Y = TRAY_Y + 10;
/** Drawn bottom of every item in the book, leaving room for the counts above the page's padded bottom. */
export const TRAY_ITEM_BOTTOM = (() => {
  const area = pageItemArea(BOOK_PAGES[0]);
  return area.y + area.h - TRAY_COUNT_SPACE;
})();

/** The inventory, drawn as an open spellbook: a trimmed cover, two pages, and a dark spine. */
function drawSpellbook(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics): void {
  const cover = BOOK_COVER;
  g.fillStyle(COLOR_BOOK_COVER).fillRoundedRect(cover.x, cover.y, cover.w, cover.h, 6);
  g.lineStyle(2, COLOR_BOOK_TRIM).strokeRoundedRect(cover.x, cover.y, cover.w, cover.h, 6);

  const t = PAGE_TRIM_INSET;
  for (const page of BOOK_PAGES) {
    g.fillStyle(COLOR_BOOK_PAGE).fillRect(page.x, page.y, page.w, page.h);
    g.lineStyle(1, COLOR_BOOK_TRIM, 0.45).strokeRect(page.x + t, page.y + t, page.w - t * 2, page.h - t * 2);
  }
  g.fillStyle(COLOR_BOOK_SPINE).fillRect(SPINE_X - SPINE_HALF_W, cover.y, SPINE_HALF_W * 2, cover.h);
  g.lineStyle(1, COLOR_BOOK_TRIM, 0.6).lineBetween(SPINE_X, cover.y + 2, SPINE_X, cover.y + cover.h - 2);

  const heading = pageItemArea(BOOK_PAGES[0]);
  scene.add.text(heading.x, TRAY_HEADING_Y, "magic inventory", textStyle(10, TEXT_MUTED));
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
    // Just above its host, so it sorts with it: in front of what's behind, behind what's in front.
    view.setDepth(host.body.depth + 1);
    views.set(p.uid, view);
  }
  return views;
}

/** Footprint top-left for a surface item in `slot` on the host view: centered in the slot, standing on the host's top. */
export function surfaceSlotPosition(host: ItemView, slot: number): { x: number; y: number } {
  return { x: host.x + slot * TILE + (TILE - SURFACE_ITEM_W) / 2, y: host.seatY - SURFACE_ITEM_H };
}

/** Screen area of `slot` on the host view, where a surface item would stand: for the drop highlight. */
export function surfaceSlotBox(host: ItemView, slot: number): Box {
  return { x: host.x + slot * TILE, y: host.seatY - SURFACE_ITEM_H - 2, w: TILE, h: SURFACE_ITEM_H + 4 };
}

function depthOf(p: GridPlacement): number {
  if (p.layer === "wall") return DEPTH_WALL;
  // Rugs never overlap each other, and always draw under everything else on the floor.
  if (p.layer === "rug") return DEPTH_RUG + p.row;
  return depthForBottom(gridToWorld(p).y + CATALOG[p.itemId].height * TILE);
}
