import type * as Phaser from 'phaser';
import type { PlayerPerception } from '../../../shared/contracts/session';
import type { Sensor } from '../../../shared/types/game';
import type { LayoutMetrics } from '../config/layout';
import type { Murmur } from '../entities/Murmur';

export type SensorInput = {
  x: number;
  y: number;
  durationMs?: number;
  deltaX?: number;
  deltaY?: number;
};

export type SensorProgress = {
  used: number;
  maximum: 3;
  complete: boolean;
};

export type SensorExperienceContext = {
  scene: Phaser.Scene;
  perception: PlayerPerception;
  murmur: Murmur;
  reducedMotion: boolean;
  metrics: () => LayoutMetrics;
  onProgress: (progress: SensorProgress, accessibleSignal: string) => void;
};

export interface SensorExperience {
  readonly id: Sensor;
  enter(): void;
  activate(input: SensorInput): void;
  replay(): void;
  reset(): void;
  destroy(): void;
  forceActivate(): void;
  getProgress(): SensorProgress;
  getAccessibleSignal(): string;
  getInstruction(): string;
}

export abstract class BaseSensorExperience implements SensorExperience {
  abstract readonly id: Sensor;
  protected readonly context: SensorExperienceContext;
  protected used = 0;
  protected accessibleSignal = '';

  constructor(context: SensorExperienceContext) {
    this.context = context;
  }

  abstract enter(): void;
  abstract activate(input: SensorInput): void;
  abstract destroy(): void;
  abstract getInstruction(): string;

  forceActivate(): void {
    const metrics = this.context.metrics();
    this.activate({ x: metrics.centerX, y: metrics.centerY });
  }

  replay(): void {
    this.reset();
  }

  reset(): void {
    this.used = 0;
    this.accessibleSignal = '';
    this.clearVisuals();
    this.context.onProgress(this.getProgress(), this.accessibleSignal);
  }

  getProgress(): SensorProgress {
    return { used: this.used, maximum: 3, complete: this.used >= 3 };
  }

  getAccessibleSignal(): string {
    return this.accessibleSignal;
  }

  protected completeActivation(input: SensorInput): void {
    if (this.used >= 3) return;
    this.used += 1;
    this.accessibleSignal = this.context.perception.activationDescriptions[this.used - 1] ?? '';
    this.drawActivation(this.used, input);
    this.context.onProgress(this.getProgress(), this.accessibleSignal);
  }

  protected abstract drawActivation(stage: number, input: SensorInput): void;
  protected abstract clearVisuals(): void;
}
