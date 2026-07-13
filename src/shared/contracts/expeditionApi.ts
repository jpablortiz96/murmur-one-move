import { parseExpeditionPublicView, type ExpeditionPublicView } from './expedition';

export type ModeratorActionRequest = {
  requestId: string;
  confirmation: string;
};

export type ExpeditionApiResponse = {
  status: 'ok';
  expedition: ExpeditionPublicView;
  navigateTo: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseModeratorActionRequest = (value: unknown): ModeratorActionRequest | null => {
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'confirmation,requestId' ||
    typeof value.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(value.requestId) ||
    typeof value.confirmation !== 'string' || value.confirmation.length > 80) return null;
  return { requestId: value.requestId, confirmation: value.confirmation };
};

export const parseExpeditionApiResponse = (value: unknown): ExpeditionApiResponse | null => {
  if (!isRecord(value) || value.status !== 'ok' || (value.navigateTo !== null && typeof value.navigateTo !== 'string')) return null;
  const expedition = parseExpeditionPublicView(value.expedition);
  return expedition ? { status: 'ok', expedition, navigateTo: value.navigateTo } : null;
};
