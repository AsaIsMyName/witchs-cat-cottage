// The ambient cat's reactions, idle habits, and pacing. Fixed in v1 (see CLAUDE.md).

import type { CatBehavior, IdleAction, Reaction } from "../logic/cat";

/** Shown in text. Unnamed for now. */
export const CAT_NAME = "the cat";

export const CAT_BEHAVIOR: CatBehavior = {
  rules: [
    { reaction: "nap", tags: ["soft"] },
    { reaction: "paw-up", tags: ["shiny", "fragile"], on: ["high", "wall"] },
    { reaction: "warm", tags: ["warm"] },
    { reaction: "bat", tags: ["shiny"] },
    { reaction: "loaf", hasSurface: true, on: ["floor"] },
    { reaction: "stare", tags: ["spooky"] },
  ],
  cozyReactions: ["nap", "warm", "loaf"],
  cozyChance: 0.5,
};

/** What the cat "says" for each reaction. */
export const REACTION_LINES: Record<Reaction, string> = {
  nap: "zzz…",
  "paw-up": "mrrp!",
  warm: "purr…",
  bat: "*bat bat*",
  loaf: "…",
  stare: "!?",
  sniff: "sniff sniff",
};

export const IDLE_LINES: Record<IdleAction, string> = {
  sit: "",
  groom: "lick lick",
  nap: "zzz…",
};

export const PET_LINE = "purr purr";

/** The one offended moment: its rug was pulled out from under a nap. Quiet, and never about the item. */
export const OFFENDED_LINE = "mrr.";

/** Pacing, in milliseconds unless noted. */
export const CAT_TIMING = {
  walkSpeed: 90, // px per second
  /** Crossing furniture with a top: slower up there, a short arcing hop on and off. */
  topWalkSpeed: 60, // px per second
  hop: 400,
  /** Hopping straight down because its perch was moved or removed. */
  hopDown: 350,
  hopArc: 6, // px the cat rises above a straight line mid-hop
  /** Route cost (in steps) of each hop up onto furniture, so the cat prefers walking around. */
  climbCost: 4,
  /** Extra route cost of hopping on or off from behind or in front, so it prefers the side. */
  frontBackHopCost: 0.5,
  noticeDelay: [800, 1800],
  reactionLength: 2200,
  napLength: [4000, 7000],
  idleGap: [1500, 4000],
  /** Petted on the move: it slows to this fraction of its speed, holds it, then eases back to full speed. */
  petSlowdown: 0.4,
  petSlowFor: 1000,
  petEaseBack: 400,
  /** Rug pulled out from under a nap: sits up, one slow blink, "mrr.", a tail flick, then carries on. */
  offendedBlink: 700,
  offendedLength: 2200,
};
