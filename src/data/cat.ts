// The cat's preferences, scoring, and hint lines. Fixed in v1 (see CLAUDE.md).

import type { CatPrefs } from "../logic/cat";

/** Shown in text. Unnamed for now. */
export const CAT_NAME = "the cat";

export const CAT_PREFS: CatPrefs = {
  likes: ["soft", "warm", "shiny"],
  dislikes: [{ tag: "fragile", on: ["high"] }],
  points: { liked: 15, disliked: -20 },
};

/** What the cat "says" for each reaction, keyed by the tag behind it. */
export const CAT_HINTS = {
  like: {
    soft: "so soft… purr",
    warm: "toasty… purr",
    shiny: "ooh, shiny!",
  } as Record<string, string>,
  likeDefault: "purr",
  neutral: "sniff sniff.",
  dislike: {
    fragile: "mrrp… too wobbly up there!",
  } as Record<string, string>,
  dislikeDefault: "hss!",
  emptyRoom: "yawn… nothing to look at.",
};
