// The ambient cat on screen: walks, reacts, idles, watches drags, and can be petted.
// Decisions come from src/logic/cat.ts; this file only animates them.

import * as Phaser from "phaser";
import { CAT_BEHAVIOR, CAT_TIMING, IDLE_LINES, OFFENDED_LINE, PET_LINE, REACTION_LINES } from "../data/cat";
import { CATALOG } from "../data/items";
import { BEDROOM } from "../data/rooms";
import {
  changedItems,
  displaced,
  movedOrRemoved,
  pickIdle,
  reactionFor,
  slotSide,
  toBack,
  type IdleAction,
  type Reaction,
} from "../logic/cat";
import type { RoomState } from "../logic/grid";
import { findRoute, type Leg, type Tile } from "../logic/route";
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
  private readonly tail: Phaser.GameObjects.Rectangle;
  /** Head and ears, which dip together for a slow blink. */
  private readonly face: Phaser.GameObjects.Rectangle[];
  private readonly faceY: number[];
  private readonly bubble: Phaser.GameObjects.Text;
  private mode: Mode = "idle";
  private pose: Pose = "resting";
  /** True while the player is dragging something. */
  private watching = false;
  /** Bumped on every interrupt; scheduled steps from an older token are dropped. */
  private token = 0;
  private readonly queue: string[] = [];
  private facing: 1 | -1 = 1;
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
    ({ cat: this.cat, tail: this.tail, face: this.face } = this.makeCat());
    this.faceY = this.face.map((part) => part.y);
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
      const reordered = toBack(this.queue, target, next.placements.some((p) => p.uid === target));
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
      this.offendedBlink(rug?.centerX);
    } else {
      this.interrupt();
      this.finish();
    }
  }

  /**
   * The player picked something up. The cat keeps doing what it's doing, but may glance over.
   * `held` is every item view being carried, so wobbles leave them alone.
   */
  startWatching(x: number, held: ItemView[]): void {
    this.watching = true;
    for (const view of held) this.held.add(view);
    this.glanceAt(x);
  }

  /** Turns toward `x`, but only if the cat is idle and sitting still. */
  glanceAt(x: number): void {
    if (this.watching && this.mode === "idle" && this.pose === "resting") this.turnTo(x);
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
    this.tween({ targets: this.cat, angle: this.facing * 360, duration: 700, ease: "Quad.easeInOut" }, () => {
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
        const moved = now !== undefined && Phaser.Math.Distance.BetweenPoints(this.approach(uid, reaction, now).point, point) >= 2;
        if (!now || moved) {
          // A moved item stays queued, so the cat still comes to see it where it is now.
          if (moved && !this.queue.includes(uid)) this.queue.push(uid);
          if (this.perch) this.hopDown(() => this.finish());
          else this.finish();
          return;
        }
        // A perch it couldn't reach (boxed in) gets the reaction from the nearest spot on the floor.
        if (perch && this.perch?.uid === uid) {
          this.perch = { uid, groundY: footprintBottom(now) - 4 };
          this.updateDepth();
        }
        if (reaction === "nap" && now.def.layer === "rug") this.napRug = uid;
        this.turnTo(now.centerX);
        this.react(reaction, now);
        this.later(length, () => this.finish());
      },
      perch ? uid : undefined,
    );
  }

  private wander(col: number, row: number, action: IdleAction): void {
    this.walkTo(floorPoint(col, row), () => {
      this.acting = true;
      this.restY = this.cat.y;
      this.say(IDLE_LINES[action]);
      if (action === "nap") this.nap();
      else if (action === "sit") this.squash(0.85);
      else this.tween({ targets: this.cat, y: this.cat.y - 2, duration: 200, yoyo: true, repeat: 3 });
      this.later(action === "nap" ? between(CAT_TIMING.napLength) : between(CAT_TIMING.idleGap), () => this.finish());
    });
  }

  private react(reaction: Reaction, view: ItemView): void {
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
        this.tween({ targets: this.cat, x: this.cat.x + this.facing * 4, duration: 90, yoyo: true, repeat: 3 });
        this.later(150, () => this.wobble(view));
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
    // Stand beside the item (or its furniture): on the side a surface item sits on, else the left,
    // falling back to the other side when there's no room.
    const width = anchor.def.width * TILE;
    const left = anchor.x - BODY_W / 2 - 2;
    const right = anchor.x + width + BODY_W / 2 + 2;
    const side = host && placement?.layer === "surface" ? slotSide(placement.slot, host.def.width) : undefined;
    const x =
      side === "right"
        ? right < ROOM_X + BEDROOM.columns * TILE - BODY_W ? right : left
        : left > ROOM_X + BODY_W ? left : right;
    return { point: { x, y: footprintBottom(anchor) - 4 }, perch: false };
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

  /** Plans a route from where the cat is and walks its legs in turn, re-planning if the room changed meanwhile. */
  private walkRoute(point: Point, goal: Tile, endOnTop: boolean, then: () => void): void {
    const state = this.getState();
    const perch = this.perch?.uid;
    const from = tileAt(this.cat.x, this.perch?.groundY ?? this.cat.y);
    const { climbCost, frontBackHopCost } = CAT_TIMING;
    const route = findRoute(BEDROOM, CATALOG, state, from, goal, { climbCost, frontBackHopCost, onTop: perch !== undefined, endOnTop });
    const atGoal = route.reached.col === goal.col && route.reached.row === goal.row;
    // Already on the goal tile: just the last few pixels to the exact spot.
    const legs: Leg[] = route.legs.length === 0 && atGoal && perch === undefined ? [{ ...goal, climb: false }] : [...route.legs];
    // About to hop off from somewhere between tiles (e.g. a loaf in the middle of a table): walk to the edge tile first.
    if (perch !== undefined && legs.length > 0 && legs[0].on !== perch && Math.abs(this.cat.x - floorPoint(from.col, from.row).x) >= 2) {
      legs.unshift({ ...from, climb: true, on: perch });
    }
    // Ending with a hop onto furniture: hop onto the tile, then walk across the top to the exact spot.
    const last = legs.at(-1);
    const beforeLast = legs.length >= 2 ? legs[legs.length - 2].on : perch;
    if (atGoal && last?.climb && last.on !== beforeLast) legs.push({ ...last });
    const step = (i: number) => {
      if (i >= legs.length) return this.arrive(then);
      if (this.getState() !== state) return this.walkRoute(point, goal, endOnTop, then);
      this.walkLeg(legs[i], i === legs.length - 1 && atGoal ? point : undefined, () => step(i + 1));
    };
    step(0);
  }

  /**
   * One straight leg of a route, ending at `exact` if given (the walk's final point), else at the
   * leg's tile. Hops on and off furniture are short arcs; on top it walks a little slower.
   */
  private walkLeg(leg: Leg, exact: Point | undefined, then: () => void): void {
    const host = leg.on !== undefined ? this.getViews().get(leg.on) : undefined;
    const target = exact ?? (leg.climb && host ? { x: floorPoint(leg.col, leg.row).x, y: host.top + 1 } : floorPoint(leg.col, leg.row));
    const distance = Phaser.Math.Distance.Between(this.cat.x, this.cat.y, target.x, target.y);
    if (distance < 2) return then();
    this.turnTo(target.x);
    /** `speed` in px per second; none means a hop. */
    const move = (speed: number | undefined, trackDepth: boolean) => {
      if (speed === undefined) return this.startMove(target, CAT_TIMING.hop, then, { arc: CAT_TIMING.hopArc });
      this.startMove(target, Math.max(150, (distance / speed) * 1000), then, { trackDepth });
    };

    if (leg.climb && host && leg.on !== undefined) {
      // Up on (or across) furniture: drawn above it, and an interrupt drops the cat to the floor in front.
      const hop = this.perch?.uid !== leg.on;
      const groundY = footprintBottom(host) - 4;
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
    this.pose = "resting";
    if (this.perch) this.perch = { uid: this.perch.uid, groundY: this.perch.groundY };
    this.updateDepth();
    then();
  }

  /** Hops straight down off its perch, unbothered: only for a perch that was moved or removed. */
  private hopDown(then: () => void, groundY = this.perch?.groundY ?? this.cat.y): void {
    this.perch = undefined;
    const landed = () => {
      this.restY = undefined;
      this.pose = "resting";
      this.updateDepth();
      then();
    };
    if (Math.abs(groundY - this.cat.y) < 2) return landed(); // already dropped to the floor by an interrupt
    this.pose = "walking";
    this.restY = groundY;
    this.startMove({ x: this.cat.x, y: groundY }, CAT_TIMING.hopDown, landed, { arc: CAT_TIMING.hopArc });
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
      this.cat.setPosition(Phaser.Math.Linear(from.x, to.x, t), Phaser.Math.Linear(from.y, to.y, t) - lift);
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
   * Woken by its rug sliding away: sits up, turns toward where the rug went (`towardX`, if it's
   * still in the room), gives one slow unimpressed blink and a quiet "mrr.", flicks its tail once,
   * then gets on with its day. The placeholder cat has no eyes, so the blink is a slow dip of the head.
   */
  private offendedBlink(towardX?: number): void {
    this.mode = "busy";
    this.acting = true;
    this.cat.scaleY = 0.6; // still curled up from the nap
    this.tween({ targets: this.cat, scaleY: 1, duration: 250, ease: "Quad.easeOut" });
    if (towardX !== undefined) this.turnTo(towardX);
    const blink = CAT_TIMING.offendedBlink;
    this.tween({ targets: this.face, y: "+=2", duration: blink / 2, yoyo: true, delay: 300, ease: "Sine.easeInOut" }, () => {
      this.say(OFFENDED_LINE);
      this.tween({ targets: this.tail, angle: -30, duration: 110, yoyo: true, ease: "Quad.easeOut" });
    });
    this.later(CAT_TIMING.offendedLength, () => this.finish());
  }

  private finish(): void {
    this.cat.setScale(this.facing, 1);
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
    this.cat.setDepth(host ? host.body.depth + 3 : depthAt(this.cat.y));
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
        view.setPosition(baseX + Math.sin(t * Math.PI * 6) * 3 * (1 - t), view.y);
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

  /** A placeholder cat built from rectangles, drawn facing right with its feet at (0, 0). */
  private makeCat(): {
    cat: Phaser.GameObjects.Container;
    tail: Phaser.GameObjects.Rectangle;
    face: Phaser.GameObjects.Rectangle[];
  } {
    const s = this.scene;
    const shape = (x: number, y: number, w: number, h: number) =>
      s.add.rectangle(x, y, w, h, COLOR_CAT).setOrigin(0.5, 1).setStrokeStyle(2, COLOR_OUTLINE);
    const headX = BODY_W / 2 - 2;
    const headBottom = -BODY_H + 4;
    const tail = shape(-BODY_W / 2 - 1, -BODY_H + 4, 4, 12);
    const face = [
      shape(headX, headBottom, HEAD, HEAD), // head
      shape(headX - 3, headBottom - HEAD + 1, 3, 4), // ears
      shape(headX + 3, headBottom - HEAD + 1, 3, 4),
    ];
    return { cat: s.add.container(0, 0, [tail, shape(0, 0, BODY_W, BODY_H), ...face]), tail, face };
  }
}

function floorPoint(col: number, row: number): Point {
  return { x: ROOM_X + (col + 0.5) * TILE, y: FLOOR_Y + (row + 1) * TILE - 4 };
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

/** Floor depth for a cat standing at `y`: in front of items in its row, behind rows nearer the front. */
function depthAt(y: number): number {
  return DEPTH_FLOOR + rowAt(y) * 10 + 5;
}

function between([min, max]: number[]): number {
  return Phaser.Math.Between(min, max);
}
