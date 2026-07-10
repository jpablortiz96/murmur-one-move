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

  const draw = (): void => {
    background.clear();
    background
      .fillStyle(selected ? 0x164b4d : 0x071d22, enabled ? 0.88 : 0.48)
      .fillRoundedRect(-width / 2, -height / 2, width, height, 18)
      .lineStyle(selected ? 2 : 1, selected ? 0xa8ffe8 : 0x4b9e98, enabled ? 0.9 : 0.25)
      .strokeRoundedRect(-width / 2, -height / 2, width, height, 18);
    label.setAlpha(enabled ? 1 : 0.42);
    label.setText(`${selected ? '◆ ' : ''}${labelText}`);
  };

  container.on('pointerdown', () => {
    if (enabled) onActivate();
  });
  container.on('pointerover', () => {
    if (enabled && !selected) background.setAlpha(0.78);
  });
  container.on('pointerout', () => background.setAlpha(1));
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

