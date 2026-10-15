// ── Who should have each tool, and where the workspace differs ─────────────
//
// A rule on a tool says who is entitled to a licence: everyone, or the people
// in some departments or whose job title contains some words. Against the
// directory and the access records it gives two lists:
//
//   toGrant     active people the rule covers who hold no licence yet
//   outsideRule active people who hold a licence the rule does not give them
//
// Stacklens does not grant or remove the licence in the vendor's console: the
// person doing it marks it here, which records an access row (or revokes one)
// with the usual audit trail. Two answers keep a line off the lists for good:
// "not needed" on someone the rule covers (tool.eligibility.excluded_ids) and
// "keep as an exception" on a licence outside it (access.eligibility_exception).
//
// People who have left are not in either list: they are the Offboarding
// page's job, and listing them twice would count the same licence twice.

export const RULE_MODES = ['all', 'match'];

/** Lower case, no accents, single spaces: "Développement " → "developpement". */
export const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

/** A rule as stored, cleaned: unknown modes and empty words dropped. */
export function cleanRule(rule) {
  if (!rule || !RULE_MODES.includes(rule.mode)) return null;
  const list = (v) => [...new Set((Array.isArray(v) ? v : []).filter((x) => x != null).map((x) => String(x).trim()).filter(Boolean))];
  return {
    mode: rule.mode,
    departments: list(rule.departments),
    titles: list(rule.titles),
    excluded_ids: list(rule.excluded_ids),
  };
}

/** "dev, ingénieur ; Data" → ['dev', 'ingénieur', 'Data'] */
export function parseTitleWords(text) {
  return [...new Set(String(text || '').split(/[,;\n]/).map((s) => s.trim()).filter(Boolean))];
}

const jobTitle = (emp) => emp?.job_title || emp?.title || emp?.role || '';
// The Google Workspace import writes "admin" / "user" into `role`: that is an
// account type, not a job, and must never match a title word.
const ACCOUNT_TYPES = new Set(['admin', 'user']);

/** Does the rule give this person a licence? Only people still here count. */
export function isEligible(emp, rawRule) {
  const rule = cleanRule(rawRule);
  if (!rule || !emp || emp.status !== 'active') return false;
  if (rule.mode === 'all') return true;
  const dept = norm(emp.department);
  if (dept && rule.departments.some((d) => norm(d) === dept)) return true;
  const title = norm(jobTitle(emp));
  if (!title || ACCOUNT_TYPES.has(title)) return false;
  return rule.titles.some((w) => norm(w) && title.includes(norm(w)));
}

const HELD = new Set(['active', 'pending_revocation']);
const holds = (a) => HELD.has(a?.status || 'active');

/**
 * What a monthly licence costs, as far as the workspace knows: the tool's cost
 * over its seats, else over the people holding it today. null when neither is
 * known, rather than a made-up figure.
 */
export function perLicence(tool, holders) {
  const cost = Number(tool?.cost_per_month ?? tool?.cost_monthly ?? tool?.cost) || 0;
  if (!cost) return null;
  const seats = Number(tool?.seats) || 0;
  if (seats > 0) return cost / seats;
  return holders > 0 ? cost / holders : null;
}

/** The two lists for one tool, plus what each would cost or save per month. */
export function eligibilityGaps(db, tool) {
  const rule = cleanRule(tool?.eligibility);
  const employees = db?.employees || [];
  const byId = new Map(employees.map((e) => [e.id, e]));
  const byEmail = new Map(employees.filter((e) => e.email).map((e) => [norm(e.email), e]));
  const rows = (db?.access || []).filter((a) => a.tool_id === tool?.id && holds(a));
  const who = (a) => byId.get(a.employee_id) || byEmail.get(norm(a.employee_email)) || null;
  const holderIds = new Set(rows.map((a) => who(a)?.id).filter(Boolean));

  if (!rule) {
    return { rule: null, eligible: [], toGrant: [], outsideRule: [], exceptions: [], notNeeded: [], holders: holderIds.size, perLicence: perLicence(tool, holderIds.size) };
  }
  const excluded = new Set(rule.excluded_ids);
  const eligible = employees.filter((e) => isEligible(e, rule));
  const toGrant = eligible.filter((e) => !holderIds.has(e.id) && !excluded.has(e.id));
  const notNeeded = eligible.filter((e) => !holderIds.has(e.id) && excluded.has(e.id));

  const outsideRule = []; const exceptions = [];
  for (const a of rows) {
    const emp = who(a);
    if (!emp || emp.status !== 'active') continue;      // left: the Offboarding page's job
    if (isEligible(emp, rule)) continue;
    (a.eligibility_exception ? exceptions : outsideRule).push({ access: a, employee: emp });
  }
  const unit = perLicence(tool, holderIds.size);
  return {
    rule, eligible, toGrant, outsideRule, exceptions, notNeeded,
    holders: holderIds.size, perLicence: unit,
    grantCost: unit == null ? null : unit * toGrant.length,
    recoverable: unit == null ? null : unit * outsideRule.length,
  };
}

/** Every tool with a rule, with its gaps; for the overview and the dashboard. */
export function eligibilityOverview(db) {
  const tools = (db?.tools || []).filter((t) => t.status !== 'decommissioned' && cleanRule(t.eligibility));
  const items = tools.map((tool) => ({ tool, ...eligibilityGaps(db, tool) }));
  return {
    items,
    toGrant: items.reduce((s, i) => s + i.toGrant.length, 0),
    outsideRule: items.reduce((s, i) => s + i.outsideRule.length, 0),
  };
}

/** The departments people are actually in, with how many active people each. */
export function departmentsInUse(employees) {
  const counts = new Map();
  for (const e of employees || []) {
    if (e.status !== 'active' || !String(e.department || '').trim()) continue;
    const key = norm(e.department);
    const prev = counts.get(key);
    counts.set(key, { value: prev?.value || String(e.department).trim(), count: (prev?.count || 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
