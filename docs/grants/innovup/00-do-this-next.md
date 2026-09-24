# Do this next — the founder's checklist

Written 2026-09-20. This is the running order for the Innov'up application:
what to do, in what order, and what each step is waiting on. The other files
in this folder are the content; this one is the sequence.

**Status, 24 September 2026: Innov'up is closed to an entreprise
individuelle.** The Région answered in three days and the answer is below.
The rule that set this order paid for itself: ask the eligibility question
before writing anything long. What remains open, and what transfers, is in
the first section. The interviews carry on unchanged.

---

## Innov'up is closed. Answered 24 September 2026.

The Région replied to the note sent on 21 September:

> "Nous vous informons que les entreprises individuelles ne sont pas éligibles
> au dispositif Innov'up."
> — Service Information-Orientation, Pôle Développement Economique Formation
> et Innovation, Région Île-de-France

**Three days, and the answer cost one email.** That is the eligibility-first
order doing exactly its job: had the long form been written first, four weeks
of work would have been rejected on a point of legal form.

### Read what it does and does not say

It rules out the **legal form**, not the project. It says nothing about
*logiciel métier*, which was the risk the note was written to test. The
framing in `02` and `03` is therefore untested, not rejected, and it survives
intact for any other scheme or for an investor.

### One thing worth a single reply

Public summaries of Innov'up describe the beneficiaries as TPE, PME and ETI
*"quelle que soit leur forme juridique"*. That does not sit easily beside the
answer received. The official page could not be read directly from here to
confirm the current wording, so this is a discrepancy to raise, not a claim
that the Région is wrong.

It costs one polite email and could reopen the whole route:

> Madame, Monsieur,
>
> Je vous remercie pour votre réponse rapide.
>
> Je souhaitais simplement lever une ambiguïté : la présentation publique du
> dispositif indique qu'il s'adresse aux TPE, PME et ETI « quelle que soit
> leur forme juridique ». Dois-je comprendre que l'exclusion des entreprises
> individuelles résulte d'une condition distincte, par exemple l'obligation de
> déposer des comptes sociaux ou d'être soumis à l'impôt sur les sociétés ?
>
> Cette précision m'aiderait à savoir si une transformation en SASU ou EURL
> rendrait le projet éligible, et sous quel délai.
>
> Je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.

Ask it, then act on the answer rather than on the assumption.

### What is actually open

| Route | Legal form | Worth it? |
|---|---|---|
| **Crédit d'Impôt Innovation (CII)** | Open to an entreprise individuelle meeting the EU definition of a PME, provided it is taxed **au réel** and not under the micro regime | **Best fit.** A tax credit, not a competition: no jury, no deadline, claimed on the return. 20% of eligible expenditure in metropolitan France since the 2025 finance law, running to 31 December 2027. Covers prototype and pilot design for a product not yet on the market that is distinguished by significantly superior performance, which is what `02` and `03` already describe. **Check the tax regime with an accountant first: under micro-BIC this does not apply.** |
| **Bourse French Tech (Bpifrance)** | No mandatory legal form. Entreprise individuelle accepted, and an applicant may even apply as a natural person before creating a structure | **Apply.** Squarely aimed at an early innovative project |
| **Incorporating as SASU or EURL, then Innov'up** | Solves it by construction | Only if the reply above says the exclusion really is the legal form. This is a tax, social-contribution and accounting decision, not a grant decision, and it should be taken with an accountant on its own merits |
| **Local: CCI Seine-Saint-Denis, BGE, Initiative France, Réseau Entreprendre** | Generally open | Worth a morning. Prêts d'honneur and accompaniment, and the same Île-de-France anchoring |

### The dossier is not wasted

Only the Innov'up framing is dead. Everything under it transfers without
rework: the measured technical baseline (`02`), the six work packages (`03`),
the security and privacy package (`04`), the KPIs and their measurement
methods (`05`), the budget structure (`06`), the competitor matrix (`07`) and
the risk register (`08`). A CII claim needs the technical description and the
expenditure mapping, which is `02`, `03` and `06`. An investor asks for the
same material in a different order.

**The interviews continue regardless.** They were never only for the grant:
they are how you learn whether the product is right, and questions 10 to 12
are what work packages three and four turn on.

