import { FIELD_NOTE_MAX_COMMENTARY, NOTE_CONFIDENCES } from '../../../shared/constants/game';
import { AVAILABLE_DIRECTIONS } from '../../../shared/constants/game';
import type {
  FieldNoteDraft,
  FieldNotePreview,
  FieldNotesView,
  NoteConfidence,
} from '../../../shared/contracts/fieldNotes';
import type { Direction } from '../../../shared/types/game';
import {
  createFieldNoteRequestId,
  fetchFieldNotes,
  FieldNotesApiError,
  previewFieldNote,
  publishFieldNote,
} from '../systems/fieldNotesClient';
import { requestCommentsNavigation } from '../systems/navigation';

type OverlayStage = 'idle' | 'composer' | 'preview' | 'done';

const DIRECTION_LABEL: Record<Direction, string> = {
  north: 'North', east: 'East', south: 'South', west: 'West',
};
const CONFIDENCE_LABEL: Record<NoteConfidence, string> = {
  low: 'Low', medium: 'Medium', high: 'High',
};
const VERDICT_COPY = {
  'chorus-held': {
    title: 'THE CHORUS HELD',
    detail: 'Three partial truths found one path.',
  },
  'minority-heard': {
    title: 'THE MINORITY HEARD IT',
    detail: (count: number) => `${count} Field Note${count === 1 ? '' : 's'} warned of the safer path.`,
  },
  'hollow-kept-secret': {
    title: 'THE HOLLOW KEPT ITS SECRET',
    detail: 'Too few Field Notes survived the noise.',
  },
} as const;

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/**
 * Accessible DOM overlay for Field Notes. It never dominates the community
 * result: a discreet CTA appears only after voting, publication is a separate
 * explicit action, and the exact comment body is always shown before posting.
 */
export class FieldNotesOverlay {
  private readonly root: HTMLDivElement;
  private backdrop: HTMLDivElement | null = null;
  private view: FieldNotesView | null = null;
  private stage: OverlayStage = 'idle';
  private draft: Partial<FieldNoteDraft> = {};
  private preview: FieldNotePreview | null = null;
  private busy = false;
  private navigating = false;
  private navigationFailed = false;
  private refreshTimer: number | null = null;

  constructor(private readonly host: HTMLElement) {
    this.root = el('div', 'fn-layer');
    this.root.setAttribute('aria-live', 'polite');
    this.host.appendChild(this.root);
    window.addEventListener('murmur:community-updated', this.handleExternalUpdate);
  }

  async mount(): Promise<void> {
    await this.refresh();
    this.refreshTimer = window.setInterval(() => {
      if (this.stage === 'idle') void this.refresh();
    }, 5_000);
  }

  destroy(): void {
    if (this.refreshTimer !== null) window.clearInterval(this.refreshTimer);
    this.refreshTimer = null;
    window.removeEventListener('murmur:community-updated', this.handleExternalUpdate);
    this.backdrop?.remove();
    this.backdrop = null;
    this.root.remove();
  }

  private handleExternalUpdate = (): void => {
    if (this.stage === 'idle') void this.refresh();
  };

  private async refresh(): Promise<void> {
    try {
      this.view = await fetchFieldNotes();
    } catch {
      this.view = null;
    }
    this.render();
  }

  /**
   * The composer is modal: while it is open a backdrop blocks the world beneath
   * it, and closing or destroying the overlay removes the backdrop so the world
   * becomes interactive again. The backdrop never covers the composer itself.
   */
  private syncBackdrop(): void {
    const modal = this.stage === 'composer' || this.stage === 'preview';
    if (modal && !this.backdrop) {
      this.backdrop = el('div', 'fn-backdrop');
      this.backdrop.setAttribute('aria-hidden', 'true');
      this.host.appendChild(this.backdrop);
    } else if (!modal && this.backdrop) {
      this.backdrop.remove();
      this.backdrop = null;
    }
  }

  private render(): void {
    this.root.replaceChildren();
    this.syncBackdrop();
    const view = this.view;
    if (!view || !view.enabled) return;

    if (view.minorityInsight) this.root.appendChild(this.renderMinorityReveal(view));
    else if (view.board && view.board.totalNotes > 0) this.root.appendChild(this.renderBoard(view));

    if (this.stage === 'composer') this.root.appendChild(this.renderComposer(view));
    else if (this.stage === 'preview' && this.preview) this.root.appendChild(this.renderPreview(this.preview));
    else if (view.canContribute) this.root.appendChild(this.renderCta());
    else if (view.alreadyContributed) this.root.appendChild(this.chip('Field Note shared'));
  }

