import * as Phaser from 'phaser';
import type { Direction } from '../../../shared/types/game';

export class CaveField {
  private readonly scene: Phaser.Scene;
  private readonly reducedMotion: boolean;
  private readonly base: Phaser.GameObjects.Graphics;
  private readonly ambience: Phaser.GameObjects.Graphics;
  private readonly reveal: Phaser.GameObjects.Graphics;
  private readonly selection: Phaser.GameObjects.Graphics;
  private width = 0;
  private height = 0;

  constructor(scene: Phaser.Scene, reducedMotion: boolean) {
    this.scene = scene;
    this.reducedMotion = reducedMotion;
    this.base = scene.add.graphics().setDepth(-20);
    this.ambience = scene.add.graphics().setDepth(-15);
    this.reveal = scene.add.graphics().setDepth(-10).setAlpha(0.12);
    this.selection = scene.add.graphics().setDepth(-5);
  }

  layout(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const cx = width / 2;
    const cy = this.centerY;
    const horizontalReach = Math.min(width * 0.37, 260);
    const verticalReach = Math.min(height * 0.21, 165);

    this.base.clear();
    this.base.fillStyle(0x050b0e, 1).fillRect(0, 0, width, height);
    this.base.fillStyle(0x07151a, 1).fillEllipse(cx, cy, width * 0.86, height * 0.62);
    this.base.fillStyle(0x0a2026, 0.58).fillEllipse(cx, cy + 42, width * 0.62, height * 0.42);

    this.drawOpening(cx, cy - verticalReach, 42, 30, true);
    this.drawOpening(cx + horizontalReach, cy, 45, 33, false);
    this.drawOpening(cx, cy + verticalReach, 42, 30, true);
    this.drawOpening(cx - horizontalReach, cy, 45, 33, false);

    this.base
      .lineStyle(2, 0x17444a, 0.26)
      .beginPath()
      .moveTo(0, height * 0.18)
      .lineTo(width * 0.2, cy - 80)
      .lineTo(cx - horizontalReach * 0.55, cy)
      .lineTo(width * 0.14, cy + 105)
      .lineTo(0, height * 0.84)
      .strokePath()
      .beginPath()
      .moveTo(width, height * 0.14)
      .lineTo(width * 0.78, cy - 105)
      .lineTo(cx + horizontalReach * 0.5, cy)
      .lineTo(width * 0.86, cy + 95)
      .lineTo(width, height * 0.88)
      .strokePath();

    this.drawReveal();
  }

  update(time: number): void {
    const motion = this.reducedMotion ? 0 : time * 0.00012;
    this.ambience.clear();
    this.ambience.fillStyle(0x1a6d6f, 0.035);
    this.ambience.fillEllipse(
      this.width * (0.18 + Math.sin(motion) * 0.04),
      this.height * 0.42,
      this.width * 0.6,
      this.height * 0.16
    );
    this.ambience.fillEllipse(
      this.width * (0.78 - Math.sin(motion * 1.3) * 0.05),
      this.height * 0.64,
      this.width * 0.68,
      this.height * 0.18
    );

    for (let index = 0; index < 22; index += 1) {
      const xSeed = ((index * 47) % 97) / 97;
      const ySeed = ((index * 31 + 11) % 89) / 89;
      const drift = this.reducedMotion ? 0 : Math.sin(time * 0.0007 + index) * 7;
      const alpha = 0.2 + ((index * 13) % 30) / 100;
      this.ambience.fillStyle(index % 4 === 0 ? 0x7ce6cf : 0x3b9895, alpha);
      this.ambience.fillCircle(xSeed * this.width + drift, ySeed * this.height, index % 5 === 0 ? 2 : 1);
    }
  }

  flashEcho(): void {
    this.scene.tweens.killTweensOf(this.reveal);
    this.reveal.setAlpha(0.95);
    if (this.reducedMotion) {
      this.scene.time.delayedCall(320, () => this.reveal.setAlpha(0.18));
      return;
    }
    this.scene.tweens.add({
      targets: this.reveal,
      alpha: 0.13,
      duration: 1050,
      delay: 180,
      ease: 'Sine.Out',
    });
  }

