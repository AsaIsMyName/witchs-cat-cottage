// The ambient cat's decisions: how it reacts to an item, what it does when idle, and which items
// are new enough to go look at. Plain TypeScript, no Phaser, so it can be unit tested.
// The cat never judges: every reaction is positive, playful, or curious. (The one exception, an
// offended blink when its rug is pulled out from under a nap, isn't about the item; see cat-actor.ts.)

import { targetOf, type ItemShape, type Placement, type RoomShape, type RoomState } from "./grid";

export interface TaggedItem extends ItemShape {
  tags: string[];
}

export type TaggedCatalog = Record<string, TaggedItem>;

/** Where an item sits: its grid layer, or "low"/"high" for surface items on furniture/shelves. */
export type Spot = "wall" | "floor" | "rug" | "low" | "high";

export type Reaction = "nap" | "paw-up" | "warm" | "bat" | "loaf" | "stare" | "sniff";

/** A rule matches when every condition it sets holds. The first matching rule picks the reaction. */
export interface ReactionRule {
  reaction: Reaction;
  /** The item has at least one of these tags. */
  tags?: string[];
  /** The item sits in one of these spots. */
  on?: Spot[];
  /** The item has (or lacks) a surface. */
  hasSurface?: boolean;
}

export interface CatBehavior {
  rules: ReactionRule[];
  /** Reactions that make an item a cozy spot the cat drifts back to when idle. */
  cozyReactions: Reaction[];
  /** Chance (0–1) that an idle cat visits a cozy spot instead of wandering, when there is one. */
  cozyChance: number;
}

export type IdleAction = "sit" | "groom" | "nap";

export type IdlePlan =
  | { kind: "visit"; uid: string; reaction: Reaction }
  | { kind: "wander"; col: number; row: number; action: IdleAction };

const IDLE_ACTIONS: IdleAction[] = ["sit", "groom", "nap"];

/** Which way the cat faces in the ¾ view: up is away from the viewer (toward the wall), down is toward them. */
export type Facing = "up" | "down" | "left" | "right";

/**
 * The way to face for a move or look of (dx, dy) in screen px (y grows down): the dominant axis,
 * left/right on a tie. Within `deadZone` px on both axes (e.g. no movement), it keeps `current`.
 */
export function facingFor(dx: number, dy: number, current: Facing, deadZone = 0): Facing {
  if (Math.abs(dx) <= deadZone && Math.abs(dy) <= deadZone) return current;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

/** Tuning for which way the cat faces when it walks and rests (values in src/data/cat.ts). */
export interface FacingRules {
  /**
   * Later legs of a walk keep the current facing while they still move along it by at least this
   * fraction of their move across it (1 keeps it on an exact diagonal), so it doesn't flip mid-walk.
   */
  keepWhileWalking: number;
  /** Chance (0–1) that an idle action (sit, groom, nap) keeps the facing it arrived with. */
  idleKeepChance: number;
  /** Otherwise, relative weights for a fresh random facing. */
  idleWeights: Record<Facing, number>;
}

/**
 * The facing for one leg of a walk that moves (dx, dy), chosen once for the whole leg. The first
 * leg turns along its dominant axis (left/right on a tie, so a diagonal walk is sideways). A later
 * leg (`continuing`) keeps the current facing when it still heads that way enough, e.g. a straight
 * leg into a diagonal one, so a near-diagonal walk never flickers between two facings.
 */
export function legFacing(
  dx: number,
  dy: number,
  current: Facing,
  continuing: boolean,
  rules: Pick<FacingRules, "keepWhileWalking">,
  deadZone = 0,
): Facing {
  if (continuing) {
    const step = facingStep(current);
    const along = dx * step.x + dy * step.y;
    const across = Math.abs(dx * step.y - dy * step.x);
    if (along > deadZone && along >= across * rules.keepWhileWalking) return current;
  }
  return facingFor(dx, dy, current, deadZone);
}

/**
 * The facing as an idle action starts: usually the way it arrived, otherwise a random one by
 * weight (mostly sideways). `random` returns numbers in [0, 1), like Math.random.
 */
export function idleFacing(current: Facing, rules: Omit<FacingRules, "keepWhileWalking">, random: () => number): Facing {
  if (random() < rules.idleKeepChance) return current;
  const options = (Object.entries(rules.idleWeights) as [Facing, number][]).filter(([, w]) => w > 0);
  const total = options.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) return current;
  let r = random() * total;
  for (const [facing, w] of options) {
    r -= w;
    if (r < 0) return facing;
  }
  return options[options.length - 1][0];
}

