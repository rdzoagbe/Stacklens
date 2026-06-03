# Stacklens Test Dataset — Nexus Technologies

Fictional company with 15 users across 5 departments, 15 SaaS tools, realistic contracts, licenses and invoices. Designed to exercise every section of the Stacklens UI.

**Domain:** `nexustech.io`  
**Headcount:** 15 employees  
**Monthly SaaS spend:** ~€3,583  
**Annual SaaS spend:** ~€42,996  

---

## Files

| File | Purpose |
|---|---|
| `users-entraid.csv` | Import into Microsoft Entra ID (Bulk create users) |
| `users-google-workspace.csv` | Import into Google Workspace Admin (Bulk upload) |
| `stacklens-db.json` | Paste into browser devtools as `localStorage['saasguard_db']` to seed the app |

---

## Users

| Name | Email | Department | Title |
|---|---|---|---|
| Alice Martin | alice.martin@nexustech.io | Engineering | CTO |
| Bob Chen | bob.chen@nexustech.io | Engineering | Senior Software Engineer |
| Claire Dubois | claire.dubois@nexustech.io | Engineering | Software Engineer |
| David Nguyen | david.nguyen@nexustech.io | Engineering | Frontend Developer |
| Emma Leroy | emma.leroy@nexustech.io | Engineering | DevOps Engineer |
| François Bernard | francois.bernard@nexustech.io | Marketing | VP Marketing |
| Grace Smith | grace.smith@nexustech.io | Marketing | Content Marketing Manager |
| Hugo Petit | hugo.petit@nexustech.io | Marketing | Product Designer |
| Isabelle Moreau | isabelle.moreau@nexustech.io | Sales | VP Sales |
| Julien Garcia | julien.garcia@nexustech.io | Sales | Account Executive |
| Karen Wilson | karen.wilson@nexustech.io | Sales | Sales Development Rep |
| Lucas Thomas | lucas.thomas@nexustech.io | Human Resources | HR Manager |
| Marie Robert | marie.robert@nexustech.io | Human Resources | HR Business Partner |
| Nicolas Laurent | nicolas.laurent@nexustech.io | Finance | CFO |
| Olivia Simon | olivia.simon@nexustech.io | Finance | Financial Analyst |

---

## SaaS Tools & Pricing

| Tool | Category | Pricing Model | Unit Price | Seats | Monthly Cost |
|---|---|---|---|---|---|
| GitHub Enterprise | Development | Per user | €21/user | 10 | €210 |
| Slack Pro | Communication | Per user | €7.25/user | 15 | €108.75 |
| Notion Team | Productivity | Per user | €16/user | 15 | €240 |
| Jira Software | Project Management | Per user | €8.15/user | 10 | €81.50 |
| Figma Professional | Design | Per user | €12/user | 5 | €60 |
| Salesforce Sales Cloud | CRM | Per user | €150/user | 5 | €750 |
| HubSpot Marketing Hub | Marketing | Flat fee | — | — | €800 |
| Zoom Business | Communication | Per user | €19.99/user | 15 | €299.85 |
| 1Password Teams | Security | Per user | €4/user | 15 | €60 |
| Miro Team | Productivity | Per user | €10/user | 8 | €80 |
| DocuSign Standard | Legal | Per user | €25/user | 5 | €125 |
| Loom Business | Communication | Per user | €12.50/user | 10 | €125 |
| Intercom Starter | Customer Success | Flat fee | — | — | €74 |
| Google Workspace Business Plus | Productivity | Per user | €18/user | 15 | €270 |
| Datadog Pro | Monitoring | Flat fee | — | — | €350 |

---

## What it exercises in Stacklens

| Feature | What's covered |
|---|---|
| **Directory sync** | 15 users with org units, managers, departments — maps to Entra ID / Google Workspace structure |
| **Tools** | Mix of per-user and flat-fee billing, multiple categories, 3 unused seats (GitHub, Notion, Jira) to trigger waste alerts |
| **Access** | 80+ access records; some users have stale last_login (>60 days) to trigger inactive-user alerts |
| **Licenses** | 12 license records including seats_used < seats_purchased — triggers optimisation suggestions |
| **Contracts** | 8 contracts; `tool-007` (HubSpot) marked `expiring` to test renewal alerts; `tool-005` and `tool-010` have `auto_renew: false` |
| **Invoices** | 15 invoices; `inv-011` (DocuSign) is `overdue`, `inv-006` (Salesforce) and `inv-015` (Datadog) are `pending` |
| **Finance** | Enough spend spread across departments to populate the cost breakdown and analytics charts |

---

## How to import

### Entra ID (Microsoft)
1. Azure Portal → **Microsoft Entra ID** → Users → **Bulk operations** → **Bulk create**
2. Upload `users-entraid.csv`
3. All users get a temporary password — they'll be prompted to change on first login

### Google Workspace
1. Admin Console → **Directory** → Users → **Bulk update users** → Upload `users-google-workspace.csv`
2. Org unit paths (`/Engineering`, `/Marketing`, etc.) must exist in your domain before importing, or remove the Org Unit column
3. Temporary password is `Welcome2024!` — change at next sign-in is enforced

### Stacklens (seed localStorage)
Open the Stacklens app, sign in, then run in the browser console:

```js
localStorage.setItem('saasguard_db', JSON.stringify( /* paste stacklens-db.json content here */ ));
location.reload();
```

Or use the **Import** feature in Settings if available.
