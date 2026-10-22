// The cat's review of a room: which items it visits, in what order, how it reacts, and the
// happiness score. Plain TypeScript, no Phaser, so it can be unit tested.

import { removeToTray, type Catalog, type ItemShape, type Placement, type RoomState } from "./grid";

export interface TaggedItem extends ItemShape {
  tags: string[];
}

export type TaggedCatalog = Record<string, TaggedItem>;

/** Where an item sits: its grid layer, or "low"/"high" for surface items on furniture/shelves. */
export type Spot = "wall" | "floor" | "rug" | "low" | "high";

export interface DislikeRule {
  tag: string;
  /** Only disliked in these spots. Omit for "anywhere". */
  on?: Spot[];
}

export interface CatPrefs {
  likes: string[];
  dislikes: DislikeRule[];
  points: { liked: number; disliked: number };
}

export type Reaction = "like" | "neutral" | "dislike";

export interface Visit {
  uid: string;
  itemId: string;
  reaction: Reaction;
  /** The tag behind a like or dislike, for hint text. */
  tag?: string;
}

export interface Review {
  visits: Visit[];
  /** Cat happiness, 0–100. */
  score: number;
}

export const MAX_SCORE = 100;

export function reviewRoom(catalog: TaggedCatalog, state: RoomState, prefs: CatPrefs): Review {
  const visits = visitOrder(catalog, state).map((p): Visit => {
    const item = catalog[p.itemId];
    const spot = spotOf(state, p);
    const dislike = prefs.dislikes.find((rule) => item.tags.includes(rule.tag) && (!rule.on || rule.on.includes(spot)));
    if (dislike) return { uid: p.uid, itemId: p.itemId, reaction: "dislike", tag: dislike.tag };
    const liked = item.tags.find((tag) => prefs.likes.includes(tag));
    if (liked) return { uid: p.uid, itemId: p.itemId, reaction: "like", tag: liked };
    return { uid: p.uid, itemId: p.itemId, reaction: "neutral" };
  });

  let score = 0;
  for (const visit of visits) {
    if (visit.reaction === "like") score += prefs.points.liked;
    if (visit.reaction === "dislike") score += prefs.points.disliked;
  }
  return { visits, score: Math.max(0, Math.min(MAX_SCORE, score)) };
}

/** Sends every knocked-over item (and anything sitting on it) back to the tray. */
export function applyKnockovers(state: RoomState, review: Review): RoomState {
  return review.visits
    .filter((visit) => visit.reaction === "dislike")
    .reduce((next, visit) => removeToTray(next, visit.uid), state);
}

/** Hearts out of 5, in half-heart steps. */
export function heartsFor(score: number): number {
  return Math.round(score / 10) / 2;
}

/**
 * The cat walks left to right. Items are visited by the x of their center; at the same x it
 * checks the floor first and looks up last.
 */
export function visitOrder(catalog: Catalog, state: RoomState): Placement[] {
  const byUid = new Map(state.placements.map((p) => [p.uid, p]));
  const position = (p: Placement): { x: number; rank: number } => {
    if (p.layer !== "surface") {
      const rank = { rug: 0, floor: 1, wall: 3 }[p.layer];
      return { x: p.col + catalog[p.itemId].width / 2, rank };
    }
    const host = byUid.get(p.hostUid);
    if (!host || host.layer === "surface") return { x: Infinity, rank: 0 };
    return { x: host.col + p.slot + 0.5, rank: host.layer === "wall" ? 4 : 2 };
  };
  return [...state.placements].sort((a, b) => {
    const pa = position(a);
    const pb = position(b);
    return pa.x - pb.x || pa.rank - pb.rank;
  });
}

export function spotOf(state: RoomState, p: Placement): Spot {
  if (p.layer !== "surface") return p.layer;
  const host = state.placements.find((h) => h.uid === p.hostUid);
  return host?.layer === "wall" ? "high" : "low";
}
