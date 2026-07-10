import * as Phaser from 'phaser';
import { AVAILABLE_DIRECTIONS } from '../../../shared/constants/game';
import type { Direction } from '../../../shared/types/game';
import type { LayoutMetrics, LayoutPoint } from '../config/layout';

export class CaveField {
  private readonly scene: Phaser.Scene;
  private readonly reducedMotion: boolean;
  private readonly base: Phaser.GameObjects.Graphics;
  private readonly fog: Phaser.GameObjects.Graphics;
  private readonly structure: Phaser.GameObjects.Graphics;
  private readonly hollow: Phaser.GameObjects.Graphics;
  private readonly hazard: Phaser.GameObjects.Graphics;
  private readonly selection: Phaser.GameObjects.Graphics;
  private readonly motes: Phaser.GameObjects.Arc[];
  private metrics: LayoutMetrics;

  constructor(scene: Phaser.Scene, reducedMotion: boolean) {
    this.scene = scene;
    this.reducedMotion = reducedMotion;
    this.base = scene.add.graphics().setDepth(-20);
    this.fog = scene.add.graphics().setDepth(-16);
    this.structure = scene.add.graphics().setDepth(-10).setAlpha(0.055);
    this.hollow = scene.add.graphics().setDepth(-9).setAlpha(0.018);
    this.hazard = scene.add.graphics().setDepth(-8).setAlpha(0);
    this.selection = scene.add.graphics().setDepth(-5);
    this.motes = Array.from({ length: 16 }, (_, index) => {
      const mote = scene.add
        .circle(0, 0, index % 5 === 0 ? 2 : 1, index % 4 === 0 ? 0x78dec9 : 0x398f8b)
        .setAlpha(0.2 + ((index * 11) % 28) / 100)
        .setDepth(-14);
      if (!reducedMotion) {
        scene.tweens.add({
          targets: mote,
          y: `-=${5 + (index % 4) * 2}`,
          alpha: mote.alpha + 0.16,
          duration: 2200 + (index % 5) * 380,
          delay: index * 90,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
      }
      return mote;
    });

    if (!reducedMotion) {
      scene.tweens.add({
        targets: this.fog,
        alpha: 0.68,
        duration: 4200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
  }

  layout(metrics: LayoutMetrics): void {
    this.metrics = metrics;
    const { width, height, centerX, centerY, worldBounds, pathNodes } = metrics;

    this.base.clear();
    this.base.fillStyle(0x050b0e, 1).fillRect(0, 0, width, height);
    this.base
      .fillStyle(0x07171b, 1)
      .fillEllipse(centerX - worldBounds.width * 0.055, centerY + 18, worldBounds.width * 0.9, worldBounds.height * 0.79)
      .fillStyle(0x0a2429, 0.55)
      .fillEllipse(centerX + worldBounds.width * 0.08, centerY + 54, worldBounds.width * 0.65, worldBounds.height * 0.51)
      .fillStyle(0x03080a, 0.95)
      .fillTriangle(
        worldBounds.x,
        worldBounds.y + worldBounds.height * 0.12,
        worldBounds.x + worldBounds.width * 0.22,
        worldBounds.y + worldBounds.height * 0.46,
        worldBounds.x,
        worldBounds.y + worldBounds.height * 0.8
      )
      .fillTriangle(
        worldBounds.x + worldBounds.width,
        worldBounds.y + worldBounds.height * 0.05,
        worldBounds.x + worldBounds.width * 0.76,
        worldBounds.y + worldBounds.height * 0.55,
        worldBounds.x + worldBounds.width,
        worldBounds.y + worldBounds.height * 0.92
      );

    this.drawOpening(pathNodes.north, 'north', 30, 42);
    this.drawOpening(pathNodes.east, 'east', 52, 34);
    this.drawOpening(pathNodes.south, 'south', 27, 47);
    this.drawOpening(pathNodes.west, 'west', 46, 31);

    for (const direction of AVAILABLE_DIRECTIONS) {
      this.drawRoute(this.base, direction, 0x1c5053, 0.14);
    }

    this.drawAmbientFog();
    this.drawRevealLayers();
    this.layoutMotes();
  }

  revealPulse(pulseNumber: number): void {
    const pulse = Math.max(1, Math.min(3, pulseNumber));
    this.scene.tweens.killTweensOf([this.structure, this.hollow, this.hazard]);

    this.flashLayer(this.structure, pulse === 1 ? 0.95 : pulse === 2 ? 0.66 : 0.48, 0.08, 0);
    if (pulse >= 2) {
      this.flashLayer(this.hollow, pulse === 2 ? 0.96 : 0.56, 0.035, 100);
    }
    if (pulse === 3) {
      this.flashLayer(this.hazard, 0.96, 0, 190);
    }
  }

  setSelection(direction: Direction | null): void {
    this.selection.clear();
    if (direction === null) return;

    const point = this.metrics.pathNodes[direction];
    const { centerX, centerY } = this.metrics;
    const bend = this.bendFor(direction);
    this.selection
      .lineStyle(3, 0x9bffe5, 0.85)
      .beginPath()
      .moveTo(centerX, centerY)
      .lineTo((centerX + point.x) / 2 + bend.x, (centerY + point.y) / 2 + bend.y)
      .lineTo(point.x, point.y)
      .strokePath()
      .lineStyle(1, 0x9bffe5, 0.35)
      .strokeEllipse(point.x, point.y, 92, 60)
      .fillStyle(0xd7fff4, 0.95)
      .fillTriangle(point.x, point.y - 8, point.x + 7, point.y + 5, point.x - 7, point.y + 5);
  }

  private flashLayer(
    layer: Phaser.GameObjects.Graphics,
    peak: number,
    resting: number,
    delay: number
  ): void {
    const reveal = (): void => {
      layer.setAlpha(peak);
      if (this.reducedMotion) {
        this.scene.time.delayedCall(260, () => layer.setAlpha(resting));
        return;
      }
      this.scene.tweens.add({
        targets: layer,
        alpha: resting,
        duration: 920,
        delay: 160,
        ease: 'Sine.Out',
      });
    };
    if (delay > 0 && !this.reducedMotion) this.scene.time.delayedCall(delay, reveal);
    else reveal();
  }

  private drawAmbientFog(): void {
    const { centerX, centerY, worldBounds } = this.metrics;
    this.fog.clear();
    this.fog
      .fillStyle(0x1a6d6f, 0.038)
      .fillEllipse(
        centerX - worldBounds.width * 0.28,
        centerY - worldBounds.height * 0.05,
        worldBounds.width * 0.62,
        worldBounds.height * 0.24
      )
      .fillStyle(0x287d78, 0.027)
      .fillEllipse(
        centerX + worldBounds.width * 0.31,
        centerY + worldBounds.height * 0.18,
        worldBounds.width * 0.7,
        worldBounds.height * 0.2
      );
  }

  private layoutMotes(): void {
    const { worldBounds } = this.metrics;
    this.motes.forEach((mote, index) => {
      const xSeed = ((index * 47 + 9) % 97) / 97;
      const ySeed = ((index * 31 + 11) % 89) / 89;
      mote.setPosition(
        worldBounds.x + xSeed * worldBounds.width,
        worldBounds.y + ySeed * worldBounds.height
      );
    });
  }

  private drawOpening(
    point: LayoutPoint,
    direction: Direction,
    width: number,
    height: number
  ): void {
    const vertical = direction === 'north' || direction === 'south';
    this.base
      .fillStyle(0x010405, 0.98)
      .fillEllipse(point.x, point.y, vertical ? height : width, vertical ? width : height)
      .lineStyle(1, direction === 'east' ? 0x3d8580 : 0x255b5d, 0.3)
      .strokeEllipse(
        point.x,
        point.y,
        vertical ? height + 9 : width + 9,
        vertical ? width + 9 : height + 9
      );
  }

  private drawRoute(
    graphics: Phaser.GameObjects.Graphics,
    direction: Direction,
    color: number,
    alpha: number
  ): void {
    const point = this.metrics.pathNodes[direction];
    const { centerX, centerY } = this.metrics;
    const bend = this.bendFor(direction);
    const midpoint = {
      x: (centerX + point.x) / 2 + bend.x,
      y: (centerY + point.y) / 2 + bend.y,
    };
    const normal = direction === 'north' || direction === 'south'
      ? { x: 24, y: 0 }
      : { x: 0, y: 22 };

    graphics
      .lineStyle(2, color, alpha)
      .beginPath()
      .moveTo(centerX + normal.x, centerY + normal.y)
      .lineTo(midpoint.x + normal.x * 0.72, midpoint.y + normal.y * 0.72)
      .lineTo(point.x + normal.x * 0.45, point.y + normal.y * 0.45)
      .strokePath()
      .beginPath()
      .moveTo(centerX - normal.x, centerY - normal.y)
      .lineTo(midpoint.x - normal.x * 0.72, midpoint.y - normal.y * 0.72)
      .lineTo(point.x - normal.x * 0.45, point.y - normal.y * 0.45)
      .strokePath();
  }

  private drawRevealLayers(): void {
    this.structure.clear();
    this.hollow.clear();
    this.hazard.clear();
    for (const direction of AVAILABLE_DIRECTIONS) {
      this.drawRoute(this.structure, direction, 0x8be6d2, 0.82);
    }

    const east = this.metrics.pathNodes.east;
    const startX = this.metrics.centerX + (east.x - this.metrics.centerX) * 0.54;
    for (let step = 0; step < 4; step += 1) {
      this.hollow
        .lineStyle(2, 0x64ffdd, 0.78 - step * 0.12)
        .strokeEllipse(startX + step * 25, east.y, 24 + step * 5, 38 + step * 6);
    }

    const west = this.metrics.pathNodes.west;
    const hx = west.x + (this.metrics.centerX - west.x) * 0.28;
    const hy = west.y - 5;
    this.hazard
      .lineStyle(3, 0xffa66d, 0.9)
      .beginPath()
      .moveTo(hx - 22, hy - 25)
      .lineTo(hx, hy - 6)
      .lineTo(hx + 24, hy - 31)
      .strokePath()
      .beginPath()
      .moveTo(hx - 24, hy + 26)
      .lineTo(hx, hy + 7)
      .lineTo(hx + 27, hy + 29)
      .strokePath()
      .fillStyle(0xffc08b, 0.78)
      .fillCircle(hx, hy, 4);
  }

  private bendFor(direction: Direction): LayoutPoint {
    const bends: Record<Direction, LayoutPoint> = {
      north: { x: -18, y: 6 },
      east: { x: 18, y: -16 },
      south: { x: -15, y: 12 },
      west: { x: -22, y: 18 },
    };
    return bends[direction];
  }
}