  setSelection(direction: Direction | null): void {
    this.selection.clear();
    if (direction === null) return;

    const cx = this.width / 2;
    const cy = this.centerY;
    const reachX = Math.min(this.width * 0.37, 260);
    const reachY = Math.min(this.height * 0.21, 165);
    const positions: Record<Direction, Phaser.Math.Vector2> = {
      north: new Phaser.Math.Vector2(cx, cy - reachY),
      east: new Phaser.Math.Vector2(cx + reachX, cy),
      south: new Phaser.Math.Vector2(cx, cy + reachY),
      west: new Phaser.Math.Vector2(cx - reachX, cy),
    };
    const point = positions[direction];
    this.selection
      .lineStyle(3, 0x9bffe5, 0.94)
      .strokeCircle(point.x, point.y, 34)
      .lineStyle(1, 0x9bffe5, 0.36)
      .strokeCircle(point.x, point.y, 42)
      .fillStyle(0xd7fff4, 0.95)
      .fillTriangle(point.x, point.y - 7, point.x + 7, point.y + 7, point.x - 7, point.y + 7);
  }

  get centerY(): number {
    return Math.max(255, Math.min(this.height * 0.45, this.height - 300));
  }

  private drawOpening(x: number, y: number, width: number, height: number, vertical: boolean): void {
    this.base.fillStyle(0x010405, 0.98).fillEllipse(
      x,
      y,
      vertical ? height : width,
      vertical ? width : height
    );
    this.base.lineStyle(1, 0x2a696b, 0.2).strokeEllipse(
      x,
      y,
      vertical ? height + 8 : width + 8,
      vertical ? width + 8 : height + 8
    );
  }

  private drawReveal(): void {
    const cx = this.width / 2;
    const cy = this.centerY;
    const reachX = Math.min(this.width * 0.37, 260);
    const reachY = Math.min(this.height * 0.21, 165);
    this.reveal.clear();

    this.reveal
      .lineStyle(2, 0x87e4d1, 0.75)
      .beginPath()
      .moveTo(cx - 30, cy - 45)
      .lineTo(cx - 95, cy - reachY * 0.52)
      .lineTo(cx - 20, cy - reachY + 28)
      .strokePath()
      .beginPath()
      .moveTo(cx + 30, cy - 45)
      .lineTo(cx + 92, cy - reachY * 0.5)
      .lineTo(cx + 20, cy - reachY + 28)
      .strokePath()
      .beginPath()
      .moveTo(cx + 48, cy - 28)
      .lineTo(cx + reachX * 0.58, cy - 56)
      .lineTo(cx + reachX - 28, cy - 18)
      .strokePath()
      .beginPath()
      .moveTo(cx + 48, cy + 28)
      .lineTo(cx + reachX * 0.58, cy + 55)
      .lineTo(cx + reachX - 28, cy + 18)
      .strokePath()
      .beginPath()
      .moveTo(cx - 30, cy + 49)
      .lineTo(cx - 85, cy + reachY * 0.55)
      .lineTo(cx - 18, cy + reachY - 27)
      .strokePath();

    // Hollow-looking path: repeated open contours toward the east.
    for (let step = 0; step < 4; step += 1) {
      this.reveal
        .lineStyle(2, 0x64ffdd, 0.78 - step * 0.12)
        .strokeEllipse(cx + 86 + step * 30, cy, 27 + step * 6, 42 + step * 8);
    }

    // Abstract silent hazard toward the west: warm fractured mandibles, not an enemy sprite.
    const hx = cx - reachX * 0.67;
    this.reveal
      .lineStyle(3, 0xffa66d, 0.85)
      .beginPath()
      .moveTo(hx - 22, cy - 26)
      .lineTo(hx, cy - 7)
      .lineTo(hx + 23, cy - 30)
      .strokePath()
      .beginPath()
      .moveTo(hx - 25, cy + 27)
      .lineTo(hx, cy + 8)
      .lineTo(hx + 25, cy + 30)
      .strokePath()
      .fillStyle(0xffc08b, 0.7)
      .fillCircle(hx, cy, 4);
  }
}
