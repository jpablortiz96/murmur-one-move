import type { Direction } from '../../../shared/types/game';

export type HiddenPathTruth = {
  direction: Direction;
  structure: {
    continuity: 'open' | 'narrow' | 'blocked';
    stability: 'stable' | 'fragile' | 'collapsing';
    cavity: 'solid' | 'hollow' | 'deep';
    depth: 'near' | 'middle' | 'far';
  };
  thermal: {
    temperature: 'cold' | 'neutral' | 'warm' | 'burning';
    signature: 'none' | 'dormant' | 'moving' | 'swarm';
    motion: 'still' | 'drifting' | 'approaching';
    volatility: 'stable' | 'rising' | 'pulsing';
  };
  airflow: {
    strength: 'still' | 'weak' | 'steady' | 'violent';
    flow: 'inward' | 'outward' | 'crosscurrent';
    contamination: 'clear' | 'spores' | 'ash' | 'toxic';
    turbulence: 'smooth' | 'eddying' | 'chaotic';
  };
  outcome: {
    survivable: boolean;
    consequenceId: string;
  };
};

export type WorldTruth = {
  generatorVersion: number;
  optimalDirection: Direction;
  paths: HiddenPathTruth[];
};

export type ScenarioIdentity = {
  postId: string;
  chapter: number;
  day: number;
  generatorVersion: number;
};

export type ScenarioValidation = {
  valid: boolean;
  reasons: string[];
  plausibleRoutes: Record<'echo' | 'heat' | 'wind', Direction[]>;
  combinedCandidates: Direction[];
};
