import { describe, expect, it } from 'vitest';
import { calculateLayout } from '../src/client/game/config/layout';

const viewports = [
  [360, 800],
  [390, 844],
  [412, 915],
  [768, 1024],
  [1280, 720],
] as const;

describe('responsive game layout', () => {
  it.each(viewports)('separates header, world, and action zones at %d×%d', (width, height) => {
    const layout = calculateLayout(width, height);
    const headerBottom = layout.headerBounds.y + layout.headerBounds.height;
    const worldBottom = layout.worldBounds.y + layout.worldBounds.height;
    const actionBottom = layout.actionBounds.y + layout.actionBounds.height;

    expect(layout.headerBounds.y).toBeGreaterThanOrEqual(0);
    expect(headerBottom).toBe(layout.worldBounds.y);
    expect(worldBottom).toBe(layout.actionBounds.y);
    expect(actionBottom).toBe(height);
    expect(layout.worldBounds.height).toBeGreaterThan(300);
  });

  it.each(viewports)('keeps path targets and instructions separated at %d×%d', (width, height) => {
    const layout = calculateLayout(width, height);
    const halfTarget = 30;

    for (const node of Object.values(layout.pathNodes)) {
      expect(node.x - halfTarget).toBeGreaterThanOrEqual(layout.worldBounds.x);
      expect(node.x + halfTarget).toBeLessThanOrEqual(
        layout.worldBounds.x + layout.worldBounds.width
      );
      expect(node.y - halfTarget).toBeGreaterThanOrEqual(layout.worldBounds.y);
      expect(node.y + halfTarget).toBeLessThan(layout.instructionY - 8);
    }
  });

  it.each(viewports)('keeps decision hierarchy and both actions in bounds at %d×%d', (width, height) => {
    const layout = calculateLayout(width, height);
    const leftActionCenter = layout.centerX - layout.actionButtonOffset;
    const rightActionCenter = layout.centerX + layout.actionButtonOffset;
    const halfActionWidth = 68;
    const halfActionHeight = 24;
    const actionBottom = layout.actionBounds.y + layout.actionBounds.height;

    expect(layout.decisionStatusY).toBeGreaterThan(layout.actionBounds.y);
    expect(layout.decisionDetailY).toBeGreaterThan(layout.decisionStatusY);
    expect(leftActionCenter - halfActionWidth).toBeGreaterThanOrEqual(layout.actionBounds.x);
    expect(rightActionCenter + halfActionWidth).toBeLessThanOrEqual(
      layout.actionBounds.x + layout.actionBounds.width
    );
    expect(layout.actionButtonsY - halfActionHeight).toBeGreaterThan(layout.decisionDetailY);
    expect(layout.actionButtonsY + halfActionHeight).toBeLessThanOrEqual(actionBottom);
    expect(layout.moderatorButtonY - halfActionHeight).toBeGreaterThan(
      layout.isWide ? layout.actionBounds.y : layout.decisionDetailY
    );
    expect(layout.moderatorButtonY + halfActionHeight).toBeLessThanOrEqual(actionBottom);
    expect(layout.moderatorButtonX - halfActionWidth).toBeGreaterThanOrEqual(
      layout.actionBounds.x
    );
    expect(layout.moderatorButtonX + halfActionWidth).toBeLessThanOrEqual(
      layout.actionBounds.x + layout.actionBounds.width
    );
  });

  it('accounts for safe areas without shrinking touch geometry', () => {
    const layout = calculateLayout(390, 844, { top: 24, right: 8, bottom: 20, left: 8 });

    expect(layout.headerBounds.y).toBe(24);
    expect(layout.actionBounds.y + layout.actionBounds.height).toBe(824);
    expect(layout.pathNodes.west.x).toBeGreaterThanOrEqual(56);
    expect(layout.pathNodes.east.x).toBeLessThanOrEqual(334);
  });

  it('uses a dedicated wide composition', () => {
    const wide = calculateLayout(1280, 720);
    const portrait = calculateLayout(390, 844);

    expect(wide.isWide).toBe(true);
    expect(wide.density).toBe('wide');
    expect(wide.actionBounds.height).toBeLessThan(portrait.actionBounds.height);
    expect(wide.pathNodes.east.y).not.toBe(wide.pathNodes.west.y);
  });
});