### The engine freeze is lifted

`src/lib/saasAudit.js` was frozen because Innov'up would not fund work begun
before filing. There is no filing, so there is no freeze. The inference engine
can be improved whenever it is worth improving.

Two things stay true anyway, and are worth keeping for their own sake. Re-run
`node tools/record-baseline.mjs` whenever the engine changes, so the measured
numbers never drift from the code. And **keep every dated results file**
rather than overwriting it: a CII claim is strengthened by exactly the same
before-and-after evidence, and so is any investor conversation.

---

## The live task — book the interviews

Unchanged by the Innov'up answer, because these were never only for the
grant. They are how you find out whether the product is right, and questions
10 to 12 are what work packages three and four turn on. Fifteen to twenty
conversations cannot be compressed; they need calendar time.

Everything you need is in `09-interview-guide.md`: the four recruitment
messages in French, the channel plan with the posting rule for each place,
the opening script, the fourteen questions in order, the note sheet, and the
tally sheet that turns the notes into the numbers the application quotes.

**Tomorrow morning: the LinkedIn post.** Tuesday to Thursday, 08:00 to
10:00 Paris time. The ready text is in `09-interview-guide.md` under
"LinkedIn — the public post", with the reasoning for each choice and the
rules for working the comments, which matter more than the post itself.
Reply to every comment in the first hour, and turn each "intéressé" into a
private message the same day: a public reply is not a booking.

**Then the direct messages, in this order.** LinkedIn first, because that is
where French experts-comptables are. Then Compta Online, the French accounting
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

## Still worth doing — two checks, one hour

Neither depended on the Région's answer and both are still needed: the
database location is a claim the public site makes, and a current SIRENE
extract is wanted by the CII, by Bpifrance and by any accountant you talk to
about incorporating.

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

## Still worth doing — the competitor matrix, two to three hours

Open `07-competitor-matrix.md`. It lists candidates and has the Stacklens
column already filled from the code. You fill three competitor columns. This
is state-of-the-art evidence for a CII claim, material for an investor, and
the fastest way to find out what you are actually competing with.

For each one: open their product page, their pricing page and their security
page. For every cell write what they actually state, the page address, and
the date you looked. Screenshot each page into `evidence/`.

**The trap to avoid:** never write that a competitor cannot do something
unless you have verified it. An assessor who knows the market will catch one
wrong claim and then distrust the whole document. "Not stated on their site,
checked 20 September" is a perfectly good entry.

---

## The Innov'up-specific steps are retired

What used to stand here was the decision tree for the Région's answer, the
budget scenarios, the forecasts and the form. The answer came and it was no,
so those steps have no subject any more.

Nothing is deleted. The content they pointed at is still in `06` for the
budget structure and `10` for the company block and the attachments list, and
both are reusable:

- **For a CII claim:** the technical description in `02` and `03`, and the
  expenditure mapping in `06` recast as eligible innovation expenditure. Take
  it to an accountant, since the binding question is your tax regime.
- **For Bourse French Tech:** `02`, `03` and `10` cover most of what is asked.
- **For an investor:** the same material, reordered around the market rather
  than the technical uncertainty.

Do not rewrite them for a scheme you have not yet been told you qualify for.
Get the answer to the clarification email first, and the accountant's answer
on the tax regime, then write once.

---

## While all this is happening

**The engine is no longer frozen**, and the first thing that came off the
back of it was a real bug: the parser assumed day-first dates, so a US or any
month-first export lost every row past the 12th and transposed the rest,
silently. It now reads the convention off the file and says which one it used.
Keep re-recording the baseline when the engine changes, and keep each dated
results file: before-and-after evidence is worth as much to a CII claim as it
was to the grant.

**The measured figures look low, and that is still the point.** Seventy-one
percent precision reads like a weakness in a sales deck. In a CII file, in
front of an investor, or in a LinkedIn post, it is evidence that a real
unsolved problem exists and that you characterised it honestly. Do not
present a better number than you can defend.

**Say what is true about data location.** Data is stored in the EU, server
processing currently runs in a US region, and moving it is still on the list.
Say exactly that, wherever it is asked. Do not use the "GDPR-native" badge
from the website as a compliance claim.
