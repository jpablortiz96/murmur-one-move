import type { Direction } from '../../../shared/types/game';

export type Insets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type LayoutRectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutPoint = {
  x: number;
  y: number;
};

export type VisualDensity = 'compact' | 'balanced' | 'spacious' | 'wide';

export type LayoutMetrics = {
  width: number;
  height: number;
  aspectRatio: number;
  isCompact: boolean;
  isWide: boolean;
  isPortrait: boolean;
  density: VisualDensity;
  safeArea: Insets;
  headerBounds: LayoutRectangle;
  worldBounds: LayoutRectangle;
  actionBounds: LayoutRectangle;
  centerX: number;
  centerY: number;
  uiScale: number;
  titleY: number;
  chapterY: number;
  sensorY: number;
  instructionY: number;
  pulseCounterY: number;
  decisionStatusY: number;
  decisionDetailY: number;
  actionButtonsY: number;
  actionButtonOffset: number;
  pathNodes: Record<Direction, LayoutPoint>;
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

const normalizeInset = (value: number | undefined): number =>
  Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;

export const calculateLayout = (
  width: number,
  height: number,
  safeAreaInput: Partial<Insets> = {}
): LayoutMetrics => {
  if (width <= 0 || height <= 0) {
    throw new Error('Layout dimensions must be positive');
  }

  const safeArea: Insets = {
    top: normalizeInset(safeAreaInput.top),
    right: normalizeInset(safeAreaInput.right),
    bottom: normalizeInset(safeAreaInput.bottom),
    left: normalizeInset(safeAreaInput.left),
  };
  const aspectRatio = width / height;
  const isWide = aspectRatio >= 1.35;
  const isPortrait = !isWide;
  const isCompact = width <= 390 || height <= 760;
  const density: VisualDensity = isWide
    ? 'wide'
    : width >= 700
      ? 'spacious'
      : isCompact
        ? 'compact'
        : 'balanced';
  const uiScale = clamp(Math.min(width / 390, height / 844), 0.94, 1.12);
  const usableTop = safeArea.top;
  const usableBottom = height - safeArea.bottom;
  const headerHeight = isWide ? 106 : density === 'spacious' ? 124 : isCompact ? 112 : 120;
  const actionHeight = isWide ? 132 : density === 'spacious' ? 190 : isCompact ? 180 : 186;

  const headerBounds: LayoutRectangle = {
    x: safeArea.left,
    y: usableTop,
    width: width - safeArea.left - safeArea.right,
    height: headerHeight,
  };
  const actionBounds: LayoutRectangle = {
    x: safeArea.left,
    y: usableBottom - actionHeight,
    width: width - safeArea.left - safeArea.right,
    height: actionHeight,
  };
  const worldBounds: LayoutRectangle = {
    x: safeArea.left,
    y: headerBounds.y + headerBounds.height,
    width: width - safeArea.left - safeArea.right,
    height: actionBounds.y - (headerBounds.y + headerBounds.height),
  };
  const centerX = worldBounds.x + worldBounds.width / 2;
  const centerY = worldBounds.y + worldBounds.height * 0.46;
  const sideInset = clamp(worldBounds.width * 0.13, 48, isWide ? 116 : 78);
  const northInset = clamp(worldBounds.height * 0.17, 72, 92);
  const southReach = isWide ? 176 : 166 * uiScale;
  const southInset = isWide ? 64 : density === 'spacious' ? 82 : 70;
  const instructionInset = isWide ? 22 : density === 'spacious' ? 30 : 26;

  return {
    width,
    height,
    aspectRatio,
    isCompact,
    isWide,
    isPortrait,
    density,
    safeArea,
    headerBounds,
    worldBounds,
    actionBounds,
    centerX,
    centerY,
    uiScale,
    titleY: headerBounds.y + 13,
    chapterY: headerBounds.y + 44,
    sensorY: headerBounds.y + headerBounds.height - 20,
    instructionY: worldBounds.y + worldBounds.height - instructionInset,
    pulseCounterY: actionBounds.y + 19,
    decisionStatusY: actionBounds.y + (isWide ? 20 : 24),
    decisionDetailY: actionBounds.y + (isWide ? 46 : 53),
    actionButtonsY: actionBounds.y + actionBounds.height - 47,
    actionButtonOffset: isCompact ? 72 : 76,
    pathNodes: {
      north: {
        x: centerX - clamp(width * 0.035, 12, 32),
        y: worldBounds.y + northInset,
      },
      east: {
        x: worldBounds.x + worldBounds.width - sideInset,
        y: centerY - (isWide ? 18 : 24),
      },
      south: {
        x: centerX + clamp(width * 0.028, 10, 28),
        y: Math.min(centerY + southReach, worldBounds.y + worldBounds.height - southInset),
      },
      west: {
        x: worldBounds.x + sideInset,
        y: centerY + (isWide ? 30 : 36),
      },
    },
  };
};

const readCssPixels = (styles: CSSStyleDeclaration, property: string): number => {
  const value = Number.parseFloat(styles.getPropertyValue(property));
  return Number.isFinite(value) ? value : 0;
};

export const readSafeAreaInsets = (): Insets => {
  const styles = getComputedStyle(document.documentElement);
  return {
    top: readCssPixels(styles, '--safe-area-top'),
    right: readCssPixels(styles, '--safe-area-right'),
    bottom: readCssPixels(styles, '--safe-area-bottom'),
    left: readCssPixels(styles, '--safe-area-left'),
  };
};

