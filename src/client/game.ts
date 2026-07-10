import * as Phaser from 'phaser';
import { BootstrapScene } from './game/scenes/BootstrapScene';
import { getSceneSettings, MurmurScene } from './game/scenes/MurmurScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#050b0e',
  transparent: false,
  render: {
    antialias: true,
    roundPixels: false,
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 360,
    height: 800,
  },
  scene: [BootstrapScene, MurmurScene],
  callbacks: {
    preBoot: (game) => {
      game.registry.set('settings', getSceneSettings());
    },
  },
};

document.addEventListener('DOMContentLoaded', () => {
  new Phaser.Game(config);
});
