import * as Phaser from "phaser";
import { CATALOG, ITEMS, type ItemDef } from "../data/items";
import { BEDROOM } from "../data/rooms";
import {
  clearRoom,
  moveItem,
  placeFromTray,
  planDrop,
  removeToTray,
  surfaceItemsOn,
  type RoomState,
  type Target,
} from "../logic/grid";
import { loadRoom, saveRoom } from "./room-store";
import {
  DEPTH_FLOOR,
  FLOOR_Y,
  GAME_HEIGHT,
  GAME_WIDTH,
  ItemView,
  ROOM_X,
  SURFACE_ITEM_H,
  TEXT_LIGHT,
  TEXT_MUTED,
  TILE,
  TRAY_Y,
  WALL_Y,
  drawRoom,
  gridToWorld,
  layoutPlacements,
  textStyle,
  visualBox,
  type Box,
} from "./room-view";

const TRAY_ITEM_BOTTOM = TRAY_Y + 72;
const TRAY_GAP = 12;
const DEPTH_DRAGGING = 1000;

const COLOR_OK = 0x7bd389;
const COLOR_SWAP = 0x6fa8dc;
const COLOR_REPLACE = 0xe8b04a;
const COLOR_BLOCKED = 0xe0625a;
const TEXT_WARNING = "#e0625a";
const RESET_CONFIRM_MS = 3000;

type DragSource = { kind: "tray"; itemId: string } | { kind: "placed"; uid: string };

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
  private placedViews = new Map<string, ItemView>();
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
    // Scenes are reused when restarted, so clear anything left from the last visit.
    this.views.length = 0;
    this.sources.clear();
    this.trayLabels = [];
    this.drag = undefined;
    this.resetConfirmTimer = undefined;

    this.state = loadRoom();
    drawRoom(this);
    this.highlight = this.add.graphics().setDepth(DEPTH_DRAGGING - 1);
    this.input.dragDistanceThreshold = 4;
    this.input.on("dragstart", this.onDragStart, this);
    this.input.on("drag", this.onDrag, this);
    this.input.on("dragend", this.onDragEnd, this);
    this.addDoneButton();
    this.addResetButton();
    this.renderItems();
  }

  private addDoneButton(): void {
    this.add
      .text(10, TRAY_Y + 4, "▶ show the cat", textStyle(10, TEXT_LIGHT))
      .setPadding(6, 4, 6, 4)
      .setBackgroundColor("#3d3357")
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.scene.start("CatReview"));
  }

  private addResetButton(): void {
    this.resetButton = this.add
      .text(GAME_WIDTH - 10, TRAY_Y + 4, "reset room", textStyle(10, TEXT_MUTED))
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
    saveRoom(this.state);
    this.renderItems();
  }

  private cancelReset(): void {
    this.resetConfirmTimer?.remove();
    this.resetConfirmTimer = undefined;
    this.resetButton.setText("reset room").setColor(TEXT_MUTED);
  }

  /** Rebuilds every item view from `state`. Cheap at this item count, and keeps the screen in sync with the logic. */
  private renderItems(): void {
    for (const view of this.views) view.destroy();
    for (const label of this.trayLabels) label.destroy();
    this.views.length = 0;
    this.trayLabels = [];
    this.sources.clear();

    this.placedViews = layoutPlacements(this.state, (def, uid) => this.addView(def, { kind: "placed", uid }));

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
          this.add.text(x + view.trayWidth / 2, TRAY_ITEM_BOTTOM + 6, `×${count}`, textStyle(10, TEXT_MUTED)).setOrigin(0.5, 0),
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
      saveRoom(this.state);
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
    const movingUid = drag.source.kind === "placed" ? drag.source.uid : undefined;
    const plan = planDrop(BEDROOM, CATALOG, this.state, def.id, target, movingUid);
    const color = { place: COLOR_OK, swap: COLOR_SWAP, replace: COLOR_REPLACE, blocked: COLOR_BLOCKED }[plan.kind];
    const box = this.dropBox(def, plan.kind === "blocked" ? target : plan.target);
    if (!box) return;
    g.fillStyle(color, 0.3).fillRect(box.x, box.y, box.w, box.h);
    g.lineStyle(2, color, 0.9).strokeRect(box.x, box.y, box.w, box.h);

    // For a swap, also outline where the other item will go.
    const otherBox = plan.kind === "swap" ? this.dropBox(CATALOG[plan.other.itemId], plan.otherTarget) : null;
    if (otherBox) g.lineStyle(2, COLOR_SWAP, 0.9).strokeRect(otherBox.x, otherBox.y, otherBox.w, otherBox.h);
  }

  /** Screen area an item of `def` would cover at `target`. */
  private dropBox(def: ItemDef, target: Target): Box | null {
    if (target.kind === "surface") {
      const host = this.placedViews.get(target.hostUid);
      if (!host) return null;
      return { x: host.x + target.slot * TILE, y: host.top - SURFACE_ITEM_H - 2, w: TILE, h: SURFACE_ITEM_H + 2 };
    }
    if (def.layer === "surface") return null;
    const { x, y } = gridToWorld({ layer: def.layer, col: target.col, row: target.row });
    return { x, y, w: def.width * TILE, h: def.height * TILE };
  }
}
