// Decor catalog. Adding an item means adding a row here, not editing scene code.

import type { ItemShape } from "../logic/grid";

export interface ItemDef extends ItemShape {
  name: string;
  /** Texture key. Until that sprite exists, the item draws as a labeled rectangle in `color`. */
  spriteId: string;
  color: number;
  /** Drawn height as a fraction of the footprint, bottom-aligned. Floor and rug items default to 0.9; wall items fill their tile unless set. */
  visualHeight?: number;
}

export const ITEMS: ItemDef[] = [
  { id: "frame", name: "frame", layer: "wall", width: 1, height: 1, spriteId: "frame", color: 0xc9a66b },
  { id: "moon-chart", name: "moon chart", layer: "wall", width: 1, height: 1, spriteId: "moon-chart", color: 0x4b5d9e },
  { id: "shelf", name: "shelf", layer: "wall", width: 1, height: 1, hasSurface: true, visualHeight: 0.3, spriteId: "shelf", color: 0x8b5e3c },
  { id: "clock", name: "clock", layer: "wall", width: 1, height: 1, spriteId: "clock", color: 0xb8a77e },
  { id: "table", name: "table", layer: "floor", width: 2, height: 1, hasSurface: true, visualHeight: 0.6, spriteId: "table", color: 0x7a4e2d },
  { id: "stool", name: "stool", layer: "floor", width: 1, height: 1, hasSurface: true, visualHeight: 0.45, spriteId: "stool", color: 0x9c6b3f },
  { id: "rug", name: "rug", layer: "rug", width: 2, height: 1, visualHeight: 0.25, spriteId: "rug", color: 0xa34a5e },
  { id: "cauldron", name: "cauldron", layer: "floor", width: 1, height: 1, visualHeight: 0.7, spriteId: "cauldron", color: 0x55556a },
  { id: "candle", name: "candle", layer: "surface", width: 1, height: 1, spriteId: "candle", color: 0xe8c35a },
  { id: "potion", name: "potion", layer: "surface", width: 1, height: 1, spriteId: "potion", color: 0x5fb98a },
];

export const CATALOG: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((item) => [item.id, item]));

/** What the player owns at the start: one of each item, plus extras of the small things that go on surfaces. */
export const STARTING_INVENTORY: Record<string, number> = {
  ...Object.fromEntries(ITEMS.map((item) => [item.id, 1])),
  shelf: 2,
  candle: 2,
  potion: 2,
};
