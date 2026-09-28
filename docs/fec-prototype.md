# FEC import — prototype

**Status:** prototype, live on `/audit-saas` behind a "beta" label. Measured on
synthetic files only. Nothing here has yet been checked against a real client
ledger.

## What it does

The free audit now accepts the *Fichier des Écritures Comptables* (FEC), the
ledger export every French accounting package must produce (article A47 A-1
LPF). The page recognises it by its header and reads it in the browser, like a
bank statement: nothing is uploaded.

`src/lib/fec.js` turns the ledger into the same transactions the bank reader
produces, so the same engine, review buttons, CSV and client report work on it:

- **One charge per purchase entry.** Lines sharing `JournalCode` +
  `EcritureNum` are one entry. Its class 6 lines are summed (credits inside the
  entry netted); VAT (445), supplier (401) and bank (512) lines are not charges.
  Entries with no class 6 line — payments, sales — are ignored.
- **Named after the supplier**, from `CompAuxLib` on the 401 line. A catch-all
  sub-account ("Fournisseurs divers") falls back to `EcritureLib`.
- **Dated by the invoice** (`PieceDate`), falling back to `EcritureDate`.
- **Amounts excluding VAT**, as the ledger holds them. The page and the client
  report say so.
- **Both layouts** the standard allows: `|` or tab, `Debit`/`Credit` or
  `Montant`/`Sens`.

## Why it is worth having

The expense account settles what a bank label cannot. Each charge carries the
class of the account it was booked to:

| Class | Accounts (PCG defaults) | Effect |
|---|---|---|
| software | 651 licences, 6135 software rental, 6156 maintenance | Recurring = software, even for a vendor not in our name list |
| excluded | 6132 rent, 614, 616 insurance, 621–622 fees, 623 advertising, 624 transport, 625 travel/receptions, 627 bank charges, 63 tax, 64 payroll, 652–658, 66–69 | Never software, whatever the name |
| neutral | everything else in class 6 (60x purchases, 626 telecoms, 617, 618, 628…) | The vendor name decides, as for bank lines |

On the synthetic sample (`sampleFec()`), which contains the three lines that
fool the bank-statement audit:

| | Bank statement | FEC |
|---|---|---|
| Google Ads | read as Google Workspace | excluded (623) |
| Qonto plan fee ("ABONNEMENT") | read as software | excluded (627) |
| Monday café | read as monday.com | excluded (625) |
| Zeendoc (not in the name list) | missed unless the label says "abonnement" | found via 6512 |

Pinned in `src/lib/fec.test.js`. These are synthetic results; they show the
mechanism works, not how often it works.

## What real files must show before this leaves beta

1. **Where do bookkeepers actually put SaaS?** The classes above are the plan
   comptable's defaults. Small firms often book subscriptions to 6064
   (fournitures administratives), 606 or 618. Those are *neutral* here, so the
   name list still decides — no worse than a bank statement, but no better.
   Count, per firm, the share of software spend in software-class accounts.
2. **Are supplier sub-accounts used?** Some ledgers post every supplier to
   401000 with no `CompAuxLib`. Then the name comes from `EcritureLib`, which
   varies ("Facture n°123"). Measure how often the name is usable.
3. **Excluded accounts that do hold software.** A firm booking SaaS to 622 or
   6278 would lose it. Look for any known vendor in an excluded account.
4. **Credit notes.** They are dropped rather than matched to the invoice they
   refund; check how often that distorts a monthly figure.
5. **Size and encoding.** Real FECs run to tens of thousands of lines and
   ISO-8859-15. The reader is linear, and `decodeBankFile` handles
   windows-1252; confirm on a large real file.

**How to measure without collecting ledgers.** An FEC holds personal data
(payroll, employee sub-accounts), so do not ask firms to send one. Early-access
firms run the audit themselves, use the review buttons (Correct / Not software
/ Rename / It's software) and send the corrections email, which carries labels
and verdicts only. Precision is confirmed ÷ (confirmed + not software);
recall needs the "It's software" additions. Record results per firm, dated,
the way `docs/grants/innovup/evidence/` records the bank baseline.
