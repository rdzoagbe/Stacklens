import { describe, it, expect, beforeEach } from 'vitest';
import { purgeLegacyCredentials } from './legacyCredentials';

describe('purgeLegacyCredentials', () => {
  beforeEach(() => localStorage.clear());

  it('removes the Zoom Server-to-Server client secret', () => {
    localStorage.setItem('sg_zoom_client_secret', 'super-secret-value');
    purgeLegacyCredentials();
    expect(localStorage.getItem('sg_zoom_client_secret')).toBeNull();
  });

  it('removes the whole Zoom credential triple', () => {
    localStorage.setItem('sg_zoom_account_id', 'acct');
    localStorage.setItem('sg_zoom_client_id', 'cid');
    localStorage.setItem('sg_zoom_client_secret', 'shh');
    const purged = purgeLegacyCredentials();
    expect(purged).toHaveLength(3);
    expect(localStorage.getItem('sg_zoom_account_id')).toBeNull();
    expect(localStorage.getItem('sg_zoom_client_id')).toBeNull();
    expect(localStorage.getItem('sg_zoom_client_secret')).toBeNull();
  });

  it('leaves non-credential keys alone', () => {
    // The last-sync timestamp is not sensitive and drives the "synced N ago"
    // label — purging it would make a connected integration look unused.
    localStorage.setItem('sg_zoom_last_sync', '2026-08-01T00:00:00.000Z');
    localStorage.setItem('sg_connected_integrations', '["zoom"]');
    purgeLegacyCredentials();
    expect(localStorage.getItem('sg_zoom_last_sync')).toBe('2026-08-01T00:00:00.000Z');
    expect(localStorage.getItem('sg_connected_integrations')).toBe('["zoom"]');
  });

  it('is a no-op when nothing was stored', () => {
    expect(purgeLegacyCredentials()).toEqual([]);
  });

  it('is idempotent', () => {
    localStorage.setItem('sg_zoom_client_secret', 'shh');
    expect(purgeLegacyCredentials()).toHaveLength(1);
    expect(purgeLegacyCredentials()).toEqual([]);
  });
});
