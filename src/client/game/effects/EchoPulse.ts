import * as Phaser from 'phaser';

export const emitEchoRing = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  reducedMotion: boolean
): void => {
  const ring = scene.add
    .circle(x, y, reducedMotion ? radius * 0.55 : 14)
    .setStrokeStyle(2, 0x9bffe6, 0.9)
    .setFillStyle(0x4ee6cc, 0.025)
    .setDepth(20);

  if (reducedMotion) {
    scene.time.delayedCall(230, () => ring.destroy());
    return;
  }

  scene.tweens.add({
    targets: ring,
    scale: radius / 14,
    alpha: 0,
    duration: 920,
    ease: 'Sine.Out',
    onComplete: () => ring.destroy(),
  });
};

