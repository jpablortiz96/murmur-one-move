import * as Phaser from 'phaser';
import type { Direction } from '../../../shared/types/game';

export class Murmur extends Phaser.GameObjects.Container {
  private readonly reducedMotion: boolean;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly silhouette: Phaser.GameObjects.Graphics;
  private readonly core: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, reducedMotion: boolean) {
    super(scene, 0, 0);
    this.reducedMotion = reducedMotion;
    this.glow = scene.add.graphics();
    this.silhouette = scene.add.graphics();
    this.core = scene.add.graphics();

    this.drawCreature();
    this.add([this.glow, this.silhouette, this.core]);
    this.setSize(84, 94);
    scene.add.existing(this);

    if (!reducedMotion) {
      scene.tweens.add({
        targets: this,
        scaleX: 1.035,
        scaleY: 0.965,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      scene.tweens.add({
        targets: this.core,
        alpha: 0.72,
        duration: 1150,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
  }

  react(): void {
    if (this.reducedMotion) {
      this.setScale(1.03, 0.97);
      this.scene.time.delayedCall(90, () => this.setScale(1));
      return;
    }

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      y: this.y - 7,
      angle: this.angle + 3,
      duration: 105,
      yoyo: true,
      ease: 'Quad.Out',
      onComplete: () => {
        this.setAngle(0);
        this.scene.tweens.add({
          targets: this,
          scaleX: 1.035,
          scaleY: 0.965,
          duration: 1800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
      },
    });
  }

  face(direction: Direction | null): void {
    const angleByDirection: Record<Direction, number> = {
      north: 0,
      east: 18,
      south: 0,
      west: -18,
    };
    const targetAngle = direction === null ? 0 : angleByDirection[direction];
    if (this.reducedMotion) {
      this.setAngle(targetAngle);
      return;
    }
    this.scene.tweens.add({
      targets: this,
      angle: targetAngle,
      duration: 260,
      ease: 'Sine.Out',
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
      .strokeEllipse(0, 11, 62, 70)
      .lineStyle(2, 0x83ddcf, 0.9)
      .beginPath()
      .moveTo(-17, -17)
      .lineTo(-28, -36)
      .lineTo(-38, -31)
      .strokePath()
      .beginPath()
      .moveTo(17, -17)
      .lineTo(29, -37)
      .lineTo(38, -30)
      .strokePath()
      .fillStyle(0xc9fff0, 1)
      .fillCircle(-38, -31, 3)
      .fillCircle(38, -30, 3);

    this.core
      .fillStyle(0x8effdd, 0.18)
      .fillEllipse(0, 10, 32, 38)
      .fillStyle(0xc9ffee, 0.9)
      .fillEllipse(0, 9, 13, 18)
      .fillStyle(0xf1fffa, 1)
      .fillCircle(-2, 6, 3);
  }
}
