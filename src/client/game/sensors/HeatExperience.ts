import * as Phaser from 'phaser';
import type { HeatPerception, HeatSignal } from '../../../shared/contracts/session';
import { BaseSensorExperience, type SensorExperienceContext, type SensorInput } from './SensorExperience';

const heatColor = (temperature: HeatSignal['temperature']): number => ({
  cold: 0x6aa6a6,
  neutral: 0x8ed0a5,
  warm: 0xffb16f,
  burning: 0xff715f,
})[temperature];

export class HeatExperience extends BaseSensorExperience {
  readonly id = 'heat' as const;
  private readonly perception: HeatPerception;
  private readonly layer: Phaser.GameObjects.Graphics;
  private focus: Phaser.GameObjects.Arc | null = null;
  private holdStarted = 0;
  private holdPointer: Phaser.Input.Pointer | null = null;
  private holdTimer: Phaser.Time.TimerEvent | null = null;
  private completedHold = false;
  private readonly pointerDown: (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => void;
  private readonly pointerUp: (pointer: Phaser.Input.Pointer) => void;
  private readonly cancel: () => void;

  constructor(context: SensorExperienceContext) {
    super(context);
    if (context.perception.sensor !== 'heat') throw new Error('Heat controller requires Heat perception');
    this.perception = context.perception;
    this.layer = context.scene.add.graphics().setDepth(-3);
    this.pointerDown = (pointer, over) => {
      if (over.length > 0 || this.used >= 3) return;
      this.cancelHold();
      this.holdStarted = performance.now();
      this.holdPointer = pointer;
      this.completedHold = false;
      this.focus = this.context.scene.add.circle(pointer.worldX, pointer.worldY, 25)
        .setStrokeStyle(2, 0xffb36c, 0.82).setFillStyle(0xff7b52, 0.08).setDepth(20);
      if (!this.context.reducedMotion) {
        this.context.scene.tweens.add({ targets: this.focus, scale: 1.8, alpha: 0.42, duration: 560, ease: 'Sine.Out' });
      }
      this.holdTimer = this.context.scene.time.delayedCall(520, () => {
        if (!this.holdPointer) return;
        this.completedHold = true;
        this.activate({ x: this.holdPointer.worldX, y: this.holdPointer.worldY, durationMs: 520 });
      });
    };
    this.pointerUp = (pointer) => {
      if (!this.holdPointer) return;
      const durationMs = performance.now() - this.holdStarted;
      if (!this.completedHold && durationMs >= 80) this.activate({ x: pointer.worldX, y: pointer.worldY, durationMs });
      this.cancelHold();
    };
    this.cancel = () => this.cancelHold();
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
    return this.used >= 3 ? 'Choose what the warmth cannot explain.' : 'Press and hold to focus a thermal region.';
  }

  protected drawActivation(stage: number, input: SensorInput): void {
    const metrics = this.context.metrics();
    const clarity = Math.min(1, Math.max(0.35, (input.durationMs ?? 520) / 520));
    for (const signal of this.perception.thermalSignals) {
      const point = metrics.pathNodes[signal.direction];
      const color = heatColor(signal.temperature);
      if (stage === 1) {
        const radius = signal.temperature === 'burning' ? 34 : signal.temperature === 'warm' ? 27 : 20;
        this.layer.fillStyle(color, 0.08 + clarity * 0.1).fillCircle(point.x, point.y, radius)
          .lineStyle(2, color, 0.4 + clarity * 0.35).strokeCircle(point.x, point.y, radius);
      } else if (stage === 2 && signal.presence !== 'none') {
        const marks = signal.presence === 'swarm' ? 5 : signal.presence === 'moving' ? 3 : 1;
        for (let mark = 0; mark < marks; mark += 1) {
          this.layer.fillStyle(color, 0.72 - mark * 0.09)
            .fillEllipse(point.x - 14 + mark * 7, point.y + ((mark % 2) * 9 - 4), 7, 12);
        }
      } else if (stage === 3) {
        const rings = signal.volatility === 'pulsing' ? 3 : signal.volatility === 'rising' ? 2 : 1;
        for (let ring = 0; ring < rings; ring += 1) {
          this.layer.lineStyle(2, color, 0.72 - ring * 0.18)
            .strokeEllipse(point.x, point.y, 32 + ring * 17, 24 + ring * 13);
        }
      }
    }
    this.context.murmur.echo(stage);
    if (stage === 3) this.context.murmur.flinchDanger();
  }

  protected clearVisuals(): void {
    this.cancelHold();
    this.layer.clear();
  }

  private cancelHold(): void {
    this.holdTimer?.remove(false);
    this.holdTimer = null;
    if (this.focus) {
      this.context.scene.tweens.killTweensOf(this.focus);
      this.focus.destroy();
      this.focus = null;
    }
    this.holdPointer = null;
  }

  destroy(): void {
    this.cancelHold();
    this.context.scene.input.off('pointerdown', this.pointerDown);
    this.context.scene.input.off('pointerup', this.pointerUp);
    this.context.scene.input.off('pointerupoutside', this.pointerUp);
    this.context.scene.input.off('gameout', this.cancel);
    this.layer.destroy();
  }
}
