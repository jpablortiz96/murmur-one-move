import * as Phaser from 'phaser';
import type { Direction } from '../../../shared/types/game';

export type SignalNode = {
  container: Phaser.GameObjects.Container;
  resonate: () => void;
  setDimmed: (dimmed: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  setSelected: (selected: boolean) => void;
};

export const createSignalNode = (
  scene: Phaser.Scene,
  direction: Direction,
  reducedMotion: boolean,
  onActivate: () => void
): SignalNode => {
  const width = 82;
  const height = 62;
  const rune = scene.add.graphics();
  const label = scene.add
    .text(0, 1, direction.toUpperCase(), {
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
      fontSize: '12px',
      color: '#d7fff5',
      letterSpacing: 1.2,
      align: 'center',
    })
    .setOrigin(0.5);
  const container = scene.add.container(0, 0, [rune, label]).setDepth(60);
  container.setSize(width, height).setInteractive({ useHandCursor: true });

  let selected = false;
  let enabled = true;
  let dimmed = false;
  let hovered = false;
  let pressed = false;

  const draw = (): void => {
    const active = enabled && !dimmed;
    const lineColor = selected ? 0xc6fff0 : hovered ? 0x8eead6 : 0x4eaaa2;
    const lineAlpha = selected ? 0.98 : active ? 0.68 : 0.25;
    const fillAlpha = selected ? 0.28 : hovered ? 0.2 : 0.11;
    const squeeze = pressed ? 2 : 0;

    rune.clear();
    rune
      .fillStyle(selected ? 0x164b4b : 0x071b20, fillAlpha)
      .fillEllipse(0, 0, 72 - squeeze, 42 - squeeze)
      .lineStyle(selected ? 2 : 1, lineColor, lineAlpha)
      .strokeEllipse(0, 0, 72 - squeeze, 42 - squeeze)
      .lineStyle(1, lineColor, lineAlpha * 0.55)
      .beginPath()
      .moveTo(-31, -16)
      .lineTo(-37, -7)
      .lineTo(-37, 6)
      .strokePath()
      .beginPath()
      .moveTo(31, 16)
      .lineTo(37, 7)
      .lineTo(37, -6)
      .strokePath()
      .fillStyle(lineColor, lineAlpha)
      .fillCircle(-39, 0, 2)
      .fillCircle(39, 0, 2);

    if (selected) {
      rune
        .lineStyle(2, 0xbaffeb, 0.88)
        .strokeEllipse(0, 0, 80, 52)
        .fillStyle(0xdffff7, 0.95)
        .fillTriangle(0, -31, 5, -25, -5, -25);
    }

    label.setText(`${selected ? '◆ ' : ''}${direction.toUpperCase()}`);
    label.setAlpha(dimmed ? 0.38 : enabled || selected ? 1 : 0.48);
  };

  const resonate = (): void => {
    const resonance = scene.add
      .ellipse(container.x, container.y, 64, 40)
      .setStrokeStyle(2, 0xa8ffe7, 0.8)
      .setDepth(55);
    if (reducedMotion) {
      scene.time.delayedCall(140, () => resonance.destroy());
      return;
    }
    scene.tweens.add({
      targets: resonance,
      scaleX: 1.45,
      scaleY: 1.35,
      alpha: 0,
      duration: 320,
      ease: 'Sine.Out',
      onComplete: () => resonance.destroy(),
    });
  };

  container.on('pointerover', () => {
    hovered = true;
    draw();
  });
  container.on('pointerout', () => {
    hovered = false;
    pressed = false;
    draw();
  });
  container.on('pointerdown', () => {
    if (!enabled) return;
    pressed = true;
    draw();
  });
  container.on('pointerup', () => {
    if (!enabled) return;
    pressed = false;
    draw();
    onActivate();
  });
  draw();

  return {
    container,
    resonate,
    setDimmed: (value: boolean) => {
      dimmed = value;
      draw();
    },
    setEnabled: (value: boolean) => {
      enabled = value;
      if (container.input) container.input.enabled = value;
      draw();
    },
    setSelected: (value: boolean) => {
      selected = value;
      draw();
    },
  };
};

