import { describe, it, expect, vi } from 'vitest';

vi.mock('../firebase-config', () => ({ callAI: vi.fn() }));

import { sourceFingerprint, readCachedTranslation } from '../translations';

// ── A machine translation is only valid for the English it came from ───────
//
// German, Spanish and Portuguese visitors see most of the legal and security
// pages through a translation made at runtime and cached in their browser.
// The cache used to be keyed by string name only, so correcting an English
// sentence never reached anyone who had already seen the old one: their
// browser kept the translation of the old text indefinitely. Correcting a
// false privacy claim in English would have left it standing in German.

describe('cached translations are tied to their English source', () => {
  const en = 'Cancelling moves you to the free plan and keeps your data.';

  it('a translation of the current English is used', () => {
    const entry = { t: 'Kündigen behält Ihre Daten.', s: sourceFingerprint(en) };
    expect(readCachedTranslation(entry, en)).toBe('Kündigen behält Ihre Daten.');
  });

  it('a translation of an earlier English is not, so it gets translated again', () => {
    const old = 'When you cancel, your data is permanently deleted.';
    const entry = { t: 'Bei Kündigung werden Ihre Daten dauerhaft gelöscht.', s: sourceFingerprint(old) };
    expect(readCachedTranslation(entry, en)).toBeUndefined();
  });

  it('entries in the old format, a bare string, are treated as stale', () => {
    expect(readCachedTranslation('Bei Kündigung werden Ihre Daten gelöscht.', en)).toBeUndefined();
  });

  it('ignores missing and malformed entries', () => {
    expect(readCachedTranslation(undefined, en)).toBeUndefined();
    expect(readCachedTranslation(null, en)).toBeUndefined();
    expect(readCachedTranslation({ s: sourceFingerprint(en) }, en)).toBeUndefined();
  });

  it('the fingerprint changes when a single word changes, including a negation', () => {
    expect(sourceFingerprint('Your data is not sold.')).not.toBe(sourceFingerprint('Your data is sold.'));
    expect(sourceFingerprint(en)).toBe(sourceFingerprint(en));
  });
});
