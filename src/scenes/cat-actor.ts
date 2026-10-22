// The ambient cat on screen: walks, reacts, idles, watches drags, and can be petted.
// Decisions come from src/logic/cat.ts; this file only animates them.

import * as Phaser from "phaser";
import { CAT_BEHAVIOR, CAT_TIMING, IDLE_LINES, PET_LINE, REACTION_LINES } from "../data/cat";
import { CATALOG } from "../data/items";
import { BEDROOM } from "../data/rooms";
import { changedItems, pickIdle, reactionFor, type IdleAction, type Reaction } from "../logic/cat";
import type { RoomState } from "../logic/grid";
import { DEPTH_FLOOR, FLOOR_Y, GAME_WIDTH, ItemView, ROOM_X, TEXT_LIGHT, TILE, textStyle } from "./room-view";

const BODY_W = 30;
const BODY_H = 14;
const HEAD = 12;
const COLOR_CAT = 0x8a6fbf;
const COLOR_OUTLINE = 0x1e1a2b;
const COLOR_HEART = "#f28fb0";
const DEPTH_BUBBLE = 950;
const BUBBLE_OFFSET = BODY_H + HEAD + 8;

/** idle: doing its own thing. busy: reacting to an item or being petted. */
type Mode = "idle" | "busy";

/** What the cat's body is doing right now; only a resting cat glances at drags. */
type Pose = "walking" | "resting" | "napping";

interface Point {
  x: number;
  y: number;
}