/** A unit step in the facing direction, in screen axes (y grows down), e.g. for a nudge toward what it faces. */
export function facingStep(facing: Facing): { x: number; y: number } {
  if (facing === "left") return { x: -1, y: 0 };
  if (facing === "right") return { x: 1, y: 0 };
  return { x: 0, y: facing === "up" ? -1 : 1 };
}

/** The horizontal sign for flipping a side view: -1 facing left, else 1 (up and down are drawn unflipped). */
export function facingSign(facing: Facing): 1 | -1 {
  return facing === "left" ? -1 : 1;
}

export function reactionFor(catalog: TaggedCatalog, state: RoomState, p: Placement, rules: ReactionRule[]): Reaction {
  const item = catalog[p.itemId];
  if (!item) return "sniff";
  const spot = spotOf(state, p);
  const rule = rules.find(
    (r) =>
      (!r.tags || r.tags.some((tag) => item.tags.includes(tag))) &&
      (!r.on || r.on.includes(spot)) &&
      (r.hasSurface === undefined || Boolean(item.hasSurface) === r.hasSurface),
  );
  return rule?.reaction ?? "sniff";
}

/** What an idle cat does next. `random` returns numbers in [0, 1), like Math.random. */
export function pickIdle(
  catalog: TaggedCatalog,
  state: RoomState,
  room: RoomShape,
  behavior: CatBehavior,
  random: () => number,
): IdlePlan {
  const cozy = state.placements
    .map((p) => ({ uid: p.uid, reaction: reactionFor(catalog, state, p, behavior.rules) }))
    .filter((c) => behavior.cozyReactions.includes(c.reaction));
  if (cozy.length > 0 && random() < behavior.cozyChance) {
    return { kind: "visit", ...cozy[Math.floor(random() * cozy.length)] };
  }
  return {
    kind: "wander",
    col: Math.floor(random() * room.columns),
    row: Math.floor(random() * room.floorRows),
    action: IDLE_ACTIONS[Math.floor(random() * IDLE_ACTIONS.length)],
  };
}

/** Uids of items that are new in `next` or sit somewhere different than in `prev`. */
export function changedItems(prev: RoomState, next: RoomState): string[] {
  const before = new Map(prev.placements.map((p) => [p.uid, JSON.stringify(targetOf(p))]));
  return next.placements.filter((p) => before.get(p.uid) !== JSON.stringify(targetOf(p))).map((p) => p.uid);
}

/** Whether item `uid` was removed or moved between `prev` and `next` (e.g. the rug or table the cat is on). */
export function movedOrRemoved(prev: RoomState, next: RoomState, uid: string): boolean {
  return !next.placements.some((p) => p.uid === uid) || changedItems(prev, next).includes(uid);
}

/**
 * Whether item `uid` was moved or removed, counting the furniture or shelf it sits on, which
 * carries it. A reaction to an item that this is true for ends right away.
 */
export function displaced(prev: RoomState, next: RoomState, uid: string): boolean {
  if (movedOrRemoved(prev, next, uid)) return true;
  const p = prev.placements.find((q) => q.uid === uid);
  return p?.layer === "surface" && movedOrRemoved(prev, next, p.hostUid);
}

/** `queue` with `uid` moved to the back, so other pending items come first. Dropped if `present` is false. */
export function toBack(queue: string[], uid: string, present: boolean): string[] {
  const rest = queue.filter((q) => q !== uid);
  return present ? [...rest, uid] : rest;
}

/**
 * Which side of its furniture a surface item in `slot` sits on, so the cat can stand there.
 * Undefined for a middle slot (including a 1-slot host like the stool): no preference.
 */
export function slotSide(slot: number, hostWidth: number): "left" | "right" | undefined {
  const middle = hostWidth / 2;
  if (slot + 0.5 < middle) return "left";
  if (slot + 0.5 > middle) return "right";
  return undefined;
}

export function spotOf(state: RoomState, p: Placement): Spot {
  if (p.layer !== "surface") return p.layer;
  const host = state.placements.find((h) => h.uid === p.hostUid);
  return host?.layer === "wall" ? "high" : "low";
}
