import { expect, test } from 'vitest';
import { commentsUrlFor } from '../src/server/services/fieldNoteService';

test('a t3_ prefixed post id becomes a real Reddit comments URL', () => {
  const url = commentsUrlFor('t3_1uvh1ff');
  expect(url).toBe('https://www.reddit.com/comments/1uvh1ff');
  expect(url).not.toContain('t3_');
});

test('an already normalized post id is left alone', () => {
  expect(commentsUrlFor('1uvh1ff')).toBe('https://www.reddit.com/comments/1uvh1ff');
});

test('only a leading t3_ is stripped, never one inside the id', () => {
  expect(commentsUrlFor('abct3_123')).toBe('https://www.reddit.com/comments/abct3_123');
});

test('the URL is absolute, so Devvit client navigation can parse it', () => {
  // navigateTo throws a TypeError on anything new URL() cannot parse.
  expect(() => new URL(commentsUrlFor('t3_1uvh1ff'))).not.toThrow();
  expect(new URL(commentsUrlFor('t3_1uvh1ff')).protocol).toBe('https:');
});

test('the URL points at a specific post, never at the subreddit', () => {
  const url = commentsUrlFor('t3_abc123');
  expect(url).toMatch(/\/comments\/[a-z0-9]+$/);
  expect(url).not.toMatch(/\/r\//);
});
