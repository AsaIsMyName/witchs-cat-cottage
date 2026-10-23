// Dev-only hook for `npm run shots` (scripts/shots.mjs). Installed only under `import.meta.env.DEV`,
// so the Pages build leaves it out. Points are in game pixels, which the script's 960×540 viewport
// maps 1:1 to the page.

import type * as Phaser from "phaser";
import type { Facing } from "../logic/cat";
import type { GridLayer } from "../logic/grid";
import type { CatActor } from "./cat-actor";
import { gridToWorld, type ItemView } from "./room-view";

/** Where an item's footprint starts (`x`, `y`), and a point on its front face to grab it by. */
interface ViewPoints {
  x: number;
  y: number;
  grabX: number;
  grabY: number;
}

export function installShotHook(
  scene: Phaser.Scene,
  cat: CatActor,
  placedView: (uid: string) => ItemView | undefined,
  trayView: (itemId: string) => ItemView | undefined,
): void {
  const points = (view: ItemView | undefined): ViewPoints | null =>
    view ? { x: view.x, y: view.y, grabX: view.centerX, grabY: view.y + view.box.y + view.box.h - 4 } : null;
  (window as unknown as { __shots: unknown }).__shots = {
    pinCat: (facing: Facing, col: number, row: number) => cat.pin(facing, col, row),
    placed: (uid: string) => points(placedView(uid)),
    tray: (itemId: string) => points(trayView(itemId)),
    tile: (layer: GridLayer, col: number, row: number) => gridToWorld({ layer, col, row }),
    settled: () => scene.tweens.getTweens().length === 0,
  };
}
