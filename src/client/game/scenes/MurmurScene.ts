import * as Phaser from 'phaser';
import type { BootstrapResponse } from '../../../shared/contracts/bootstrap';
import type { PlayerSession } from '../../../shared/contracts/session';
import { AVAILABLE_DIRECTIONS, DEBUG_DEFAULT } from '../../../shared/constants/game';
import type { Direction } from '../../../shared/types/game';
import {
  calculateLayout,
  readSafeAreaInsets,
  type Insets,
  type LayoutMetrics,
} from '../config/layout';
import { CaveField } from '../effects/CaveField';
import { Murmur } from '../entities/Murmur';
import {
  changeChoice,
  createDecisionState,
  replaySignal,
  selectDirection,
  type DecisionState,
} from '../systems/decisionState';
import {
  CommunityApiError,
  createVoteRequestId,
  fetchPlayerSession,
  resolveCommunityRound,
  submitCommunityVote,
} from '../systems/communityClient';
import { createWorldButton, type WorldButton } from '../ui/worldButton';
import { createSignalNode, type SignalNode } from '../ui/signalNode';
import { createSensorExperience } from '../sensors/createSensorExperience';
import type { SensorExperience } from '../sensors/SensorExperience';

type SceneSettings = {
  reducedMotion: boolean;
  debug: boolean;
  safeArea: Insets;
};

type MurmurSceneData = {
  bootstrap: BootstrapResponse;
  session: PlayerSession;
};

export class MurmurScene extends Phaser.Scene {
  private bootstrap: BootstrapResponse;
  private session: PlayerSession;
  private settings: SceneSettings;
  private state: DecisionState = createDecisionState();
  private metrics: LayoutMetrics;
  private cave: CaveField;
  private murmur: Murmur;
  private titleText: Phaser.GameObjects.Text;
  private chapterText: Phaser.GameObjects.Text;
  private sensorText: Phaser.GameObjects.Text;
  private senseIntroText: Phaser.GameObjects.Text;
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
  private resolveButton: WorldButton;
  private debugResetButton: WorldButton | null = null;
  private debugPulseButton: WorldButton | null = null;
  private decisionFeedbackTimer: Phaser.Time.TimerEvent | null = null;
  private sensorExperience: SensorExperience;
  private sessionLoading = false;
  private roundError: string | null = null;
  private voteSubmitting = false;
  private voteRequestId: string | null = null;
  private resolutionArmed = false;
  private resolutionArmTimer: Phaser.Time.TimerEvent | null = null;
  private outcomePlayed = false;

  constructor() {
    super('Murmur');
  }

  init(data: MurmurSceneData): void {
    this.bootstrap = data.bootstrap;
    this.session = data.session;
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
      .text(0, 0, this.session.player.sensor.toUpperCase().split('').join(' '), {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '20px',
        color: '#bfffee',
        letterSpacing: 4,
      })
      .setOrigin(0.5)
      .setAlpha(this.settings.reducedMotion ? 1 : 0);
    this.senseIntroText = this.add
      .text(0, 0, this.senseIntroduction(), {
        ...this.bodyStyle(),
        fontSize: '13px',
        color: '#d9fff5',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5)
      .setDepth(60);
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
    this.sensorExperience = createSensorExperience(this.session.player.sensor, {
      scene: this,
      perception: this.session.perception,
      murmur: this.murmur,
      reducedMotion: this.settings.reducedMotion,
      metrics: () => this.metrics,
      onProgress: (progress) => {
        this.state = { ...this.state, pulsesUsed: progress.used };
        this.renderState();
      },
    });
    this.sensorExperience.enter();
    this.replayButton = createWorldButton(this, 'CONFIRM SIGNAL', 136, () =>
      this.handlePrimaryAction()
    );
    this.changeButton = createWorldButton(this, 'CHANGE CHOICE', 136, () => this.change());
    this.resolveButton = createWorldButton(this, 'MOD · RESOLVE', 136, () =>
      this.handleResolveAction()
    );
    this.resolveButton.container.setVisible(false);

    if (this.settings.debug) this.createDebugLayer();

    this.layout();
    const restoredDirection = this.session.round.resolution?.winningDirection ?? this.session.round.currentVote;
    if (restoredDirection) {
      this.state = { ...this.state, phase: 'decided', pulsesUsed: 1, selection: restoredDirection };
      this.cave.setSelection(restoredDirection);
      this.murmur.face(restoredDirection);
    }
    this.renderState();
    this.scale.on('resize', () => this.layout());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.sensorExperience.destroy());

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
    const introDuration = this.settings.reducedMotion ? 1100 : 1800;
    this.time.delayedCall(introDuration, () => {
      if (this.settings.reducedMotion) this.senseIntroText.setVisible(false);
      else this.tweens.add({ targets: this.senseIntroText, alpha: 0, duration: 360, onComplete: () => this.senseIntroText.setVisible(false) });
    });
    if (this.session.expedition.status === 'resolved') this.playOutcome();
  }

