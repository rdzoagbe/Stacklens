import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  subscribeSync, getSyncSnapshot, markSyncSaving, markSyncSaved,
  markSyncFailed, retrySync, _resetSyncStatus,
} from './syncStatus';

beforeEach(() => _resetSyncStatus());

describe('syncStatus', () => {
  it('starts idle', () => {
    expect(getSyncSnapshot().status).toBe('idle');
  });

  it('records a failed cloud write with its message', () => {
    markSyncFailed(new Error('quota exceeded'));
    expect(getSyncSnapshot().status).toBe('error');
    expect(getSyncSnapshot().error).toBe('quota exceeded');
  });

  it('notifies subscribers on change and stops after unsubscribe', () => {
    const fn = vi.fn();
    const unsub = subscribeSync(fn);
    markSyncSaving();
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    markSyncSaved();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  // useSyncExternalStore requires a stable reference between changes.
  it('keeps a stable snapshot reference until state changes', () => {
    const a = getSyncSnapshot();
    expect(getSyncSnapshot()).toBe(a);
    markSyncSaving();
    expect(getSyncSnapshot()).not.toBe(a);
  });

  it('retry re-runs the failed write and clears the error on success', async () => {
    const attempt = vi.fn().mockResolvedValue(undefined);
    markSyncFailed(new Error('offline'), attempt);
    await expect(retrySync()).resolves.toBe(true);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(getSyncSnapshot().status).toBe('saved');
    expect(getSyncSnapshot().error).toBeNull();
  });

  it('retry keeps the error state when the write fails again', async () => {
    const attempt = vi.fn().mockRejectedValue(new Error('still offline'));
    markSyncFailed(new Error('offline'), attempt);
    await expect(retrySync()).resolves.toBe(false);
    expect(getSyncSnapshot().status).toBe('error');
    expect(getSyncSnapshot().error).toBe('still offline');
  });

  it('retry is a no-op when nothing failed', async () => {
    await expect(retrySync()).resolves.toBe(false);
    expect(getSyncSnapshot().status).toBe('idle');
  });

  // A throwing listener must never break the save path that notified it.
  it('survives a subscriber that throws', () => {
    subscribeSync(() => { throw new Error('bad listener'); });
    expect(() => markSyncFailed(new Error('x'))).not.toThrow();
    expect(getSyncSnapshot().status).toBe('error');
  });
});
