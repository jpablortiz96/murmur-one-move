import { expect, test } from 'vitest';
import { createPostNavigateUrl } from '../src/server/routes/menu';

test('strips the t3_ prefix so the menu navigates to a real Reddit comments URL', () => {
  const url = createPostNavigateUrl('murmur_one_move_dev', 't3_abc123');
  expect(url).toBe('https://reddit.com/r/murmur_one_move_dev/comments/abc123');
  expect(url).not.toContain('/comments/t3_');
});

test('leaves an already normalized post id untouched', () => {
  expect(createPostNavigateUrl('murmur_one_move_dev', 'abc123')).toBe(
    'https://reddit.com/r/murmur_one_move_dev/comments/abc123'
  );
});

test('only strips a leading t3_ prefix, never one inside the id', () => {
  expect(createPostNavigateUrl('murmur_one_move_dev', 'abct3_123')).toBe(
    'https://reddit.com/r/murmur_one_move_dev/comments/abct3_123'
  );
});