  private renderCta(): HTMLElement {
    const wrap = el('div', 'fn-cta-wrap');
    const button = el('button', 'fn-btn fn-cta', 'SHARE WHAT YOU SENSED');
    button.type = 'button';
    button.addEventListener('click', () => {
      this.stage = 'composer';
      this.draft = {};
      this.render();
    });
    wrap.appendChild(button);
    return wrap;
  }

  private chip(text: string): HTMLElement {
    const wrap = el('div', 'fn-cta-wrap');
    wrap.appendChild(el('span', 'fn-chip', text));
    return wrap;
  }

  private renderComposer(view: FieldNotesView): HTMLElement {
    const dialog = this.dialogShell('Write a Field Note');

    dialog.appendChild(el('p', 'fn-lede', 'A clue becomes valuable only when someone chooses to share it.'));

    dialog.appendChild(this.fieldset('What did your sense reveal?',
      view.observations.map((option) =>
        this.choice('fn-observation', option.id, option.label, this.draft.observationId === option.id, (value) => {
          this.draft.observationId = value;
        })
      )
    ));

    dialog.appendChild(this.fieldset('Which way does it point?',
      AVAILABLE_DIRECTIONS.map((direction) =>
        this.choice('fn-direction', direction, DIRECTION_LABEL[direction], this.draft.direction === direction, (value) => {
          this.draft.direction = value as Direction;
        })
      )
    ));

    dialog.appendChild(this.fieldset('How sure are you?',
      NOTE_CONFIDENCES.map((confidence) =>
        this.choice('fn-confidence', confidence, CONFIDENCE_LABEL[confidence], this.draft.confidence === confidence, (value) => {
          this.draft.confidence = value as NoteConfidence;
        })
      )
    ));

    const commentaryId = 'fn-commentary';
    const label = el('label', 'fn-label', 'Add a short signal (optional)');
    label.htmlFor = commentaryId;
    const textarea = el('textarea', 'fn-textarea');
    textarea.id = commentaryId;
    textarea.maxLength = FIELD_NOTE_MAX_COMMENTARY;
    textarea.rows = 2;
    textarea.value = this.draft.commentary ?? '';
    const counter = el('span', 'fn-counter', `${textarea.value.length}/${FIELD_NOTE_MAX_COMMENTARY}`);
    textarea.addEventListener('input', () => {
      this.draft.commentary = textarea.value;
      counter.textContent = `${textarea.value.length}/${FIELD_NOTE_MAX_COMMENTARY}`;
    });
    dialog.appendChild(label);
    dialog.appendChild(textarea);
    dialog.appendChild(counter);

    dialog.appendChild(el('p', 'fn-consent', 'Your Field Note will be public and reportable on Reddit.'));

    const status = el('p', 'fn-status');
    dialog.appendChild(status);

    const actions = el('div', 'fn-actions');
    const previewBtn = el('button', 'fn-btn fn-primary', 'PREVIEW');
    previewBtn.type = 'button';
    previewBtn.addEventListener('click', () => void this.requestPreview(status));
    const cancelBtn = el('button', 'fn-btn fn-ghost', 'Cancel');
    cancelBtn.type = 'button';
    cancelBtn.addEventListener('click', () => this.close());
    actions.appendChild(cancelBtn);
    actions.appendChild(previewBtn);
    dialog.appendChild(actions);
    return dialog;
  }

  private async requestPreview(status: HTMLElement): Promise<void> {
    if (this.busy) return;
    if (!this.draft.observationId || !this.draft.direction || !this.draft.confidence) {
      status.textContent = 'Choose an observation, a direction and a confidence first.';
      return;
    }
    const draft: FieldNoteDraft = {
      observationId: this.draft.observationId,
      direction: this.draft.direction,
      confidence: this.draft.confidence,
    };
    if (this.draft.commentary && this.draft.commentary.trim().length > 0) draft.commentary = this.draft.commentary;
    this.busy = true;
    status.textContent = 'Composing…';
    try {
      this.preview = await previewFieldNote(draft);
      this.stage = 'preview';
      this.render();
    } catch (error) {
      status.textContent = error instanceof FieldNotesApiError ? error.message : 'Could not build that Field Note.';
    } finally {
      this.busy = false;
    }
  }

