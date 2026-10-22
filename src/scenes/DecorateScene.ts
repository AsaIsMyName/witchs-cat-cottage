import * as Phaser from "phaser";
import { CATALOG, ITEMS, STARTING_INVENTORY, type ItemDef } from "../data/items";
import { BEDROOM, ROOMS } from "../data/rooms";
import {
  clearRoom,
  dropKind,
  emptyRoom,
  isValidState,
  moveItem,
  placeFromTray,
  removeToTray,
  surfaceItemsOn,
  type GridLayer,
  type GridPlacement,
  type RoomState,
  type Target,
} from "../logic/grid";
import { SAVE_VERSION, loadSave, writeSave, type KeyValueStore } from "../logic/save";

export const GAME_WIDTH = 768;
export const GAME_HEIGHT = 432;

const TILE = 48;
const ROOM_X = (GAME_WIDTH - BEDROOM.columns * TILE) / 2;
const WALL_Y = 16;
const FLOOR_Y = WALL_Y + BEDROOM.wallRows * TILE;
const ROOM_BOTTOM = FLOOR_Y + BEDROOM.floorRows * TILE;
const TRAY_Y = ROOM_BOTTOM + 12;
const TRAY_ITEM_BOTTOM = TRAY_Y + 64;
const TRAY_GAP = 12;
const SURFACE_ITEM_W = 24;
const SURFACE_ITEM_H = 22;

const DEPTH_WALL = 10;
const DEPTH_RUG = 50;
const DEPTH_FLOOR = 100;
const DEPTH_DRAGGING = 1000;

const COLOR_WALL = 0x3d3357;
const COLOR_FLOOR = 0x5a4632;
const COLOR_TRAY = 0x221d30;
const COLOR_GRID_LINE = 0xffffff;
const COLOR_OUTLINE = 0x1e1a2b;
const COLOR_OK = 0x7bd389;
const COLOR_REPLACE = 0xe8b04a;
const COLOR_BLOCKED = 0xe0625a;
const TEXT_MUTED = "#a89cc8";
const TEXT_WARNING = "#e0625a";
const RESET_CONFIRM_MS = 3000;

const SAVE_KEY = "witchs-cat-cottage/save";

type DragSource = { kind: "tray"; itemId: string } | { kind: "placed"; uid: string };

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where an item's visible rectangle sits inside its footprint. */
function visualBox(def: ItemDef): Box {
  if (def.layer === "surface") return { x: 0, y: 0, w: SURFACE_ITEM_W, h: SURFACE_ITEM_H };
  const w = def.width * TILE;
  const h = def.height * TILE;
  if (def.layer === "wall" && def.visualHeight === undefined) return { x: 3, y: 3, w: w - 6, h: h - 6 };
  const visibleH = Math.round(h * (def.visualHeight ?? 0.9));
  return { x: 3, y: h - visibleH, w: w - 6, h: visibleH };
}

function gridToWorld(p: { layer: GridLayer; col: number; row: number }): { x: number; y: number } {
  return { x: ROOM_X + p.col * TILE, y: (p.layer === "wall" ? WALL_Y : FLOOR_Y) + p.row * TILE };
}

