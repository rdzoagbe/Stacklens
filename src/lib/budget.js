import { saveDb } from './db';

export const UNALLOCATED = '__unallocated__';

// Seat-weighted cost allocation: each active tool's monthly cost is split
// across departments in proportion to how many of its active seats belong to
// each department. Tools with no active seats land in the Unallocated bucket.
export function allocateSpendByDepartment({ tools = [], employees = [], access = [] }) {
  const empDept = {};
  employees.forEach(e => { empDept[e.id] = (e.department || '').trim() || 'other'; });

  const seatsByTool = {};
  access.filter(a => a.status === 'active').forEach(a => {
    const dept = empDept[a.employee_id];
    if (!dept) return;
    if (!seatsByTool[a.tool_id]) seatsByTool[a.tool_id] = {};
    seatsByTool[a.tool_id][dept] = (seatsByTool[a.tool_id][dept] || 0) + 1;
  });

  const monthlyByDept = {};
  tools.filter(t => t.status !== 'archived').forEach(tool => {
    const cost = Number(tool.cost_per_month || tool.cost_monthly || tool.cost || 0);
    if (!cost) return;
    const seats = seatsByTool[tool.id];
    const totalSeats = seats ? Object.values(seats).reduce((s, n) => s + n, 0) : 0;
    if (!totalSeats) {
      monthlyByDept[UNALLOCATED] = (monthlyByDept[UNALLOCATED] || 0) + cost;
      return;
    }
    Object.entries(seats).forEach(([dept, n]) => {
      monthlyByDept[dept] = (monthlyByDept[dept] || 0) + cost * (n / totalSeats);
    });
  });
  return monthlyByDept;
}

// Tolerant CSV parser for "Department, Annual budget" files. Accepts comma or
// semicolon separators (French Excel exports use ;), an optional header row,
// and currency symbols / spaces / French decimal commas inside amounts.
export function parseBudgetCsv(text) {
  const rows = [];
  text.split(/\r?\n/).forEach(line => {
    if (!line.trim()) return;
    const sep = line.includes(';') ? ';' : ',';
    const parts = line.split(sep).map(p => p.trim().replace(/^"|"$/g, ''));
    if (parts.length < 2) return;
    const dept = parts[0];
    const raw = parts.slice(1).find(p => /\d/.test(p)) || '';
    const amount = Number(raw.replace(/[^0-9.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    if (!dept || !Number.isFinite(amount) || amount <= 0) return;
    if (/^(department|d[ée]partement|service)$/i.test(dept)) return; // header row
    rows.push({ department: dept, annual: Math.round(amount) });
  });
  return rows;
}

export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Record this month's spend once per month so "spent to date" becomes exact
// over time instead of a run-rate estimate. Called from the Finance shell;
// appends { month, total, by_department } to db.spend_history (capped) and
// returns true when a snapshot was written (caller invalidates the query).
export function maybeSnapshotSpend(db) {
  if (!db?.user?.is_authenticated || db?.user?.is_demo) return false;
  const key = monthKey();
  const history = db.spend_history || [];
  if (history.some(s => s.month === key)) return false;
  const byDept = allocateSpendByDepartment(db);
  const total = Object.values(byDept).reduce((s, n) => s + n, 0);
  if (!total) return false;
  const rounded = Object.fromEntries(Object.entries(byDept).map(([d, n]) => [d, Math.round(n * 100) / 100]));
  const next = {
    ...db,
    spend_history: [...history, { month: key, total: Math.round(total * 100) / 100, by_department: rounded }].slice(-36),
  };
  saveDb(next);
  return true;
}

// Normalize an AI-extracted invoice into a monthly recurring amount.
export function monthlyAmountFromInvoice(inv) {
  const amount = Number(inv.amount || 0);
  if (!amount) return 0;
  if (inv.billing_cycle === 'yearly') return amount / 12;
  if (inv.billing_cycle === 'quarterly') return amount / 3;
  if (inv.billing_cycle === 'monthly') return amount;
  return 0; // one_time / unknown — recorded but not treated as recurring
}
