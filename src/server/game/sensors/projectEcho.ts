import { PERCEPTION_SCHEMA_VERSION } from '../../../shared/constants/game';
import type { EchoPerception } from '../../../shared/contracts/session';
import type { WorldTruth } from '../world/worldTypes';

export const projectEcho = (truth: WorldTruth): EchoPerception => {
  const signals = truth.paths.map(({ direction, structure }) => ({
    direction,
    continuity: structure.continuity,
    cavity: structure.cavity,
    stability: structure.stability,
    depth: structure.depth,
  }));
  const open = signals.find(({ continuity }) => continuity === 'open');
  const hollow = signals.find(({ cavity }) => cavity === 'hollow');
  const fragile = signals.find(({ stability }) => stability === 'fragile');
  return {
    sensor: 'echo',
    schemaVersion: PERCEPTION_SCHEMA_VERSION,
    structuralSignals: signals,
    activationDescriptions: [
      `${open?.direction ?? 'A distant'} passage answers with continuous stone edges.`,
      `A ${hollow?.depth ?? 'middle'} hollow answers from the ${hollow?.direction ?? 'dark'}.`,
      `The ${fragile?.direction ?? 'nearest'} path returns a fractured, fragile echo.`,
    ],
  };
};
