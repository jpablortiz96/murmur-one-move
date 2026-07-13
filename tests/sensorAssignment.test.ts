import { describe, expect, test } from 'vitest';
import { assignSensor } from '../src/server/game/sensors/assignSensor';

const assignment = (userId: string, day = 1, assignmentVersion = 1) =>
  assignSensor({ userId, postId: 't3_private_round', chapter: 1, day, assignmentVersion });

describe('private sensor assignment', () => {
  test('is stable and reproducible for the same user and round', () => {
    expect(assignment('t2_stable')).toBe(assignment('t2_stable'));
  });

  test('versions and day participate in assignment identity', () => {
    expect(Array.from({ length: 100 }, (_, index) => assignment(`t2_day_${index}`, 1) !== assignment(`t2_day_${index}`, 2))).toContain(true);
    expect(Array.from({ length: 100 }, (_, index) => assignment(`t2_version_${index}`, 1, 1) !== assignment(`t2_version_${index}`, 1, 2))).toContain(true);
  });

  test('keeps 30,000 deterministic identities between 30% and 36% per sensor', () => {
    const counts = { echo: 0, heat: 0, wind: 0 };
    for (let index = 0; index < 30_000; index += 1) counts[assignment(`t2_sim_${index}`)] += 1;
    for (const count of Object.values(counts)) {
      expect(count / 30_000).toBeGreaterThanOrEqual(0.3);
      expect(count / 30_000).toBeLessThanOrEqual(0.36);
    }
  });
});
