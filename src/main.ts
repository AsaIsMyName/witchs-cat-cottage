import * as Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { DecorateScene } from "./scenes/DecorateScene";
import { GAME_HEIGHT, GAME_WIDTH } from "./scenes/room-view";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#1e1a2b",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, DecorateScene],
});
