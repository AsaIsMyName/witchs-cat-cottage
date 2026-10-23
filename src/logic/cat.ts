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

/** What the cat does when it's free to pick something new. */
export type NextActivity = "visit" | "dive" | "idle";

/**
 * Queued item visits always come first. Otherwise, once play time reaches `diveDueAt`, the cat
 * dives into a portal; else it picks an idle activity. Only asked when the cat is free, so a dive
 * never interrupts anything.
 */
export function nextActivity(queued: number, playTime: number, diveDueAt: number): NextActivity {
  if (queued > 0) return "visit";
  return playTime >= diveDueAt ? "dive" : "idle";
}

/** Play time at which the next dive is due: somewhere in `range` (ms) after `playTime`. */
export function nextDiveAt(playTime: number, [min, max]: readonly [number, number], random: () => number): number {
  return playTime + min + random() * (max - min);
}

/** The small things the cat does while floating in the spellbook. None of them touches the item. */
export type BookReaction = "paw-air" | "blink" | "stare" | "curl" | "sniff";

export interface BookReactionRule {
  reaction: BookReaction;
  /** The item has at least one of these tags. */
  tags: string[];
}

/** First matching rule wins, like `reactionFor`; anything else gets a sniff. */
export function bookReactionFor(tags: string[], rules: BookReactionRule[]): BookReaction {
  return rules.find((r) => r.tags.some((tag) => tags.includes(tag)))?.reaction ?? "sniff";
}
