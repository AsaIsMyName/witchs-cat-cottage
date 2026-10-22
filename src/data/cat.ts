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

/** The one grumpy moment: its rug was pulled out from under a nap. Mild, and never about the item. */
export const GRUMPY_LINE = "hmph!";

/** Pacing, in milliseconds unless noted. */
export const CAT_TIMING = {
  walkSpeed: 90, // px per second
  noticeDelay: [800, 1800],
  reactionLength: 2200,
  napLength: [4000, 7000],
  idleGap: [1500, 4000],
  grumpyLength: 1600,
};
