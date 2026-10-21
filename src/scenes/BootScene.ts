import * as Phaser from "phaser";

// Placeholder scene for milestone 0: proves the build runs and deploys.
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2 - 40, "Witch's Cat Cottage", {
        fontFamily: "monospace",
        fontSize: "32px",
        color: "#f3e6c4",
      })
      .setOrigin(0.5);

    // Stand-in for the cat until the sprite pack is chosen.
    this.add.rectangle(width / 2, height / 2 + 40, 48, 48, 0x8a6fbf);

    this.add
      .text(width / 2, height / 2 + 100, "milestone 0: setup", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#a89cc8",
      })
      .setOrigin(0.5);
  }
}
