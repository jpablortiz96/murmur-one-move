import type { CombinedTruth, ExpeditionPublicView, PublicMurmurState } from '../../../shared/contracts/expedition';

export type ExpeditionMapNode = {
  day: number;
  state: 'completed' | 'current' | 'hidden';
  mark: 'safe' | 'costly' | 'dangerous' | null;
};

export const createExpeditionMapNodes = (view: ExpeditionPublicView): ExpeditionMapNode[] =>
  Array.from({ length: 7 }, (_, index) => {
    const day = index + 1;
    const summary = view.history.find((item) => item.day === day);
    return {
      day,
      state: summary ? 'completed' : day === view.currentDay ? 'current' : 'hidden',
      mark: summary?.severity ?? null,
    };
  });

export const approximateWindowCopy = (view: ExpeditionPublicView, now: Date): string => {
  if (view.status === 'completed') return 'The expedition has left its final signal.';
  if (view.status === 'resolving') return 'The community move is resolving.';
  if (view.status === 'resolved' || view.status === 'next-chapter-pending') return 'The next hollow is preparing.';
  const remaining = Date.parse(view.window.closesAt) - now.getTime();
  if (remaining <= 0) return view.schedulerDelayed ? 'The hollow closed; recovery is listening.' : 'The hollow closed; resolution is near.';
  const hours = Math.ceil(remaining / 3_600_000);
  if (hours >= 2) return `About ${hours} hours remain.`;
  const minutes = Math.max(1, Math.ceil(remaining / 60_000));
  return `About ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} remain.`;
};

export const murmurVisualSignature = (state: PublicMurmurState): string[] => [
  `vitality-${state.vitality}`,
  `condition-${state.condition}`,
  ...state.scars.map((scar) => `scar-${scar}`),
  `memory-${Math.min(4, state.memoryFragments)}`,
];

export const combinedTruthStages = (truth: CombinedTruth): readonly string[] => [
  `WHAT ECHO HEARD\n${truth.echo}`,
  `WHAT HEAT FELT\n${truth.heat}`,
  `WHAT WIND CARRIED\n${truth.wind}`,
  `THREE TRUTHS. ONE CONSEQUENCE.\n${truth.consequence}`,
];
