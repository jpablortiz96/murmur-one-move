import * as Phaser from 'phaser';
import type { BootstrapResponse } from '../../../shared/contracts/bootstrap';
import { AVAILABLE_DIRECTIONS, DEBUG_DEFAULT } from '../../../shared/constants/game';
import type { Direction } from '../../../shared/types/game';
import {
  calculateLayout,
  readSafeAreaInsets,
  type Insets,
  type LayoutMetrics,
} from '../config/layout';
import { CaveField } from '../effects/CaveField';
import { emitEchoRing } from '../effects/EchoPulse';
import { Murmur } from '../entities/Murmur';
import {
  canEmitPulse,
  changeChoice,
  createDecisionState,
  emitPulse,
  replaySignal,
  selectDirection,
  type DecisionState,
} from '../systems/decisionState';
import { createWorldButton, type WorldButton } from '../ui/worldButton';

type SceneSettings = {
  reducedMotion: boolean;
  debug: boolean;
  safeArea: Insets;
};

export class MurmurScene extends Phaser.Scene {
  private bootstrap: BootstrapResponse;
  private settings: SceneSettings;
  private state: DecisionState = createDecisionState();
  private metrics: LayoutMetrics;
  private cave: CaveField;
  private murmur: Murmur;
  private titleText: Phaser.GameObjects.Text;
  private chapterText: Phaser.GameObjects.Text;
  private sensorText: Phaser.GameObjects.Text;
  private instructionText: Phaser.GameObjects.Text;
  private pulseText: Phaser.GameObjects.Text;
  private resultText: Phaser.GameObjects.Text;
  private pendingText: Phaser.GameObjects.Text;
  private debugText: Phaser.GameObjects.Text | null = null;
  private readonly directionButtons: Record<Direction, WorldButton> = {
    north: undefined!,
    east: undefined!,
    south: undefined!,
    west: undefined!,
  };
  private replayButton: WorldButton;
  private changeButton: WorldButton;
  private debugResetButton: WorldButton | null = null;
  private debugPulseButton: WorldButton | null = null;

  constructor() {
    super('Murmur');
  }

  init(data: BootstrapResponse): void {
    this.bootstrap = data;
    this.state = createDecisionState();
    this.settings = this.registry.get('settings');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x050b0e);
    this.cave = new CaveField(this, this.settings.reducedMotion);
    this.murmur = new Murmur(this, this.settings.reducedMotion).setDepth(15);

