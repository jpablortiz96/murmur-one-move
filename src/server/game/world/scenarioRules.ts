import type { Direction } from '../../../shared/types/game';
import type { HiddenPathTruth } from './worldTypes';

export type PathRole = 'optimal' | 'structural-decoy' | 'ambiguous' | 'immediate-danger';

export const createPathForRole = (direction: Direction, role: PathRole): HiddenPathTruth => {
  if (role === 'optimal') return {
    direction,
    structure: { continuity: 'open', stability: 'stable', cavity: 'deep', depth: 'far' },
    thermal: { temperature: 'neutral', signature: 'dormant', motion: 'still', volatility: 'stable' },
    airflow: { strength: 'steady', flow: 'outward', contamination: 'clear', turbulence: 'smooth' },
    outcome: { survivable: true, consequenceId: 'quiet-passage' },
  };
  if (role === 'structural-decoy') return {
    direction,
    structure: { continuity: 'open', stability: 'stable', cavity: 'hollow', depth: 'far' },
    thermal: { temperature: 'burning', signature: 'swarm', motion: 'approaching', volatility: 'pulsing' },
    airflow: { strength: 'weak', flow: 'inward', contamination: 'clear', turbulence: 'smooth' },
    outcome: { survivable: false, consequenceId: 'nest-awakens' },
  };
  if (role === 'ambiguous') return {
    direction,
    structure: { continuity: 'narrow', stability: 'fragile', cavity: 'hollow', depth: 'middle' },
    thermal: { temperature: 'cold', signature: 'none', motion: 'still', volatility: 'stable' },
    airflow: { strength: 'steady', flow: 'crosscurrent', contamination: 'spores', turbulence: 'eddying' },
    outcome: { survivable: false, consequenceId: 'spore-sleep' },
  };
  return {
    direction,
    structure: { continuity: 'blocked', stability: 'collapsing', cavity: 'solid', depth: 'near' },
    thermal: { temperature: 'warm', signature: 'moving', motion: 'approaching', volatility: 'rising' },
    airflow: { strength: 'violent', flow: 'inward', contamination: 'toxic', turbulence: 'chaotic' },
    outcome: { survivable: false, consequenceId: 'immediate-collapse' },
  };
};
