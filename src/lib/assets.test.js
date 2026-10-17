import { describe, it, expect } from 'vitest';
import {
  cleanAsset, isoDate, serialKey, holderOf, holderFields, assetsHeldBy, devicesToReturn,
  coverageState, coverageEnding, assetSummary, assetsFromCsv, mergeAssets,
  ASSET_CSV_TEMPLATE, ASSET_KINDS, ASSET_STATUSES,
} from './assets';
import { parseCsv } from './dataUtils';

const NOW = Date.parse('2026-10-17T10:00:00Z');
const people = [
  { id: 'e1', full_name: 'Jane Smith', email: 'jane@co.com', status: 'active' },
  { id: 'e2', full_name: 'Tom Brown', email: 'Tom@co.com', status: 'offboarding', end_date: '2026-10-20' },
  { id: 'e3', full_name: 'Amy Lee', email: 'amy@co.com', status: 'offboarded', end_date: '2026-09-01' },
];

describe('cleanAsset', () => {
  it('falls back to known kinds and statuses', () => {
    const a = cleanAsset({ kind: 'spaceship', status: 'flying', name: ' Mac ' });
    expect(a.kind).toBe('other');
    expect(a.status).toBe('in_stock');
    expect(a.name).toBe('Mac');
  });

  it('a device with a holder and no status is in use', () => {
    expect(cleanAsset({ assigned_to: 'e1' }).status).toBe('in_use');
  });

  it('in use without anybody holding it is in stock', () => {
    expect(cleanAsset({ status: 'in_use' }).status).toBe('in_stock');
  });

  it('a device in stock, retired or lost has no holder; in repair keeps it', () => {
    for (const status of ['in_stock', 'retired', 'lost']) {
      const a = cleanAsset({ status, ...holderFields(people[0]) });
      expect(a.assigned_to).toBe('');
      expect(a.assigned_email).toBe('');
    }
    expect(cleanAsset({ status: 'in_repair', ...holderFields(people[0]) }).assigned_to).toBe('e1');
  });

  it('reads amounts and dates the way people write them', () => {
    const a = cleanAsset({ purchase_cost: '1 299,90 €', purchase_date: '10/02/2025', coverage_end: '2027-02-10T00:00:00Z' });
    expect(a.purchase_cost).toBe(1299.9);
    expect(a.purchase_date).toBe('2025-02-10');
    expect(a.coverage_end).toBe('2027-02-10');
  });

  it('never stores a negative or unreadable cost', () => {
    expect(cleanAsset({ purchase_cost: '-5' }).purchase_cost).toBe(0);
    expect(cleanAsset({ purchase_cost: 'abc' }).purchase_cost).toBe(0);
  });
});

describe('dates and serials', () => {
  it('isoDate', () => {
    expect(isoDate('2026-01-05')).toBe('2026-01-05');
    expect(isoDate('5/1/2026')).toBe('2026-01-05');
    expect(isoDate('nonsense')).toBe('');
    expect(isoDate('')).toBe('');
  });
  it('serialKey ignores case, spaces and dashes', () => {
    expect(serialKey(' c02-xk1 abcd ')).toBe(serialKey('C02XK1ABCD'));
    expect(serialKey('')).toBe('');
  });
});

