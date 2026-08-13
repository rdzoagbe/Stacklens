import { describe, it, expect, vi } from 'vitest';
import { resolveGraphUser, blockGraphUserSignIn, M365WriteError, GRAPH_WRITE_SCOPES } from './m365-writeback';

// This is the only code path in Stacklens that changes a customer's tenant.
// It cannot be exercised against a real Microsoft tenant here, so the rules
// that decide WHETHER to act — and the refusals — are pinned instead.

const ok = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });
const graphUser = (over = {}) => ({
  id: 'guid-1', displayName: 'Noah Petit',
  mail: 'noah.petit@acme.com', userPrincipalName: 'noah.petit@acme.com',
  accountEnabled: true, ...over,
});

describe('resolving which account to block', () => {
  it('matches on mail or userPrincipalName', async () => {
    const f = vi.fn().mockResolvedValue(ok({ value: [graphUser()] }));
    const u = await resolveGraphUser('noah.petit@acme.com', 'tok', f);
    expect(u.id).toBe('guid-1');
    const url = f.mock.calls[0][0];
    expect(decodeURIComponent(url)).toContain("mail eq 'noah.petit@acme.com'");
    expect(decodeURIComponent(url)).toContain("userPrincipalName eq 'noah.petit@acme.com'");
  });

  it('is case-insensitive about the address it was given', async () => {
    const f = vi.fn().mockResolvedValue(ok({ value: [graphUser()] }));
    await resolveGraphUser('  Noah.Petit@ACME.com  ', 'tok', f);
    expect(decodeURIComponent(f.mock.calls[0][0])).toContain("'noah.petit@acme.com'");
  });

  it('REFUSES when no account matches, rather than acting on a guess', async () => {
    const f = vi.fn().mockResolvedValue(ok({ value: [] }));
    await expect(resolveGraphUser('ghost@acme.com', 'tok', f))
      .rejects.toMatchObject({ code: 'not_found' });
  });

  it('REFUSES when several accounts match — never picks a human to lock out', async () => {
    const f = vi.fn().mockResolvedValue(ok({
      value: [graphUser(), graphUser({ id: 'guid-2' })],
    }));
    await expect(resolveGraphUser('noah.petit@acme.com', 'tok', f))
      .rejects.toMatchObject({ code: 'ambiguous' });
  });

  it('rejects an empty address without calling Microsoft at all', async () => {
    const f = vi.fn();
    await expect(resolveGraphUser('', 'tok', f)).rejects.toMatchObject({ code: 'not_found' });
    expect(f).not.toHaveBeenCalled();
  });

  it("escapes quotes so an address cannot break out of the OData filter", async () => {
    const f = vi.fn().mockResolvedValue(ok({ value: [graphUser()] }));
    await resolveGraphUser("o'brien@acme.com", 'tok', f);
    expect(decodeURIComponent(f.mock.calls[0][0])).toContain("o''brien@acme.com");
  });

  it('explains a 403 as a consent problem, not a generic failure', async () => {
    const f = vi.fn().mockResolvedValue(ok({}, 403));
    await expect(resolveGraphUser('a@acme.com', 'tok', f))
      .rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('blocking sign-in', () => {
  it('patches accountEnabled:false on the resolved account only', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(ok({ value: [graphUser()] }))
      .mockResolvedValueOnce(ok({}, 204));
    const res = await blockGraphUserSignIn('noah.petit@acme.com', 'tok', f);

    expect(res.alreadyBlocked).toBe(false);
    const [url, init] = f.mock.calls[1];
    expect(url).toContain('/users/guid-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ accountEnabled: false });
  });

  it('never sends a delete', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(ok({ value: [graphUser()] }))
      .mockResolvedValueOnce(ok({}, 204));
    await blockGraphUserSignIn('noah.petit@acme.com', 'tok', f);
    for (const [, init] of f.mock.calls) {
      expect(init?.method).not.toBe('DELETE');
    }
  });

  it('reports an already-blocked account instead of claiming it acted', async () => {
    const f = vi.fn().mockResolvedValue(ok({ value: [graphUser({ accountEnabled: false })] }));
    const res = await blockGraphUserSignIn('noah.petit@acme.com', 'tok', f);
    expect(res.alreadyBlocked).toBe(true);
    expect(f).toHaveBeenCalledTimes(1); // no PATCH attempted
  });

  it('does not patch anything when resolution was ambiguous', async () => {
    const f = vi.fn().mockResolvedValue(ok({ value: [graphUser(), graphUser({ id: 'guid-2' })] }));
    await expect(blockGraphUserSignIn('noah.petit@acme.com', 'tok', f)).rejects.toThrow(M365WriteError);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("surfaces Microsoft's own message when it refuses a privileged account", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(ok({ value: [graphUser()] }))
      .mockResolvedValueOnce(ok({ error: { message: 'Insufficient privileges to complete the operation.' } }, 403));
    await expect(blockGraphUserSignIn('admin@acme.com', 'tok', f))
      .rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('scope', () => {
  it('asks for User.ReadWrite.All, and only that', () => {
    expect(GRAPH_WRITE_SCOPES).toEqual(['https://graph.microsoft.com/User.ReadWrite.All']);
  });
});
