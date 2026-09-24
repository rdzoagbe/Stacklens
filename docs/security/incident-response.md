# Incident response procedure

**Status:** draft for the founder to adopt. Internal: do not link from the
public site. Last reviewed 2026-09-24.

This is what to do when something may have gone wrong with customer data. It is
written for a one-person company, so every step names the exact lever in this
stack rather than a team or a tool we do not have.

The commitment it serves is in the DPA (`dpa_s6_item5`): we notify the
customer (the controller) of a personal data breach affecting their data
**without undue delay and in any case within 72 hours** of becoming aware of
it. The customer then decides whether to notify the CNIL, whose own 72-hour
clock starts when *they* learn of it. For data where Stacklens is the
controller (accounts, billing, consent records), we notify the CNIL ourselves
within 72 hours unless the breach is unlikely to result in a risk to people.

## 0. What counts

Treat it as an incident until shown otherwise if any of these happens:

- Someone reports seeing data that is not theirs, or that they should not see.
- A secret may have leaked: a Secret Manager value, a Firebase service
  account, a GitHub token, or a customer's stored vendor credential.
- Firestore rules, a Cloud Function, or Hosting headers were changed in a way
  that may have widened access, even briefly.
- Sentry, Stripe, Google Cloud or GitHub alerts on unusual access, a spike of
  errors on an auth path, or an unexpected deploy.
- A laptop or phone with an active founder session is lost.

## 1. Start the log (first 10 minutes)

Open a new file `incidents/YYYY-MM-DD-short-name.md` in a **private** place
(not this public repo). Write down, with times in UTC:

- when and how it was noticed, and by whom;
- what is known and what is guessed, kept separate;
- every action taken from here on.

The 72-hour clock runs from the moment of "becoming aware", so that first
timestamp matters. Save the evidence before changing anything where it is
cheap to do so: screenshots, the Sentry event link, the Cloud Logging query
and its results, the git SHA that is live.

## 2. Contain

Pick the levers that match what happened. They are ordered from least to most
disruptive.

| Situation | Lever |
|---|---|
| A code or rules change caused it | Revert the PR on GitHub and merge the revert; CI deploys main. For Hosting only, Firebase Console → Hosting → release history → **Roll back** is faster. |
| Firestore rules let the wrong person read | Revert via PR as above. If CI is unavailable and data is leaking right now: Firebase Console → Firestore → Rules, publish `allow read, write: if false;` for the affected path. The app degrades to the local copy. Undo through a PR as soon as possible, because the console change is not in git and the next deploy will overwrite it. |
| A Secret Manager secret leaked (`ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENDGRID_API_KEY`) | Revoke it at the vendor first (Anthropic console, Stripe dashboard → Developers, SendGrid → API keys), then add a new version in Secret Manager and redeploy functions. A redeploy is what binds the new version. |
| A user account is compromised | Firebase Console → Authentication → disable the user. Disabling stops new sign-ins; existing ID tokens stay valid for up to an hour, so for an urgent case also revoke refresh tokens (`admin.auth().revokeRefreshTokens(uid)`) from a one-off admin script. |
| Stored vendor credentials may be exposed (`/integration_credentials`) | Delete the affected documents. Tell each affected customer to **rotate the token at the vendor**, because deleting our copy does not invalidate it. |
| The founder's own Google or GitHub account | Change the password, sign out all sessions, review OAuth grants and GitHub personal access tokens, check the GCP IAM member list for anything you did not add. |
| Abuse of an unauthenticated endpoint (`api`, `clientErrors`, `invoiceInbound`, `stripeWebhook`) | Revoke the API key involved, or turn on App Check enforcement for the function, or roll the function back. |

Do not delete logs, rotate everything blindly, or wipe data to "clean up"
before the scope is known. That destroys the evidence needed in step 3.

## 3. Assess

Answer these in the log. They decide who must be told.

1. **Which data?** Collections, fields, and whether it includes personal data
   (employee names and work emails are personal data).
2. **Whose?** List the affected `uid`s and client `orgId`s. Cloud Logging for
   the functions and Firestore audit logs (if enabled) are the sources.
3. **What happened to it?** Read by someone unauthorised, changed, deleted,
   or made unavailable.
4. **From when to when?** The first moment exposure was possible to the moment
   containment took effect.
5. **Risk to people?** Names and work emails alone are lower risk than
   credentials or anything that enables access elsewhere. A leaked vendor
   token is high risk even if nobody is known to have used it.

## 4. Notify

| Who | When | How |
|---|---|---|
| Each affected customer (controller) | Without undue delay, at most 72 h after awareness, even if the picture is incomplete | Email to the account owner's address. Say what happened, what data, what period, what we have done, what they should do (for example rotate a vendor token), and when the next update comes. A template is below. |
| CNIL, for data where we are controller | Within 72 h unless unlikely to result in a risk | notifications.cnil.fr. A late notice must give the reasons for the delay. |
| Affected people directly | Only where the risk to them is high, and for customer data only on the customer's instruction | Via the customer. |
| Sub-processors involved | As soon as relevant | Their security contact, so they can investigate on their side. |

Notify on what is known. Partial information given on time is better than a
complete account given late, and the regulation allows it to be given in
phases.

### Customer notice template

> Subject: Security incident affecting your Stacklens data
>
> On [date, UTC] we became aware that [plain description]. It affected
> [which data] belonging to your workspace between [start] and [end].
> [We have / have not] seen evidence that it was accessed by anyone else.
>
> What we have done: [containment steps].
> What we ask you to do: [for example, rotate the Google Workspace token you
> connected, or nothing].
>
> As your processor we are telling you so you can decide whether to notify
> the CNIL; your own 72-hour period starts from this message. We will send
> the next update by [time]. Reply to this email with any question.

## 5. Recover and close

- Confirm the fix is on main and deployed, and that the console-only changes
  (rules lockdown, disabled users) are either reverted or captured in git.
- Add a test that would have caught it. This repo's habit is a guard test that
  fails when the code and the claim diverge; do the same here.
- Write a short post-incident note in the private log: timeline, cause, what
  worked, what to change. Keep it; it is part of the record we owe to the
  CNIL on request (Article 33(5) requires documenting every breach, notified
  or not).
- If the public security page or the DPA said anything the incident showed to
  be untrue, correct it in the same week.

## Contacts

| What | Where |
|---|---|
| CNIL breach notification | notifications.cnil.fr |
| Firebase / Google Cloud | Console for project `accessguard-v2`; support via the Cloud console |
| Stripe | Dashboard → Developers; security@stripe.com |
| Anthropic | console.anthropic.com → API keys |
| SendGrid | app.sendgrid.com → Settings → API keys |
| GitHub | github.com/settings/security |