export class CatActor {
  private readonly cat: Phaser.GameObjects.Container;
  private readonly bubble: Phaser.GameObjects.Text;
  private mode: Mode = "idle";
  private pose: Pose = "resting";
  /** True while the player is dragging something. */
  private watching = false;
  /** Bumped on every interrupt; scheduled steps from an older token are dropped. */
  private token = 0;
  private readonly queue: string[] = [];
  private facing: 1 | -1 = 1;
  private perch?: { uid: string; groundY: number };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly getState: () => RoomState,
    private readonly getViews: () => Map<string, ItemView>,
  ) {
    this.cat = this.makeCat();
    const start = floorPoint(Phaser.Math.Between(2, BEDROOM.columns - 3), BEDROOM.floorRows - 1);
    this.cat.setPosition(start.x, start.y);
    this.updateDepth();
    this.bubble = scene.add
      .text(0, 0, "", { ...textStyle(10, "#1e1a2b"), backgroundColor: TEXT_LIGHT, padding: { x: 5, y: 2 } })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_BUBBLE)
      .setVisible(false);
    this.later(between(CAT_TIMING.idleGap), () => this.next());
  }

  /**
   * Call after every room change, once the item views have been rebuilt. Changed items join the
   * cat's queue; it gets to them after finishing what it's doing. The one exception: if its perch
   * was moved or removed, it hops down right away.
   */
  roomChanged(prev: RoomState, next: RoomState): void {
    const changed = changedItems(prev, next);
    for (const uid of changed) if (!this.queue.includes(uid)) this.queue.push(uid);

    const perch = this.perch;
    const lostPerch = perch !== undefined && (changed.includes(perch.uid) || !next.placements.some((p) => p.uid === perch.uid));
    if (!lostPerch) return;
    this.interrupt();
    this.mode = "idle";
    this.hopDown(() => this.later(between(CAT_TIMING.noticeDelay), () => this.next()));
  }

  /** The player picked something up. The cat keeps doing what it's doing, but may glance over. */
  startWatching(x: number): void {
    this.watching = true;
    this.glanceAt(x);
  }

  /** Turns toward `x`, but only if the cat is idle and sitting still. */
  glanceAt(x: number): void {
    if (this.watching && this.mode === "idle" && this.pose === "resting") this.turnTo(x);
  }

  stopWatching(): void {
    this.watching = false;
  }

  /** Generous hit area so the small cat is easy to tap on a phone. */
  hitTest(x: number, y: number): boolean {
    const halfW = BODY_W / 2 + HEAD;
    return Math.abs(x - this.cat.x) <= halfW && y <= this.cat.y + 6 && y >= this.cat.y - (BODY_H + HEAD + 10);
  }

  pet(): void {
    this.interrupt();
    this.mode = "busy";
    this.say(PET_LINE);
    this.floatHeart();
    this.tween({ targets: this.cat, angle: this.facing * 360, duration: 700, ease: "Quad.easeInOut" }, () => {
      this.cat.angle = 0;
      this.later(1200, () => this.finish());
    });
  }

  private next(): void {
    const state = this.getState();
    const views = this.getViews();
    while (this.queue.length > 0) {
      const uid = this.queue.shift()!;
      const placement = state.placements.find((p) => p.uid === uid);
      if (!placement || !views.has(uid)) continue;
      this.mode = "busy";
      this.visit(uid, reactionFor(CATALOG, state, placement, CAT_BEHAVIOR.rules), CAT_TIMING.reactionLength);
      return;
    }

    this.mode = "idle";
    const plan = pickIdle(CATALOG, state, BEDROOM, CAT_BEHAVIOR, Math.random);
    if (plan.kind === "wander") this.wander(plan.col, plan.row, plan.action);
    else if (views.has(plan.uid)) this.visit(plan.uid, plan.reaction, between(CAT_TIMING.napLength));
    else this.later(between(CAT_TIMING.idleGap), () => this.next());
  }

  /** Goes to an item and reacts to it. */
  private visit(uid: string, reaction: Reaction, length: number): void {
    const view = this.getViews().get(uid);
    if (!view) return this.finish();
    const { point, perch } = this.approach(uid, reaction, view);
    this.walkTo(point, () => {
      if (perch) {
        this.perch = { uid, groundY: footprintBottom(view) - 4 };
        this.updateDepth();
      }
      this.turnTo(view.centerX);
      this.react(reaction, view);
      this.later(length, () => this.finish());
    });
  }

  private wander(col: number, row: number, action: IdleAction): void {
    this.walkTo(floorPoint(col, row), () => {
      this.say(IDLE_LINES[action]);
      if (action === "nap") this.nap();
      else if (action === "sit") this.squash(0.85);
      else this.tween({ targets: this.cat, y: this.cat.y - 2, duration: 200, yoyo: true, repeat: 3 });
      this.later(action === "nap" ? between(CAT_TIMING.napLength) : between(CAT_TIMING.idleGap), () => this.finish());
    });
  }

  private react(reaction: Reaction, view: ItemView): void {
    this.say(REACTION_LINES[reaction]);
    switch (reaction) {
      case "nap":
        this.nap();
        break;
      case "warm":
        this.squash(0.8);
        break;
      case "loaf":
        this.squash(0.75);
        break;
      case "paw-up":
        this.tween({ targets: this.cat, scaleY: 1.35, duration: 220, yoyo: true, repeat: 2 });
        this.scene.time.delayedCall(250, () => wobble(this.scene, view));
        break;
      case "bat":
        this.tween({ targets: this.cat, x: this.cat.x + this.facing * 4, duration: 90, yoyo: true, repeat: 3 });
        this.scene.time.delayedCall(150, () => wobble(this.scene, view));
        break;
      case "stare":
        this.tween({ targets: this.cat, y: this.cat.y - 6, duration: 120, yoyo: true });
        break;
      case "sniff":
        this.tween({ targets: this.cat, x: this.cat.x + this.facing * 2, duration: 120, yoyo: true, repeat: 3 });
        break;
    }
  }

  /** Where to stand for a reaction, and whether that means sitting on top of the item. */
  private approach(uid: string, reaction: Reaction, view: ItemView): { point: Point; perch: boolean } {
    if (reaction === "loaf") return { point: { x: view.centerX, y: view.top + 1 }, perch: true };
    if (reaction === "nap" && view.def.layer === "rug") {
      return { point: { x: view.centerX, y: footprintBottom(view) - 6 }, perch: false };
    }
    const placement = this.getState().placements.find((p) => p.uid === uid);
    const host = placement?.layer === "surface" ? this.getViews().get(placement.hostUid) : undefined;
    const anchor = host ?? view;
    if (anchor.def.layer === "wall") return { point: { x: view.centerX, y: FLOOR_Y + TILE - 4 }, perch: false };
    // Stand beside the item (or its furniture), on whichever side has room.
    const width = anchor.def.width * TILE;
    const left = anchor.x - BODY_W / 2 - 2;
    const x = left > ROOM_X + BODY_W ? left : anchor.x + width + BODY_W / 2 + 2;
    return { point: { x, y: footprintBottom(anchor) - 4 }, perch: false };
  }

  private walkTo(point: Point, then: () => void): void {
    this.bubble.setVisible(false);
    const go = () => {
      const distance = Phaser.Math.Distance.Between(this.cat.x, this.cat.y, point.x, point.y);
      if (distance < 2) return then();
      this.pose = "walking";
      this.turnTo(point.x);
      this.cat.setDepth(Math.max(this.cat.depth, depthAt(point.y)));
      const duration = Math.max(150, (distance / CAT_TIMING.walkSpeed) * 1000);
      this.tween({ targets: this.cat, x: point.x, y: point.y, duration, ease: "Linear" }, () => {
        this.pose = "resting";
        this.updateDepth();
        then();
      });
    };
    if (this.perch) this.hopDown(go);
    else go();
  }

  private hopDown(then: () => void): void {
    const groundY = this.perch?.groundY ?? this.cat.y;
    this.perch = undefined;
    this.pose = "walking";
    this.tween({ targets: this.cat, y: groundY, duration: 250, ease: "Quad.easeIn" }, () => {
      this.pose = "resting";
      this.updateDepth();
      then();
    });
  }

  private finish(): void {
    this.cat.setScale(this.facing, 1);
    this.bubble.setVisible(false);
    this.mode = "idle";
    this.pose = "resting";
    this.later(between(CAT_TIMING.idleGap), () => this.next());
  }

  private interrupt(): void {
    this.token++;
    this.scene.tweens.killTweensOf(this.cat);
    this.cat.setScale(this.facing, 1);
    this.cat.angle = 0;
    this.bubble.setVisible(false);
    this.pose = "resting";
  }

  private turnTo(x: number): void {
    if (Math.abs(x - this.cat.x) < 4) return;
    this.facing = x < this.cat.x ? -1 : 1;
    this.cat.scaleX = this.facing;
  }

  private nap(): void {
    this.pose = "napping";
    this.squash(0.6);
  }

  private squash(scaleY: number): void {
    this.tween({ targets: this.cat, scaleY, duration: 250 });
  }

  private say(text: string): void {
    if (!text) return void this.bubble.setVisible(false);
    this.bubble.setText(text).setVisible(true);
    const half = this.bubble.width / 2;
    this.bubble.setPosition(Phaser.Math.Clamp(this.cat.x, half + 4, GAME_WIDTH - half - 4), this.cat.y - BUBBLE_OFFSET);
  }

  private floatHeart(): void {
    const heart = this.scene.add
      .text(this.cat.x, this.cat.y - BUBBLE_OFFSET - 14, "♥", textStyle(16, COLOR_HEART))
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_BUBBLE);
    this.scene.tweens.add({ targets: heart, y: heart.y - 24, alpha: 0, duration: 900, onComplete: () => heart.destroy() });
  }

  private updateDepth(): void {
    const host = this.perch && this.getViews().get(this.perch.uid);
    this.cat.setDepth(host ? host.body.depth + 3 : depthAt(this.cat.y));
  }

  /** Runs `fn` after `ms`, unless the cat was interrupted in the meantime. */
  private later(ms: number, fn: () => void): void {
    const token = this.token;
    this.scene.time.delayedCall(ms, () => {
      if (token === this.token) fn();
    });
  }

  /** Adds a tween on the cat; `then` runs when it completes, unless the cat was interrupted. */
  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig, then?: () => void): void {
    const token = this.token;
    this.scene.tweens.add({
      ...config,
      onComplete: () => {
        if (then && token === this.token) then();
      },
    });
  }

  /** A placeholder cat built from rectangles, drawn facing right with its feet at (0, 0). */
  private makeCat(): Phaser.GameObjects.Container {
    const s = this.scene;
    const shape = (x: number, y: number, w: number, h: number) =>
      s.add.rectangle(x, y, w, h, COLOR_CAT).setOrigin(0.5, 1).setStrokeStyle(2, COLOR_OUTLINE);
    const headX = BODY_W / 2 - 2;
    const headBottom = -BODY_H + 4;
    return s.add.container(0, 0, [
      shape(-BODY_W / 2 - 1, -BODY_H + 4, 4, 12), // tail
      shape(0, 0, BODY_W, BODY_H), // body
      shape(headX, headBottom, HEAD, HEAD), // head
      shape(headX - 3, headBottom - HEAD + 1, 3, 4), // ears
      shape(headX + 3, headBottom - HEAD + 1, 3, 4),
    ]);
  }
}

function floorPoint(col: number, row: number): Point {
  return { x: ROOM_X + (col + 0.5) * TILE, y: FLOOR_Y + (row + 1) * TILE - 4 };
}

function footprintBottom(view: ItemView): number {
  return view.y + view.def.height * TILE;
}

/** Floor depth for a cat standing at `y`: in front of items in its row, behind rows nearer the front. */
function depthAt(y: number): number {
  const row = Phaser.Math.Clamp(Math.floor((y - FLOOR_Y - 1) / TILE), 0, BEDROOM.floorRows - 1);
  return DEPTH_FLOOR + row * 10 + 5;
}

function between([min, max]: number[]): number {
  return Phaser.Math.Between(min, max);
}

/** A little shake that leaves the item where it was. */
function wobble(scene: Phaser.Scene, view: ItemView): void {
  const baseX = view.x;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: 500,
    onUpdate: (tween) => {
      const t = tween.getValue() ?? 1;
      view.setPosition(baseX + Math.sin(t * Math.PI * 6) * 3 * (1 - t), view.y);
    },
    onComplete: () => view.setPosition(baseX, view.y),
  });
}
