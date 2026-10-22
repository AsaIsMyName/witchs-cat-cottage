import * as Phaser from "phaser";
import { CAT_HINTS, CAT_NAME, CAT_PREFS } from "../data/cat";
import { CATALOG } from "../data/items";
import { MAX_SCORE, applyKnockovers, heartsFor, reviewRoom, type Review, type Visit } from "../logic/cat";
import { surfaceItemsOn, type RoomState } from "../logic/grid";
import { loadRoom, saveRoom } from "./room-store";
import {
  GAME_WIDTH,
  ItemView,
  ROOM_BOTTOM,
  ROOM_X,
  TEXT_LIGHT,
  TEXT_MUTED,
  TRAY_Y,
  drawRoom,
  layoutPlacements,
  textStyle,
} from "./room-view";

const CAT_W = 34;
const CAT_H = 22;
const CAT_SPEED = 220; // px per second
const PAUSE_MS = 650;
const FAST_FORWARD = 3;

const DEPTH_CAT = 900;
const DEPTH_BUBBLE = 950;
const COLOR_CAT = 0x8a6fbf;
const COLOR_OUTLINE = 0x1e1a2b;
const COLOR_HEART = "#f28fb0";
const COLOR_BUTTON = "#3d3357";

/** The cat walks the room left to right, reacts to each item, then shows its happiness. */
export class CatReviewScene extends Phaser.Scene {
  private cat!: Phaser.GameObjects.Container;
  private bubble!: Phaser.GameObjects.Text;
  private views = new Map<string, ItemView>();

  constructor() {
    super("CatReview");
  }

  create(): void {
    // Scene plugins persist across restarts, so undo any fast-forward from the last review.
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;

    const state = loadRoom();
    drawRoom(this);
    this.views = layoutPlacements(state, (def) => new ItemView(this, def));

    this.cat = this.add
      .container(ROOM_X - CAT_W, ROOM_BOTTOM - 3, [
        this.add.rectangle(0, 0, CAT_W, CAT_H, COLOR_CAT).setOrigin(0.5, 1).setStrokeStyle(2, COLOR_OUTLINE),
        this.add.text(0, -CAT_H / 2, "cat", textStyle(9)).setOrigin(0.5),
      ])
      .setDepth(DEPTH_CAT);
    this.bubble = this.add
      .text(0, 0, "", { ...textStyle(10, "#1e1a2b"), backgroundColor: TEXT_LIGHT, padding: { x: 6, y: 3 } })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_BUBBLE)
      .setVisible(false);