  private tryActivation(): void {
    this.sensorExperience.forceActivate();
  }

  private choose(direction: Direction): void {
    if (this.state.phase !== 'observing' || this.state.pulsesUsed < 1) return;
    this.state = selectDirection(this.state, direction);
    this.cave.setSelection(direction);
    this.directionNodes[direction].resonate();
    this.murmur.face(direction);
    this.murmur.calm();
    this.voteRequestId = null;
    this.disarmResolution();
    this.renderState();
    this.showDecisionFeedback(direction);
  }

  private change(): void {
    this.clearDecisionFeedback();
    this.state = changeChoice(this.state);
    this.cave.setSelection(null);
    this.murmur.face(null);
    this.voteRequestId = null;
    this.disarmResolution();
    this.renderState();
  }

  private replay(): void {
    this.clearDecisionFeedback();
    this.state = replaySignal();
    this.sensorExperience.replay();
    this.cave.setSelection(null);
    this.murmur.face(null);
    this.voteRequestId = null;
    this.disarmResolution();
    this.renderState();
  }

  private resetDemo(): void {
    this.clearDecisionFeedback();
    this.state = createDecisionState();
    this.sensorExperience.reset();
    this.cave.setSelection(null);
    this.murmur.face(null);
    this.voteRequestId = null;
    this.disarmResolution();
    this.renderState();
  }

  private renderState(): void {
    const hasPulse = this.state.pulsesUsed > 0;
    const decided = this.state.phase === 'decided';
    const atLimit = this.state.pulsesUsed >= this.state.maxPulses;

    const accessibleSignal = this.sensorExperience.getAccessibleSignal();
    const gestureInstruction = this.sensorExperience.getInstruction();
    this.instructionText.setText(
      decided ? '' : accessibleSignal ? `${accessibleSignal}\n${gestureInstruction}` : gestureInstruction
    );
    const communityLine = this.communityLine();
    this.pulseText.setText(
      `${this.session.player.sensor.toUpperCase()} ${this.state.pulsesUsed} OF ${this.state.maxPulses}${atLimit ? '  ·  COMPLETE' : ''}` +
        `\n${communityLine}`
    );
    this.instructionText.setVisible(!decided);
    this.pulseText.setVisible(!decided);

    for (const direction of AVAILABLE_DIRECTIONS) {
      const node = this.directionNodes[direction];
      const selected = this.state.selection === direction;
      node.container.setVisible(hasPulse);
      node.setSelected(selected);
      node.setDimmed(decided && !selected);
      node.setEnabled(!decided && !this.voteSubmitting);
    }

    if (!decided) {
      this.resultText.setVisible(false);
      this.pendingText.setVisible(false);
      this.replayButton.container.setVisible(false);
      this.changeButton.container.setVisible(false);
      this.resolveButton.container.setVisible(false);
    } else if (this.decisionFeedbackTimer === null) {
      this.showPersistentDecision();
    }
    this.positionActionButtons();
    this.updateDebugText();
  }