    this.titleText = this.add.text(0, 0, this.bootstrap.gameTitle, this.titleStyle()).setOrigin(0.5, 0);
    this.chapterText = this.add
      .text(0, 0, `DAY ${this.bootstrap.day}  ·  ${this.bootstrap.chapter.toUpperCase()}`, {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '10px',
        color: '#699e99',
        letterSpacing: 1.5,
      })
      .setOrigin(0.5, 0);
    this.sensorText = this.add
      .text(0, 0, 'E C H O', {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '20px',
        color: '#bfffee',
        letterSpacing: 5,
      })
      .setOrigin(0.5)
      .setAlpha(this.settings.reducedMotion ? 1 : 0);
    this.instructionText = this.add.text(0, 0, '', this.bodyStyle()).setOrigin(0.5);
    this.pulseText = this.add.text(0, 0, '', this.microStyle()).setOrigin(0.5);
    this.resultText = this.add
      .text(0, 0, 'Signal recorded', {
        ...this.bodyStyle(),
        color: '#ddfff6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.pendingText = this.add
      .text(0, 0, 'The community has not moved yet.', this.microStyle())
      .setOrigin(0.5);

    this.createDirectionButtons();
    this.replayButton = createWorldButton(this, 'REPLAY SIGNAL', 136, () => this.replay());
    this.changeButton = createWorldButton(this, 'CHANGE CHOICE', 136, () => this.change());

    if (this.settings.debug) this.createDebugLayer();

    this.layout();
    this.renderState();
    this.scale.on('resize', () => this.layout());
    this.input.on(
      'pointerdown',
      (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        if (currentlyOver.length === 0) this.tryPulse(false);
      }
    );

    if (!this.settings.reducedMotion) {
      this.cameras.main.setZoom(0.92);
      this.tweens.add({
        targets: this.cameras.main,
        zoom: 1,
        duration: 650,
        ease: 'Sine.Out',
      });
      this.tweens.add({
        targets: this.sensorText,
        alpha: 1,
        duration: 700,
        delay: 260,
      });
    }
  }

  override update(time: number): void {
    this.cave.update(time);
    this.updateDebugText();
  }

  private tryPulse(force: boolean): void {
    if (!force && !canEmitPulse(this.state)) return;
    if (!force) this.state = emitPulse(this.state);

    const radius = Math.min(Math.max(this.scale.width, this.scale.height) * 0.72, 570);
    emitEchoRing(this, this.murmur.x, this.murmur.y, radius, this.settings.reducedMotion);
    this.cave.flashEcho();
    this.murmur.react();
    this.renderState();
  }

  private choose(direction: Direction): void {
    if (this.state.phase !== 'observing' || this.state.pulsesUsed < 1) return;
    this.state = selectDirection(this.state, direction);
    this.cave.setSelection(direction);
    this.murmur.face(direction);
    this.renderState();
  }

  private change(): void {
    this.state = changeChoice(this.state);
    this.cave.setSelection(null);
    this.murmur.face(null);
    this.renderState();
  }

  private replay(): void {
    this.state = replaySignal();
    this.cave.setSelection(null);
    this.murmur.face(null);
    this.renderState();
    this.tryPulse(false);
  }

  private resetDemo(): void {
    this.state = createDecisionState();
    this.cave.setSelection(null);
    this.murmur.face(null);
    this.renderState();
  }

  private renderState(): void {
    const hasPulse = this.state.pulsesUsed > 0;
    const decided = this.state.phase === 'decided';
    const atLimit = this.state.pulsesUsed >= this.state.maxPulses;

    this.instructionText.setText(
      decided
        ? `◆ ${this.state.selection?.toUpperCase()} PATH HELD`
        : atLimit
          ? 'The cavern is quiet. Choose what you trust.'
          : 'Tap the cavern to listen.'
    );
    this.pulseText.setText(
      `${this.state.pulsesUsed} / ${this.state.maxPulses} ECHO PULSES${atLimit ? ' · SPENT' : ''}`
    );

    for (const direction of AVAILABLE_DIRECTIONS) {
      const button = this.directionButtons[direction];
      button.container.setVisible(hasPulse);
      button.setSelected(this.state.selection === direction);
      button.setEnabled(!decided);
    }

    this.resultText.setVisible(decided);
    this.pendingText.setVisible(decided);
    this.replayButton.container.setVisible(decided);
    this.changeButton.container.setVisible(decided);
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.metrics = calculateLayout(width, height, this.settings.safeArea);
    const { centerX, centerY, pathNodes } = this.metrics;

    this.cameras.resize(width, height);
    this.cave.layout(width, height);
    this.murmur.setPosition(centerX, centerY);
    this.titleText.setPosition(centerX, this.metrics.titleY);
    this.chapterText.setPosition(centerX, this.metrics.chapterY);
    this.sensorText.setPosition(centerX, this.metrics.sensorY);
    this.instructionText.setPosition(centerX, this.metrics.instructionY);
    this.pulseText.setPosition(centerX, this.metrics.pulseCounterY);
    this.resultText.setPosition(centerX, this.metrics.decisionStatusY);
    this.pendingText.setPosition(centerX, this.metrics.decisionDetailY);

    this.directionButtons.north.container.setPosition(pathNodes.north.x, pathNodes.north.y);
    this.directionButtons.east.container.setPosition(pathNodes.east.x, pathNodes.east.y);
    this.directionButtons.south.container.setPosition(pathNodes.south.x, pathNodes.south.y);
    this.directionButtons.west.container.setPosition(pathNodes.west.x, pathNodes.west.y);
    this.replayButton.container.setPosition(
      centerX - this.metrics.actionButtonOffset,
      this.metrics.actionButtonsY
    );
    this.changeButton.container.setPosition(
      centerX + this.metrics.actionButtonOffset,
      this.metrics.actionButtonsY
    );

    this.debugText?.setPosition(width - 7, 7);
    this.debugResetButton?.container.setPosition(width - 55, 104);
    this.debugPulseButton?.container.setPosition(width - 55, 156);
    this.updateDebugText();
  }

  private createDirectionButtons(): void {
    this.directionButtons.north = createWorldButton(this, 'NORTH', 78, () => this.choose('north'));
    this.directionButtons.east = createWorldButton(this, 'EAST', 78, () => this.choose('east'));
    this.directionButtons.south = createWorldButton(this, 'SOUTH', 78, () => this.choose('south'));
    this.directionButtons.west = createWorldButton(this, 'WEST', 78, () => this.choose('west'));
  }

  private createDebugLayer(): void {
    this.debugText = this.add
      .text(0, 0, '', {
        fontFamily: 'Consolas, monospace',
        fontSize: '10px',
        color: '#d7fff5',
        backgroundColor: '#020708cc',
        padding: { x: 6, y: 5 },
        align: 'right',
      })
      .setOrigin(1, 0)
      .setDepth(100);
    this.debugResetButton = createWorldButton(this, 'RESET', 96, () => this.resetDemo());
    this.debugPulseButton = createWorldButton(this, 'PULSE', 96, () => this.tryPulse(true));
    this.debugResetButton.container.setDepth(100);
    this.debugPulseButton.container.setDepth(100);
  }

  private updateDebugText(): void {
    this.debugText?.setText(
      `DEBUG · ${this.scale.width}×${this.scale.height}\n` +
        `${this.state.phase} · pulses ${this.state.pulsesUsed}/${this.state.maxPulses}\n` +
        `choice ${this.state.selection ?? 'none'} · reduced ${this.settings.reducedMotion}`
    );
  }

  private titleStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
      fontSize: '23px',
      color: '#eafff9',
      letterSpacing: 7,
    };
  }

  private bodyStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
      fontSize: '14px',
      color: '#a9d8d0',
      align: 'center',
      wordWrap: { width: Math.max(280, this.scale.width - 36) },
    };
  }

  private microStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
      fontSize: '10px',
      color: '#719f9a',
      letterSpacing: 1,
      align: 'center',
    };
  }
}

export const getSceneSettings = (): SceneSettings => ({
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  debug:
    DEBUG_DEFAULT || new URLSearchParams(window.location.search).get('debug') === '1',
  safeArea: readSafeAreaInsets(),
});
