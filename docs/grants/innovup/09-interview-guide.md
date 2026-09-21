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

## Where to post, and the rule in each place

Checked 21 September 2026. **Reddit is largely closed to this and the part
that is open is not where your buyers are.** That is worth knowing before
spending a week on it.

| Channel | Fit | The rule you have to respect |
|---|---|---|
| **LinkedIn** | **Best.** Where French *experts-comptables* actually are | Connection note capped near 300 characters, so use the short form below. No link |
| **Compta Online** (compta-online.com) | **Best French forum.** A digital community for the accounting professions: experts-comptables, accountants, auditors, DCG/DSCG/DEC students, with discussion boards per subject | Peer forum. Post a question, answer others' questions, never advertise |
| **CROEC Paris Île-de-France** (the regional Ordre) and its events | Strong, and doubles as grant evidence: the Région wants Île-de-France activity | Professional body. Turn up, do not pitch |
| **Local: CCI Seine-Saint-Denis, BGE, Réseau Entreprendre, Bondy networks** | Good, and the best regional-impact evidence you can get | In person. Bring the question, not the product |
| **Reddit, r/sysadmin and r/msp** | Narrow. Real practitioners for the IT and security half of your split, but anglophone | Disclose that you build in the space, in the post. r/msp actively hunts undisclosed vendors and keeps lists of suspected accounts |
| **Reddit, r/smallbusiness** | **Closed.** Market-research posts are removed outright, including pain-point hunting. Only pre-approved academic surveys are allowed | Do not post. Mods have said this explicitly |
| **Reddit, r/accounting** | **Closed.** Rules bar self-promotion and solicitation | Do not post |
| **Reddit, French subs** | **Weak.** No experts-comptables subreddit exists. r/france is general news, r/vosfinances is personal finance at roughly 33,000 members, r/entrepreneurFR is small. None is where a cabinet partner spends a working day | Not worth the effort for this |

A 2026 survey of 49 subreddits that founders commonly pitch in found that
61% ban self-promotion. Reddit's own convention is the 90/10 rule, nine parts
participation to at most one part your own thing, and individual moderators
are free to be stricter. Most are.

**Two practical blockers on Reddit, before the rules even apply.** A new
account with no history gets caught by the spam filter in most large
subreddits, so a first post from a fresh account usually never appears. And
several subs have minimum account-age or karma gates. If you have no Reddit
history, answer other people's questions for a week or two first, or accept
that the post will not survive.

### The grant caveat, which matters more than the channel choice

Reddit interviews are anglophone and global. They are perfectly good evidence
for the **technical** uncertainties, questions 10 to 12 on trust, rejection
and what must never be automated, which is what WP3 and WP4 turn on. They are
**not** evidence for the regional economic impact the Région asks for in
section 10. So Reddit can never substitute for the French channel. Do the
French channel first and treat Reddit as an addition.

### LinkedIn — the public post

A post reaches people you are not connected to, so it does the recruiting the
direct messages cannot. Post this once, then work the comments. Do not post it
again next week: a repeated ask reads as a campaign.

Copy from the block below. Nothing in it needs editing except the signature.

```
Quand une PME paie un logiciel dont plus personne ne se sert, qui s'en aperçoit ?

Et au bout de combien de temps ?

Je pose la question sérieusement, parce que je n'ai pas la réponse.

Je mène une étude sur la gestion des abonnements logiciels et des accès dans les petites structures : qui détient la liste, comment on repère un prélèvement devenu inutile, ce qui se passe quand un salarié part et que ses accès restent ouverts.

Je cherche 15 à 20 personnes pour un échange de 20 minutes :

— dirigeants de PME de 5 à 50 salariés
— responsables informatique ou sécurité, en interne ou prestataires
— experts-comptables, RAF, responsables administratifs

Ce que je veux comprendre, c'est ce que vous faites aujourd'hui. Pas ce qu'il faudrait faire.

Transparence : je développe un logiciel dans ce domaine. Je le précise pour que ce soit clair, mais ce n'est pas l'objet. Je ne vous présenterai rien et je ne vous vendrai rien — si je le faisais, l'étude ne vaudrait rien.

Je partagerai la synthèse anonymisée avec les participants.

Un commentaire ou un message privé suffit.

Roland — Bondy (93)
```

