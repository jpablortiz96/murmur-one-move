import * as Phaser from 'phaser';
import type { WindPerception } from '../../../shared/contracts/session';
import { BaseSensorExperience, type SensorExperienceContext, type SensorInput } from './SensorExperience';

export class WindExperience extends BaseSensorExperience {
  readonly id = 'wind' as const;
  private readonly perception: WindPerception;
  private readonly layer: Phaser.GameObjects.Graphics;
  private start: { x: number; y: number } | null = null;
  private readonly pointerDown: (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => void;
  private readonly pointerUp: (pointer: Phaser.Input.Pointer) => void;
  private readonly cancel: () => void;

  constructor(context: SensorExperienceContext) {
    super(context);
    if (context.perception.sensor !== 'wind') throw new Error('Wind controller requires Wind perception');
    this.perception = context.perception;
    this.layer = context.scene.add.graphics().setDepth(-3);
    this.pointerDown = (pointer, over) => {
      if (over.length === 0 && this.used < 3) this.start = { x: pointer.worldX, y: pointer.worldY };
    };
    this.pointerUp = (pointer) => {
      if (!this.start) return;
      const deltaX = pointer.worldX - this.start.x;
      const deltaY = pointer.worldY - this.start.y;
      if (Math.hypot(deltaX, deltaY) >= 18) {
        this.activate({ x: this.start.x, y: this.start.y, deltaX, deltaY });
      }
      this.start = null;
    };
    this.cancel = () => { this.start = null; };
  }

  enter(): void {
    this.context.scene.input.on('pointerdown', this.pointerDown);
    this.context.scene.input.on('pointerup', this.pointerUp);
    this.context.scene.input.on('pointerupoutside', this.pointerUp);
    this.context.scene.input.on('gameout', this.cancel);
  }

  activate(input: SensorInput): void {
    this.completeActivation(input);
  }

  getInstruction(): string {
    return this.used >= 3 ? 'Choose what the cavern carries.' : 'Drag briefly to release wind tracers.';
  }

  protected drawActivation(stage: number, input: SensorInput): void {
    const metrics = this.context.metrics();
    const gestureAngle = Math.atan2(input.deltaY ?? -1, input.deltaX ?? 1);
    for (const signal of this.perception.airflowSignals) {
      const point = metrics.pathNodes[signal.direction];
      const contaminationColor = signal.contamination === 'toxic' ? 0xd7d06b : signal.contamination === 'ash' ? 0xb9aaa0 : signal.contamination === 'spores' ? 0x99d591 : 0xa9f6e5;
      if (stage === 1) {
        const bend = signal.flow === 'crosscurrent' ? 28 : signal.flow === 'inward' ? -18 : 12;
        this.layer.lineStyle(signal.strength === 'violent' ? 3 : 2, 0xb4f8e7, signal.strength === 'still' ? 0.22 : 0.68)
          .beginPath().moveTo(metrics.centerX, metrics.centerY)
          .lineTo((metrics.centerX + point.x) / 2 + Math.cos(gestureAngle) * bend, (metrics.centerY + point.y) / 2 + Math.sin(gestureAngle) * bend)
          .lineTo(point.x, point.y).strokePath();
      } else if (stage === 2) {
        const turns = signal.turbulence === 'chaotic' ? 4 : signal.turbulence === 'eddying' ? 3 : 1;
        for (let turn = 0; turn < turns; turn += 1) {
          this.layer.lineStyle(1.5, 0x9ee8d4, 0.7 - turn * 0.12)
            .strokeEllipse(point.x + turn * 4, point.y - turn * 3, 18 + turn * 10, 10 + turn * 7);
        }
      } else if (stage === 3 && signal.contamination !== 'clear') {
        const count = this.context.reducedMotion ? 3 : 6;
        for (let mote = 0; mote < count; mote += 1) {
          const x = point.x - 22 + mote * 8;
          const y = point.y + ((mote % 3) - 1) * 10;
          if (signal.contamination === 'spores') this.layer.lineStyle(2, contaminationColor, 0.82).strokeCircle(x, y, 4);
          else if (signal.contamination === 'ash') this.layer.fillStyle(contaminationColor, 0.72).fillRect(x - 3, y - 2, 6, 4);
          else this.layer.fillStyle(contaminationColor, 0.76).fillTriangle(x, y - 5, x + 5, y + 4, x - 5, y + 4);
        }
      }
    }
    this.context.murmur.echo(stage);
    if (stage === 3) this.context.murmur.flinchDanger();
  }

  protected clearVisuals(): void {
    this.start = null;
    this.layer.clear();
  }

  destroy(): void {
    this.context.scene.input.off('pointerdown', this.pointerDown);
    this.context.scene.input.off('pointerup', this.pointerUp);
    this.context.scene.input.off('pointerupoutside', this.pointerUp);
    this.context.scene.input.off('gameout', this.cancel);
    this.layer.destroy();
  }
}
