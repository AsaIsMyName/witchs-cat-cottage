// Portal effects for the magic inventory. Visual only: nothing here touches room state, and
// every object is destroyed when its tween completes.

import * as Phaser from "phaser";
import { MAGIC_FX } from "../data/magic";
import { itemGhost, type ItemView } from "./room-view";

/** Above the room and the cat's bubbles, under the drop highlight and the dragged item. */
const DEPTH_FX = 990;
/** Landing sparkles draw over the item that just landed. */
const DEPTH_SPARKLE = 1005;

/** Runs `onUpdate(t)` with t going 0 → 1 over `duration`, then `onComplete`. */
function animate(
  scene: Phaser.Scene,
  duration: number,
  onUpdate: (t: number) => void,
  onComplete: () => void,
): Phaser.Tweens.Tween {
  const progress = { t: 0 };
  return scene.tweens.add({
    targets: progress,
    t: 1,
    duration,
    onUpdate: () => onUpdate(progress.t),
    onComplete,
  });
}

/** Summon: a glowing ring opens at (x, y), then fades and shrinks out. */
export function openPortal(scene: Phaser.Scene, x: number, y: number): void {
  const { duration, radius, squash, endScale, colors, lineWidth } = MAGIC_FX.portal;
  const rings = colors.map((color, i) => {
    const r = radius * (1 - i * 0.3);
    return scene.add
      .ellipse(x, y, r * 2, r * 2 * squash)
      .setStrokeStyle(lineWidth, color, 1)
      .setDepth(DEPTH_FX);
  });
  const OPEN = 0.3; // fraction of the time spent opening
  animate(
    scene,
    duration,
    (t) => {
      const opening = t < OPEN;
      const k = opening ? t / OPEN : (t - OPEN) / (1 - OPEN);
      const scale = opening ? 0.5 + 0.5 * k : 1 - (1 - endScale) * k;
      for (const ring of rings) ring.setScale(scale).setAlpha(opening ? 1 : 1 - k);
    },
    () => rings.forEach((ring) => ring.destroy()),
  );
}

/**
 * Summon: the item pops from slightly small to full size, around its visual center. Only the
 * drawing scales, so the view's x and y (and the drop math that reads them) are untouched.
 */
export function popIn(scene: Phaser.Scene, view: ItemView): void {
  const { from, duration } = MAGIC_FX.pop;
  view.setScale(from);
  animate(
    scene,
    duration,
    (t) => {
      if (view.alive) view.setScale(from + (1 - from) * t);
    },
    () => {
      if (view.alive) view.setScale(1);
    },
  );
}

/** Land: a few small stars fly out from (x, y) and fade. */
export function sparkle(scene: Phaser.Scene, x: number, y: number): void {
  const { duration, count, distance, size, colors } = MAGIC_FX.sparkle;
  const offset = Math.random() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const angle = offset + (i / count) * Math.PI * 2;
    const star = scene.add
      .star(x, y, 4, size * 0.35, size, colors[i % colors.length])
      .setDepth(DEPTH_SPARKLE);
    scene.tweens.add({
      targets: star,
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
      alpha: 0,
      scale: 0.4,
      angle: 90,
      duration,
      ease: "Quad.easeOut",
      onComplete: () => star.destroy(),
    });
  }
}

/**
 * Send back: a copy of `view` spins and shrinks into a small swirl, then vanishes. The copy is
 * its own object, so it outlives the re-render that destroys `view`.
 */
export function sendBack(scene: Phaser.Scene, view: ItemView): void {
  const { duration, turns, swirlRadius, swirlColor } = MAGIC_FX.sendBack;
  const ghost = itemGhost(scene, view).setDepth(DEPTH_FX);
  const swirl = scene.add
    .ellipse(ghost.x, ghost.y, swirlRadius * 2, swirlRadius)
    .setStrokeStyle(2, swirlColor, 1)
    .setDepth(DEPTH_FX + 1)
    .setScale(0.3);
  animate(
    scene,
    duration,
    (t) => {
      ghost.setScale(1 - t).setAngle(360 * turns * t).setAlpha(1 - t * t);
      // The swirl grows in as the item shrinks, then fades out at the end.
      swirl.setScale(0.3 + 0.7 * Math.min(1, t * 2)).setAngle(-360 * t).setAlpha(t < 0.6 ? 1 : (1 - t) / 0.4);
    },
    () => {
      ghost.destroy();
      swirl.destroy();
    },
  );
}
