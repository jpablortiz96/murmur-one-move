import {
  parseFieldNotePreview,
  parseFieldNotesView,
  parsePublishFieldNoteResponse,
  type FieldNoteDraft,
  type FieldNotePreview,
  type FieldNotesView,
  type PublishFieldNoteResponse,
} from '../../../shared/contracts/fieldNotes';

export class FieldNotesApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'FieldNotesApiError';
    this.status = status;
    this.code = code;
  }
}

const readError = async (response: Response): Promise<FieldNotesApiError> => {
  let message = `Field Notes request returned HTTP ${response.status}`;
  let code = 'unavailable';
  try {
    const value: unknown = await response.json();
    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>;
      if (typeof record.message === 'string') message = record.message;
      if (typeof record.code === 'string') code = record.code;
    }
  } catch {
    // Non-JSON body: the status code is still actionable.
  }
  return new FieldNotesApiError(message, response.status, code);
};

export const fetchFieldNotes = async (): Promise<FieldNotesView> => {
  const response = await fetch('/api/field-notes', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw await readError(response);
  const view = parseFieldNotesView(await response.json());
  if (view === null) throw new FieldNotesApiError('Invalid Field Notes response', 502, 'unavailable');
  return view;
};

export const previewFieldNote = async (draft: FieldNoteDraft): Promise<FieldNotePreview> => {
  const response = await fetch('/api/field-notes/preview', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });
  if (!response.ok) throw await readError(response);
  const preview = parseFieldNotePreview(await response.json());
  if (preview === null) throw new FieldNotesApiError('Invalid Field Note preview', 502, 'unavailable');
  return preview;
};

export const publishFieldNote = async (
  token: string,
  requestId: string
): Promise<PublishFieldNoteResponse> => {
  const response = await fetch('/api/field-notes/publish', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, requestId }),
  });
  if (!response.ok) throw await readError(response);
  const result = parsePublishFieldNoteResponse(await response.json());
  if (result === null) throw new FieldNotesApiError('Invalid Field Note publish response', 502, 'unavailable');
  return result;
};

export const createFieldNoteRequestId = (): string => crypto.randomUUID();
