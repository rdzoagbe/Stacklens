# Do this next — the founder's checklist

Written 2026-09-20. This is the running order for the Innov'up application:
what to do, in what order, and what each step is waiting on. The other files
in this folder are the content; this one is the sequence.

**The one rule that sets the order:** the grant will not fund work that
started before you file, and it excludes "logiciels métiers". So the first
task is a 20-minute email that tells you whether the rest is worth writing,
and nothing in the six work packages may begin until the application is in.

---

## Step 1 — Send the eligibility email. **DONE, Monday 21 September 2026.**

Sent to the Région, and to Bpifrance if you used both channels. Everything
else is shaped by the answer, which is why this went first.

**Two things to finish closing it out:**

1. Save the sent message as a PDF into `evidence/`, named
   `2026-09-21-note-eligibilite-envoyee.pdf`. The Région asks for the
   pre-filing correspondence and the date you asked is part of the argument
   that the project had not started.
2. If you only sent it to **aides.economiques@iledefrance.fr**, send the same
   text through **contact.bpifrance.fr** as well, choosing "Je suis porteur
   de projet innovant". Two channels, because either may answer first and
   neither is obliged to.

**Chase date: Tuesday 6 October 2026.** That is one working day after ten
have passed. If there is no reply by Monday 5 October, resend the same text,
then telephone Bpifrance. Record both attempts in `evidence/`.

**While it is open, do not write the long form.** Steps 2 to 4 below do not
depend on the answer and are the right use of the wait.

<details>
<summary>What was sent, for the record</summary>

The text is in `01-note-eligibilite.md`, section **Version française**. It
asks whether a project about inferring a company's software estate from bank
and directory data falls under the advanced digital / AI and business
security priorities, rather than being excluded as a *logiciel métier*, and
puts the eight pre-filing questions from the guide's section 23.

</details>

---

## Step 2 — Book the interviews. **This is now the live task.**

Fifteen to twenty conversations cannot be compressed. They need calendar
time, so every day of the wait spent not booking them is a day lost. This
does not depend on the Région's answer.

Everything you need is in `09-interview-guide.md`: the four recruitment
messages in French, the channel plan with the posting rule for each place,
the opening script, the fourteen questions in order, the note sheet, and the
tally sheet that turns the notes into the numbers the application quotes.

**Where to send them, in order.** LinkedIn first, because that is where
French experts-comptables are. Then Compta Online, the French accounting
profession's own forum. Then the regional Ordre and the Seine-Saint-Denis
networks, which double as Île-de-France impact evidence. Reddit last and
narrow: r/smallbusiness and r/accounting both forbid exactly what you would
want to post, and only r/sysadmin and r/msp are open to it, with disclosure.
Reddit is also anglophone, so it cannot serve the regional-impact case. The
channel table in `09` gives the rule for each place.

Who to approach, easiest first:

| Source | How |
|---|---|
| People who already ran the free audit | They came to you and they have the problem. Analytics shows how many there are |
| Existing Stacklens sign-ups | Export from the Firebase console. Interview these separately from prospects and add the six extra questions at the end of the guide |
| Accountants and bookkeepers | Aim for at least three. They are the channel and each one sees twenty companies |
| The people who did not reply to your earlier outreach | Message them once more. "Twenty minutes of research, not a sales call" gets a different answer from a sales approach |
| Bondy and Seine-Saint-Denis business networks | Local, and the Région cares that the activity is in Île-de-France |

Target the split in the guide: five to seven founders, five to seven
IT or security people, four to six finance or operations.

**Do not demo the product** until after question fourteen. The moment you
show it, the answers stop being about what they do today.

**The one number to get from every single interview** is question eight,
hours per month spent on software administration. That is the before figure
of the whole impact case. Without it there is no after.

---

## Step 3 — Two checks you can do in an hour, any time this week.

Neither depends on the Région's answer, and both are needed whatever happens.

