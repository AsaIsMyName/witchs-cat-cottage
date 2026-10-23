import * as Phaser from "phaser";
import { CATALOG, ITEMS, type ItemDef } from "../data/items";
import { BEDROOM } from "../data/rooms";
import {
  clearRoom,
  moveItem,
  placeFromTray,
  placementsNotIn,
  planDrop,
  removeToTray,
  surfaceItemsOn,
  type RoomState,
  type Target,
} from "../logic/grid";
import { layoutTrayRow } from "../logic/tray";
import { CatActor } from "./cat-actor";
import { installShotHook } from "./dev-shots";
import { openPortal, popIn, sendBack, sparkle } from "./magic-fx";
import { loadRoom, saveRoom } from "./room-store";
import {
  BOOK_PAGES,
  DEPTH_FLOOR,
  FLOOR_Y,
  GAME_HEIGHT,
  GAME_WIDTH,
  ItemView,
  ROOM_X,
  SURFACE_ITEM_H,
  TEXT_MUTED,
  TILE,
  TRAY_COUNT_GAP,
  TRAY_HEADING_Y,
  TRAY_ITEM_BOTTOM,
  TRAY_Y,
  WALL_Y,
  drawRoom,
  gridToWorld,
  layoutPlacements,
  pageItemArea,
  seatOffset,
  surfaceSlotBox,
  textStyle,
  visualBox,
  type Box,
} from "./room-view";

