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
import { emitEchoWave } from '../effects/EchoPulse';
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
import { createSignalNode, type SignalNode } from '../ui/signalNode';

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
  private readonly directionNodes: Record<Direction, SignalNode> = {
    north: undefined!,
    east: undefined!,
    south: undefined!,
    west: undefined!,
  };
  private replayButton: WorldButton;
  private changeButton: WorldButton;
  private debugResetButton: WorldButton | null = null;
  private debugPulseButton: WorldButton | null = null;
  private decisionFeedbackTimer: Phaser.Time.TimerEvent | null = null;

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
        fontSize: '11px',
        color: '#699e99',
        letterSpacing: 1.5,
      })
      .setOrigin(0.5, 0);
    this.sensorText = this.add
      .text(0, 0, 'E C H O', {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '20px',
        color: '#bfffee',
        letterSpacing: 4,
      })
      .setOrigin(0.5)
      .setAlpha(this.settings.reducedMotion ? 1 : 0);
    this.instructionText = this.add.text(0, 0, '', this.bodyStyle()).setOrigin(0.5);
    this.pulseText = this.add.text(0, 0, '', this.microStyle()).setOrigin(0.5);
    this.resultText = this.add
      .text(0, 0, '', {
        ...this.bodyStyle(),
        color: '#ddfff6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.pendingText = this.add
      .text(0, 0, 'The community has not moved yet.', {
        ...this.bodyStyle(),
        fontSize: '12px',
        color: '#82b8b0',
      })
      .setOrigin(0.5);

    this.createDirectionNodes();
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

  private tryPulse(force: boolean): void {
    if (!force && !canEmitPulse(this.state)) return;
    if (!force) this.state = emitPulse(this.state);

    const pulseNumber = force
      ? (this.state.pulsesUsed % this.state.maxPulses) + 1
      : this.state.pulsesUsed;
    emitEchoWave(this, this.metrics, pulseNumber, this.settings.reducedMotion);
    this.cave.revealPulse(pulseNumber);
    this.murmur.echo(pulseNumber);
    if (pulseNumber === 3) this.murmur.flinchDanger();
    this.renderState();
  }

  private choose(direction: Direction): void {
    if (this.state.phase !== 'observing' || this.state.pulsesUsed < 1) return;
    this.state = selectDirection(this.state, direction);
    this.cave.setSelection(direction);
    this.directionNodes[direction].resonate();
    this.murmur.face(direction);
    this.murmur.calm();
    this.renderState();
    this.showDecisionFeedback(direction);
  }

  private change(): void {
    this.clearDecisionFeedback();
    this.state = changeChoice(this.state);
    this.cave.setSelection(null);
    this.murmur.face(null);
    this.renderState();
  }

  private replay(): void {
    this.clearDecisionFeedback();
    this.state = replaySignal();
    this.cave.setSelection(null);
    this.murmur.face(null);
    this.renderState();
    if (this.settings.reducedMotion) this.tryPulse(false);
    else this.time.delayedCall(180, () => this.tryPulse(false));
  }

  private resetDemo(): void {
    this.clearDecisionFeedback();
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
        ? ''
        : atLimit
          ? 'Choose what you trust.'
          : hasPulse
            ? 'Echo again, or hold a path.'
            : 'Touch the dark to listen.'
    );
    this.pulseText.setText(
      `ECHO ${this.state.pulsesUsed} OF ${this.state.maxPulses}${atLimit ? '  ·  SPENT' : ''}`
    );
    this.instructionText.setVisible(!decided);
    this.pulseText.setVisible(!decided);

    for (const direction of AVAILABLE_DIRECTIONS) {
      const node = this.directionNodes[direction];
      const selected = this.state.selection === direction;
      node.container.setVisible(hasPulse);
      node.setSelected(selected);
      node.setDimmed(decided && !selected);
      node.setEnabled(!decided);
    }

    if (!decided) {
      this.resultText.setVisible(false);
      this.pendingText.setVisible(false);
      this.replayButton.container.setVisible(false);
      this.changeButton.container.setVisible(false);
    } else if (this.decisionFeedbackTimer === null) {
      this.showPersistentDecision();
    }
    this.updateDebugText();
  }

  private showDecisionFeedback(direction: Direction): void {
    this.clearDecisionFeedback();
    this.resultText.setText('Signal recorded').setVisible(true).setAlpha(1);
    this.pendingText.setVisible(false);
    this.replayButton.container.setVisible(false);
    this.changeButton.container.setVisible(false);
    this.decisionFeedbackTimer = this.time.delayedCall(900, () => {
      this.decisionFeedbackTimer = null;
      if (this.state.selection === direction) this.showPersistentDecision();
    });
  }

  private showPersistentDecision(): void {
    if (this.state.selection === null) return;
    this.resultText
      .setText(`${this.state.selection.toUpperCase()} SIGNAL HELD`)
      .setVisible(true);
    this.pendingText.setVisible(true);
    this.replayButton.container.setVisible(true);
    this.changeButton.container.setVisible(true);

    if (this.settings.reducedMotion) {
      this.resultText.setAlpha(1);
      this.pendingText.setAlpha(1);
      this.replayButton.container.setAlpha(1);
      this.changeButton.container.setAlpha(1);
      return;
    }

    const targets = [
      this.resultText,
      this.pendingText,
      this.replayButton.container,
      this.changeButton.container,
    ];
    targets.forEach((target) => target.setAlpha(0));
    this.tweens.add({
      targets,
      alpha: 1,
      duration: 280,
      ease: 'Sine.Out',
    });
  }

  private clearDecisionFeedback(): void {
    this.decisionFeedbackTimer?.remove(false);
    this.decisionFeedbackTimer = null;
    this.tweens.killTweensOf([
      this.resultText,
      this.pendingText,
      this.replayButton.container,
      this.changeButton.container,
    ]);
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.metrics = calculateLayout(width, height, this.settings.safeArea);
    const { centerX, centerY, pathNodes } = this.metrics;

    this.cameras.resize(width, height);
    this.cave.layout(this.metrics);
    this.murmur.setPosition(centerX, centerY);
    this.titleText.setPosition(centerX, this.metrics.titleY);
    this.chapterText.setPosition(centerX, this.metrics.chapterY);
    this.sensorText.setPosition(centerX, this.metrics.sensorY);
    this.instructionText.setPosition(centerX, this.metrics.instructionY);
    this.pulseText.setPosition(centerX, this.metrics.pulseCounterY);
    this.resultText.setPosition(centerX, this.metrics.decisionStatusY);
    this.pendingText.setPosition(centerX, this.metrics.decisionDetailY);

    this.directionNodes.north.container.setPosition(pathNodes.north.x, pathNodes.north.y);
    this.directionNodes.east.container.setPosition(pathNodes.east.x, pathNodes.east.y);
    this.directionNodes.south.container.setPosition(pathNodes.south.x, pathNodes.south.y);
    this.directionNodes.west.container.setPosition(pathNodes.west.x, pathNodes.west.y);
    this.replayButton.container.setPosition(
      centerX - this.metrics.actionButtonOffset,
      this.metrics.actionButtonsY
    );
    this.changeButton.container.setPosition(
      centerX + this.metrics.actionButtonOffset,
      this.metrics.actionButtonsY
    );

    this.debugText?.setPosition(6, 6);
    this.debugResetButton?.container.setPosition(width - 52, 31);
    this.debugPulseButton?.container.setPosition(width - 52, 82);
    this.updateDebugText();
  }

  private createDirectionNodes(): void {
    this.directionNodes.north = createSignalNode(
      this,
      'north',
      this.settings.reducedMotion,
      () => this.choose('north')
    );
    this.directionNodes.east = createSignalNode(
      this,
      'east',
      this.settings.reducedMotion,
      () => this.choose('east')
    );
    this.directionNodes.south = createSignalNode(
      this,
      'south',
      this.settings.reducedMotion,
      () => this.choose('south')
    );
    this.directionNodes.west = createSignalNode(
      this,
      'west',
      this.settings.reducedMotion,
      () => this.choose('west')
    );
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
      .setOrigin(0, 0)
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
      letterSpacing: 5.5,
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
      fontSize: '11px',
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
