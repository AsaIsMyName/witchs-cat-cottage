// Decor catalog. Adding an item means adding a row here, not editing scene code.

import type { TaggedItem } from "../logic/cat";
import type { StandingItem } from "../logic/stand";

export interface ItemDef extends TaggedItem, StandingItem {
  name: string;
  /** Texture key. Until that sprite exists, the item draws as a labeled rectangle in `color`. */
  spriteId: string;
  color: number;
  /**
   * Floor items only: how many tiles the item stands above its footprint in the ¾ view (see
   * src/logic/stand.ts). Its top face is the footprint lifted by this much, and its front face
   * fills the gap, so a 1×1 cauldron at 1 draws two tiles tall. Missing means flat, like a rug.
   * Wall items fill their slot (a shelf draws as a ledge), and surface items have a fixed size.
   */
  standHeight?: number;
}

export const ITEMS: ItemDef[] = [
  { id: "frame", name: "frame", layer: "wall", width: 1, height: 1, tags: ["cozy"], spriteId: "frame", color: 0xc9a66b },
  {
    id: "moon-chart",
    name: "moon chart",
    layer: "wall",
    width: 1,
    height: 1,
    tags: ["spooky"],
    spriteId: "moon-chart",
    color: 0x4b5d9e,
  },
  {
    id: "shelf",
    name: "shelf",
    layer: "wall",
    width: 1,
    height: 1,
    hasSurface: true,
    tags: ["tall"],
    spriteId: "shelf",
    color: 0x8b5e3c,
  },
  { id: "clock", name: "clock", layer: "wall", width: 1, height: 1, tags: ["shiny"], spriteId: "clock", color: 0xb8a77e },
  {
    id: "table",
    name: "table",
    layer: "floor",
    width: 2,
    height: 1,
    hasSurface: true,
    standHeight: 0.75,
    tags: ["cozy"],
    spriteId: "table",
    color: 0x7a4e2d,
  },
  {
    id: "stool",
    name: "stool",
    layer: "floor",
    width: 1,
    height: 1,
    hasSurface: true,
    standHeight: 0.6,
    tags: ["cozy"],
    spriteId: "stool",
    color: 0x9c6b3f,
  },
  { id: "rug", name: "rug", layer: "rug", width: 2, height: 1, tags: ["soft", "cozy"], spriteId: "rug", color: 0xa34a5e },
  {
    id: "cauldron",
    name: "cauldron",
    layer: "floor",
    width: 1,
    height: 1,
    standHeight: 1,
    tags: ["warm", "spooky"],
    spriteId: "cauldron",
    color: 0x55556a,
  },
  {
    id: "candle",
    name: "candle",
    layer: "surface",
    width: 1,
    height: 1,
    tags: ["warm", "shiny"],
    spriteId: "candle",
    color: 0xe8c35a,
  },
  {
    id: "potion",
    name: "potion",
    layer: "surface",
    width: 1,
    height: 1,
    tags: ["shiny", "fragile"],
    spriteId: "potion",
    color: 0x5fb98a,
  },
];

export const CATALOG: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((item) => [item.id, item]));

/** What the player owns at the start: one of each item, plus extras of the small things that go on surfaces. */
export const STARTING_INVENTORY: Record<string, number> = {
  ...Object.fromEntries(ITEMS.map((item) => [item.id, 1])),
  shelf: 2,
  candle: 2,
  potion: 2,
};
