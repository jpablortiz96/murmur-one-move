import * as Phaser from 'phaser';
import type { CombinedTruth, ExpeditionPublicView } from '../../../shared/contracts/expedition';
import type { CommunityCounts } from '../../../shared/contracts/round';
import type { LayoutMetrics } from '../config/layout';
import { createExpeditionMapNodes } from '../systems/expeditionPresentation';

export class ExpeditionDisplay {
  private readonly map: Phaser.GameObjects.Container;
  private readonly mapGraphics: Phaser.GameObjects.Graphics;
  private readonly mapLabel: Phaser.GameObjects.Text;
  private readonly reveal: Phaser.GameObjects.Container;
  private readonly revealBackground: Phaser.GameObjects.Graphics;
  private readonly revealTitle: Phaser.GameObjects.Text;
  private readonly revealBody: Phaser.GameObjects.Text;
  private readonly revealFooter: Phaser.GameObjects.Text;
  private view: ExpeditionPublicView | null;
  private mapLineVisible = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly reducedMotion: boolean,
    view: ExpeditionPublicView | null
  ) {
    this.view = view;
    this.map = scene.add.container(0, 0).setDepth(55);
    this.mapGraphics = scene.add.graphics();
    this.mapLabel = scene.add.text(0, 0, '', {
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', fontSize: '9px',
      color: '#8fc7bd', letterSpacing: 1.1, align: 'center',
    }).setOrigin(1, 0.5);
    this.map.add([this.mapGraphics, this.mapLabel]);

    this.reveal = scene.add.container(0, 0).setDepth(80).setVisible(false);
    this.revealBackground = scene.add.graphics();
    this.revealTitle = scene.add.text(0, -138, '', {
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', fontSize: '15px',
      color: '#e8fff8', letterSpacing: 2.2, align: 'center',
    }).setOrigin(0.5);
    this.revealBody = scene.add.text(0, -94, '', {
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', fontSize: '12px',
      color: '#b8e2da', lineSpacing: 7, align: 'left', wordWrap: { width: 286 },
    }).setOrigin(0.5, 0);
    this.revealFooter = scene.add.text(0, 106, '', {
      fontFamily: 'Trebuchet MS, Segoe UI, sans-serif', fontSize: '12px',
      color: '#f3fff9', fontStyle: 'bold', letterSpacing: 1.2,
      align: 'center', wordWrap: { width: 292 },
    }).setOrigin(0.5, 0);
    this.reveal.add([this.revealBackground, this.revealTitle, this.revealBody, this.revealFooter]);
    this.redrawMap();
  }

  update(view: ExpeditionPublicView | null): void {
    this.view = view;
    this.redrawMap();
  }

  layout(metrics: LayoutMetrics): void {
    this.map.setPosition(metrics.centerX, metrics.worldBounds.y - 4);
    this.reveal.setPosition(metrics.centerX, metrics.centerY);
    const width = Math.min(340, metrics.width - 20);
    const height = Math.min(360, metrics.worldBounds.height + 70);
    this.revealBackground.clear()
      .fillStyle(0x031113, 0.96).fillEllipse(0, 0, width, height)
      .lineStyle(1.5, 0x69d8c3, 0.65).strokeEllipse(0, 0, width, height)
      .lineStyle(1, 0x2d746d, 0.42).strokeEllipse(0, 0, width - 18, height - 16);
    this.revealBody.setWordWrapWidth(Math.min(286, width - 42));
    this.revealFooter.setWordWrapWidth(Math.min(292, width - 36));
  }

  /**
   * Every stage writes to the same reveal container, so two stages can never
   * occupy the main zone at once. The small map line is hidden while the reveal
   * is up, because the reveal ellipse would otherwise sit on top of it.
   */
  private showStage(title: string, body: string, footer: string, animate: boolean): void {
    this.reveal.setVisible(true).setAlpha(1);
    this.revealTitle.setText(title);
    this.revealBody.setText(body);
    this.revealFooter.setText(footer);
    if (!animate || this.reducedMotion) {
      this.revealTitle.setAlpha(1);
      this.revealBody.setAlpha(1);
      this.revealFooter.setAlpha(1);
      return;
    }
    this.revealTitle.setAlpha(0);
    this.revealBody.setAlpha(0);
    this.revealFooter.setAlpha(0);
    this.scene.tweens.add({ targets: this.revealTitle, alpha: 1, duration: 200 });
    this.scene.tweens.add({ targets: this.revealBody, alpha: 1, duration: 320, delay: 160 });
    this.scene.tweens.add({ targets: this.revealFooter, alpha: 1, duration: 280, delay: 320 });
  }

  /** Stage 1: what the community chose, without revealing the three senses yet. */
  showSummary(direction: string, counts: CommunityCounts, severity: string, animate = true): void {
    this.showStage(
      'THE COMMUNITY MOVED',
      [
        `MURMUR FOLLOWS ${direction.toUpperCase()}`,
        '',
        `N${counts.north}  E${counts.east}  S${counts.south}  W${counts.west}`,
        `${counts.total} ${counts.total === 1 ? 'SIGNAL' : 'SIGNALS'} · SNAPSHOT SEALED`,
      ].join('\n'),
      severity.toUpperCase(),
      animate
    );
  }

  /** Stage 2: the three partial truths only. */
  showThreeTruths(truth: CombinedTruth, animate = true): void {
    this.showStage(
      'THREE TRUTHS · ONE PATH',
      [
        'WHAT ECHO HEARD', truth.echo,
        '', 'WHAT HEAT FELT', truth.heat,
        '', 'WHAT WIND CARRIED', truth.wind,
      ].join('\n'),
      '',
      animate
    );
  }

  /** Stage 3: the consequence only. */
  showConsequence(truth: CombinedTruth, animate = true): void {
    this.showStage('ONE CONSEQUENCE', truth.consequence, truth.severity.toUpperCase(), animate);
  }

  hideResolution(): void {
    this.reveal.setVisible(false);
  }

  /** The seven-node line is owned by the caller so it never coexists with a stage that would cover it. */
  setMapLineVisible(visible: boolean): void {
    this.mapLineVisible = visible;
    this.map.setVisible(visible && this.view !== null);
  }

  showMapState(): void {
    if (!this.view) return;
    const history = this.view.history.map((day) => `D${day.day} ${day.direction.toUpperCase()} · ${day.severity.toUpperCase()}`);
    this.reveal.setVisible(true).setAlpha(1);
    this.revealTitle.setText(`DAY ${this.view.currentDay} OF 7 · ${this.view.murmur.condition.toUpperCase()}`);
    this.revealBody.setText([
      `VITAL LIGHT ${this.view.murmur.vitality}/3`,
      `MEMORY ${this.view.murmur.memoryFragments}`,
      `SCARS ${this.view.murmur.scars.length ? this.view.murmur.scars.join(' · ') : 'NONE'}`,
      '',
      ...(history.length ? history : ['No hollow has been resolved yet.']),
    ].join('\n'));
    this.revealFooter.setText(this.view.status === 'completed'
      ? (this.view.ending ?? 'EXPEDITION COMPLETE').replaceAll('-', ' ').toUpperCase()
      : this.view.chapter.cliffhanger);
  }

  destroy(): void {
    this.map.destroy(true);
    this.reveal.destroy(true);
  }

  private redrawMap(): void {
    this.mapGraphics.clear();
    if (!this.view) {
      this.map.setVisible(false);
      return;
    }
    // Never override the caller's exclusivity decision on a redraw/update.
    this.map.setVisible(this.mapLineVisible);
    const spacing = 27;
    const start = -spacing * 3;
    this.mapGraphics.lineStyle(2, 0x2c7770, 0.46).beginPath();
    for (let index = 0; index < 7; index += 1) {
      const x = start + index * spacing;
      const y = Math.sin(index * 1.35) * 3;
      if (index === 0) this.mapGraphics.moveTo(x, y);
      else this.mapGraphics.lineTo(x, y);
    }
    this.mapGraphics.strokePath();
    const nodes = createExpeditionMapNodes(this.view);
    for (let index = 0; index < nodes.length; index += 1) {
      const x = start + index * spacing;
      const y = Math.sin(index * 1.35) * 3;
      const node = nodes[index];
      const completed = node?.state === 'completed';
      const current = node?.state === 'current';
      this.mapGraphics.fillStyle(completed ? 0x9af5d9 : current ? 0x77d9c7 : 0x15383b, completed ? 0.9 : 0.72)
        .fillCircle(x, y, current ? 5 : 3.5);
      if (current) this.mapGraphics.lineStyle(1, 0xd8fff5, 0.8).strokeCircle(x, y, 8);
      if (completed) this.mapGraphics.lineStyle(1, 0x041314, 0.85).lineBetween(x - 3, y + 3, x + 3, y - 3);
    }
    this.mapLabel.setText(`${this.view.currentDay}/7 · ${this.view.murmur.condition.toUpperCase()}`).setPosition(-95, 0);
  }
}
