import { createHash } from 'node:crypto';
import type { ScenarioIdentity } from './worldTypes';

export const canonicalScenarioIdentity = (identity: ScenarioIdentity): string =>
  `post:${identity.postId}|chapter:${identity.chapter}|day:${identity.day}|generator:${identity.generatorVersion}`;

export const scenarioDigest = (identity: ScenarioIdentity): Buffer =>
  createHash('sha256').update(canonicalScenarioIdentity(identity)).digest();
