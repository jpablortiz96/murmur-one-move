import * as Phaser from 'phaser';
import type { LayoutMetrics } from '../config/layout';

const PULSE_COLORS = [0x9bffe6, 0x76efcf, 0xb9ffe7] as const;

export const emitEchoWave = (
  scene: Phaser.Scene,
  metrics: LayoutMetrics,
  pulseNumber: number,
  reducedMotion: boolean
): void => {
  const pulseIndex = Math.max(0, Math.min(PULSE_COLORS.length - 1, pulseNumber - 1));
  const color = PULSE_COLORS[pulseIndex] ?? PULSE_COLORS[0];
  const { centerX, centerY, worldBounds } = metrics;
  const reach = 0.78 + pulseIndex * 0.08;

  const nearPulse = scene.add
    .ellipse(centerX, centerY, 58, 48)
    .setStrokeStyle(2, color, 0.82)
    .setDepth(12);
  const mainWave = scene.add.graphics().setPosition(centerX, centerY).setDepth(-6);
  mainWave
    .lineStyle(2, color, 0.48)
    .beginPath()
    .arc(0, 0, 34, -2.72, -0.42)
    .strokePath()
    .beginPath()
    .arc(0, 0, 34, 0.12, 1.62)
    .strokePath()
    .beginPath()
    .arc(0, 0, 34, 1.92, 2.66)
    .strokePath();
  const echoA = scene.add
    .ellipse(
      centerX + (metrics.pathNodes.east.x - centerX) * 0.68,
      metrics.pathNodes.east.y,
      32,
      46
    )
    .setStrokeStyle(1, color, pulseNumber === 2 ? 0.7 : 0.3)
    .setDepth(-6);
  const echoB = scene.add
    .ellipse(
      centerX + (metrics.pathNodes.east.x - centerX) * 0.82,
      metrics.pathNodes.east.y,
      24,
      38
    )
    .setStrokeStyle(1, color, pulseNumber === 2 ? 0.55 : 0.22)
    .setDepth(-6);

  if (reducedMotion) {
    mainWave.setScale(
      (worldBounds.width * reach) / 68,
      (worldBounds.height * 0.62) / 68
    );
    scene.time.delayedCall(220, () => {
      nearPulse.destroy();
      mainWave.destroy();
      echoA.destroy();
      echoB.destroy();
    });
    return;
  }

  scene.tweens.add({
    targets: nearPulse,
    scaleX: 1.7,
    scaleY: 1.55,
    alpha: 0,
    duration: 360,
    ease: 'Sine.Out',
    onComplete: () => nearPulse.destroy(),
  });
  scene.tweens.add({
    targets: mainWave,
    scaleX: (worldBounds.width * reach) / 68,
    scaleY: (worldBounds.height * (0.58 + pulseIndex * 0.035)) / 68,
    alpha: 0,
    duration: 780 + pulseIndex * 70,
    ease: 'Sine.Out',
    onComplete: () => mainWave.destroy(),
  });
  scene.tweens.add({
    targets: [echoA, echoB],
    scaleX: 1.5,
    scaleY: 1.25,
    alpha: 0,
    duration: 520,
    delay: pulseNumber === 2 ? 140 : 220,
    ease: 'Sine.Out',
    onComplete: () => {
      echoA.destroy();
      echoB.destroy();
    },
  });
};
