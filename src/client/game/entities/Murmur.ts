import * as Phaser from 'phaser';
import type { Direction } from '../../../shared/types/game';
import type { PublicMurmurState } from '../../../shared/contracts/expedition';

export class Murmur extends Phaser.GameObjects.Container {
  private readonly reducedMotion: boolean;
  private readonly form: Phaser.GameObjects.Container;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly silhouette: Phaser.GameObjects.Graphics;
  private readonly core: Phaser.GameObjects.Graphics;
  private readonly antennaLeft: Phaser.GameObjects.Graphics;
  private readonly antennaRight: Phaser.GameObjects.Graphics;
  private readonly conditionMarks: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, reducedMotion: boolean) {
    super(scene, 0, 0);
    this.reducedMotion = reducedMotion;
    this.form = scene.add.container(0, 0);
    this.glow = scene.add.graphics();
    this.silhouette = scene.add.graphics();
    this.core = scene.add.graphics();
    this.antennaLeft = scene.add.graphics().setPosition(-17, -16);
    this.antennaRight = scene.add.graphics().setPosition(17, -16);
    this.conditionMarks = scene.add.graphics();

    this.drawCreature();
    this.form.add([
      this.glow,
      this.silhouette,
      this.antennaLeft,
      this.antennaRight,
      this.core,
      this.conditionMarks,
    ]);
    this.add(this.form);
    this.setSize(88, 98).setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => this.touchReact());
    scene.add.existing(this);

    if (!reducedMotion) {
      this.startIdleMotion();
      this.startCoreIdle();
      this.startAntennaIdle();
    }
  }

  applyExpeditionState(state: PublicMurmurState): void {
    this.conditionMarks.clear();
    const vitalityAlpha = 0.48 + state.vitality * 0.14;
    this.core.setAlpha(vitalityAlpha);
    this.glow.setAlpha(0.035 + state.vitality * 0.018);
    if (state.scars.includes('fractured-shell')) {
      this.conditionMarks.lineStyle(2, 0xc5eae2, 0.72).beginPath()
        .moveTo(-22, -1).lineTo(-11, 7).lineTo(-18, 16).lineTo(-7, 25).strokePath();
    }
    if (state.scars.includes('thermal-burn')) {
      this.conditionMarks.lineStyle(2, 0xffb06f, 0.74)
        .strokeEllipse(16, 14, 17, 28)
        .fillStyle(0xffa56b, 0.42).fillCircle(22, 3, 2).fillCircle(25, 11, 1.6);
    }
    if (state.scars.includes('spore-mark')) {
      this.conditionMarks.fillStyle(0xb9db87, 0.76)
        .fillCircle(-25, 20, 2.3).fillCircle(-20, 28, 1.5).fillCircle(-28, 31, 1.2);
    }
    const fragments = Math.min(4, state.memoryFragments);
    for (let index = 0; index < fragments; index += 1) {
      const angle = -2.4 + index * 1.18;
      this.conditionMarks.fillStyle(0xd9fff5, 0.82)
        .fillTriangle(
          Math.cos(angle) * 43, Math.sin(angle) * 36 + 10,
          Math.cos(angle) * 43 - 3, Math.sin(angle) * 36 + 15,
          Math.cos(angle) * 43 + 3, Math.sin(angle) * 36 + 15
        );
    }
  }

  touchReact(): void {
    if (this.reducedMotion) {
      this.form.setScale(1.025, 0.98);
      this.scene.time.delayedCall(100, () => this.form.setScale(1));
      return;
    }
    this.scene.tweens.add({
      targets: this,
      y: this.y - 6,
      duration: 110,
      yoyo: true,
      ease: 'Quad.Out',
    });
  }

  echo(pulseNumber: number): void {
    this.scene.tweens.killTweensOf([this.core, this.antennaLeft, this.antennaRight]);
    if (this.reducedMotion) {
      this.core.setScale(1.15).setAlpha(1);
      this.antennaLeft.setAngle(-5);
      this.antennaRight.setAngle(5);
      this.scene.time.delayedCall(130, () => {
        this.core.setScale(1).setAlpha(0.86);
        this.antennaLeft.setAngle(0);
        this.antennaRight.setAngle(0);
      });
      return;
    }

    this.scene.tweens.add({
      targets: this.core,
      scale: 1.22 + pulseNumber * 0.05,
      alpha: 1,
      duration: 140,
      yoyo: true,
      ease: 'Sine.Out',
      onComplete: () => this.startCoreIdle(),
    });
    this.scene.tweens.add({
      targets: this.antennaLeft,
      angle: -7 - pulseNumber,
      y: this.antennaLeft.y - 3,
      duration: 130,
      yoyo: true,
      ease: 'Sine.Out',
      onComplete: () => this.startAntennaIdle(),
    });
    this.scene.tweens.add({
      targets: this.antennaRight,
      angle: 7 + pulseNumber,
      y: this.antennaRight.y - 3,
      duration: 130,
      yoyo: true,
      ease: 'Sine.Out',
    });
  }

  flinchDanger(): void {
    if (this.reducedMotion) {
      this.setScale(0.96, 1.04);
      this.scene.time.delayedCall(120, () => this.setScale(1));
      return;
    }
    this.scene.tweens.add({
      targets: this,
      scaleX: 0.94,
      scaleY: 1.055,
      x: 3,
      duration: 120,
      yoyo: true,
      ease: 'Quad.Out',
    });
  }

  face(direction: Direction | null): void {
    const angleByDirection: Record<Direction, number> = {
      north: -3,
      east: 14,
      south: 4,
      west: -14,
    };
    const targetAngle = direction === null ? 0 : angleByDirection[direction];
    if (this.reducedMotion) {
      this.form.setAngle(targetAngle);
      return;
    }
    this.scene.tweens.add({
      targets: this.form,
      angle: targetAngle,
      duration: 280,
      ease: 'Sine.Out',
    });
  }

  calm(): void {
    if (this.reducedMotion) {
      this.glow.setAlpha(0.82);
      this.core.setAlpha(0.82).setScale(1);
      return;
    }
    this.scene.tweens.killTweensOf(this.core);
    this.scene.tweens.add({
      targets: [this.glow, this.core],
      alpha: 0.8,
      duration: 480,
      ease: 'Sine.Out',
    });
    this.scene.tweens.add({
      targets: this.core,
      scale: 1,
      duration: 300,
      ease: 'Sine.Out',
    });
  }

  private startIdleMotion(): void {
    this.scene.tweens.add({
      targets: this.form,
      scaleX: 1.026,
      scaleY: 0.974,
      duration: 1760,
      hold: 160,
      repeatDelay: 310,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  private startCoreIdle(): void {
    this.scene.tweens.add({
      targets: this.core,
      alpha: 0.7,
      duration: 1080,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  private startAntennaIdle(): void {
    this.scene.tweens.add({
      targets: this.antennaLeft,
      angle: -2.2,
      duration: 1380,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.scene.tweens.add({
      targets: this.antennaRight,
      angle: 1.7,
      duration: 1640,
      delay: 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  private drawCreature(): void {
    this.glow
      .fillStyle(0x42e6c6, 0.07)
      .fillEllipse(0, 9, 108, 94)
      .fillStyle(0x70f6dd, 0.1)
      .fillEllipse(0, 8, 78, 70);
    this.silhouette
      .fillStyle(0x0a3038, 1)
      .fillEllipse(0, 11, 62, 70)
      .fillStyle(0x115b62, 1)
      .fillEllipse(-4, 6, 48, 58)
      .fillStyle(0x0d424b, 1)
      .fillEllipse(-29, 23, 18, 28)
      .fillEllipse(27, 21, 17, 30)
      .lineStyle(2, 0xa5f5e3, 0.68)
      .strokeEllipse(0, 11, 62, 70);
    this.antennaLeft
      .lineStyle(2, 0x83ddcf, 0.9)
      .beginPath()
      .moveTo(0, 0)
      .lineTo(-11, -20)
      .lineTo(-21, -15)
      .strokePath()
      .fillStyle(0xc9fff0, 1)
      .fillCircle(-21, -15, 3);
    this.antennaRight
      .lineStyle(2, 0x83ddcf, 0.9)
      .beginPath()
      .moveTo(0, 0)
      .lineTo(12, -21)
      .lineTo(21, -14)
      .strokePath()
      .fillStyle(0xc9fff0, 1)
      .fillCircle(21, -14, 3);
    this.core
      .fillStyle(0x8effdd, 0.18)
      .fillEllipse(0, 10, 32, 38)
      .fillStyle(0xc9ffee, 0.9)
      .fillEllipse(0, 9, 13, 18)
      .fillStyle(0xf1fffa, 1)
      .fillCircle(-2, 6, 3);
  }
}
