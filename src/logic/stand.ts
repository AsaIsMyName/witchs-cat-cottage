// How floor and rug items stand in the ¾ view: drawn height is separate from footprint. No Phaser.
//
// The floor is seen from above, so a footprint shows as its own tiles. An item's top face is its
// footprint lifted up the screen by its stand height, and its front face fills the gap back down
// to the footprint's front edge. That front edge is its bottom edge, which sets the draw order.

import type { Layer } from "./grid";

export interface StandingItem {
  layer: Layer;
  /** Footprint depth in tiles (rows). */
  height: number;
  /** Floor items only: how many tiles the item stands above its footprint. Missing means flat. */
  standHeight?: number;
}

/** A floor or rug item's drawn shape, in tiles, measured down from its footprint's top edge. */
export interface StandShape {
  /** Top of the drawing: negative when the item rises over the rows behind it. */
  top: number;
  /** Depth of the lighter top face, from `top`. */
  topFace: number;
  /** Height of the darker front face, under the top face. */
  frontFace: number;
  /** Bottom of the drawing: the footprint's front edge. */
  bottom: number;
}

export function standShape(item: StandingItem): StandShape {
  // Rugs lie flat under everything; only floor items stand up.
  const stand = item.layer === "floor" ? Math.max(0, item.standHeight ?? 0) : 0;
  return { top: stand > 0 ? -stand : 0, topFace: item.height, frontFace: stand, bottom: item.height };
}
