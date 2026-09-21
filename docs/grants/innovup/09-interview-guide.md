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

## The messages that book the interview

Copy-paste text. French, because the people you are writing to are French
professionals. The earlier outreach to SMB operations people returned nothing,
and the most likely reason is that it offered a product from an unknown
sender. These offer nothing and ask for twenty minutes, which is a different
transaction and converts differently.

Four rules they all follow, and it matters that they do:

- **Say it is not a sales call, in the first three lines.** It is the only
  sentence that changes how the rest is read.
- **No link to stacklens.fr, no product name in the body.** One link turns a
  research request back into a sales email. The signature is enough.
- **Ask for twenty minutes, not "a chat".** A bounded ask is easy to accept.
- **Short.** If it does not fit on a phone screen it will not be read.

### A. Accountants, bookkeepers, fractional CFOs (cold)

Your priority group. Each one sees twenty to fifty companies, so three of
them are worth ten single-company interviews for the state-of-the-art
picture.

> **Objet : 20 minutes pour une étude sur les abonnements logiciels de vos clients**
>
> Bonjour [Prénom],
>
> Je mène une étude sur la façon dont les cabinets suivent les abonnements
> logiciels de leurs clients : qui détient la liste, comment on repère un
> abonnement devenu inutile, ce qui se passe quand un salarié part.
>
> Ce n'est pas un appel commercial et je ne vous présenterai aucun produit.
> Je cherche à comprendre ce que vous faites aujourd'hui, ce qui vous prend
> du temps et ce qui casse.
>
> Vingt minutes, en visio, au créneau qui vous arrange. Je partagerai la
> synthèse anonymisée de l'étude avec les participants.
>
> Auriez-vous un créneau cette semaine ou la suivante ?
>
> Bien cordialement,
> Roland Dzoagbe — Bondy (93)

### B. People who already ran the free audit

The warmest list you have. They arrived with the problem and spent effort on
it, which is more qualification than any cold list gives you.

> **Objet : Votre audit d'abonnements — quelques questions ?**
>
> Bonjour,
>
> Vous avez utilisé l'audit gratuit d'abonnements logiciels. Merci d'avoir
> pris le temps.
>
> Je mène une étude sur ce sujet et j'aimerais vous poser quelques questions :
> ce que vous cherchiez, ce que vous avez trouvé, et surtout comment vous
> procédez d'habitude sans outil.
>
> Vingt minutes, aucune démonstration, aucune vente. Vos réponses orientent
> directement la suite.
>
> Un créneau cette semaine ?
>
> Bien cordialement,
> Roland Dzoagbe

### C. Existing Stacklens users

Interview these separately from prospects, and add the six extra questions at
the end of this guide.

> **Objet : 20 minutes pour me dire ce qui ne va pas**
>
> Bonjour [Prénom],
>
> Vous utilisez Stacklens, et j'aimerais vous entendre sur ce qui vous a été
> utile, ce qui vous a fait perdre du temps et ce qui manque.
>
> Vingt minutes, et je préfère les critiques : ce sont les seules qui font
> avancer le produit. Rien à préparer.
>
> Un créneau cette semaine ou la suivante ?
>
> Bien cordialement,
> Roland Dzoagbe

### D. The people who never replied to the earlier outreach

Do not resend the old message. Change the ask, name the fact that they
ignored you, and give them an easy exit. This one also asks for a referral,
which is often the real return on the list.

> **Objet : Je change d'approche (et ce n'est pas une vente)**
>
> Bonjour [Prénom],
>
> Je vous avais écrit il y a quelques semaines au sujet de la gestion des
> logiciels et des accès. Vous n'avez pas répondu, et c'est assez logique :
> je vous proposais un produit.
>
> Je change d'approche. Je mène une étude et je cherche seulement à
> comprendre comment vous procédez aujourd'hui. Vingt minutes, et je ne vous
> montrerai aucun écran.
>
> Si le sujet ne vous concerne pas, dites-le-moi et je n'insisterai plus. Si
> quelqu'un d'autre chez vous s'en occupe, son nom me suffit.
>
> Bien cordialement,
> Roland Dzoagbe

### The follow-up, four working days later, once only

One line, on the same thread. Never a second paragraph, never a third message.

> Bonjour [Prénom], je remonte ce message au cas où il serait passé
> inaperçu. Si ce n'est pas le bon moment, aucun souci — un simple "non"
> me suffit pour ne plus vous relancer.

### When someone says no

Ask once, then stop:

> Merci de m'avoir répondu. Si vous connaissez une personne pour qui ce sujet
> compte, son nom me serait très utile.

A referral from a no is worth more than a yes from a cold list, because the
introduction does the credibility work you cannot do yourself.

### Practical notes

| Thing | Do this |
|---|---|
| When to send | Tuesday to Thursday, mid-morning. Not Monday morning, not Friday afternoon |
| How many at once | Ten to fifteen per batch. More than that and you cannot follow up properly |
| Booking | Put a scheduling link in your signature, not in the body. Or offer two specific slots, which converts better than "when suits you" |
| Recording | Ask permission on the call, in the opening script below. Without a yes, take notes only |
| Tracking | One row per person: name, segment, date sent, date followed up, outcome. Keep it outside the repository, since it holds personal data |
| Target | Fifteen to twenty completed. Expect to contact three to four times that number |

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