const TRAY_GAP = 12;
/** "reset room" has this much padding, so its text lines up with the right page's item area. */
const RESET_PADDING = 6;
const DEPTH_DRAGGING = 1000;
/** Over the dragged item and anything riding on it. */
const DEPTH_HIGHLIGHT_EDGE = DEPTH_DRAGGING + 4;

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
  /** The drop highlight's fill, under the dragged item, and its outline, over it (a standing item covers its own footprint). */
  private highlight!: Phaser.GameObjects.Graphics;
  private highlightEdge!: Phaser.GameObjects.Graphics;
  private resetButton!: Phaser.GameObjects.Text;
  private resetConfirmTimer?: Phaser.Time.TimerEvent;
  private drag?: Drag;
  private cat!: CatActor;
  /** Whether the current press turned into a drag; a press that didn't can pet the cat. */
  private dragged = false;

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
    this.highlightEdge = this.add.graphics().setDepth(DEPTH_HIGHLIGHT_EDGE);
    this.input.dragDistanceThreshold = 4;
    this.input.on("dragstart", this.onDragStart, this);
    this.input.on("drag", this.onDrag, this);
    this.input.on("dragend", this.onDragEnd, this);
    this.input.on("pointerdown", () => (this.dragged = false));
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragged && this.cat.hitTest(pointer.worldX, pointer.worldY)) this.cat.pet();
    });
    this.addResetButton();
    this.renderItems();
    this.cat = new CatActor(
      this,
      () => this.state,
      () => this.placedViews,
    );
    if (import.meta.env.DEV) {
      installShotHook(
        this,
        this.cat,
        (uid) => this.placedViews.get(uid),
        (itemId) => [...this.sources.values()].find((e) => e.source.kind === "tray" && e.source.itemId === itemId)?.view,
      );
    }
  }

  /**
   * Applies a new room state: saves it, redraws, and lets the cat notice what changed. Anything
   * that went back to the tray spins away from where its view last was, before the redraw destroys it.
   */
  private setState(next: RoomState): void {
    const prev = this.state;
    this.state = next;
    saveRoom(next);
    for (const p of placementsNotIn(prev, next)) {
      const view = this.placedViews.get(p.uid);
      if (view) sendBack(this, view);
    }
    this.renderItems();
    this.cat.roomChanged(prev, next);
  }

  private addResetButton(): void {
    const page = pageItemArea(BOOK_PAGES[1]);
    this.resetButton = this.add
      .text(page.x + page.w + RESET_PADDING, TRAY_HEADING_Y - 4, "reset room", textStyle(10, TEXT_MUTED))
      .setOrigin(1, 0)
      .setPadding(RESET_PADDING, 4, RESET_PADDING, 4)
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
    this.setState(clearRoom(this.state));
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
    // Left page first, then the right, each row centered on its page.
    const pages = BOOK_PAGES.map(pageItemArea);
    const xs = layoutTrayRow(
      trayViews.map((v) => v.trayWidth),
      pages,
      TRAY_GAP,
    );
    trayViews.forEach((view, i) => {
      const x = xs[i];
      view.setPosition(x, view.footprintYForBottom(TRAY_ITEM_BOTTOM));
      view.setDepth(DEPTH_FLOOR);
      const count = this.state.inventory[view.def.id] ?? 0;
      if (count > 1) {
        const countY = TRAY_ITEM_BOTTOM + TRAY_COUNT_GAP;
        this.trayLabels.push(
          this.add.text(x + view.trayWidth / 2, countY, `×${count}`, textStyle(10, TEXT_MUTED)).setOrigin(0.5, 0),
        );
      }
    });
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
    this.dragged = true;
    view.setDepth(DEPTH_DRAGGING);
    for (const child of children) child.view.setDepth(DEPTH_DRAGGING + 2);
    if (source.kind === "tray") {
      // Purely visual, and the view's x/y are untouched: `onDrag` moves it from this same frame.
      openPortal(this, view.centerX, view.centerY);
      popIn(this, view);
    }
    this.cat.startWatching(pointer.worldX, pointer.worldY, [view, ...children.map((c) => c.view)]);
  }

  private onDrag(pointer: Phaser.Input.Pointer): void {
    const drag = this.drag;
    if (!drag) return;
    const x = pointer.worldX - drag.offsetX;
    const y = pointer.worldY - drag.offsetY;
    drag.view.setPosition(x, y);
    for (const child of drag.children) child.view.setPosition(x + child.dx, y + child.dy);
    this.drawHighlight(drag, pointer);
    this.cat.glanceAt(pointer.worldX, pointer.worldY);
  }

  private onDragEnd(pointer: Phaser.Input.Pointer): void {
    const drag = this.drag;
    this.drag = undefined;
    this.highlight.clear();
    this.highlightEdge.clear();
    if (!drag) return;
    this.cat.stopWatching();

    let next: RoomState | null = null;
    /** Where the dragged item ended up in the room, for the landing sparkle. */
    let landedUid: string | undefined;
    if (pointer.worldY >= TRAY_Y) {
      if (drag.source.kind === "placed") next = removeToTray(this.state, drag.source.uid);
    } else {
      const target = this.targetFor(drag, pointer);
      const source = drag.source;
      if (target) {
        next =
          source.kind === "tray"
            ? placeFromTray(BEDROOM, CATALOG, this.state, source.itemId, target)
            : moveItem(BEDROOM, CATALOG, this.state, source.uid, target);
      }
      if (next) {
        landedUid =
          source.kind === "placed" ? source.uid : placementsNotIn(next, this.state).find((p) => p.itemId === source.itemId)?.uid;
      }
    }
    // A refused drop just re-renders, which snaps the item back to where it came from.
    if (!next) {
      this.renderItems();
      return;
    }
    this.setState(next);
    const landed = landedUid && this.placedViews.get(landedUid);
    if (landed) sparkle(this, landed.centerX, landed.centerY);
  }

  private targetFor(drag: Drag, pointer: Phaser.Input.Pointer): Target | null {
    const def = drag.view.def;
    if (def.layer === "surface") {
      // Of the furniture and shelves under the pointer (counting the space just above where their
      // surface items stand), pick the one whose seat is closest, so a shelf just above a tall
      // table still gets its own drops. Read from the grid, not the views, which may be wobbling.
      let best: { uid: string; slot: number; distance: number } | null = null;
      for (const p of this.state.placements) {
        if (p.layer === "surface" || !CATALOG[p.itemId].hasSurface) continue;
        const host = CATALOG[p.itemId];
        const box = visualBox(host);
        const { x, y } = gridToWorld(p);
        const seat = y + box.y + seatOffset(box);
        const inX = pointer.worldX >= x && pointer.worldX < x + host.width * TILE;
        const inY = pointer.worldY >= seat - SURFACE_ITEM_H - TILE / 2 && pointer.worldY < y + box.y + box.h;
        const distance = Math.abs(pointer.worldY - (seat - SURFACE_ITEM_H / 2));
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
    const edge = this.highlightEdge.clear();
    if (pointer.worldY >= TRAY_Y) {
      if (drag.source.kind === "placed") {
        edge.lineStyle(2, COLOR_OK, 0.8).strokeRect(2, TRAY_Y + 2, GAME_WIDTH - 4, GAME_HEIGHT - TRAY_Y - 4);
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
    edge.lineStyle(2, color, 0.9).strokeRect(box.x, box.y, box.w, box.h);

    // For a swap, also outline where the other item will go.
    const otherBox = plan.kind === "swap" ? this.dropBox(CATALOG[plan.other.itemId], plan.otherTarget) : null;
    if (otherBox) edge.lineStyle(2, COLOR_SWAP, 0.9).strokeRect(otherBox.x, otherBox.y, otherBox.w, otherBox.h);
  }

  /** Screen area an item of `def` would cover at `target`. */
  private dropBox(def: ItemDef, target: Target): Box | null {
    if (target.kind === "surface") {
      const host = this.placedViews.get(target.hostUid);
      return host ? surfaceSlotBox(host, target.slot) : null;
    }
    if (def.layer === "surface") return null;
    const { x, y } = gridToWorld({ layer: def.layer, col: target.col, row: target.row });
    return { x, y, w: def.width * TILE, h: def.height * TILE };
  }
}