/** One item on screen: a labeled rectangle, or its sprite once one exists. Positioned by footprint top-left. */
class ItemView {
  readonly body: Phaser.GameObjects.Rectangle;
  private readonly sprite?: Phaser.GameObjects.Image;
  private readonly label?: Phaser.GameObjects.Text;
  private readonly box: Box;
  x = 0;
  y = 0;

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
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#f3e6c4",
          stroke: "#1e1a2b",
          strokeThickness: 3,
          align: "center",
          wordWrap: { width: Math.max(this.box.w, TILE) },
          resolution: 2,
        })
        .setOrigin(0.5);
    }
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    const { box } = this;
    this.body.setPosition(x + box.x, y + box.y);
    this.sprite?.setPosition(x + box.x, y + box.y);
    this.label?.setPosition(x + box.x + box.w / 2, y + box.y + box.h / 2);
  }

  setDepth(depth: number): void {
    this.body.setDepth(depth);
    this.sprite?.setDepth(depth);
    this.label?.setDepth(depth + 0.5);
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

interface Drag {
  view: ItemView;
  source: DragSource;
  offsetX: number;
  offsetY: number;
  children: { view: ItemView; dx: number; dy: number }[];
}

export class DecorateScene extends Phaser.Scene {
  private state!: RoomState;
  private readonly views: ItemView[] = [];
  private readonly placedViews = new Map<string, ItemView>();
  private readonly sources = new Map<Phaser.GameObjects.GameObject, { view: ItemView; source: DragSource }>();
  private trayLabels: Phaser.GameObjects.Text[] = [];
  private highlight!: Phaser.GameObjects.Graphics;
  private resetButton!: Phaser.GameObjects.Text;
  private resetConfirmTimer?: Phaser.Time.TimerEvent;
  private drag?: Drag;

  constructor() {
    super("Decorate");
  }

  create(): void {
    this.state = this.loadRoom();
    this.drawRoom();
    this.highlight = this.add.graphics().setDepth(DEPTH_DRAGGING - 1);
    this.input.dragDistanceThreshold = 4;
    this.input.on("dragstart", this.onDragStart, this);
    this.input.on("drag", this.onDrag, this);
    this.input.on("dragend", this.onDragEnd, this);
    this.addResetButton();
    this.renderItems();
  }

  private addResetButton(): void {
    this.resetButton = this.add
      .text(GAME_WIDTH - 10, TRAY_Y + 4, "reset room", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: TEXT_MUTED,
        resolution: 2,
      })
      .setOrigin(1, 0)
      .setPadding(6, 4, 6, 4)
      .setInteractive({ useHandCursor: true });
    this.resetButton.on("pointerup", this.onResetTap, this);
  }

  /** The first tap asks for confirmation; a second tap within a few seconds clears the room. */
  private onResetTap(): void {
    if (!this.resetConfirmTimer) {
      this.resetButton.setText("tap again to reset").setColor(TEXT_WARNING);
      this.resetConfirmTimer = this.time.delayedCall(RESET_CONFIRM_MS, this.cancelReset, [], this);
      return;
    }
    this.cancelReset();
    this.state = clearRoom(this.state);
    this.saveRoom();
    this.renderItems();
  }

  private cancelReset(): void {
    this.resetConfirmTimer?.remove();
    this.resetConfirmTimer = undefined;
    this.resetButton.setText("reset room").setColor(TEXT_MUTED);
  }

  private drawRoom(): void {
    const g = this.add.graphics();
    const roomW = BEDROOM.columns * TILE;
    g.fillStyle(COLOR_WALL).fillRect(ROOM_X, WALL_Y, roomW, FLOOR_Y - WALL_Y);
    g.fillStyle(COLOR_FLOOR).fillRect(ROOM_X, FLOOR_Y, roomW, ROOM_BOTTOM - FLOOR_Y);
    g.lineStyle(1, COLOR_GRID_LINE, 0.08);
    for (let c = 1; c < BEDROOM.columns; c++) g.lineBetween(ROOM_X + c * TILE, WALL_Y, ROOM_X + c * TILE, ROOM_BOTTOM);
    for (let y = WALL_Y + TILE; y < ROOM_BOTTOM; y += TILE) g.lineBetween(ROOM_X, y, ROOM_X + roomW, y);
    g.lineStyle(2, COLOR_OUTLINE).strokeRect(ROOM_X, WALL_Y, roomW, ROOM_BOTTOM - WALL_Y);
    g.fillStyle(COLOR_TRAY).fillRect(0, TRAY_Y, GAME_WIDTH, GAME_HEIGHT - TRAY_Y);
  }

  /** Rebuilds every item view from `state`. Cheap at this item count, and keeps the screen in sync with the logic. */
  private renderItems(): void {
    for (const view of this.views) view.destroy();
    for (const label of this.trayLabels) label.destroy();
    this.views.length = 0;
    this.trayLabels = [];
    this.placedViews.clear();
    this.sources.clear();

    for (const p of this.state.placements) {
      if (p.layer === "surface") continue;
      const view = this.addView(CATALOG[p.itemId], { kind: "placed", uid: p.uid });
      const { x, y } = gridToWorld(p);
      view.setPosition(x, y);
      view.setDepth(this.depthOf(p));
      this.placedViews.set(p.uid, view);
    }
    for (const p of this.state.placements) {
      if (p.layer !== "surface") continue;
      const host = this.placedViews.get(p.hostUid);
      if (!host) continue;
      const view = this.addView(CATALOG[p.itemId], { kind: "placed", uid: p.uid });
      const pos = this.surfaceSlotPosition(host, p.slot);
      view.setPosition(pos.x, pos.y);
      view.setDepth(host.body.depth + 2);
      this.placedViews.set(p.uid, view);
    }

    const trayItems = ITEMS.filter((item) => (this.state.inventory[item.id] ?? 0) > 0);
    const trayViews = trayItems.map((item) => this.addView(item, { kind: "tray", itemId: item.id }));
    const totalW = trayViews.reduce((sum, v) => sum + v.trayWidth, 0) + TRAY_GAP * Math.max(0, trayViews.length - 1);
    let x = (GAME_WIDTH - totalW) / 2;
    for (const view of trayViews) {
      view.setPosition(x, view.footprintYForBottom(TRAY_ITEM_BOTTOM));
      view.setDepth(DEPTH_FLOOR);
      const count = this.state.inventory[view.def.id] ?? 0;
      if (count > 1) {
        this.trayLabels.push(
          this.add
            .text(x + view.trayWidth / 2, TRAY_ITEM_BOTTOM + 6, `×${count}`, {
              fontFamily: "monospace",
              fontSize: "10px",
              color: TEXT_MUTED,
              resolution: 2,
            })
            .setOrigin(0.5, 0),
        );
      }
      x += view.trayWidth + TRAY_GAP;
    }
  }

  private addView(def: ItemDef, source: DragSource): ItemView {
    const view = new ItemView(this, def);
    view.body.setInteractive({ useHandCursor: true });
    this.input.setDraggable(view.body);
    this.sources.set(view.body, { view, source });
    this.views.push(view);
    return view;
  }

  private depthOf(p: GridPlacement): number {
    // Rugs always draw under furniture. Floor items closer to the front (higher row) draw on top.
    if (p.layer === "wall") return DEPTH_WALL;
    if (p.layer === "rug") return DEPTH_RUG + p.row;
    return DEPTH_FLOOR + (p.row + CATALOG[p.itemId].height - 1) * 10;
  }

  /** Footprint top-left for a surface item in `slot` on the host view. */
  private surfaceSlotPosition(host: ItemView, slot: number): { x: number; y: number } {
    const hostTop = host.y + visualBox(host.def).y;
    return { x: host.x + slot * TILE + (TILE - SURFACE_ITEM_W) / 2, y: hostTop - SURFACE_ITEM_H };
  }

  private onDragStart(pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject): void {
    const entry = this.sources.get(obj);
    if (!entry) return;
    const { view, source } = entry;
    const children =
      source.kind === "placed"
        ? surfaceItemsOn(this.state, source.uid).flatMap((p) => {
            const child = this.placedViews.get(p.uid);
            return child ? [{ view: child, dx: child.x - view.x, dy: child.y - view.y }] : [];
          })
        : [];
    this.drag = { view, source, offsetX: pointer.worldX - view.x, offsetY: pointer.worldY - view.y, children };
    view.setDepth(DEPTH_DRAGGING);
    for (const child of children) child.view.setDepth(DEPTH_DRAGGING + 2);
  }

  private onDrag(pointer: Phaser.Input.Pointer): void {
    const drag = this.drag;
    if (!drag) return;
    const x = pointer.worldX - drag.offsetX;
    const y = pointer.worldY - drag.offsetY;
    drag.view.setPosition(x, y);
    for (const child of drag.children) child.view.setPosition(x + child.dx, y + child.dy);
    this.drawHighlight(drag, pointer);
  }

  private onDragEnd(pointer: Phaser.Input.Pointer): void {
    const drag = this.drag;
    this.drag = undefined;
    this.highlight.clear();
    if (!drag) return;

    let next: RoomState | null = null;
    if (pointer.worldY >= TRAY_Y) {
      if (drag.source.kind === "placed") next = removeToTray(this.state, drag.source.uid);
    } else {
      const target = this.targetFor(drag, pointer);
      if (target) {
        next =
          drag.source.kind === "tray"
            ? placeFromTray(BEDROOM, CATALOG, this.state, drag.source.itemId, target)
            : moveItem(BEDROOM, CATALOG, this.state, drag.source.uid, target);
      }
    }
    if (next) {
      this.state = next;
      this.saveRoom();
    }
    // Re-render either way: a refused drop snaps back to where it came from.
    this.renderItems();
  }

  private targetFor(drag: Drag, pointer: Phaser.Input.Pointer): Target | null {
    const def = drag.view.def;
    if (def.layer === "surface") {
      // Of the furniture and shelves under the pointer (counting the space just above their tops),
      // pick the one whose top is closest, so a shelf just above a table still gets its own drops.
      let best: { uid: string; slot: number; distance: number } | null = null;
      for (const p of this.state.placements) {
        if (p.layer === "surface" || !CATALOG[p.itemId].hasSurface) continue;
        const host = CATALOG[p.itemId];
        const { x, y } = gridToWorld(p);
        const top = y + visualBox(host).y;
        const inX = pointer.worldX >= x && pointer.worldX < x + host.width * TILE;
        const inY = pointer.worldY >= top - TILE && pointer.worldY < y + host.height * TILE;
        const distance = Math.abs(pointer.worldY - (top - SURFACE_ITEM_H / 2));
        if (inX && inY && (!best || distance < best.distance)) {
          best = { uid: p.uid, slot: Math.floor((pointer.worldX - x) / TILE), distance };
        }
      }
      return best && { kind: "surface", hostUid: best.uid, slot: best.slot };
    }
    const layerY = def.layer === "wall" ? WALL_Y : FLOOR_Y;
    return {
      kind: "grid",
      col: Math.round((drag.view.x - ROOM_X) / TILE),
      row: Math.round((drag.view.y - layerY) / TILE),
    };
  }

  private drawHighlight(drag: Drag, pointer: Phaser.Input.Pointer): void {
    const g = this.highlight.clear();
    if (pointer.worldY >= TRAY_Y) {
      if (drag.source.kind === "placed") {
        g.lineStyle(2, COLOR_OK, 0.8).strokeRect(2, TRAY_Y + 2, GAME_WIDTH - 4, GAME_HEIGHT - TRAY_Y - 4);
      }
      return;
    }
    const target = this.targetFor(drag, pointer);
    if (!target) return;

    const def = drag.view.def;
    const ignoreUid = drag.source.kind === "placed" ? drag.source.uid : undefined;
    const kind = dropKind(BEDROOM, CATALOG, this.state, def.id, target, ignoreUid);
    let box: Box;
    if (target.kind === "surface") {
      const host = this.placedViews.get(target.hostUid);
      if (!host) return;
      const top = host.y + visualBox(host.def).y;
      box = { x: host.x + target.slot * TILE, y: top - SURFACE_ITEM_H - 2, w: TILE, h: SURFACE_ITEM_H + 2 };
    } else {
      if (def.layer === "surface") return;
      const { x, y } = gridToWorld({ layer: def.layer, col: target.col, row: target.row });
      box = { x, y, w: def.width * TILE, h: def.height * TILE };
    }
    const color = kind === "place" ? COLOR_OK : kind === "replace" ? COLOR_REPLACE : COLOR_BLOCKED;
    g.fillStyle(color, 0.3).fillRect(box.x, box.y, box.w, box.h);
    g.lineStyle(2, color, 0.9).strokeRect(box.x, box.y, box.w, box.h);
  }

  private loadRoom(): RoomState {
    const save = loadSave(storage(), SAVE_KEY, (roomId, state) => {
      const room = ROOMS[roomId];
      return room !== undefined && isValidState(room, CATALOG, state);
    });
    return save?.rooms[BEDROOM.id] ?? emptyRoom(STARTING_INVENTORY);
  }

  private saveRoom(): void {
    writeSave(storage(), SAVE_KEY, { version: SAVE_VERSION, rooms: { [BEDROOM.id]: this.state } });
  }
}

function storage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