**Confirm where the database actually is.** Firebase console, Firestore,
database settings, read the location. The public sub-processor page says
Belgium. If it says anything else, tell me and I will correct the page and
the security document. The application makes a claim about EU data storage
and it has to be the true one.

**Get a fresh SIRENE extract.** Search for "avis de situation SIRENE" and
use the INSEE service, or `annuaire-entreprises.data.gouv.fr`. Download the
PDF into `evidence/`. Then check it line by line against the company block
at the top of `10-application-fields.md`. Do not reuse the notice from
registration if anything has changed since May.

---

## Step 4 — Fill in the competitor matrix. Two to three hours.

Open `07-competitor-matrix.md`. It lists candidates and has the Stacklens
column already filled from the code. You fill three competitor columns.

For each one: open their product page, their pricing page and their security
page. For every cell write what they actually state, the page address, and
the date you looked. Screenshot each page into `evidence/`.

**The trap to avoid:** never write that a competitor cannot do something
unless you have verified it. An assessor who knows the market will catch one
wrong claim and then distrust the whole document. "Not stated on their site,
checked 20 September" is a perfectly good entry.

---

## Step 5 — When the answer arrives, decide.

| Their answer | What you do |
|---|---|
| Yes, it can be examined under advanced digital or security | Continue to step 6. Quote their reply in the eligibility paragraph of the form |
| Yes, but only if… | Reshape the work packages in `03` to their conditions before writing anything long. Tell me the conditions and I will redraft |
| No, this is a logiciel métier | Stop the Innov'up route. The dossier transfers: ask them which scheme fits, and look at Bpifrance Bourse French Tech, the Aide pour la faisabilité de l'innovation, and the Crédit d'Impôt Innovation. Almost none of the work is lost |

---

## Step 6 — The money. Only after a yes.

Open `06-budget-scenarios.md`. Three scenarios are drafted at thirty, fifty
and seventy-five thousand euros, all subvention only, with every line already
mapped to a work package. Two things are missing and only you can supply
them.

**Supplier quotes.** Four kinds: data or machine-learning engineering by the
day, a security test, a privacy review, and design or user-research support.
Get two quotes for the engineering line. Each quote must name the work
package it belongs to.

**Your own hours and what they cost.** Question four of the eligibility
email asks the Région which calculation method they accept for a sole
trader. Use their answer. Then start a timesheet from the first day of the
project, one row per month per work package. They will ask for it later.

**Then pick the smallest scenario that fully funds the work.** Do not inflate
the project to chase a bigger grant. Write down how you will fund the
company's share before you choose, because that is the real constraint.

---

## Step 7 — The forecast. Only after a yes.

A twelve to eighteen month forecast and a three-year one. Label every figure
as actual, assumption or target, and keep them consistent with each other
and with the budget. Pull the actuals from Stripe and the Firebase user
count. The indicator table at the bottom of `05-kpis-and-measurement.md`
is the shape to fill.

No market-size claims. If you use a market statistic, keep its source and
date beside it.

---

## Step 8 — Fill the form and file.

`10-application-fields.md` has every section of the form with the answer
already prepared or marked as yours to supply. Work down it, then run the
submission gate at the bottom of `README.md`. Do not file until every row
reads yes.

File at **mesdemarches.iledefrance.fr**, before any work package starts.

---

## While all this is happening

**The inference engine stays frozen.** The vendor list, the cadence rules and
the findings thresholds in `src/lib/saasAudit.js` are the measured starting
point of the project. Improving them now is starting the funded work early,
which cannot be claimed. Everything else in the product carries on as normal:
marketing, bug fixes, the accountant pages, sign-in, billing.

**The measured figures look low, and that is the point.** Seventy-one percent
precision reads like a weakness in a sales deck. In a research grant it is
the evidence that a real unsolved problem exists and that you have
characterised it honestly. Do not be tempted to present a better number.

**Say what is true about data location.** The application should state that
data is stored in the EU, that server processing currently runs in a US
region, and that moving it is part of the funded work. Do not use the
"GDPR-native" badge from the website as a compliance claim.
