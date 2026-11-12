import { perfNow } from '@/features/canvas/engine/performance';

const pendingNavigationStarts = new Map<string, number>();

export function markNotebookNavigationStart(notebookId: string) {
  if (!__DEV__) return;
  const tapStartedAt = perfNow();
  const navigationStartedAt = perfNow();
  pendingNavigationStarts.set(notebookId, navigationStartedAt);
  if (pendingNavigationStarts.size > 8) {
    const oldestId = pendingNavigationStarts.keys().next().value;
    if (oldestId) pendingNavigationStarts.delete(oldestId);
  }
  if (__DEV__) {
    console.log('[Notex perf] notebook_navigation_start', {
      tap_to_navigation_start_ms: Math.round((navigationStartedAt - tapStartedAt) * 10) / 10,
    });
  }
}

export function consumeNotebookNavigationStart(notebookId: string) {
  if (!__DEV__) return undefined;
  const startedAt = pendingNavigationStarts.get(notebookId);
  if (startedAt !== undefined) pendingNavigationStarts.delete(notebookId);
  return startedAt;
}