**Why it is built this way.**

| Choice | Reason |
|---|---|
| The question is the first line | LinkedIn truncates at roughly three lines. The question has to land before "voir plus" or nobody opens it |
| "parce que je n'ai pas la réponse" | A founder asking a question he already has an answer to is recognisably doing marketing. This one is true, and the baseline in `02` is the proof |
| The disclosure paragraph | Anyone curious clicks your profile and sees Stacklens within two seconds. Saying it first costs nothing and buys the rest of the post. Concealing it and being found out costs the channel |
| No link anywhere | LinkedIn suppresses reach on posts carrying an external link, and a link turns a research request back into an advert. Your profile is the link |
| Three named profiles | People self-select. It also quietly signals that you know the problem has three different shapes |
| "Pas ce qu'il faudrait faire" | Pre-empts the advice you do not want. You are after current practice, not opinions on best practice |
| No statistic | You do not yet have a defensible number about other companies. Inventing one would be the fastest way to lose an accountant who deals in real figures |

**Working the post, which matters more than the post.**

| When | Do |
|---|---|
| Tuesday to Thursday, 08:00–10:00 Paris | Post. Not Monday, not Friday, not the evening |
| First hour | Reply to every comment. Early engagement decides how far it travels. Do not edit the post in that hour |
| Every comment saying "intéressé" | Reply publicly with thanks **and** send the private message. A public reply is not a booking |
| Anyone who answers the question instead of volunteering | Answer them properly and note what they said against the tally sheet below. That is data, whether or not they ever take a call |
| Nobody engages after a day | Do not repost. Go back to the direct messages, which are the reliable channel. The post was the cheap shot |

**Reply to a comment, to turn it into a booking:**

> Merci [Prénom]. Je vous envoie un message pour trouver 20 minutes.

Then send message A from the section above, or the short connection note below
if you are not yet connected.

### LinkedIn — the connection note (under 300 characters)

> Bonjour [Prénom], je mène une étude sur la façon dont les cabinets suivent
> les abonnements logiciels de leurs clients. Ce n'est pas une démarche
> commerciale. Auriez-vous 20 minutes ? Roland, Bondy.

Once they accept, send message A from the section above.

### Compta Online — post a question, do not advertise

The forum rewards a real professional question. Ask it, then answer two or
three other people's questions in the same week so you are a participant
rather than a visitor.

> **Titre : Comment suivez-vous les abonnements logiciels de vos clients ?**
>
> Bonjour,
>
> Je m'interroge sur une tâche qui revient souvent chez mes contacts en
> cabinet : le suivi des abonnements logiciels des clients. Repérer un
> prélèvement récurrent devenu inutile, savoir qui détient la liste, gérer
> les accès quand un salarié part.
>
> Comment procédez-vous concrètement ? Un tableur ? Rien de formalisé ?
> Est-ce même votre rôle, ou celui du client ?
>
> Je mène une étude sur le sujet et je serais heureux d'échanger 20 minutes
> avec ceux que ça intéresse. Je partagerai la synthèse.
>
> Merci d'avance.

### Reddit — r/sysadmin or r/msp, a genuine question with disclosure

The offboarding question is on-topic there and gets real answers. The
disclosure line is not optional and it helps: these communities punish
concealment and reward transparency.

> **Title: How do you actually verify a leaver has lost every SaaS they had access to?**
>
> Not the identity-provider apps, those are easy. The ones bought on a card
> by a department, never in SSO, that nobody wrote down.
>
> What I'm trying to understand is the real process, not the ideal one. Is it
> a spreadsheet? A card statement? Do you find out months later when an
> invoice arrives? Do you accept that some access just stays live?
>
> Full disclosure: I build software in this space, I'm not linking it and
> I'm not selling anything here. I'm trying to find out how much of this is
> actually detectable versus how much depends on somebody remembering.
>
> Happy to talk for 20 minutes if anyone would rather do that than type.

Answer every reply. A thread where the poster argues with the answers is
worth more than ten unanswered ones, and the comments themselves are
research: note them against the tally sheet below.

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
