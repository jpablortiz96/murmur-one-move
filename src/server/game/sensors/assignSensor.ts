import { createHash } from 'node:crypto';
import { AVAILABLE_SENSORS } from '../../../shared/constants/game';
import type { Sensor } from '../../../shared/types/game';

export type SensorAssignmentIdentity = {
  userId: string;
  postId: string;
  chapter: number;
  day: number;
  assignmentVersion: number;
};

export const assignSensor = (identity: SensorAssignmentIdentity): Sensor => {
  const canonical = [
    `user:${identity.userId}`,
    `post:${identity.postId}`,
    `chapter:${identity.chapter}`,
    `day:${identity.day}`,
    `assignment:${identity.assignmentVersion}`,
  ].join('|');
  const digest = createHash('sha256').update(canonical).digest();
  return AVAILABLE_SENSORS[(digest.readUInt32BE(0) % AVAILABLE_SENSORS.length)] ?? 'echo';
};
