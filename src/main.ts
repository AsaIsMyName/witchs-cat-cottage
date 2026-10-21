import * as Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 640,
  height: 480,
  backgroundColor: "#2b2540",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene],
});
