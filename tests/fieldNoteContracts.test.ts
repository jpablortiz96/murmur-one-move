import { expect, test } from 'vitest';
import {
  parseFieldNoteBoard,
  parseFieldNoteDraft,
  parseFieldNotePreview,
  parseFieldNotesView,
  parseMinorityInsight,
  parsePublishFieldNoteRequest,
  parsePublishFieldNoteResponse,
  validateCommentary,
} from '../src/shared/contracts/fieldNotes';

test('accepts a minimal valid draft and a full draft', () => {
  expect(parseFieldNoteDraft({ direction: 'east', confidence: 'high', observationId: 'moving-warmth' })).toEqual({
    direction: 'east',
    confidence: 'high',
    observationId: 'moving-warmth',
  });
  expect(
    parseFieldNoteDraft({ direction: 'north', confidence: 'low', observationId: 'deep-hollow', commentary: '  a clue  ' })
  ).toEqual({ direction: 'north', confidence: 'low', observationId: 'deep-hollow', commentary: 'a clue' });
});

test('rejects drafts with unknown keys, bad direction, or forbidden ids', () => {
  expect(parseFieldNoteDraft({ direction: 'east', confidence: 'high', observationId: 'x', userId: 't2_a' })).toBeNull();
  expect(parseFieldNoteDraft({ direction: 'up', confidence: 'high', observationId: 'deep-hollow' })).toBeNull();
  expect(parseFieldNoteDraft({ direction: 'east', confidence: 'sure', observationId: 'deep-hollow' })).toBeNull();
  expect(parseFieldNoteDraft({ direction: 'east', confidence: 'high', observationId: 'BAD_ID' })).toBeNull();
});

test('commentary validation normalizes and rejects abusive payloads', () => {
  expect(validateCommentary('  hello   world  ')).toEqual({ ok: true, value: 'hello world' });
  expect(validateCommentary(undefined)).toEqual({ ok: true, value: undefined });
  expect(validateCommentary('')).toEqual({ ok: true, value: undefined });
  expect(validateCommentary('a'.repeat(161)).ok).toBe(false);
  expect(validateCommentary('aaaaaaaaaaaa').ok).toBe(false); // 12 repeated chars
  expect(validateCommentary('see http://a.com and http://b.com').ok).toBe(false); // two urls
  expect(validateCommentary('nice [link](http://evil)').ok).toBe(false); // markdown link
  expect(validateCommentary('zero​width').ok).toBe(false); // format char
  expect(validateCommentary('badbell').ok).toBe(false); // control char
  expect(validateCommentary('one link http://ok.com is fine')).toEqual({ ok: true, value: 'one link http://ok.com is fine' });
});

test('publish request requires exactly token and requestId', () => {
  expect(parsePublishFieldNoteRequest({ token: 'x'.repeat(20), requestId: 'req_abcdef12' })).toEqual({
    token: 'x'.repeat(20),
    requestId: 'req_abcdef12',
  });
  expect(parsePublishFieldNoteRequest({ token: 'short', requestId: 'req_abcdef12' })).toBeNull();
  expect(parsePublishFieldNoteRequest({ token: 'x'.repeat(20), requestId: 'bad id!' })).toBeNull();
  expect(parsePublishFieldNoteRequest({ token: 'x'.repeat(20), requestId: 'req_abcdef12', extra: 1 })).toBeNull();
});

test('board parser enforces null-or-complete breakdowns', () => {
  expect(parseFieldNoteBoard({ totalNotes: 2, thresholdMet: false, bySensor: null, byDirection: null })).not.toBeNull();
  expect(
    parseFieldNoteBoard({
      totalNotes: 3,
      thresholdMet: true,
      bySensor: { echo: 1, heat: 1, wind: 1 },
      byDirection: { north: 1, east: 1, south: 1, west: 0 },
    })
  ).not.toBeNull();
  expect(parseFieldNoteBoard({ totalNotes: 3, thresholdMet: true, bySensor: { echo: 1 }, byDirection: null })).toBeNull();
});

test('minority insight and view round-trip through their parsers', () => {
  const insight = {
    communityDirection: 'south',
    optimalDirection: 'north',
    communityWasCorrect: false,
    correctNoteCount: 1,
    totalNoteCount: 4,
    correctNoteShare: 0.25,
    minorityWasCorrect: true,
    participatingSensors: ['echo', 'heat'],
    verdict: 'minority-heard',
  };
  expect(parseMinorityInsight(insight)).toEqual(insight);

  const view = {
    schemaVersion: 1,
    enabled: true,
    publishMode: 'fallback',
    authenticated: true,
    hasVoted: true,
    canContribute: true,
    alreadyContributed: false,
    sensor: 'heat',
    observations: [{ id: 'moving-warmth', label: 'Moving warmth' }],
    authorName: null,
    commentsUrl: 'https://www.reddit.com/comments/abc',
    parentThreadUrl: null,
    board: { totalNotes: 0, thresholdMet: false, bySensor: null, byDirection: null },
    minorityInsight: null,
  };
  expect(parseFieldNotesView(view)).not.toBeNull();
  expect(parseFieldNotesView({ ...view, sensor: 'smell' })).toBeNull();
});

test('preview and publish responses validate their variants', () => {
  expect(
    parseFieldNotePreview({
      schemaVersion: 1,
      body: '**HEAT FIELD NOTE · EAST**',
      destination: { postId: 't3_a', commentsUrl: 'https://x', parentKnown: false },
      publishMode: 'native',
      authorName: 'alice',
      token: 'abc.def',
      expiresAt: new Date().toISOString(),
    })
  ).not.toBeNull();
  expect(parsePublishFieldNoteResponse({ status: 'published', mode: 'native', alreadyPublished: false, authorName: 'a', commentUrl: null })).not.toBeNull();
  expect(parsePublishFieldNoteResponse({ status: 'copy-ready', mode: 'fallback', body: 'x', commentsUrl: null })).not.toBeNull();
  expect(parsePublishFieldNoteResponse({ status: 'already-active', mode: 'native' })).not.toBeNull();
  expect(parsePublishFieldNoteResponse({ status: 'published', mode: 'fallback', alreadyPublished: false, authorName: 'a', commentUrl: null })).toBeNull();
});
