import { expect, test } from 'vitest';
import { buildFieldNoteBody, fieldNoteBodyHash } from '../src/server/game/fieldNotes/noteBody';

test('builds the exact scannable body with commentary', () => {
  const body = buildFieldNoteBody({
    sensor: 'heat',
    direction: 'east',
    confidence: 'high',
    clause: 'Moving warmth beyond the passage',
    commentary: 'Something is pacing behind the wall.',
  });
  expect(body).toBe(
    '**HEAT FIELD NOTE · EAST**\n\nMoving warmth beyond the passage · High confidence\n\n> Something is pacing behind the wall.'
  );
});

test('omits the blockquote when commentary is absent', () => {
  const body = buildFieldNoteBody({
    sensor: 'echo',
    direction: 'north',
    confidence: 'low',
    clause: 'A deep hollow answering back',
  });
  expect(body).toBe('**ECHO FIELD NOTE · NORTH**\n\nA deep hollow answering back · Low confidence');
});

test('the body never contains hidden result vocabulary', () => {
  const body = buildFieldNoteBody({ sensor: 'wind', direction: 'west', confidence: 'medium', clause: 'A clean current flowing outward' });
  expect(body).not.toMatch(/optimal|survivable|safe route|winner|solution|u\//i);
});

test('the body hash is deterministic and versioned', () => {
  const input = { sensor: 'wind', direction: 'south', confidence: 'medium', clause: 'A crosscurrent pulling two ways' } as const;
  const a = fieldNoteBodyHash(buildFieldNoteBody(input));
  const b = fieldNoteBodyHash(buildFieldNoteBody(input));
  expect(a).toBe(b);
  expect(a).toMatch(/^sha256:[a-f0-9]{64}$/);
});
