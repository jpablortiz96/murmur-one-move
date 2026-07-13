import { describe, expect, test } from 'vitest';
import type { ExpeditionPublicView } from '../src/shared/contracts/expedition';
import {
  approximateWindowCopy,
  combinedTruthStages,
  createExpeditionMapNodes,
  murmurVisualSignature,
} from '../src/client/game/systems/expeditionPresentation';

const view: ExpeditionPublicView = {
  schemaVersion: 2, seasonId: 'season-presentation', status: 'open', currentDay: 3, totalDays: 7,
  chapter: { day: 3, name: 'The Sleeping Heat', phrase: 'Warmth moves.', cavernType: 'thermal nursery', cliffhanger: 'A choir begins.' },
  window: {
    opensAt: '2026-07-13T18:00:00.000Z', closesAt: '2026-07-13T20:00:00.000Z',
    revealAt: '2026-07-13T20:01:00.000Z', nextChapterAt: '2026-07-13T20:02:00.000Z',
  },
  murmur: { vitality: 2, condition: 'stable', memoryFragments: 2, scars: ['spore-mark'] },
  history: [
    { day: 1, direction: 'north', severity: 'safe', consequence: 'safe', resolvedAt: '2026-07-13T18:00:00.000Z' },
    { day: 2, direction: 'east', severity: 'costly', consequence: 'costly', resolvedAt: '2026-07-13T19:00:00.000Z' },
  ],
  ending: null, schedulerDelayed: false, nextChapterPostId: null,
};

describe('expedition client presentation', () => {
  test('always creates seven organic-map nodes with completed, current, and hidden states', () => {
    const nodes = createExpeditionMapNodes(view);
    expect(nodes).toHaveLength(7);
    expect(nodes.map((node) => node.state)).toEqual(['completed', 'completed', 'current', 'hidden', 'hidden', 'hidden', 'hidden']);
    expect(nodes[1]?.mark).toBe('costly');
  });

  test('uses approximate time without second-level countdown pressure', () => {
    expect(approximateWindowCopy(view, new Date('2026-07-13T18:30:00.000Z'))).toBe('About 2 hours remain.');
    expect(approximateWindowCopy(view, new Date('2026-07-13T19:59:20.000Z'))).toBe('About 1 minutes remain.');
    expect(approximateWindowCopy(view, new Date('2026-07-13T20:01:00.000Z'))).toContain('resolution');
  });

  test('represents condition without relying only on color and stages all three truths', () => {
    expect(murmurVisualSignature(view.murmur)).toEqual(['vitality-2', 'condition-stable', 'scar-spore-mark', 'memory-2']);
    expect(combinedTruthStages({
      echo: 'echo', heat: 'heat', wind: 'wind', consequence: 'marked', severity: 'costly',
    })).toHaveLength(4);
  });
});
