import { describe, it, expect } from 'vitest';
import { slugHeader, mapHeaders, normaliseCsvHeaders, csvAmount } from './csvHeaders';
import { parseCsv } from './dataUtils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── A spreadsheet with ordinary column names imports ───────────────────────

describe('headers people write', () => {
  it('are slugged without accents, spaces or punctuation', () => {
    expect(slugHeader('Coût / mois')).toBe('cout_mois');
    expect(slugHeader(' E-mail ')).toBe('e_mail');
    expect(slugHeader('Date d’entrée')).toBe('date_d_entree');
  });

  it('a French HR export becomes the employees template', () => {
    const { line, renamed } = mapHeaders('Nom;E-mail;Service;Poste;Statut;Date d’entrée', 'employees');
    expect(line).toBe('full_name;email;department;role;status;start_date');
    expect(renamed).toHaveLength(6);
  });

  it('a tools sheet in English with friendly names', () => {
    const { line } = mapHeaders('Tool,Category,Monthly cost,Owner,Renewal', 'tools');
    expect(line).toBe('name,category,cost_per_month,owner_email,renewal_date');
  });

  it('canonical names are kept, unknown columns pass through, a second match is not stolen', () => {
    const { line, renamed } = mapHeaders('name,Nom,Couleur préférée', 'tools');
    expect(line).toBe('name,Nom,Couleur préférée');
    expect(renamed).toEqual([]);
  });

  it('renames only the header line, and the rows then parse under the template names', () => {
    const { text, renamed } = normaliseCsvHeaders('Nom,Email,Service\r\nAna Lopez,ana@co.fr,Ventes\n', 'employees');
    // "Email" already slugs to the template name: nothing to rename there.
    expect(renamed.map(([, to]) => to)).toEqual(['full_name', 'department']);
    expect(parseCsv(text)[0]).toEqual({ full_name: 'Ana Lopez', email: 'ana@co.fr', department: 'Ventes' });
  });

  it('a semicolon file (French Excel) parses as columns, not as one field', () => {
    const { text } = normaliseCsvHeaders('Salarié;Courriel;Outil;Coût mensuel\nAna;ana@co.fr;HubSpot;"1 200,50"\n', 'company');
    expect(parseCsv(text)[0]).toEqual({ employee_name: 'Ana', employee_email: 'ana@co.fr', tool_name: 'HubSpot', tool_cost_monthly: '1 200,50' });
  });

  it('the company file maps too, including the new tool columns', () => {
    const { line } = mapHeaders('Salarié,Courriel,Service,Outil,Coût mensuel,MFA,Sièges', 'company');
    expect(line).toBe('employee_name,employee_email,department,tool_name,tool_cost_monthly,tool_mfa,tool_seats');
  });
});

describe('amounts as a spreadsheet writes them', () => {
  it('reads French and English figures, currency signs and spaces', () => {
    expect(csvAmount('1 200,50')).toBe(1200.5);
    expect(csvAmount('1.200,50')).toBe(1200.5);
    expect(csvAmount('1,200.50')).toBe(1200.5);
    expect(csvAmount('49.90 €')).toBe(49.9);
    expect(csvAmount('€ 49')).toBe(49);
    expect(csvAmount('')).toBe(0);
    expect(csvAmount('abc')).toBe(0);
    expect(csvAmount(12)).toBe(12);
  });

  it('the import reads costs through it', () => {
    const hook = readFileSync(resolve(process.cwd(), 'src/hooks/useDbQuery.js'), 'utf8');
    expect(hook).toMatch(/import \{ csvAmount \} from '\.\.\/lib\/csvHeaders';/);
    expect(hook).not.toMatch(/Number\(r\.tool_cost_monthly/);
    expect(hook).not.toMatch(/Number\(r\.cost_per_month/);
  });
});