describe('who holds what', () => {
  it('finds the holder by id, then by email', () => {
    expect(holderOf({ assigned_to: 'e1' }, people)?.id).toBe('e1');
    expect(holderOf({ assigned_to: 'gone', assigned_email: 'TOM@co.com' }, people)?.id).toBe('e2');
    expect(holderOf({ assigned_to: 'gone', assigned_email: 'nobody@co.com' }, people)).toBeNull();
    expect(holderOf({}, people)).toBeNull();
  });

  it('lists the devices one person holds, not returned ones', () => {
    const db = {
      employees: people,
      assets: [
        { id: 'a1', status: 'in_use', assigned_to: 'e1' },
        { id: 'a2', status: 'in_repair', assigned_to: 'e1' },
        { id: 'a3', status: 'in_stock', assigned_to: '' },
        { id: 'a4', status: 'in_use', assigned_to: 'e2' },
      ],
    };
    expect(assetsHeldBy(db, people[0]).map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(assetsHeldBy(db, null)).toEqual([]);
  });
});

describe('devices to get back from leavers', () => {
  const db = {
    employees: people,
    assets: [
      { id: 'a1', status: 'in_use', assigned_to: 'e1' },              // active: not listed
      { id: 'a2', status: 'in_use', assigned_to: 'e2' },              // leaving
      { id: 'a3', status: 'in_repair', assigned_to: 'e3' },           // left
      { id: 'a4', status: 'in_stock', assigned_to: '' },              // back already
      { id: 'a5', status: 'in_use', assigned_to: 'x', assigned_email: 'amy@co.com' }, // matched by email
    ],
  };
  it('lists only devices still held by someone leaving or gone, earliest leaver first', () => {
    const list = devicesToReturn(db);
    expect(list.map((r) => r.asset.id)).toEqual(['a3', 'a5', 'a2']);
  });
  it('copes with an empty or missing workspace', () => {
    expect(devicesToReturn({})).toEqual([]);
    expect(devicesToReturn(undefined)).toEqual([]);
  });
});

describe('warranty and lease end dates', () => {
  it('classifies relative to today', () => {
    expect(coverageState({ coverage_end: '2026-10-16', status: 'in_use' }, { now: NOW })).toBe('expired');
    expect(coverageState({ coverage_end: '2026-10-17', status: 'in_use' }, { now: NOW })).toBe('soon');
    expect(coverageState({ coverage_end: '2026-11-16', status: 'in_use' }, { now: NOW })).toBe('soon');
    expect(coverageState({ coverage_end: '2026-11-17', status: 'in_use' }, { now: NOW })).toBe('ok');
    expect(coverageState({ coverage_end: '', status: 'in_use' }, { now: NOW })).toBeNull();
  });
  it('a retired or lost device needs no reminder', () => {
    expect(coverageState({ coverage_end: '2026-10-20', status: 'retired' }, { now: NOW })).toBeNull();
    expect(coverageState({ coverage_end: '2026-10-20', status: 'lost' }, { now: NOW })).toBeNull();
  });
  it('lists the ones ending soon, soonest first', () => {
    const db = { assets: [
      { id: 'b', coverage_end: '2026-11-10', status: 'in_use' },
      { id: 'a', coverage_end: '2026-10-25', status: 'in_stock' },
      { id: 'c', coverage_end: '2027-10-25', status: 'in_use' },
      { id: 'd', coverage_end: '2026-10-01', status: 'in_use' },
    ] };
    expect(coverageEnding(db, { now: NOW }).map((a) => a.id)).toEqual(['a', 'b']);
  });
});

describe('summary', () => {
  it('counts', () => {
    const db = {
      employees: people,
      assets: [
        { id: 'a1', status: 'in_use', assigned_to: 'e1', coverage_end: '2026-10-30' },
        { id: 'a2', status: 'in_use', assigned_to: 'e2' },
        { id: 'a3', status: 'in_stock' },
        { id: 'a4', status: 'retired', coverage_end: '2026-10-30' },
      ],
    };
    expect(assetSummary(db, { now: NOW })).toEqual({ total: 4, in_use: 2, in_stock: 1, to_return: 1, coverage_soon: 1 });
    expect(assetSummary({}, { now: NOW })).toEqual({ total: 0, in_use: 0, in_stock: 0, to_return: 0, coverage_soon: 0 });
  });
});

describe('CSV import', () => {
  it('the template reads back into valid records', () => {
    const { records, skipped, unmatched } = assetsFromCsv(parseCsv(ASSET_CSV_TEMPLATE), [{ ...people[0], email: 'jane@company.com' }]);
    expect(skipped).toBe(0);
    expect(unmatched).toBe(0);
    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({ kind: 'laptop', status: 'in_use', assigned_to: 'e1', purchase_cost: 1299, coverage_type: 'warranty', coverage_end: '2027-02-10' });
    expect(records[2]).toMatchObject({ kind: 'phone', status: 'in_stock', assigned_to: '', coverage_type: 'lease' });
    for (const r of records) {
      expect(ASSET_KINDS).toContain(r.kind);
      expect(ASSET_STATUSES).toContain(r.status);
    }
  });

  it('reads a French file with semicolons', () => {
    const csv = 'Modèle;Type;Numéro de série;E-mail;Statut;Prix achat;Fin de garantie\n'
      + 'ThinkPad T14;Portable;PF-123;tom@co.com;Attribué;1 049,00;01/03/2027\n';
    const { records } = assetsFromCsv(parseCsv(csv), people);
    expect(records[0]).toMatchObject({
      name: 'ThinkPad T14', kind: 'laptop', serial: 'PF-123', assigned_to: 'e2',
      status: 'in_use', purchase_cost: 1049, coverage_end: '2027-03-01',
    });
  });

  it('skips a row with neither name nor serial, and counts addresses nobody has', () => {
    const csv = 'name,serial,assigned_email\n,,jane@co.com\nPixel 8,,ghost@co.com\n';
    const { records, skipped, unmatched } = assetsFromCsv(parseCsv(csv), people);
    expect(skipped).toBe(1);
    expect(unmatched).toBe(1);
    expect(records[0]).toMatchObject({ assigned_to: '', assigned_email: 'ghost@co.com', status: 'in_use' });
  });
});

describe('merging an import into the register', () => {
  let n = 0;
  const makeId = () => `new_${++n}`;
  const existing = [
    { id: 'keep', ...cleanAsset({ name: 'MacBook', serial: 'C02-XK1', kind: 'laptop', ...holderFields(people[0]), purchase_cost: 1500, notes: 'kept' }) },
  ];

  it('updates the device with the same serial, only with the columns the file filled', () => {
    const { records } = assetsFromCsv(parseCsv('serial,coverage_end\nc02xk1,2028-01-01\n'), people);
    const { assets, created, updated } = mergeAssets(existing, records, makeId);
    expect({ created, updated }).toEqual({ created: 0, updated: 1 });
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      id: 'keep', name: 'MacBook', kind: 'laptop', status: 'in_use', assigned_to: 'e1',
      purchase_cost: 1500, notes: 'kept', coverage_end: '2028-01-01',
    });
    expect(assets[0]).not.toHaveProperty('_given');
  });

  it('a file naming a new holder moves the device to them', () => {
    const { records } = assetsFromCsv(parseCsv('serial,assigned_email\nC02XK1,tom@co.com\n'), people);
    const { assets } = mergeAssets(existing, records, makeId);
    expect(assets[0]).toMatchObject({ assigned_to: 'e2', assigned_name: 'Tom Brown', status: 'in_use' });
  });

  it('adds the rest, and never repeats a serial within one file', () => {
    const csv = 'name,serial\nScreen,S1\nScreen again,s-1\nNo serial,\nNo serial,\n';
    const { records } = assetsFromCsv(parseCsv(csv), people);
    const { assets, created, updated } = mergeAssets(existing, records, makeId);
    expect({ created, updated }).toEqual({ created: 3, updated: 1 });
    expect(assets.filter((a) => serialKey(a.serial) === 'S1')).toHaveLength(1);
    expect(assets.find((a) => a.id === 'keep')).toBeTruthy();
    for (const a of assets) expect(a).not.toHaveProperty('_given');
  });

  it('does not change the list it was given', () => {
    const before = JSON.stringify(existing);
    mergeAssets(existing, assetsFromCsv(parseCsv('serial,status\nC02XK1,retired\n'), people).records, makeId);
    expect(JSON.stringify(existing)).toBe(before);
  });
});
