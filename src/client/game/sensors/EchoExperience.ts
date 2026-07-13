import * as Phaser from 'phaser';
import type { EchoPerception } from '../../../shared/contracts/session';
import { emitEchoWave } from '../effects/EchoPulse';
import { BaseSensorExperience, type SensorExperienceContext, type SensorInput } from './SensorExperience';

export class EchoExperience extends BaseSensorExperience {
  readonly id = 'echo' as const;
  private readonly perception: EchoPerception;
  private readonly layer: Phaser.GameObjects.Graphics;
  private readonly pointerDown: (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => void;

  constructor(context: SensorExperienceContext) {
    super(context);
    if (context.perception.sensor !== 'echo') throw new Error('Echo controller requires Echo perception');
    this.perception = context.perception;
    this.layer = context.scene.add.graphics().setDepth(-4);
    this.pointerDown = (pointer, over) => {
      if (over.length === 0) this.activate({ x: pointer.worldX, y: pointer.worldY });
    };
  }

  enter(): void {
    this.context.scene.input.on('pointerdown', this.pointerDown);
  }

  activate(input: SensorInput): void {
    this.completeActivation(input);
  }

  getInstruction(): string {
    return this.getProgress().complete ? 'Choose what the echoes imply.' : 'Touch the dark to send an echo.';
  }

  protected drawActivation(stage: number): void {
    const metrics = this.context.metrics();
    emitEchoWave(this.context.scene, metrics, stage, this.context.reducedMotion);
    this.context.murmur.echo(stage);
    for (const signal of this.perception.structuralSignals) {
      const point = metrics.pathNodes[signal.direction];
      if (stage === 1) {
        const alpha = signal.continuity === 'blocked' ? 0.24 : signal.continuity === 'narrow' ? 0.5 : 0.82;
        this.layer.lineStyle(signal.continuity === 'narrow' ? 1 : 2, 0x8bffe8, alpha)
          .beginPath().moveTo(metrics.centerX, metrics.centerY).lineTo(point.x, point.y).strokePath();
      } else if (stage === 2 && signal.cavity !== 'solid') {
        const rings = signal.cavity === 'deep' ? 3 : 2;
        for (let ring = 0; ring < rings; ring += 1) {
          this.layer.lineStyle(1.5, 0x6eeed4, 0.75 - ring * 0.16)
            .strokeEllipse(point.x, point.y, 24 + ring * 13, 34 + ring * 12);
        }
      } else if (stage === 3 && signal.stability !== 'stable') {
        this.layer.lineStyle(3, 0xbaffed, 0.78).beginPath()
          .moveTo(point.x - 18, point.y - 16).lineTo(point.x - 3, point.y - 2)
          .lineTo(point.x - 12, point.y + 14).lineTo(point.x + 18, point.y + 23).strokePath();
      }
    }
    if (stage === 3) this.context.murmur.flinchDanger();
  }

  protected clearVisuals(): void {
    this.layer.clear();
  }

  destroy(): void {
    this.context.scene.input.off('pointerdown', this.pointerDown);
    this.layer.destroy();
  }
}
