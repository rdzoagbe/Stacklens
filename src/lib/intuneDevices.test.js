import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  fetchManagedDevices, toIntuneDevice, kindFromIntune, reconcileIntune, applyIntune,
  INTUNE_SCOPE, COMPLIANCE_STATES, IntuneError,
} from './intuneDevices';
import { cleanAsset, cleanMdm, holderFields, mdmConcerns } from './assets';

// ── Reading the devices Microsoft Intune manages ───────────────────────────

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const GRAPH = 'https://graph.microsoft.com/v1.0/deviceManagement/managedDevices';

const RAW = {
  id: 'dev-1', deviceName: 'LAPTOP-ANA', manufacturer: 'Lenovo', model: 'ThinkPad T14', serialNumber: 'PF4ABC',
  operatingSystem: 'Windows', osVersion: '10.0.22631', userPrincipalName: 'Ana@acme.fr', userDisplayName: 'Ana Silva',
  complianceState: 'noncompliant', isEncrypted: false, lastSyncDateTime: '2026-10-15T08:12:00Z',
  // Fields Stacklens must never keep:
  imei: '35-000000-000000-0', phoneNumber: '+33600000000', wiFiMacAddress: 'aa:bb', azureADDeviceId: 'x',
};

describe('the device list', () => {
  it('asks Microsoft Graph with GET only, and follows every page', async () => {
    const fetchImpl = vi.fn(async (url) => (url === GRAPH
      ? reply(200, { value: [RAW], '@odata.nextLink': `${GRAPH}?$skiptoken=2` })
      : reply(200, { value: [{ ...RAW, id: 'dev-2' }] })));
    const list = await fetchManagedDevices('tok', fetchImpl);
    expect(list.map((d) => d.id)).toEqual(['dev-1', 'dev-2']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchImpl.mock.calls) {
      expect(init.method).toBe('GET');
      expect(init.headers.Authorization).toBe('Bearer tok');
    }
  });

  it('never follows a next link away from Microsoft Graph (the token would go with it)', async () => {
    const fetchImpl = vi.fn(async () => reply(200, { value: [RAW], '@odata.nextLink': 'https://evil.example/steal' }));
    const list = await fetchManagedDevices('tok', fetchImpl);
    expect(list).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('says why when Microsoft refuses, and passes Microsoft\'s own words otherwise', async () => {
    await expect(fetchManagedDevices('t', async () => reply(401, {}))).rejects.toMatchObject({ code: 'unauthorised' });
    await expect(fetchManagedDevices('t', async () => reply(403, {}))).rejects.toMatchObject({ code: 'forbidden' });
    const err = await fetchManagedDevices('t', async () => reply(400, { error: { message: 'Tenant is not licensed for Intune.' } })).catch((e) => e);
    expect(err).toBeInstanceOf(IntuneError);
    expect(err.message).toBe('Tenant is not licensed for Intune.');
  });

  it('asks for the read-only permission Microsoft documents as least privileged', () => {
    expect(INTUNE_SCOPE).toBe('https://graph.microsoft.com/DeviceManagementManagedDevices.Read.All');
    expect(COMPLIANCE_STATES).toEqual(['unknown', 'compliant', 'noncompliant', 'conflict', 'error', 'inGracePeriod', 'configManager']);
  });
});

describe('a device in the register\'s terms', () => {
  it('keeps the model, serial, holder\'s address and a short snapshot', () => {
    const d = toIntuneDevice(RAW);
    expect(d).toMatchObject({
      id: 'dev-1', name: 'Lenovo ThinkPad T14', serial: 'PF4ABC', kind: 'laptop', email: 'ana@acme.fr',
      mdm: { source: 'intune', id: 'dev-1', compliance: 'noncompliant', encrypted: false, os: 'Windows', os_version: '10.0.22631', last_sync: '2026-10-15' },
    });
    expect(JSON.stringify(d)).not.toMatch(/imei|phone|35-000000|aa:bb|azureAD/i);
  });

  it('an unknown compliance value is unknown, a missing encryption flag is null', () => {
    expect(toIntuneDevice({ ...RAW, complianceState: 'weird', isEncrypted: undefined }).mdm).toMatchObject({ compliance: 'unknown', encrypted: null });
  });

  it('guesses the kind from the operating system and model', () => {
    expect(kindFromIntune({ operatingSystem: 'iOS', model: 'iPhone 15' })).toBe('phone');
    expect(kindFromIntune({ operatingSystem: 'iOS', model: 'iPad Air' })).toBe('tablet');
    expect(kindFromIntune({ operatingSystem: 'Android', model: 'Pixel 8' })).toBe('phone');
    expect(kindFromIntune({ operatingSystem: 'macOS', model: 'MacBook Pro' })).toBe('laptop');
    expect(kindFromIntune({ operatingSystem: 'Linux' })).toBe('other');
  });

  it('takes the first address when Intune gives several', () => {
    expect(toIntuneDevice({ emailAddress: 'a@x.fr; b@x.fr' }).email).toBe('a@x.fr');
  });
});

describe('comparing with the register', () => {
  const employees = [
    { id: 'ana', full_name: 'Ana Silva', email: 'ana@acme.fr', status: 'active' },
    { id: 'ben', full_name: 'Ben Roy', email: 'ben@acme.fr', status: 'active' },
  ];
  const assets = [
    { id: 'a1', ...cleanAsset({ name: 'My ThinkPad', serial: 'pf4-abc', kind: 'laptop', ...holderFields(employees[1]) }) },
    { id: 'a2', ...cleanAsset({ name: 'Old Surface', serial: 'GONE1', origin: 'intune', mdm: { source: 'intune', id: 'dev-9' } }) },
    { id: 'a3', ...cleanAsset({ name: 'Sold phone', serial: 'GONE2', status: 'retired', origin: 'intune', mdm: { source: 'intune', id: 'dev-8' } }) },
  ];
  const devices = [toIntuneDevice(RAW), toIntuneDevice({ id: 'dev-2', model: 'iPhone 15', operatingSystem: 'iOS', serialNumber: 'F2L1', userPrincipalName: 'ben@acme.fr' })];

  it('what to add, what both know, holders that differ, and what Intune no longer lists', () => {
    const r = reconcileIntune({ assets, employees }, devices);
    expect(r.toAdd.map((d) => d.id)).toEqual(['dev-2']);
    expect(r.matched.map((m) => m.asset.id)).toEqual(['a1']);           // same serial, written differently
    expect(r.holderDiffers.map((h) => [h.asset.id, h.person?.id])).toEqual([['a1', 'ana']]);
    expect(r.notInIntune.map((a) => a.id)).toEqual(['a2']);             // a3 is retired: not listed
  });

  it('recording adds what is new and refreshes what is known, never changing a recorded holder', () => {
    let n = 0;
    const { assets: out, created, updated } = applyIntune(assets, devices, employees, { makeId: () => `new${++n}`, today: '2026-10-17' });
    expect({ created, updated }).toEqual({ created: 1, updated: 1 });
    const a1 = out.find((a) => a.id === 'a1');
    expect(a1).toMatchObject({ name: 'My ThinkPad', assigned_to: 'ben', mdm: { compliance: 'noncompliant', encrypted: false, read_at: '2026-10-17', id: 'dev-1' } });
    const added = out.find((a) => a.id === 'new1');
    expect(added).toMatchObject({ name: 'iPhone 15', kind: 'phone', serial: 'F2L1', status: 'in_use', assigned_to: 'ben', origin: 'intune' });
    expect(assets.find((a) => a.id === 'a1').mdm).toBeUndefined();   // the input is not changed
  });

  it('a device without a serial number is found again by its Intune id, so a second read adds nothing', () => {
    const noSerial = [toIntuneDevice({ id: 'dev-5', model: 'Surface', operatingSystem: 'Windows' })];
    let n = 0; const makeId = () => `x${++n}`;
    const first = applyIntune([], noSerial, employees, { makeId, today: '2026-10-17' });
    const second = applyIntune(first.assets, noSerial, employees, { makeId, today: '2026-10-18' });
    expect(second).toMatchObject({ created: 0, updated: 1 });
    expect(second.assets).toHaveLength(1);
  });
});

describe('the snapshot on a device', () => {
  it('only the fields Stacklens shows, nothing else Microsoft returned', () => {
    expect(cleanMdm({ source: 'intune', id: 'd', compliance: 'compliant', encrypted: true, imei: '1', phoneNumber: '2', last_sync: '2026-10-01T10:00:00Z' }))
      .toEqual({ source: 'intune', id: 'd', compliance: 'compliant', encrypted: true, os: '', os_version: '', last_sync: '2026-10-01', read_at: '' });
    expect(cleanMdm({ source: 'other' })).toBeNull();
    expect(cleanMdm(null)).toBeNull();
  });

  it('survives an edit and a return; an unknown origin does not', () => {
    const a = cleanAsset({ name: 'X', origin: 'intune', mdm: { source: 'intune', id: 'd', compliance: 'noncompliant' }, ...holderFields({ id: 'e', email: 'e@x.fr' }) });
    expect(cleanAsset({ ...a, notes: 'edited' }).mdm.compliance).toBe('noncompliant');
    expect(cleanAsset({ ...a, status: 'in_stock' })).toMatchObject({ origin: 'intune', mdm: { id: 'd' } });
    expect(cleanAsset({ name: 'Y', origin: 'whatever' })).not.toHaveProperty('origin');
  });

  it('flags a device that fails a policy or is not encrypted, unless it is retired or lost', () => {
    expect(mdmConcerns({ status: 'in_use', mdm: { compliance: 'noncompliant', encrypted: false } })).toEqual(['noncompliant', 'not_encrypted']);
    expect(mdmConcerns({ status: 'in_use', mdm: { compliance: 'compliant', encrypted: true } })).toEqual([]);
    expect(mdmConcerns({ status: 'in_use', mdm: { compliance: 'unknown', encrypted: null } })).toEqual([]);
    expect(mdmConcerns({ status: 'retired', mdm: { compliance: 'noncompliant', encrypted: false } })).toEqual([]);
    expect(mdmConcerns({ status: 'in_use' })).toEqual([]);
  });
});

describe('it only reads', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/lib/intuneDevices.js'), 'utf8');
  const card = readFileSync(resolve(process.cwd(), 'src/components/IntuneDevicesCard.jsx'), 'utf8');

  it('every request to Microsoft is a GET, there is one, and nothing is kept in the browser', () => {
    expect(src).not.toMatch(/method:\s*'(POST|PUT|PATCH|DELETE)'/i);
    expect((src.match(/fetchImpl\(/g) || []).length).toBe(1);
    expect(src).toMatch(/method: 'GET'/);
    for (const f of [src, card]) {
      expect(f).not.toMatch(/localStorage|sessionStorage|indexedDB/);
      expect(f).not.toMatch(/ReadWrite|wipe\(|retire\(|remoteLock|syncDevice/);
    }
    expect(card).toMatch(/acquireMSToken\(\[INTUNE_SCOPE\]\)/);
  });

  it('the screen says it only reads, in English and French', () => {
    const tr = readFileSync(resolve(process.cwd(), 'src/translations.js'), 'utf8');
    expect(tr).toMatch(/itn_readonly: "Read only: Stacklens asks Microsoft only for permission to read devices \(DeviceManagementManagedDevices\.Read\.All\)\. It never locks, wipes, retires or sends anything to a device/);
    expect(tr).toMatch(/itn_readonly: "Lecture seule : Stacklens demande à Microsoft uniquement l’autorisation de lire les appareils/);
  });
});