  private renderPreview(preview: FieldNotePreview): HTMLElement {
    const dialog = this.dialogShell('This is exactly what will be posted');
    const body = el('pre', 'fn-body');
    body.textContent = preview.body;
    dialog.appendChild(body);
    dialog.appendChild(el('p', 'fn-consent', 'Your Field Note will be public and reportable on Reddit.'));
    const status = el('p', 'fn-status');
    dialog.appendChild(status);

    const actions = el('div', 'fn-actions');
    const back = el('button', 'fn-btn fn-ghost', 'Back');
    back.type = 'button';
    back.addEventListener('click', () => {
      this.stage = 'composer';
      this.render();
    });
    actions.appendChild(back);

    if (preview.publishMode === 'native' && preview.authorName) {
      const post = el('button', 'fn-btn fn-primary', `POST AS u/${preview.authorName}`);
      post.type = 'button';
      post.addEventListener('click', () => void this.publish(status));
      actions.appendChild(post);
    } else {
      const copy = el('button', 'fn-btn fn-primary', 'COPY FIELD NOTE');
      copy.type = 'button';
      copy.addEventListener('click', () => void this.copyBody(preview.body, status));
      actions.appendChild(copy);
    }
    dialog.appendChild(actions);

    if (preview.publishMode !== 'native') {
      // Fallback creates no parent thread, so this must point at the chapter's
      // general comments rather than a Field Notes thread that does not exist.
      const hint = el('p', 'fn-hint', 'Paste this into the chapter comments. It stays your comment on Reddit and is not tracked in the app.');
      dialog.appendChild(hint);
      dialog.appendChild(this.renderOpenComments(preview.destination.commentsUrl, status));
    }
    return dialog;
  }

  /**
   * Copying and navigating stay separate actions. A `_blank` anchor is blocked
   * inside the webview, so navigation goes through Devvit's client capability and
   * a failure always leaves the player a way forward instead of a dead click.
   */
  private renderOpenComments(commentsUrl: string, status: HTMLElement): HTMLElement {
    const wrap = el('div', 'fn-nav');
    const open = el('button', 'fn-btn fn-ghost', 'OPEN COMMENTS');
    open.type = 'button';
    open.addEventListener('click', () => {
      if (this.navigating) return; // a double tap must not navigate twice
      this.navigating = true;
      open.disabled = true;
      status.textContent = 'Opening comments…';
      const outcome = requestCommentsNavigation(commentsUrl);
      this.navigating = false;
      open.disabled = false;
      if (outcome === 'failed') {
        this.navigationFailed = true;
        this.render();
      } else {
        status.textContent = 'Opening the chapter comments…';
      }
    });
    wrap.appendChild(open);

    if (this.navigationFailed) {
      const failure = el('p', 'fn-error', "COULDN'T OPEN COMMENTS");
      wrap.appendChild(failure);
      const copyLink = el('button', 'fn-btn fn-ghost', 'COPY COMMENTS LINK');
      copyLink.type = 'button';
      copyLink.addEventListener('click', () => void this.copyText(commentsUrl, status, 'Comments link copied.'));
      wrap.appendChild(copyLink);
      const retry = el('button', 'fn-btn fn-ghost', 'TRY AGAIN');
      retry.type = 'button';
      retry.addEventListener('click', () => {
        this.navigationFailed = false;
        this.render();
      });
      wrap.appendChild(retry);
    }
    return wrap;
  }

  private async publish(status: HTMLElement): Promise<void> {
    if (this.busy || !this.preview) return;
    this.busy = true;
    status.textContent = 'Posting…';
    try {
      const result = await publishFieldNote(this.preview.token, createFieldNoteRequestId());
      if (result.status === 'published') {
        status.textContent = `Posted as u/${result.authorName}.`;
        this.stage = 'done';
        window.setTimeout(() => void this.refresh(), 900);
      } else if (result.status === 'copy-ready') {
        status.textContent = 'Posting as you was unavailable — copy your note and paste it into the chapter comments yourself.';
        await this.copyBody(result.body, status);
      } else {
        status.textContent = 'You already shared a Field Note this chapter.';
        window.setTimeout(() => void this.refresh(), 900);
      }
    } catch (error) {
      status.textContent = error instanceof FieldNotesApiError ? error.message : 'Could not post that Field Note.';
    } finally {
      this.busy = false;
    }
  }

