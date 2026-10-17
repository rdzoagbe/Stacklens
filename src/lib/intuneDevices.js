// ── The devices Microsoft Intune manages, read into the hardware register ──
//
// An editor clicks "Read the devices from Intune": the browser asks Microsoft
// for a token with DeviceManagementManagedDevices.Read.All (Microsoft's least
// privileged permission for this list, delegated: the signed-in admin's own
// rights apply), then lists GET /deviceManagement/managedDevices, following
// @odata.nextLink. Source: Microsoft Graph v1.0 "List managedDevices" and the
// managedDevice resource. The tenant needs an active Intune licence; without
// one Microsoft answers with an error, which is shown as Microsoft wrote it.
//
// READ ONLY. Every request here is a GET (intuneDevices.test.js fails on any
// other), and the permission asked for cannot change a device. Stacklens never
// locks, wipes, retires or sends anything to a device. What Microsoft returns
// stays in memory until the editor chooses to record it; recording keeps a
// short snapshot on each device (`asset.mdm`, lib/assets.js cleanMdm): its
// Intune id, compliance, encryption, operating system and last check-in.

import { cleanAsset, holderFields, serialKey } from './assets';

export const INTUNE_SCOPE = 'https://graph.microsoft.com/DeviceManagementManagedDevices.Read.All';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const MANAGED_DEVICES = `${GRAPH}/deviceManagement/managedDevices`;
const MAX_DEVICES = 50_000;

/** Microsoft's complianceState values (Graph v1.0 complianceState enum). */
export const COMPLIANCE_STATES = ['unknown', 'compliant', 'noncompliant', 'conflict', 'error', 'inGracePeriod', 'configManager'];

export class IntuneError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/**
 * Every device Intune manages for this tenant, as Microsoft returns them.
 * `fetchImpl` lets a test stand in for Microsoft.
 */
