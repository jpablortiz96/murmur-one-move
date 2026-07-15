import { navigateTo } from '@devvit/web/client';

/**
 * OPEN COMMENTS used to be an `<a target="_blank">`. Inside Reddit's sandboxed
 * webview that navigation is blocked, so the click did nothing at all. Devvit's
 * own client capability is the only reliable way out of the webview.
 *
 * `navigateTo` is fire-and-forget: it throws on an invalid URL but cannot report
 * whether the host honoured the effect, so this never claims more than "the
 * navigation was requested".
 */
export type NavigationOutcome = 'requested' | 'failed';

const diagnostic = { count: 0, lastUrl: null as string | null, lastOutcome: null as NavigationOutcome | null };

/** Read-only diagnostic for the browser evidence harness. Carries no identity. */
const publish = (): void => {
  if (typeof window === 'undefined') return;
  (window as unknown as { __murmurNavigation?: unknown }).__murmurNavigation = { ...diagnostic };
};

export const requestCommentsNavigation = (url: string): NavigationOutcome => {
  diagnostic.count += 1;
  diagnostic.lastUrl = url;
  try {
    navigateTo(url);
    diagnostic.lastOutcome = 'requested';
  } catch (error) {
    // An invalid destination is the only failure navigateTo can surface.
    console.info('MURMUR could not open the chapter comments', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
    diagnostic.lastOutcome = 'failed';
  }
  publish();
  return diagnostic.lastOutcome;
};