  private showDecisionFeedback(direction: Direction): void {
    this.clearDecisionFeedback();
    this.resultText.setText('Signal ready').setVisible(true).setAlpha(1);
    this.pendingText.setVisible(false);
    this.replayButton.container.setVisible(false);
    this.changeButton.container.setVisible(false);
    this.resolveButton.container.setVisible(false);
    this.decisionFeedbackTimer = this.time.delayedCall(900, () => {
      this.decisionFeedbackTimer = null;
      if (this.state.selection === direction) this.showPersistentDecision();
    });
  }

  private showPersistentDecision(): void {
    if (this.state.selection === null) return;
    if (this.session.expedition.status === 'resolved' && this.session.round.resolution) {
      this.showResolvedDecision();
      return;
    }
    const isHeld = this.session.round.currentVote === this.state.selection;
    this.resultText
      .setText(
        this.voteSubmitting
          ? 'SENDING THROUGH THE CAVERN…'
          : isHeld
            ? `${this.state.selection.toUpperCase()} VOTE HELD`
            : `${this.state.selection.toUpperCase()} SIGNAL READY`
      )
      .setVisible(true);
    this.pendingText
      .setText(
        this.roundError
          ? this.roundError
          : this.sessionLoading
            ? 'Tuning the community signal…'
            : isHeld
              ? this.communityLine()
              : this.session.player.authentication === 'authenticated'
                ? `Confirm to join ${this.session.round.counts.total} active signals.`
                : 'Sign in to receive a stable sense and join the signal.'
      )
      .setVisible(true);
    this.replayButton.container.setVisible(true);
    this.changeButton.container.setVisible(true);
    this.resolveButton.container.setVisible(
      Boolean(this.session.round.canResolve && isHeld)
    );
    this.replayButton.setEnabled(!this.voteSubmitting);
    this.changeButton.setEnabled(!this.voteSubmitting);
    this.replayButton.setLabel(
      this.roundError
        ? 'RETRY COMMUNITY'
        : isHeld
          ? 'REPLAY SIGNAL'
          : 'CONFIRM SIGNAL'
    );
    this.changeButton.setLabel(isHeld ? 'CHANGE VOTE' : 'CHANGE CHOICE');
    this.resolveButton.setLabel(
      this.resolutionArmed ? 'CONFIRM RESOLVE' : 'MOD · RESOLVE'
    );
    this.resolveButton.setEnabled(!this.voteSubmitting);

    if (this.settings.reducedMotion) {
      this.resultText.setAlpha(1);
      this.pendingText.setAlpha(1);
      this.replayButton.container.setAlpha(1);
      this.changeButton.container.setAlpha(1);
      this.resolveButton.container.setAlpha(1);
      return;
    }

    const targets = [
      this.resultText,
      this.pendingText,
      this.replayButton.container,
      this.changeButton.container,
      this.resolveButton.container,
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
      this.resolveButton.container,
    ]);
  }

  private disarmResolution(): void {
    this.resolutionArmed = false;
    this.resolutionArmTimer?.remove(false);
    this.resolutionArmTimer = null;
  }

  private async refreshSession(): Promise<void> {
    if (this.sessionLoading) return;
    this.sessionLoading = true;
    this.roundError = null;
    this.renderState();
    try {
      const session = await fetchPlayerSession();
      if (session.player.sensor !== this.session.player.sensor) {
        throw new Error('Stable sense changed during the same round');
      }
      this.session = session;
      const direction = session.round.resolution?.winningDirection ?? session.round.currentVote;
      if (direction) {
        this.state = {
          ...this.state,
          phase: 'decided',
          pulsesUsed: Math.max(1, this.state.pulsesUsed),
          selection: direction,
        };
        this.cave.setSelection(direction);
        this.murmur.face(direction);
      }
      if (session.expedition.status === 'resolved') this.playOutcome();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Private session unavailable';
      console.error('Unable to refresh private session:', message);
      this.roundError = 'Community signal unavailable. Retry safely.';
    } finally {
      this.sessionLoading = false;
      this.renderState();
    }
  }

  private async confirmVote(): Promise<void> {
    const direction = this.state.selection;
    if (!direction || this.voteSubmitting) return;
    if (this.roundError) {
      await this.refreshSession();
      if (this.roundError) return;
    }
    if (this.session.player.authentication !== 'authenticated') {
      this.roundError = 'Sign in to Reddit, then retry this signal.';
      this.renderState();
      return;
    }
    if (this.session.expedition.status !== 'open') {
      this.playOutcome();
      return;
    }
    this.voteSubmitting = true;
    this.roundError = null;
    this.voteRequestId ??= createVoteRequestId();
    this.renderState();
    try {
      const result = await submitCommunityVote(direction, this.voteRequestId);
      this.session = {
        ...this.session,
        round: {
          ...this.session.round,
          counts: result.counts,
          currentVote: result.activeVote.direction,
          revision: result.activeVote.revision,
        },
      };
      this.voteRequestId = null;
      this.murmur.calm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Vote could not be recorded';
      console.error('Unable to confirm MURMUR vote:', message);
      this.roundError =
        error instanceof CommunityApiError && error.status === 409
          ? 'The round changed. Refreshing the frozen signal…'
          : 'Signal not recorded. Retry is safe.';
      if (error instanceof CommunityApiError && error.status === 409) {
        await this.refreshSession();
      }
    } finally {
      this.voteSubmitting = false;
      this.renderState();
    }
  }

  private handlePrimaryAction(): void {
    if (this.roundError) {
      void this.refreshSession();
      return;
    }
    if (this.session.expedition.status === 'resolved') {
      this.playOutcome(true);
      return;
    }
    const held =
      this.state.selection !== null &&
      this.session.round.currentVote === this.state.selection;
    if (held) this.replay();
    else void this.confirmVote();
  }

  private handleResolveAction(): void {
    const held =
      this.state.selection !== null &&
      this.session.round.currentVote === this.state.selection;
    if (!held || !this.session.round.canResolve || this.voteSubmitting) return;
    if (!this.resolutionArmed) {
      this.resolutionArmed = true;
      this.resolutionArmTimer?.remove(false);
      this.resolutionArmTimer = this.time.delayedCall(3500, () => {
        this.resolutionArmed = false;
        this.renderState();
      });
      this.renderState();
      return;
    }
    void this.resolveRound();
  }

  private async resolveRound(): Promise<void> {
    if (this.voteSubmitting) return;
    this.voteSubmitting = true;
    this.resolutionArmed = false;
    this.resolutionArmTimer?.remove(false);
    this.renderState();
    try {
      const result = await resolveCommunityRound();
      this.session = {
        ...this.session,
        expedition: { ...this.session.expedition, status: 'resolved' },
        round: {
          ...this.session.round,
          counts: result.resolution.countsSnapshot,
          resolution: result.resolution,
          canVote: false,
          canResolve: false,
        },
      };
      this.playOutcome();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Resolution failed';
      console.error('Unable to resolve MURMUR round:', message);
      this.roundError = 'Resolution failed without changing the round.';
    } finally {
      this.voteSubmitting = false;
      this.renderState();
    }
  }

  private playOutcome(replay = false): void {
    const direction = this.session.round.resolution?.winningDirection;
    if (!direction || (this.outcomePlayed && !replay)) return;
    this.outcomePlayed = true;
    this.state = {
      ...this.state,
      phase: 'decided',
      selection: direction,
      pulsesUsed: Math.max(1, this.state.pulsesUsed),
    };
    this.cave.setSelection(direction);
    this.murmur.face(direction);
    const target = this.metrics.pathNodes[direction];
    const x = this.metrics.centerX + (target.x - this.metrics.centerX) * 0.34;
    const y = this.metrics.centerY + (target.y - this.metrics.centerY) * 0.34;
    this.tweens.killTweensOf(this.murmur);
    if (this.settings.reducedMotion) this.murmur.setPosition(x, y);
    else {
      this.murmur.setPosition(this.metrics.centerX, this.metrics.centerY);
      this.tweens.add({ targets: this.murmur, x, y, duration: 900, ease: 'Sine.InOut' });
    }
    this.renderState();
  }

  private showResolvedDecision(): void {
    const resolution = this.session.round.resolution;
    if (!resolution) return;
    this.resultText
      .setText(`MURMUR FOLLOWS ${resolution.winningDirection.toUpperCase()}`)
      .setVisible(true)
      .setAlpha(1);
    this.pendingText
      .setText(`${this.communityLine()} · Snapshot sealed.`)
      .setVisible(true)
      .setAlpha(1);
    this.replayButton.setLabel('REPLAY OUTCOME');
    this.replayButton.setEnabled(true);
    this.replayButton.container.setVisible(true).setAlpha(1);
    this.changeButton.container.setVisible(false);
    this.resolveButton.container.setVisible(false);
    this.positionActionButtons();
  }

  private communityLine(): string {
    if (this.sessionLoading) return 'COMMUNITY · TUNING';
    const { counts } = this.session.round;
    return `N ${counts.north} · E ${counts.east} · S ${counts.south} · W ${counts.west} · ${counts.total} SIGNALS`;
  }

  private positionActionButtons(): void {
    if (!this.metrics || !this.replayButton || !this.changeButton || !this.resolveButton) return;
    const singleAction = this.session.expedition.status === 'resolved';
    this.replayButton.container.setPosition(
      singleAction ? this.metrics.centerX : this.metrics.centerX - this.metrics.actionButtonOffset,
      this.metrics.actionButtonsY
    );
    this.changeButton.container.setPosition(
      this.metrics.centerX + this.metrics.actionButtonOffset,
      this.metrics.actionButtonsY
    );
    this.resolveButton.container.setPosition(
      this.metrics.moderatorButtonX,
      this.metrics.moderatorButtonY
    );
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
    this.senseIntroText.setPosition(centerX, centerY - 8);
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
    this.resolveButton.container.setPosition(
      this.metrics.moderatorButtonX,
      this.metrics.moderatorButtonY
    );

    if (this.outcomePlayed && this.session.round.resolution) {
      const target = pathNodes[this.session.round.resolution.winningDirection];
      this.murmur.setPosition(
        centerX + (target.x - centerX) * 0.34,
        centerY + (target.y - centerY) * 0.34
      );
    }
    this.positionActionButtons();

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
    this.debugPulseButton = createWorldButton(this, 'ACTIVATE', 96, () => this.tryActivation());
    this.debugResetButton.container.setDepth(100);
    this.debugPulseButton.container.setDepth(100);
  }

  private updateDebugText(): void {
    this.debugText?.setText(
      `DEBUG · ${this.scale.width}×${this.scale.height}\n` +
        `${this.session.player.sensor} · activations ${this.state.pulsesUsed}/${this.state.maxPulses}\n` +
        `choice ${this.state.selection ?? 'none'} · round ${this.session.expedition.status}\n` +
        `total ${this.session.round.counts.total} · reduced ${this.settings.reducedMotion}`
    );
  }

  private senseIntroduction(): string {
    const copy = {
      echo: ['ECHO', 'You hear what the stone refuses to show.', 'Touch to send up to three pulses.'],
      heat: ['HEAT', 'You feel what is waiting in the dark.', 'Press and hold to focus up to three regions.'],
      wind: ['WIND', 'You follow what the cavern carries.', 'Drag briefly to release up to three tracers.'],
    } as const;
    const [name, line, gesture] = copy[this.session.player.sensor];
    const guest = this.session.player.stableAssignment
      ? ''
      : '\nDEMO SENSE · Sign in for a stable assignment.';
    return `YOUR SENSE\n${name}\n${line}\n\nYour signal is only part of the truth.\n${gesture}${guest}`;
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