export async function fetchManagedDevices(token, fetchImpl = fetch) {
  const devices = [];
  let url = MANAGED_DEVICES;
  while (url && devices.length < MAX_DEVICES) {
    const res = await fetchImpl(url, { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) throw new IntuneError('unauthorised', 'The Microsoft sign-in expired or was not granted. Try again and accept the permission.');
    if (res.status === 403) {
      throw new IntuneError('forbidden', 'Microsoft refused: the account needs an Intune role that can read devices, and the app needs admin consent for DeviceManagementManagedDevices.Read.All.');
    }
    if (!res.ok) throw new IntuneError('graph', body?.error?.message || `HTTP ${res.status}`);
    devices.push(...(Array.isArray(body?.value) ? body.value : []));
    const next = body?.['@odata.nextLink'];
    // Only ever follow a link back to Microsoft Graph: the token goes with it.
    url = typeof next === 'string' && next.startsWith(`${GRAPH}/`) ? next : null;
  }
  return devices;
}

const str = (v) => String(v ?? '').trim();

/** The kind of device, from what Intune says about it. A guess the editor can change. */
export function kindFromIntune(raw) {
  const os = str(raw?.operatingSystem).toLowerCase();
  const model = str(raw?.model).toLowerCase();
  if (/ipad|tablet|\btab\b/.test(model) || os === 'ipados') return 'tablet';
  if (os === 'ios' || os === 'android') return 'phone';
  if (os.startsWith('windows') || os === 'macos' || os.includes('mac')) return 'laptop';
  return 'other';
}

/** The address of the person Intune links the device to, or ''. */
function intuneEmail(raw) {
  const upn = str(raw?.userPrincipalName);
  if (upn.includes('@')) return upn.toLowerCase();
  const first = str(raw?.emailAddress).split(/[;,\s]+/).find((e) => e.includes('@'));
  return first ? first.toLowerCase() : '';
}

/** One Intune device in the register's terms. */
export function toIntuneDevice(raw) {
  const name = [str(raw?.manufacturer), str(raw?.model)].filter(Boolean).join(' ') || str(raw?.deviceName);
  return {
    id: str(raw?.id),
    name,
    deviceName: str(raw?.deviceName),
    serial: str(raw?.serialNumber),
    kind: kindFromIntune(raw),
    email: intuneEmail(raw),
    holderName: str(raw?.userDisplayName),
    mdm: {
      source: 'intune',
      id: str(raw?.id),
      compliance: COMPLIANCE_STATES.includes(raw?.complianceState) ? raw.complianceState : 'unknown',
      encrypted: typeof raw?.isEncrypted === 'boolean' ? raw.isEncrypted : null,
      os: str(raw?.operatingSystem),
      os_version: str(raw?.osVersion),
      last_sync: str(raw?.lastSyncDateTime).slice(0, 10),
    },
  };
}

/** The register's device for an Intune device: same Intune id, else same serial number. */
function findAsset(assets, device) {
  if (device.id) {
    const byId = assets.find((a) => a.mdm?.source === 'intune' && a.mdm?.id === device.id);
    if (byId) return byId;
  }
  const k = serialKey(device.serial);
  return k ? assets.find((a) => serialKey(a.serial) === k) || null : null;
}

/**
 * How Intune's list compares with the register:
 *   toAdd       Intune devices the register does not have
 *   matched     [{ asset, device }] devices both know
 *   holderDiffers  matched devices Intune links to someone the register does not
 *   notInIntune register devices recorded from Intune that Intune no longer lists
 *                  (not retired or lost)
 */
export function reconcileIntune(db, devices) {
  const assets = db?.assets || [];
  const employees = db?.employees || [];
  const toAdd = []; const matched = []; const holderDiffers = [];
  const seen = new Set();
  for (const device of devices) {
    const asset = findAsset(assets, device);
    if (!asset) { toAdd.push(device); continue; }
    seen.add(asset.id);
    matched.push({ asset, device });
    if (!device.email) continue;
    const person = employees.find((e) => str(e.email).toLowerCase() === device.email) || null;
    const current = str(asset.assigned_email).toLowerCase();
    if (current !== device.email) holderDiffers.push({ asset, device, person });
  }
  const notInIntune = assets.filter((a) => a.mdm?.source === 'intune' && !seen.has(a.id)
    && !['retired', 'lost'].includes(a.status));
  return { toAdd, matched, holderDiffers, notInIntune };
}

/**
 * The register after recording Intune's list: devices it does not have are
 * added (holder from Intune's address when that person is in the people list,
 * else the address as written); devices it has get Intune's snapshot, and only
 * the blanks of their model, kind and serial filled. A holder already recorded
 * is never changed here: reconcileIntune lists the differences, and the
 * editor decides each one.
 */
export function applyIntune(existing = [], devices = [], employees = [], { makeId, today }) {
  const out = existing.map((a) => ({ ...a }));
  let created = 0; let updated = 0;
  const byEmail = new Map(employees.map((e) => [str(e.email).toLowerCase(), e]));
  for (const device of devices) {
    const mdm = { ...device.mdm, read_at: today };
    const asset = findAsset(out, device);
    if (asset) {
      const i = out.indexOf(asset);
      const fill = {
        ...(asset.name ? {} : { name: device.name }),
        ...(asset.serial ? {} : { serial: device.serial }),
        ...(asset.kind && asset.kind !== 'other' ? {} : { kind: device.kind }),
      };
      const { id, returned_at } = asset;
      out[i] = { ...cleanAsset({ ...asset, ...fill, mdm }), id, ...(returned_at ? { returned_at } : {}) };
      updated++;
      continue;
    }
    const person = device.email ? byEmail.get(device.email) : null;
    out.unshift({
      ...cleanAsset({
        name: device.name || device.deviceName, kind: device.kind, serial: device.serial,
        ...(person ? holderFields(person) : device.email ? { assigned_email: device.email, assigned_name: device.holderName } : {}),
        origin: 'intune', mdm,
      }),
      id: makeId(),
    });
    created++;
  }
  return { assets: out, created, updated };
}
