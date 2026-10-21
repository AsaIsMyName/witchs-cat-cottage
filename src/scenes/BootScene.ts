import * as Phaser from "phaser";

// Loads shared assets (none yet), then hands off to the first game scene.
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    this.scene.start("Decorate");
  }
}
