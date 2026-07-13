import { describe, expect, it } from 'vitest';
import {
  createEmptyCounts,
  parseActiveVote,
  parseCommunityCounts,
  parseRoundStateResponse,
  parseSubmitVoteRequest,
} from '../src/shared/contracts/round';

describe('round contracts', () => {
  it('accepts a normalized vote request and rejects client identity fields', () => {
    expect(
      parseSubmitVoteRequest({ direction: 'north', requestId: 'request_123' })
    ).toEqual({ direction: 'north', requestId: 'request_123' });
    expect(
      parseSubmitVoteRequest({
        direction: 'north',
        requestId: 'request_123',
        sensor: 'heat',
      })
    ).toBeNull();
    expect(
      parseSubmitVoteRequest({
        direction: 'north',
        requestId: 'request_123',
        userId: 't2_spoofed',
      })
    ).toBeNull();
    expect(parseSubmitVoteRequest({ direction: 'up', requestId: 'request_123' })).toBeNull();
    expect(parseSubmitVoteRequest({ direction: 'north', requestId: 'bad id' })).toBeNull();
  });

  it('rejects negative, fractional, and internally inconsistent counts', () => {
    expect(parseCommunityCounts(createEmptyCounts())).toEqual(createEmptyCounts());
    expect(
      parseCommunityCounts({ north: -1, east: 0, south: 0, west: 0, total: -1 })
    ).toBeNull();
    expect(
      parseCommunityCounts({ north: 1, east: 0, south: 0, west: 0, total: 2 })
    ).toBeNull();
    expect(
      parseCommunityCounts({ north: 0.5, east: 0, south: 0, west: 0, total: 0.5 })
    ).toBeNull();
  });

  it('validates active vote revisions and timestamps', () => {
    expect(
      parseActiveVote({
        direction: 'east',
        sensor: 'echo',
        signalQuality: 1,
        revision: 2,
        createdAt: '2026-07-13T12:00:00.000Z',
        updatedAt: '2026-07-13T12:01:00.000Z',
      })
    ).not.toBeNull();
    expect(
      parseActiveVote({
        direction: 'east',
        sensor: 'echo',
        signalQuality: 1,
        revision: 0,
        createdAt: 'invalid',
        updatedAt: '2026-07-13T12:01:00.000Z',
      })
    ).toBeNull();
  });

  it('rejects a resolved client state without a valid immutable snapshot', () => {
    const base = {
      schemaVersion: 1,
      chapter: 1,
      day: 1,
      status: 'open',
      counts: createEmptyCounts(),
      resolution: null,
      viewer: {
        authenticated: false,
        canVote: false,
        canResolve: false,
        sensor: 'echo',
        activeVote: null,
      },
    };
    expect(parseRoundStateResponse(base)).toEqual(base);
    expect(parseRoundStateResponse({ ...base, status: 'resolved' })).toBeNull();
    expect(
      parseRoundStateResponse({
        ...base,
        counts: { north: 1, east: 0, south: 0, west: 0, total: 0 },
      })
    ).toBeNull();
  });
});
