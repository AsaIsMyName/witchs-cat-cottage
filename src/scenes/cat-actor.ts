// The ambient cat on screen: walks, reacts, idles, watches drags, and can be petted.
// Decisions come from src/logic/cat.ts; this file only animates them.

import * as Phaser from "phaser";
import { CAT_BEHAVIOR, CAT_FACING, CAT_TIMING, IDLE_LINES, OFFENDED_LINE, PET_LINE, REACTION_LINES } from "../data/cat";
import { CATALOG } from "../data/items";
import { BEDROOM } from "../data/rooms";
import {
  changedItems,
  displaced,
  facingFor,
  facingSign,
  facingStep,
  idleFacing,
  legFacing,
  movedOrRemoved,
  pickIdle,
  reactionFor,
  slotSide,
  toBack,
  type Facing,
  type IdleAction,
  type Reaction,
} from "../logic/cat";
import type { RoomState } from "../logic/grid";
import { canStand, planWalk, type Leg, type Tile } from "../logic/route";
import { FLOOR_Y, GAME_WIDTH, ItemView, ROOM_X, TEXT_LIGHT, TILE, depthForBottom, textStyle } from "./room-view";

// Placeholder sizes, from the tile size so the cat stays in scale with the room.
const BODY_W = Math.round(TILE * 0.625);
const BODY_H = Math.round(TILE * 0.3);
const HEAD = Math.round(TILE * 0.25);
/** Seen from the front or back (facing down or up), the body is narrower and looks deeper. */
const FRONT_W = Math.round(TILE * 0.4);
const FRONT_H = Math.round(TILE * 0.4);
const TAIL_W = 3;
const TAIL_L = Math.round(TILE * 0.25);
const EAR = Math.max(2, Math.round(HEAD / 3));
/** How far above its tile's front edge the cat's feet rest. */
const FEET_INSET = Math.round(TILE / 8);
// Nudges and bobs, from the tile size so they stay in scale (2–4px at 32px tiles).
const BAT_NUDGE = Math.round(TILE / 10);
const SNIFF_NUDGE = Math.round(TILE / 16);
const STARE_HOP = Math.round(TILE / 8);
const GROOM_BOB = Math.round(TILE / 16);
const BLINK_DIP = Math.round(TILE / 16);
const WOBBLE = Math.round(TILE / 10);
const HOP_ARC = Math.round(CAT_TIMING.hopArc * TILE);
/** It only turns toward something farther than this on either axis, so it doesn't twitch at its own spot. */
const TURN_DEAD_ZONE = Math.round(TILE / 8);
const COLOR_CAT = 0x8a6fbf;
const COLOR_OUTLINE = 0x1e1a2b;
const COLOR_HEART = "#f28fb0";
const DEPTH_BUBBLE = 950;
const BUBBLE_OFFSET = BODY_H + HEAD + 6;

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
  private readonly tail: Phaser.GameObjects.Rectangle;
  private readonly body: Phaser.GameObjects.Rectangle;
  /** Head and ears, which dip together for a slow blink. */
  private readonly face: Phaser.GameObjects.Rectangle[];
  /** Where the face rests in the current facing, to put it back after a blink. */
  private faceY: number[] = [];
  private readonly bubble: Phaser.GameObjects.Text;
  private mode: Mode = "idle";
  private pose: Pose = "resting";
  /** True while the player is dragging something. */
  private watching = false;
  /** Bumped on every interrupt; scheduled steps from an older token are dropped. */
  private token = 0;
  private readonly queue: string[] = [];
  /** Which way it faces: set by each walk leg, an idle action's pick, a reaction, or a glance at a drag. */
  private facing: Facing = "down";
  /**
   * The furniture the cat is up on, and the floor y in front of it. `crossing` means it's only
   * passing over on a walk; an interrupt then drops it to the floor instead of leaving it up there.
   */
  private perch?: { uid: string; groundY: number; crossing?: boolean };
  /** The rug the cat is napping on; moving or removing it wakes the cat with an offended blink. */
  private napRug?: string;
  /** The queued item the cat is visiting; it goes back in the queue if the cat is interrupted first. */
  private current?: string;
  /** The item the cat is walking to or reacting to (queued or a cozy spot); moving it ends the visit. */
  private visiting?: string;
  /** True while a reaction, idle action, pet, or blink plays; petting then only gets a heart. */
  private acting = false;
  /** The tween carrying the cat somewhere (a walk, climb, or hop down); petting slows it down. */
  private move?: Phaser.Tweens.Tween;
  /** Petted on the move: the speed the cat moves at, and the counter easing it back to 1. */
  private petScale = 1;
  private petEase?: Phaser.Tweens.Tween;
  private pets = 0;
  /** Where the cat's feet belong if a hop or jump is cut short, so it never stays in mid-air. */
  private restY?: number;
  /** Item views the player is holding; wobbles leave them alone. */
  private readonly held = new Set<ItemView>();
  private readonly wobbling = new Set<ItemView>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly getState: () => RoomState,
    private readonly getViews: () => Map<string, ItemView>,
  ) {
    ({ cat: this.cat, tail: this.tail, body: this.body, face: this.face } = this.makeCat());
    this.drawFacing();
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
   * cat's queue; it gets to them after finishing what it's doing. The exception is the item it's
   * visiting: if that (or the furniture carrying it) was moved or removed, the visit ends right away
   * and a moved item goes to the back of the queue. Off a moved perch the cat hops down; woken by a
   * moved rug it gives an offended blink; otherwise it just moves on.
   */
  roomChanged(prev: RoomState, next: RoomState): void {
    for (const uid of changedItems(prev, next)) if (!this.queue.includes(uid)) this.queue.push(uid);

    const target = this.visiting;
    const visitEnded = target !== undefined && displaced(prev, next, target);
    if (visitEnded) {
      const reordered = toBack(
        this.queue,
        target,
        next.placements.some((p) => p.uid === target),
      );
      this.queue.splice(0, this.queue.length, ...reordered);
      this.current = undefined; // already requeued, so interrupt() mustn't put it back at the front
    }

    // The cat stays on its perch after a loaf ends, until its next walk, so check this even between visits.
    if (this.perch && movedOrRemoved(prev, next, this.perch.uid)) {
      this.interrupt();
      this.mode = "idle";
      this.hopDown(() => this.later(between(CAT_TIMING.noticeDelay), () => this.next()));
    } else if (!visitEnded) {
      return;
    } else if (this.napRug && movedOrRemoved(prev, next, this.napRug)) {
      const rug = this.getViews().get(this.napRug);
      this.interrupt();
      this.offendedBlink(rug && { x: rug.centerX, y: rug.centerY });
    } else {
      this.interrupt();
      this.finish();
    }
  }

  /**
   * The player picked something up. The cat keeps doing what it's doing, but may glance over.
   * `held` is every item view being carried, so wobbles leave them alone.
   */
  startWatching(x: number, y: number, held: ItemView[]): void {
    this.watching = true;
    for (const view of held) this.held.add(view);
    this.glanceAt(x, y);
  }

  /** Turns toward (`x`, `y`), but only if the cat is idle and sitting still. */
  glanceAt(x: number, y: number): void {
    if (this.watching && this.mode === "idle" && this.pose === "resting") this.turnTo({ x, y });
  }

  stopWatching(): void {
    this.watching = false;
    this.held.clear();
  }

  /** Generous hit area so the small cat is easy to tap on a phone. */
  hitTest(x: number, y: number): boolean {
    const halfW = BODY_W / 2 + HEAD;
    return Math.abs(x - this.cat.x) <= halfW && y <= this.cat.y + 6 && y >= this.cat.y - (BODY_H + HEAD + 10);
  }

  /**
   * Petting never cuts the cat's action short. On the move it slows down happily and keeps going;
   * mid-reaction or mid-idle-action it just gets a heart; only a cat with nothing on rolls over.
   */
  pet(): void {
    this.floatHeart();
    if (this.move) return this.petOnTheMove();
    if (this.acting || this.mode === "busy") return;
    this.interrupt(); // nothing is in progress, so this only drops the pending "what next" timer
    this.mode = "busy";
    this.acting = true;
    this.say(PET_LINE);
    this.tween({ targets: this.cat, angle: facingSign(this.facing) * 360, duration: 700, ease: "Quad.easeInOut" }, () => {
      this.cat.angle = 0;
      this.later(1200, () => this.finish());
    });
  }

  /**
   * Slows the current movement (and any leg that follows) for a moment, then eases back. Another
   * tap restarts the slowdown rather than stacking it. The tail goes up and wiggles, with a purr.
   */
  private petOnTheMove(): void {
    const { petSlowdown, petSlowFor, petEaseBack } = CAT_TIMING;
    this.petEase?.remove();
    this.setPetScale(petSlowdown);
    this.petEase = this.scene.tweens.addCounter({
      from: 0,
      to: petSlowFor + petEaseBack,
      duration: petSlowFor + petEaseBack,
      onUpdate: (tween) => {
        const t = Math.max(0, (tween.getValue() ?? 0) - petSlowFor) / petEaseBack;
        this.setPetScale(Phaser.Math.Linear(petSlowdown, 1, Math.min(1, t)));
      },
      onComplete: () => {
        this.petEase = undefined;
        this.setPetScale(1);
      },
    });

    this.scene.tweens.killTweensOf(this.tail);
    this.tail.angle = 0;
    this.scene.tweens.add({
      targets: this.tail,
      angle: -25,
      duration: 120,
      yoyo: true,
      repeat: 3,
      onComplete: () => (this.tail.angle = 0),
    });
    this.say(PET_LINE);
    const pet = ++this.pets;
    this.scene.time.delayedCall(petSlowFor, () => {
      if (pet === this.pets && this.move && this.bubble.text === PET_LINE) this.bubble.setVisible(false);
    });
  }

  private setPetScale(scale: number): void {
    this.petScale = scale;
    if (this.move) this.move.timeScale = scale;
  }

  private next(): void {
    const state = this.getState();
    const views = this.getViews();
    while (this.queue.length > 0) {
      const uid = this.queue.shift()!;
      const placement = state.placements.find((p) => p.uid === uid);
      if (!placement || !views.has(uid)) continue;
      this.mode = "busy";
      this.current = uid;
      this.visiting = uid;
      this.visit(uid, reactionFor(CATALOG, state, placement, CAT_BEHAVIOR.rules), CAT_TIMING.reactionLength);
      return;
    }

    this.mode = "idle";
    const plan = pickIdle(CATALOG, state, BEDROOM, CAT_BEHAVIOR, Math.random);
    if (plan.kind === "wander") this.wander(plan.col, plan.row, plan.action);
    else if (views.has(plan.uid)) {
      this.mode = "busy";
      this.visiting = plan.uid;
      this.visit(plan.uid, plan.reaction, between(CAT_TIMING.napLength));
    } else this.later(between(CAT_TIMING.idleGap), () => this.next());
  }

  /** Goes to an item and reacts to it. */
  private visit(uid: string, reaction: Reaction, length: number): void {
    const view = this.getViews().get(uid);
    if (!view) return this.finish();
    const { point, perch } = this.approach(uid, reaction, view);
    this.walkTo(
      point,
      () => {
        // Views are rebuilt on every room change, so look the item up again: it may have moved or gone mid-walk.
        const now = this.getViews().get(uid);
        const moved =
          now !== undefined && Phaser.Math.Distance.BetweenPoints(this.approach(uid, reaction, now).point, point) >= 2;
        if (!now || moved) {
          // A moved item stays queued, so the cat still comes to see it where it is now.
          if (moved && !this.queue.includes(uid)) this.queue.push(uid);
          if (this.perch) this.hopDown(() => this.finish());
          else this.finish();
          return;
        }
        // A perch it couldn't reach (boxed in) left the route on the nearest floor tile; it reacts from there.
        if (reaction === "nap" && now.def.layer === "rug") this.napRug = uid;
        this.faceItem(uid, reaction, now, point);
        this.react(reaction, now);
        this.later(length, () => this.finish());
      },
      perch ? uid : undefined,
    );
  }

  private wander(col: number, row: number, action: IdleAction): void {
    this.walkTo(floorPoint(col, row), () => {
      this.setFacing(idleFacing(this.facing, CAT_FACING, Math.random));
      this.acting = true;
      this.restY = this.cat.y;
      this.say(IDLE_LINES[action]);
      if (action === "nap") this.nap();
      else if (action === "sit") this.squash(0.85);
      else this.tween({ targets: this.cat, y: this.cat.y - GROOM_BOB, duration: 200, yoyo: true, repeat: 3 });
      this.later(action === "nap" ? between(CAT_TIMING.napLength) : between(CAT_TIMING.idleGap), () => this.finish());
    });
  }

  private react(reaction: Reaction, view: ItemView): void {
    const step = facingStep(this.facing);
    /** A little push toward whatever it faces, and back. */
    const nudge = (px: number) => ({ x: this.cat.x + step.x * px, y: this.cat.y + step.y * px });
    this.acting = true;
    this.restY = this.cat.y;
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
        this.later(250, () => this.wobble(view));
        break;
      case "bat":
        this.tween({ targets: this.cat, ...nudge(BAT_NUDGE), duration: 90, yoyo: true, repeat: 3 });
        this.later(150, () => this.wobble(view));
        break;
      case "stare":
        this.tween({ targets: this.cat, y: this.cat.y - STARE_HOP, duration: 120, yoyo: true });
        break;
      case "sniff":
        this.tween({ targets: this.cat, ...nudge(SNIFF_NUDGE), duration: 120, yoyo: true, repeat: 3 });
        break;
    }
  }

  /** Where to stand for a reaction, and whether that means sitting on top of the item. */
  private approach(uid: string, reaction: Reaction, view: ItemView): { point: Point; perch: boolean } {
    if (reaction === "loaf") return { point: { x: view.centerX, y: view.seatY }, perch: true };
    if (reaction === "nap" && view.def.layer === "rug") {
      return { point: { x: view.centerX, y: footprintBottom(view) - FEET_INSET - 2 }, perch: false };
    }
    const placement = this.getState().placements.find((p) => p.uid === uid);
    const host = placement?.layer === "surface" ? this.getViews().get(placement.hostUid) : undefined;
    const anchor = host ?? view;
    if (anchor.def.layer === "wall") return { point: { x: view.centerX, y: FLOOR_Y + TILE - FEET_INSET }, perch: false };
    // Stand beside the item (or its furniture): on the side a surface item sits on, else the left,
    // falling back to the other side when there's no room.
    const width = anchor.def.width * TILE;
    const left = anchor.x - BODY_W / 2 - 2;
    const right = anchor.x + width + BODY_W / 2 + 2;
    const side = host && placement?.layer === "surface" ? slotSide(placement.slot, host.def.width) : undefined;
    const x =
      side === "right"
        ? right < ROOM_X + BEDROOM.columns * TILE - BODY_W
          ? right
          : left
        : left > ROOM_X + BODY_W
          ? left
          : right;
    return { point: { x, y: footprintBottom(anchor) - FEET_INSET }, perch: false };
  }

  /**
   * Faces what it reacts to: up at a wall item or something on a shelf, toward the furniture it
   * stands beside (or the item, on the floor). Up on the item itself (a loaf, a nap on the rug at
   * `point`), it keeps the way it walked in, like an idle action.
   */
  private faceItem(uid: string, reaction: Reaction, view: ItemView, point: Point): void {
    const onIt =
      reaction === "loaf"
        ? this.perch?.uid === uid
        : reaction === "nap" && view.def.layer === "rug" && Phaser.Math.Distance.BetweenPoints(this.cat, point) < TILE / 2;
    if (onIt) return;
    const placement = this.getState().placements.find((p) => p.uid === uid);
    const anchor = (placement?.layer === "surface" ? this.getViews().get(placement.hostUid) : undefined) ?? view;
    if (anchor.def.layer === "wall") return this.setFacing("up");
    // The middle of its footprint, not its drawn shape, so a tall item beside the cat reads as beside it.
    this.turnTo({ x: anchor.centerX, y: footprintBottom(anchor) - (anchor.def.height * TILE) / 2 });
  }

  /**
   * Walks to `point` along a floor-tile route (src/logic/route.ts): around furniture, over furniture
   * with a top only when there's no way around, never through anything else. `perchOn` is the
   * furniture `point` sits on top of (a loaf); the route then ends up there. A spot it can't reach
   * gets the nearest tile it can. Starting on a perch, the route starts up there, so the cat walks to
   * the edge it's heading for and hops off it.
   */
  private walkTo(point: Point, then: () => void, perchOn?: string): void {
    this.bubble.setVisible(false);
    const host = perchOn !== undefined ? this.getViews().get(perchOn) : undefined;
    // A perch goal is the item's tile nearest the cat, so it hops onto the near edge and walks to the spot.
    const goal = host ? nearestTileOf(host, this.cat.x) : tileAt(point.x, point.y);
    if (this.perch) {
      this.perch = { ...this.perch, crossing: true };
      this.restY = this.perch.groundY;
    }
    this.pose = "walking";
    this.walkRoute(point, goal, host !== undefined, then);
  }

  /**
   * Plans a route from where the cat is and walks its legs in turn, re-planning if the room changed
   * meanwhile. A change during the last leg only re-plans if it left the cat on a blocked tile.
   * `replanned` means the cat is already partway through this walk, so its facing carries on.
   */
  private walkRoute(point: Point, goal: Tile, endOnTop: boolean, then: () => void, replanned = false): void {
    const state = this.getState();
    const from = this.tileHere();
    const { climbCost, frontBackHopCost } = CAT_TIMING;
    const offCenter = Math.abs(this.cat.x - floorPoint(from.col, from.row).x) >= 2;
    const { legs, exact } = planWalk(BEDROOM, CATALOG, state, from, goal, {
      climbCost,
      frontBackHopCost,
      onTop: this.perch !== undefined,
      endOnTop,
      offCenter,
    });
    const step = (i: number) => {
      const now = this.getState();
      if (i >= legs.length) {
        if (now !== state && !canStand(BEDROOM, CATALOG, now, this.tileHere(), this.perch?.uid)) {
          return this.walkRoute(point, goal, endOnTop, then, true);
        }
        return this.arrive(then);
      }
      if (now !== state) return this.walkRoute(point, goal, endOnTop, then, true);
      const exactEnd = i === legs.length - 1 && exact ? point : undefined;
      this.walkLeg(legs[i], i === 0 ? from : legs[i - 1], replanned || i > 0, exactEnd, () => step(i + 1));
    };
    step(0);
  }

  /** The floor tile the cat is on (for a perch, the furniture's front-row tile under it). */
  private tileHere(): Tile {
    return tileAt(this.cat.x, this.perch?.groundY ?? this.cat.y);
  }

  /**
   * One straight leg of a route from tile `from`, ending at `exact` if given (the walk's final
   * point), else at the leg's tile. Hops on and off furniture are short arcs; on top it walks a
   * little slower. Its facing is picked once, from the leg's tile direction (exactly straight or
   * diagonal), and holds for the whole leg; `continuing` legs keep the walk's facing when they can.
   */
  private walkLeg(leg: Leg, from: Tile, continuing: boolean, exact: Point | undefined, then: () => void): void {
    const host = leg.on !== undefined ? this.getViews().get(leg.on) : undefined;
    const target =
      exact ?? (leg.climb && host ? { x: floorPoint(leg.col, leg.row).x, y: host.seatY } : floorPoint(leg.col, leg.row));
    const distance = Phaser.Math.Distance.Between(this.cat.x, this.cat.y, target.x, target.y);
    if (distance < 2) return then();
    const tiles = { x: leg.col - from.col, y: leg.row - from.row };
    // Within one tile (a step to the exact end point, or across a perch), the pixel direction.
    const way = tiles.x !== 0 || tiles.y !== 0 ? tiles : { x: target.x - this.cat.x, y: target.y - this.cat.y };
    const deadZone = way === tiles ? 0 : TURN_DEAD_ZONE;
    this.setFacing(legFacing(way.x, way.y, this.facing, continuing, CAT_FACING, deadZone));
    /** `speed` in tiles per second; none means a hop. */
    const move = (speed: number | undefined, trackDepth: boolean) => {
      if (speed === undefined) return this.startMove(target, CAT_TIMING.hop, then, { arc: HOP_ARC });
      this.startMove(target, Math.max(150, (distance / (speed * TILE)) * 1000), then, { trackDepth });
    };

    if (leg.climb && host && leg.on !== undefined) {
      // Up on (or across) furniture: drawn above it, and an interrupt drops the cat to the floor in front.
      const hop = this.perch?.uid !== leg.on;
      const groundY = footprintBottom(host) - FEET_INSET;
      this.perch = { uid: leg.on, groundY, crossing: true };
      this.restY = groundY;
      this.updateDepth();
      move(hop ? undefined : CAT_TIMING.topWalkSpeed, false);
    } else if (this.perch) {
      // Hopping off the edge onto the next floor tile: stays drawn above the furniture until it lands.
      this.perch = undefined;
      this.restY = target.y;
      move(undefined, false);
    } else {
      this.restY = undefined;
      move(CAT_TIMING.walkSpeed, true);
    }
  }

  /** End of a walk. If the route ended up on furniture, the cat stays there like a perch until its next walk. */
  private arrive(then: () => void): void {
    this.restY = undefined;
    this.pose = "resting"; // still facing the way it walked; a visit then turns it toward the item

    if (this.perch) this.perch = { uid: this.perch.uid, groundY: this.perch.groundY };
    this.updateDepth();
    then();
  }

  /** Hops straight down off its perch, unbothered: only for a perch that was moved or removed. */
  private hopDown(then: () => void, groundY = this.perch?.groundY ?? this.cat.y): void {
    this.perch = undefined;
    const landed = () => {
      this.restY = undefined;
      this.pose = "resting"; // unbothered: still facing the way it was
      this.updateDepth();
      then();
    };
    if (Math.abs(groundY - this.cat.y) < 2) return landed(); // already dropped to the floor by an interrupt
    this.pose = "walking";
    this.restY = groundY;
    this.startMove({ x: this.cat.x, y: groundY }, CAT_TIMING.hopDown, landed, { arc: HOP_ARC });
  }

  /**
   * Moves the cat to `to` over `duration`: petting can slow it down, and the speech bubble rides
   * along. `arc` lifts it that many px mid-move, for a hop. With `trackDepth`, its depth follows
   * its y every frame, so it passes behind front-row items.
   */
  private startMove(to: Point, duration: number, then: () => void, opts: { arc?: number; trackDepth?: boolean } = {}): void {
    const from = { x: this.cat.x, y: this.cat.y };
    const arc = opts.arc ?? 0;
    const progress = { t: 0 };
    const onUpdate = () => {
      const t = progress.t;
      const lift = 4 * t * (1 - t) * arc;
      // Whole pixels: the placeholder is drawn from shapes, which ignore pixelArt's roundPixels, so a
      // sub-pixel position makes its edges and 1.5px outline land on different pixels every frame, and
      // it shimmers (on a diagonal, in both width and height at once).
      this.cat.setPosition(
        Math.round(Phaser.Math.Linear(from.x, to.x, t)),
        Math.round(Phaser.Math.Linear(from.y, to.y, t) - lift),
      );
      if (opts.trackDepth) this.updateDepth();
      this.followBubble();
    };
    this.move = this.tween({ targets: progress, t: 1, duration, ease: "Linear", onUpdate }, () => {
      this.move = undefined;
      then();
    });
    this.move.timeScale = this.petScale;
  }

  /**
   * Woken by its rug sliding away: sits up, turns toward where the rug went (`toward`, if it's
   * still in the room), gives one slow unimpressed blink and a quiet "mrr.", flicks its tail once,
   * then gets on with its day. The placeholder cat has no eyes, so the blink is a slow dip of the head.
   */
  private offendedBlink(toward?: Point): void {
    this.mode = "busy";
    this.acting = true;
    this.cat.scaleY = 0.6; // still curled up from the nap
    this.tween({ targets: this.cat, scaleY: 1, duration: 250, ease: "Quad.easeOut" });
    if (toward) this.turnTo(toward);
    const blink = CAT_TIMING.offendedBlink;
    this.tween(
      { targets: this.face, y: `+=${BLINK_DIP}`, duration: blink / 2, yoyo: true, delay: 300, ease: "Sine.easeInOut" },
      () => {
        this.say(OFFENDED_LINE);
        this.tween({ targets: this.tail, angle: -30, duration: 110, yoyo: true, ease: "Quad.easeOut" });
      },
    );
    this.later(CAT_TIMING.offendedLength, () => this.finish());
  }

  private finish(): void {
    this.cat.setScale(facingSign(this.facing), 1);
    this.resetParts();
    this.bubble.setVisible(false);
    this.mode = "idle";
    this.pose = "resting";
    this.acting = false;
    this.current = undefined;
    this.visiting = undefined;
    this.napRug = undefined;
    this.restY = undefined;
    this.later(between(CAT_TIMING.idleGap), () => this.next());
  }

  /** Cuts the current action short. An unfinished queued visit goes back to the front of the queue. */
  private interrupt(): void {
    this.token++;
    this.scene.tweens.killTweensOf(this.cat);
    this.move?.remove(); // movement tweens drive a progress counter, not the cat itself
    this.move = undefined;
    this.petEase?.remove();
    this.petEase = undefined;
    this.petScale = 1;
    this.resetParts();
    // Cut off while crossing furniture: restY is the floor in front of it, so it's no longer up there.
    if (this.perch?.crossing) this.perch = undefined;
    if (this.restY !== undefined) {
      this.cat.y = this.restY;
      this.restY = undefined;
      this.updateDepth();
    }
    if (this.current && !this.queue.includes(this.current)) this.queue.unshift(this.current);
    this.current = undefined;
    this.visiting = undefined;
    this.acting = false;
    this.napRug = undefined;
    this.cat.setScale(facingSign(this.facing), 1);
    this.cat.angle = 0;
    this.bubble.setVisible(false);
    this.pose = "resting";
  }

  /** Faces `to` along its dominant axis (left/right on a tie); something right at its feet keeps the current way. */
  private turnTo(to: Point): void {
    this.setFacing(facingFor(to.x - this.cat.x, to.y - this.cat.y, this.facing, TURN_DEAD_ZONE));
  }

  private setFacing(facing: Facing): void {
    if (facing === this.facing) return;
    this.facing = facing;
    this.drawFacing();
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
    this.followBubble();
  }

  /** Keeps a visible speech bubble above the cat, e.g. a purr while it walks. */
  private followBubble(): void {
    if (!this.bubble.visible) return;
    const half = this.bubble.width / 2;
    this.bubble.setPosition(Phaser.Math.Clamp(this.cat.x, half + 4, GAME_WIDTH - half - 4), this.cat.y - BUBBLE_OFFSET);
  }

  /** Puts the tail and head back after a wiggle, flick, or blink. */
  private resetParts(): void {
    this.scene.tweens.killTweensOf([this.tail, ...this.face]);
    this.tail.angle = 0;
    this.face.forEach((part, i) => (part.y = this.faceY[i]));
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
    // Up on furniture it draws over the furniture and what sits on it; on the floor it sorts by its feet.
    this.cat.setDepth(host ? host.body.depth + 2 : depthForBottom(this.cat.y));
  }

  /**
   * A little shake that leaves the item where it was. Skips items that were redrawn (destroyed),
   * are being carried, or are already wobbling, so it never fights a drag or a stale position.
   */
  private wobble(view: ItemView): void {
    const off = () => !view.body.active || this.held.has(view);
    if (off() || this.wobbling.has(view)) return;
    this.wobbling.add(view);
    const baseX = view.x;
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 500,
      onUpdate: (tween) => {
        if (off()) return;
        const t = tween.getValue() ?? 1;
        view.setPosition(baseX + Math.sin(t * Math.PI * 6) * WOBBLE * (1 - t), view.y);
      },
      onComplete: () => {
        this.wobbling.delete(view);
        if (!off()) view.setPosition(baseX, view.y);
      },
    });
  }

  /** Runs `fn` after `ms`, unless the cat was interrupted in the meantime. */
  private later(ms: number, fn: () => void): void {
    const token = this.token;
    this.scene.time.delayedCall(ms, () => {
      if (token === this.token) fn();
    });
  }

  /** Adds a tween on the cat (or its parts); `then` runs when it completes, unless the cat was interrupted. */
  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig, then?: () => void): Phaser.Tweens.Tween {
    const token = this.token;
    return this.scene.tweens.add({
      ...config,
      onComplete: () => {
        if (then && token === this.token) then();
      },
    });
  }

  /** A placeholder cat built from rectangles, with its feet at (0, 0). `drawFacing` lays the parts out. */
  private makeCat(): {
    cat: Phaser.GameObjects.Container;
    tail: Phaser.GameObjects.Rectangle;
    body: Phaser.GameObjects.Rectangle;
    face: Phaser.GameObjects.Rectangle[];
  } {
    const s = this.scene;
    const shape = () => s.add.rectangle(0, 0, 1, 1, COLOR_CAT).setOrigin(0.5, 1).setStrokeStyle(1.5, COLOR_OUTLINE);
    const tail = shape();
    const body = shape();
    const face = [shape(), shape(), shape()]; // head, then the ears
    return { cat: s.add.container(0, 0, [tail, body, ...face]), tail, body, face };
  }

  /**
   * Lays out the placeholder for the way it faces. Left and right: a side view with the head at the
   * front (drawn facing right, flipped for left). Down: the head low and centered over the body, the
   * tail rising behind it. Up: a small head peeking over the far end, the tail toward the viewer.
   */
  private drawFacing(): void {
    const [head, ...ears] = this.face;
    const place = (part: Phaser.GameObjects.Rectangle, x: number, bottom: number, w: number, h: number) =>
      part.setPosition(x, bottom).setSize(w, h).setOrigin(0.5, 1);
    this.scene.tweens.killTweensOf(this.face); // a blink mid-turn would put the face back in the old spot
    let order: Phaser.GameObjects.Rectangle[];
    if (this.facing === "left" || this.facing === "right") {
      const headX = BODY_W / 2 - 2;
      const headBottom = -BODY_H + 3;
      place(this.body, 0, 0, BODY_W, BODY_H);
      place(this.tail, -BODY_W / 2 - 1, -BODY_H + 3, TAIL_W, TAIL_L);
      place(head, headX, headBottom, HEAD, HEAD);
      ears.forEach((ear, i) => place(ear, headX + (i ? EAR : -EAR), headBottom - HEAD + 1, EAR, EAR + 1));
      order = [this.tail, this.body, head, ...ears];
    } else if (this.facing === "down") {
      // The body reaches back (up the screen) from the head, which sits at the cat's front edge.
      const bodyBottom = -2;
      const headBottom = 1;
      place(this.body, 0, bodyBottom, FRONT_W, FRONT_H);
      place(this.tail, FRONT_W / 2 - 3, bodyBottom - FRONT_H + 2, TAIL_W, TAIL_L);
      place(head, 0, headBottom, HEAD + 1, HEAD);
      ears.forEach((ear, i) => place(ear, i ? EAR : -EAR, headBottom - HEAD + 1, EAR, EAR + 1));
      order = [this.tail, this.body, head, ...ears];
    } else {
      // The head sits behind the body, so only its top and the ears show over the far end.
      const small = HEAD - 2;
      const headBottom = -FRONT_H + 3;
      place(this.body, 0, 0, FRONT_W, FRONT_H);
      place(head, 0, headBottom, small, small);
      ears.forEach((ear, i) => place(ear, i ? EAR - 1 : 1 - EAR, headBottom - small + 1, EAR, EAR + 1));
      // Hanging from its base toward the viewer, so a flick swings the tip.
      place(this.tail, 2, -4, TAIL_W, TAIL_L - 1).setOrigin(0.5, 0);
      order = [...ears, head, this.body, this.tail];
    }
    for (const part of order) this.cat.bringToTop(part);
    this.cat.scaleX = facingSign(this.facing);
    this.faceY = this.face.map((part) => part.y);
  }
}

function floorPoint(col: number, row: number): Point {
  return { x: ROOM_X + (col + 0.5) * TILE, y: FLOOR_Y + (row + 1) * TILE - FEET_INSET };
}

function footprintBottom(view: ItemView): number {
  return view.y + view.def.height * TILE;
}

/** The floor row a cat standing at `y` is in. */
function rowAt(y: number): number {
  return Phaser.Math.Clamp(Math.floor((y - FLOOR_Y - 1) / TILE), 0, BEDROOM.floorRows - 1);
}

/** The floor tile under a point (feet at `y`), clamped to the room. */
function tileAt(x: number, y: number): Tile {
  return { col: Phaser.Math.Clamp(Math.floor((x - ROOM_X) / TILE), 0, BEDROOM.columns - 1), row: rowAt(y) };
}

/** The tile of a floor item's front row nearest to `x`. */
function nearestTileOf(view: ItemView, x: number): Tile {
  const first = Math.round((view.x - ROOM_X) / TILE);
  const col = Phaser.Math.Clamp(tileAt(x, FLOOR_Y).col, first, first + view.def.width - 1);
  return { col, row: rowAt(footprintBottom(view) - 4) };
}

function between([min, max]: number[]): number {
  return Phaser.Math.Between(min, max);
}
