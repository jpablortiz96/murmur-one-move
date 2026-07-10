import * as Phaser from 'phaser';

export type WorldButton = {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  setSelected: (selected: boolean) => void;
  setEnabled: (enabled: boolean) => void;
};

export const createWorldButton = (
  scene: Phaser.Scene,
  labelText: string,
  width: number,
  onActivate: () => void
): WorldButton => {
  const height = 48;
  const background = scene.add.graphics();
  const label = scene.add
    .text(0, 0, labelText, {
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
      fontSize: '13px',
      color: '#dffff7',
      letterSpacing: 1.5,
      align: 'center',
    })
    .setOrigin(0.5);
  const container = scene.add.container(0, 0, [background, label]).setDepth(60);
  container.setSize(width, height).setInteractive({ useHandCursor: true });

  let selected = false;
  let enabled = true;
  let hovered = false;
  let pressed = false;

  const draw = (): void => {
    const lineColor = selected ? 0xa8ffe8 : hovered ? 0x75d8c8 : 0x4b9e98;
    background.clear();
    background
      .fillStyle(selected ? 0x164b4d : 0x071d22, enabled ? (hovered ? 0.94 : 0.8) : 0.42)
      .fillEllipse(0, 0, width - (pressed ? 4 : 0), height - 7)
      .lineStyle(selected ? 2 : 1, lineColor, enabled ? 0.86 : 0.24)
      .strokeEllipse(0, 0, width - (pressed ? 4 : 0), height - 7)
      .beginPath()
      .moveTo(-width / 2 + 13, -13)
      .lineTo(-width / 2 + 7, 0)
      .lineTo(-width / 2 + 13, 13)
      .strokePath()
      .beginPath()
      .moveTo(width / 2 - 13, -13)
      .lineTo(width / 2 - 7, 0)
      .lineTo(width / 2 - 13, 13)
      .strokePath();
    label.setAlpha(enabled ? 1 : 0.42);
    label.setText(`${selected ? '◆ ' : ''}${labelText}`);
  };

  container.on('pointerdown', () => {
    if (!enabled) return;
    pressed = true;
    draw();
  });
  container.on('pointerover', () => {
    hovered = true;
    draw();
  });
  container.on('pointerout', () => {
    hovered = false;
    pressed = false;
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
    background,
    label,
    setSelected: (value: boolean) => {
      selected = value;
      draw();
    },
    setEnabled: (value: boolean) => {
      enabled = value;
      container.input!.enabled = value;
      draw();
    },
  };
};
