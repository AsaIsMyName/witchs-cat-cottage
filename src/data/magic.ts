// Look and pacing of the magic inventory's portal effects (see CLAUDE.md, "Magic inventory and portals").
// Effects are visual only and never delay a drag or a drop.

/** Durations in milliseconds. Sizes are in tiles (the scene scales them by its tile size); line widths are in px. */
export const MAGIC_FX = {
  /** Summon: a glowing ring opens at the item's spot in the inventory, then fades and shrinks out. */
  portal: {
    duration: 280,
    radius: 0.45,
    /** Rings are drawn as ellipses this much flatter than they are wide. */
    squash: 0.55,
    endScale: 0.25,
    colors: [0xc9a0ff, 0xf3d27a],
    lineWidth: 2,
  },
  /** Summon: the picked-up item pops from this scale to full size. */
  pop: { from: 0.85, duration: 120 },
  /** Land: small four-point stars fly out from the item and fade. */
  sparkle: {
    duration: 360,
    count: 6,
    distance: 0.55,
    size: 0.11,
    colors: [0xf3d27a, 0xffffff, 0xc9a0ff],
  },
  /** Send back: a copy of the item spins and shrinks into a small swirl, then vanishes. */
  sendBack: {
    duration: 360,
    /** Full turns the item spins while it shrinks. */
    turns: 1.25,
    swirlRadius: 0.3,
    swirlColor: 0xc9a0ff,
  },
};
