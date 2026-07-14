import { expect, test } from 'vitest';
import { createPreviewToken, verifyPreviewToken, type PreviewTokenPayload } from '../src/server/game/fieldNotes/previewToken';

const SECRET = 'test-secret-value';
const basePayload = (exp: number): PreviewTokenPayload => ({
  v: 1,
  voterHash: 'voter-hash-1',
  seasonId: 'season-01',
  day: 2,
  postId: 't3_post',
  sensor: 'heat',
  direction: 'east',
  confidence: 'high',
  observationId: 'moving-warmth',
  bodyHash: `sha256:${'a'.repeat(64)}`,
  mode: 'native',
  iat: 1000,
  exp,
});

test('a freshly signed token verifies and returns the payload', () => {
  const token = createPreviewToken(SECRET, basePayload(10_000));
  expect(verifyPreviewToken(SECRET, token, 5_000)).toMatchObject({ voterHash: 'voter-hash-1', day: 2, mode: 'native' });
});

test('an expired token is rejected', () => {
  const token = createPreviewToken(SECRET, basePayload(4_000));
  expect(verifyPreviewToken(SECRET, token, 5_000)).toBeNull();
});

test('a tampered payload or signature is rejected', () => {
  const token = createPreviewToken(SECRET, basePayload(10_000));
  const [payloadB64, signature] = token.split('.');
  const swapped = Buffer.from(JSON.stringify({ ...basePayload(10_000), direction: 'west' }), 'utf8').toString('base64url');
  expect(verifyPreviewToken(SECRET, `${swapped}.${signature}`, 5_000)).toBeNull();
  expect(verifyPreviewToken(SECRET, `${payloadB64}.${'0'.repeat((signature ?? '').length)}`, 5_000)).toBeNull();
});

test('a token signed by a different secret is rejected', () => {
  const token = createPreviewToken(SECRET, basePayload(10_000));
  expect(verifyPreviewToken('other-secret', token, 5_000)).toBeNull();
});

test('optional commentary survives a round-trip', () => {
  const token = createPreviewToken(SECRET, { ...basePayload(10_000), commentary: 'a short clue' });
  expect(verifyPreviewToken(SECRET, token, 5_000)?.commentary).toBe('a short clue');
});