    const status = this.add.text(10, TRAY_Y + 8, `${CAT_NAME} is looking around…`, textStyle(11, TEXT_MUTED));
    const speedUp = this.add
      .text(GAME_WIDTH - 10, TRAY_Y + 4, "speed up ▶▶", textStyle(10, TEXT_MUTED))
      .setOrigin(1, 0)
      .setPadding(6, 4, 6, 4)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => {
        this.tweens.timeScale = FAST_FORWARD;
        this.time.timeScale = FAST_FORWARD;
        speedUp.setVisible(false);
      });

    void this.runReview(state).then((review) => {
      status.destroy();
      speedUp.destroy();
      this.showResult(review);
    });
  }

  private async runReview(state: RoomState): Promise<Review> {
    const review = reviewRoom(CATALOG, state, CAT_PREFS);
    if (review.visits.length === 0) {
      await this.walkTo(GAME_WIDTH / 2);
      this.say(CAT_HINTS.emptyRoom);
      await this.wait(1500);
    }
    for (const visit of review.visits) {
      const view = this.views.get(visit.uid);
      if (!view) continue;
      this.bubble.setVisible(false);
      await this.walkTo(view.centerX);
      await this.react(visit, view, state);
      await this.wait(PAUSE_MS);
    }
    this.bubble.setVisible(false);
    saveRoom(applyKnockovers(state, review));
    return review;
  }

  private async react(visit: Visit, view: ItemView, state: RoomState): Promise<void> {
    const tag = visit.tag ?? "";
    if (visit.reaction === "like") {
      this.say(CAT_HINTS.like[tag] ?? CAT_HINTS.likeDefault);
      this.floatHeart(view);
      await this.tween({ targets: this.cat, y: this.cat.y - 12, duration: 140, yoyo: true, repeat: 1, ease: "Quad.easeOut" });
    } else if (visit.reaction === "neutral") {
      this.say(CAT_HINTS.neutral);
      await this.tween({ targets: this.cat, x: this.cat.x + 3, duration: 80, yoyo: true, repeat: 2 });
    } else {
      this.say(CAT_HINTS.dislike[tag] ?? CAT_HINTS.dislikeDefault);
      const riders = surfaceItemsOn(state, visit.uid).flatMap((p) => this.views.get(p.uid) ?? []);
      await Promise.all([view, ...riders].map((v) => this.knockOff(v)));
    }
  }

  /** The item tumbles to the floor and fades; it goes back to the tray when the review is saved. */
  private async knockOff(view: ItemView): Promise<void> {
    const startY = view.y;
    const endY = view.footprintYForBottom(ROOM_BOTTOM - 2);
    view.setDepth(DEPTH_CAT - 1);
    await this.counter(0, 1, 500, "Bounce.easeOut", (t) => view.setPosition(view.x, startY + (endY - startY) * t));
    await this.counter(1, 0.3, 400, "Linear", (alpha) => view.setAlpha(alpha));
  }

  private floatHeart(view: ItemView): void {
    const heart = this.add
      .text(view.centerX, view.top - 2, "♥", textStyle(16, COLOR_HEART))
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_BUBBLE);
    this.tweens.add({ targets: heart, y: heart.y - 24, alpha: 0, duration: 900, onComplete: () => heart.destroy() });
  }

  private say(text: string): void {
    this.bubble.setText(text).setVisible(true);
    const half = this.bubble.width / 2;
    this.bubble.setPosition(Phaser.Math.Clamp(this.cat.x, half + 4, GAME_WIDTH - half - 4), ROOM_BOTTOM - CAT_H - 8);
  }

  private walkTo(x: number): Promise<void> {
    const distance = Math.abs(x - this.cat.x);
    if (distance < 1) return Promise.resolve();
    return this.tween({ targets: this.cat, x, duration: (distance / CAT_SPEED) * 1000, ease: "Linear" });
  }

  private showResult(review: Review): void {
    const hearts = heartsFor(review.score);
    const top = TRAY_Y + 8;
    for (let i = 0; i < 5; i++) {
      const fill = Math.max(0, Math.min(1, hearts - i));
      this.add
        .text(14 + i * 22, top, fill > 0 ? "♥" : "♡", textStyle(20, fill > 0 ? COLOR_HEART : TEXT_MUTED))
        .setAlpha(fill === 0.5 ? 0.45 : 1);
    }

    const count = (reaction: Visit["reaction"]) => review.visits.filter((v) => v.reaction === reaction).length;
    const knocked = count("dislike");
    this.add.text(14, top + 32, `happiness ${review.score}/${MAX_SCORE}`, textStyle(11, TEXT_LIGHT));
    const summary = `liked ${count("like")} · sniffed ${count("neutral")} · knocked over ${knocked}`;
    this.add.text(14, top + 50, summary, textStyle(10, TEXT_MUTED));
    if (knocked > 0) this.add.text(14, top + 66, "knocked-over items are back in the tray", textStyle(10, TEXT_MUTED));

    this.add
      .text(GAME_WIDTH - 10, top, "◀ keep decorating", textStyle(11, TEXT_LIGHT))
      .setOrigin(1, 0)
      .setPadding(8, 6, 8, 6)
      .setBackgroundColor(COLOR_BUTTON)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.scene.start("Decorate"));
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ ...config, onComplete: () => resolve() }));
  }

  private counter(from: number, to: number, duration: number, ease: string, onUpdate: (value: number) => void): Promise<void> {
    return new Promise((resolve) =>
      this.tweens.addCounter({
        from,
        to,
        duration,
        ease,
        onUpdate: (tween) => onUpdate(tween.getValue() ?? to),
        onComplete: () => resolve(),
      }),
    );
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, () => resolve()));
  }
}
