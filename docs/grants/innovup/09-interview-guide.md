# User research — 15 to 20 interviews

The guide's section 8, made runnable. Twenty minutes each, video or phone,
no feature demo until the end, no leading. The output is anonymised quotes,
counted themes and one baseline number per participant (hours per month).

## Recruitment target

| Segment | Target | What to learn |
|---|---|---|
| Founder / CEO of a 5–50 person company | 5–7 | Financial pain, visibility, who decides, willingness to pay |
| IT / security (internal or outsourced) | 5–7 | Access control, offboarding, audit, technical integration |
| Finance / operations / accountant | 4–6 | SaaS spend, renewals, invoices, ownership, reporting |

Interview existing Stacklens users separately from prospects. Aim for at least
three accountants or bookkeepers — they are the channel and they see many
companies at once.

Where to find them: the accountant page's inbound, the free audit's users
(the `audit_download` event tells you how many there are), existing sign-ups
(export from Firebase Auth), the Bondy / Seine-Saint-Denis business networks,
and one message to each person who did not answer the earlier outreach —
"20 minutes of research, not a sales call" gets a different answer.

## Opening (read as written)

> "I'm researching how companies manage their software tools, licences and
> access. This is not a sales call. I want to understand what you actually do
> today, what breaks, and what takes time. There are no right answers. May I
> take notes? Nothing will be attributed to you or your company by name."

## Questions (in this order; skip none)

1. How many software tools do you think your organisation uses today?
2. How do you currently discover and keep track of them?
3. Who owns the list, and who checks it?
4. Tell me about the last time you found a subscription you no longer needed.
5. Tell me about the last time someone left and their access had to be removed.
6. How do you handle renewals?
7. What information is hardest to obtain?
8. **How much time does this process take?** *(get a number: hours per month; this is the baseline KPI)*
9. What happens when the information is incomplete?
10. What would make you trust an automated recommendation?
11. What would make you reject one?
12. What would you never allow an automated system to change without approval?
13. If you could remove one recurring SaaS-management task, what would it be?
14. What would make you pay for a tool that solves this problem?

For existing users, add: What did you expect from Stacklens? What was useful
immediately? What was confusing? Which insight did you act on? What was
missing? What would make you stop using it?

Only after question 14: show the free audit or the dashboard, if they ask.

## Note sheet (one per interview; file as `evidence/interviews/I-NN.md`)

```
Interview I-NN
Date:                 Segment: founder / IT / finance / accountant
Company size band:    1–5 / 6–20 / 21–50 / 51–200    Sector band: 
Existing user: yes/no

Q1 tools (their guess):          Q8 hours/month on SaaS admin:
Last real problem (Q4/Q5/Q6 — which, what happened, what it cost):

Trust conditions (Q10):
Rejection conditions (Q11):
Never-automate list (Q12):
Would pay for (Q14):

Verbatim quotes (anonymised — no names, no company, no vendor that identifies them):
 - "..."
 - "..."

Themes tagged: [discovery] [utilisation] [offboarding] [renewals] [incomplete-data] [trust] [approval] [time]
Pilot interest: no / maybe / yes — follow-up date:
```

## Anonymisation rule

Notes carry the interview number only. A separate sheet, kept outside the
repository, maps numbers to names and contact details. Quotes used in the
application are checked once more for anything that identifies a person or a
company (a vendor combination can be enough in a small sector).

## Tally sheet (fill as you go; this becomes the "recurring themes" table)

| Theme | Mentions | Of N interviews | Representative quote (I-NN) |
|---|---|---|---|
| Nobody owns the tool list | | | |
| Discovery is by bank statement / card statement | | | |
| Leaver access found late | | | |
| Renewal surprised them | | | |
| Would trust a recommendation if it shows the evidence | | | |
| Would reject if it has ever been wrong before | | | |
| Never automate: cancelling, revoking without a person | | | |
| Median hours/month (Q8) | | | *number, not a quote* |

## What the interviews feed

- `02` §3 — the explainability and leaver-detection uncertainties (questions 5, 10–12).
- `03` WP4 — the recommendation schema and approval design (10–12).
- `03` WP6 — the baseline hours/month (8) and pilot recruitment (last line of the sheet).
- `05` — hours before vs after.
- The application's *Market* and *Need* sections — themes with counts, not adjectives.
