import * as Phaser from 'phaser';
import { parseBootstrap } from '../../../shared/contracts/bootstrap';

export class BootstrapScene extends Phaser.Scene {
  private statusText: Phaser.GameObjects.Text;
  private ring: Phaser.GameObjects.Arc;
  private retryButton: Phaser.GameObjects.Text | null = null;
  private loading = false;

  constructor() {
    super('Bootstrap');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x050b0e);
    this.ring = this.add
      .circle(0, 0, 27)
      .setStrokeStyle(2, 0x75dfca, 0.7)
      .setFillStyle(0x153c3f, 0.2);
    this.statusText = this.add
      .text(0, 0, 'TUNING THE CAVERN…', {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '13px',
        color: '#b5e7de',
        letterSpacing: 2,
        align: 'center',
      })
      .setOrigin(0.5);

    this.layout();
    this.scale.on('resize', () => this.layout());
    this.tweens.add({
      targets: this.ring,
      alpha: 0.2,
      scale: 1.28,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    void this.loadBootstrap();
  }

  private async loadBootstrap(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.retryButton?.destroy();
    this.retryButton = null;
    this.statusText.setText('TUNING THE CAVERN…');
    this.ring.setVisible(true);

    try {
      const response = await fetch('/api/bootstrap', {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Bootstrap request returned HTTP ${response.status}`);
      }

      const payload: unknown = await response.json();
      const bootstrap = parseBootstrap(payload);
      if (bootstrap === null) {
        throw new Error('Bootstrap response did not match the MURMUR contract');
      }

      this.scene.start('Murmur', bootstrap);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown bootstrap failure';
      console.error('Unable to enter MURMUR:', detail);
      this.showError();
    } finally {
      this.loading = false;
    }
  }

  private showError(): void {
    this.ring.setVisible(false);
    this.statusText.setText('THE SIGNAL BROKE\nNothing was recorded.');
    this.retryButton = this.add
      .text(0, 0, 'RETRY SIGNAL', {
        fontFamily: 'Trebuchet MS, Segoe UI, sans-serif',
        fontSize: '14px',
        color: '#dffff7',
        backgroundColor: '#0a282d',
        padding: { x: 22, y: 15 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => void this.loadBootstrap());
    this.layout();
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.cameras.resize(width, height);
    this.ring?.setPosition(width / 2, height / 2 - 32);
    this.statusText?.setPosition(width / 2, height / 2 + 26);
    this.retryButton?.setPosition(width / 2, height / 2 + 104);
  }
}