  /** Copying is always its own action; it never navigates. */
  private async copyText(text: string, status: HTMLElement, message: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = message;
    } catch {
      status.textContent = 'Copy is unavailable here; select the text to copy it manually.';
    }
  }

  private async copyBody(body: string, status: HTMLElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(body);
      status.textContent = 'Copied. Paste it into the chapter comments to publish it yourself.';
      this.stage = 'done';
    } catch {
      status.textContent = 'Select the text above to copy it into the chapter comments.';
    }
  }

  private renderBoard(view: FieldNotesView): HTMLElement {
    const board = view.board;
    const panel = el('section', 'fn-board');
    panel.setAttribute('aria-label', 'Field Notes signal board');
    panel.appendChild(el('h2', 'fn-board-title', 'FIELD NOTES'));
    if (!board || !board.thresholdMet || !board.bySensor) {
      panel.appendChild(el('p', 'fn-board-note', 'Waiting for more signals to compare.'));
      return panel;
    }
    const list = el('ul', 'fn-board-list');
    (['echo', 'heat', 'wind'] as const).forEach((sensor) => {
      const count = board.bySensor?.[sensor] ?? 0;
      const item = el('li', 'fn-board-item');
      item.appendChild(el('span', 'fn-board-sensor', sensor.charAt(0).toUpperCase() + sensor.slice(1)));
      item.appendChild(el('span', 'fn-board-count', `· ${count}`));
      list.appendChild(item);
    });
    panel.appendChild(list);
    return panel;
  }

  private renderMinorityReveal(view: FieldNotesView): HTMLElement {
    const insight = view.minorityInsight;
    const panel = el('section', 'fn-reveal');
    panel.setAttribute('role', 'status');
    if (!insight) return panel;
    const copy = VERDICT_COPY[insight.verdict];
    panel.appendChild(el('h2', 'fn-reveal-title', copy.title));
    const detail = insight.verdict === 'minority-heard'
      ? VERDICT_COPY['minority-heard'].detail(insight.correctNoteCount)
      : insight.verdict === 'chorus-held'
        ? VERDICT_COPY['chorus-held'].detail
        : VERDICT_COPY['hollow-kept-secret'].detail;
    panel.appendChild(el('p', 'fn-reveal-detail', detail));
    if (view.parentThreadUrl || view.commentsUrl) {
      const link = el('a', 'fn-link', 'VIEW FIELD NOTES');
      link.href = view.parentThreadUrl ?? view.commentsUrl ?? '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      panel.appendChild(link);
    }
    return panel;
  }

  private dialogShell(title: string): HTMLElement {
    const dialog = el('div', 'fn-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'false');
    dialog.setAttribute('aria-label', title);
    dialog.appendChild(el('h2', 'fn-dialog-title', title));
    return dialog;
  }

  private fieldset(legend: string, choices: HTMLElement[]): HTMLElement {
    const set = el('fieldset', 'fn-fieldset');
    set.appendChild(el('legend', 'fn-legend', legend));
    const group = el('div', 'fn-choices');
    choices.forEach((choice) => group.appendChild(choice));
    set.appendChild(group);
    return set;
  }

  private choice(
    name: string,
    value: string,
    label: string,
    checked: boolean,
    onSelect: (value: string) => void
  ): HTMLElement {
    const wrap = el('label', 'fn-choice');
    const input = el('input');
    input.type = 'radio';
    input.name = name;
    input.value = value;
    input.checked = checked;
    input.className = 'fn-radio';
    input.addEventListener('change', () => {
      onSelect(value);
    });
    wrap.appendChild(input);
    wrap.appendChild(el('span', 'fn-choice-label', label));
    return wrap;
  }

  private close(): void {
    this.stage = 'idle';
    this.preview = null;
    this.draft = {};
    this.navigationFailed = false;
    this.navigating = false;
    this.render();
  }
}

export const initFieldNotesOverlay = (): FieldNotesOverlay | null => {
  const host = document.getElementById('app');
  if (!host) return null;
  const overlay = new FieldNotesOverlay(host);
  void overlay.mount();
  return overlay;
};
