# Preuves clients : témoignages, études de cas, avis en ligne

Aujourd'hui le site n'affiche aucun témoignage, et c'est voulu : il n'y en a
pas encore de vrai. La section apparaît d'elle-même sur la page d'accueil et
sur `/experts-comptables` dès qu'une citation validée est ajoutée à
`src/lib/testimonials.js`. Ce document explique comment l'obtenir proprement.

## Les règles, sans exception

1. **Uniquement de vrais clients, avec leurs vrais mots.** Jamais de citation
   inventée, reformulée « en mieux » ou écrite par vous. Présenter un faux
   témoignage est une pratique commerciale trompeuse, et un cabinet qui trouve
   son nom sur votre site sans l'avoir accepté, c'est un client perdu.
2. **Un accord écrit sur le texte exact.** La personne voit la citation telle
   qu'elle sera publiée, avec son nom, sa fonction, son cabinet, et dit oui par
   écrit. Un nom et une citation sont des données personnelles : l'accord doit
   être précis, et on peut le retirer à tout moment.
3. **L'accès anticipé est affiché.** Un cabinet qui a le plan Pro offert le
   dit à côté de sa citation (« Cabinet en accès anticipé, plan Pro offert »).
   Le site le fait automatiquement.
4. **Jamais en échange de quoi que ce soit.** L'accès anticipé demande des
   échanges et des retours francs, pas un témoignage. Le dire explicitement
   quand vous le demandez, et ne rien changer à l'accès d'un cabinet qui
   refuse.
5. **Retrait le jour même.** Si quelqu'un demande à retirer sa citation,
   supprimez l'entrée et redéployez le jour même.

## Quand demander

Au deuxième ou au troisième échange de l'accès anticipé, **quand le cabinet a
trouvé quelque chose de concret** sur un vrai dossier : un abonnement oublié,
un doublon, un renouvellement évité. Pas avant : sans résultat, une citation
ne dit rien.

## Les questions qui produisent une citation

Posez-les pendant l'échange, notez **mot pour mot** ce qui est dit, et ne
retouchez pas.

1. « Qu'avez-vous trouvé chez vos clients que vous n'auriez pas vu autrement ? »
2. « Avant, comment faisiez-vous ce tri, et combien de temps ça prenait ? »
3. « Qu'est-ce qui vous a surpris ? »
4. « À qui le recommanderiez-vous, et pour faire quoi ? »
5. « Qu'est-ce qui manque encore ? » (La réponse ne va pas sur le site ; elle
   va dans la feuille de route, et elle rend les autres réponses crédibles.)

Une bonne citation contient un fait (« trois abonnements oubliés sur cinq
dossiers ») plutôt qu'un adjectif (« super outil »).

## Le mail de validation (à envoyer tel quel)

> **Objet :** Votre citation pour le site Stacklens — à valider
>
> Bonjour [Prénom],
>
> Merci encore pour notre échange du [date]. Vous avez dit quelque chose que
> j'aimerais citer sur stacklens.fr, exactement comme ceci :
>
> « [citation mot pour mot] »
>
> Elle apparaîtrait ainsi :
> **[Prénom Nom]**, [fonction], [cabinet], [ville]
> Cabinet en accès anticipé (plan Pro offert)
>
> [Si pertinent : avec ce résultat : « [chiffre] » — et/ou votre logo.]
>
> Pouvez-vous me répondre avec l'une de ces options ?
> - **Oui**, tel quel.
> - **Oui, mais sans mon nom** (seulement la fonction, le cabinet et la ville).
> - **Oui, avec cette modification :** …
> - **Non**, et c'est très bien ainsi.
>
> Votre réponse ne change rien à votre accès anticipé. Vous pourrez retirer
> cette citation à tout moment en répondant à ce mail ; elle sera enlevée le
> jour même.
>
> Merci,
> Roland

Gardez la réponse : c'est la preuve de l'accord. Archivez-la dans votre
messagerie (dossier « Accords témoignages »), pas dans le dépôt de code.

## Mettre une citation en ligne

Ouvrez `src/lib/testimonials.js` et ajoutez une entrée sur le modèle en
tête du fichier. Ou envoyez-moi la citation validée et la date du mail
d'accord, et je l'ajoute.

- `consent.scope` liste exactement ce qui a été accepté : `name`, `role`,
  `firm`, `quote`, et `logo` ou `result` seulement si c'était dans le mail.
- `consent.approvedVerbatim: true` seulement si la personne a vu le texte
  exact publié.
- `consent.proof` dit où est l'accord (« email du 12/10/2026, archivé »).
- `context: 'early_access'` tant que le cabinet a le plan offert.
- Un logo va dans `public/proof/` (format carré, SVG ou PNG).

Un test bloque la mise en ligne de toute entrée à qui il manque l'un de ces
éléments : impossible de publier une citation sans son accord, même par
erreur.

## L'étude de cas (quand un cabinet a un vrai résultat)

Une page, validée par le cabinet comme la citation :

1. **Le cabinet** : taille, nombre de dossiers, comment il faisait avant.
2. **Ce qui a été trouvé** : les chiffres, sur combien de dossiers, en
   combien de temps. Uniquement des chiffres mesurés et validés.
3. **Ce qui a été fait** : abonnements résiliés, accès retirés, rapport envoyé
   au client.
4. **La citation.**

C'est le meilleur argument commercial que vous aurez : un pair qui dit ce
qu'il a trouvé, chiffres à l'appui.

## Les avis en ligne

Les acheteurs de logiciels consultent ces annuaires avant d'essayer. Créer
une fiche éditeur y est gratuit (vérifiez les conditions actuelles de chaque
plateforme au moment de vous inscrire).

| Plateforme | Pourquoi | À faire |
|---|---|---|
| **Appvizer** | Comparateur de logiciels B2B français : celui que consultent vos prospects | Créer la fiche éditeur en français, catégorie gestion des dépenses / logiciels pour experts-comptables |
| **Capterra** (même réseau que GetApp et Software Advice) | Très visible sur Google, avis vérifiés | Créer la fiche via l'espace éditeur ; une fiche alimente les trois sites |
| **G2** | La référence pour les acheteurs informatiques | Créer le profil éditeur gratuit |

**Les règles des plateformes, qui sont aussi les bonnes pratiques :** jamais
d'avis écrit par vous, par un proche ou par un compte créé pour l'occasion ;
ne demandez pas « un avis positif » mais un avis honnête ; demandez-le à tous
vos utilisateurs actifs, pas seulement aux contents ; n'offrez vous-même
aucune contrepartie. Si une plateforme propose ses propres récompenses aux
auteurs d'avis, c'est son programme, et elle l'affiche.

### Le mail de demande d'avis (après 30 jours d'utilisation)

> **Objet :** Votre avis sur Stacklens (2 minutes)
>
> Bonjour [Prénom],
>
> Vous utilisez Stacklens depuis un mois. Si vous avez deux minutes, votre
> avis sur [Appvizer / Capterra] aiderait d'autres cabinets à savoir à quoi
> s'attendre : [lien de la fiche].
>
> Un avis honnête, positif ou non : ce qui fonctionne, et ce qui manque.
>
> Merci,
> Roland

## Le tableau de suivi

Un tableau simple, hors du dépôt de code (il contient des données
personnelles) :

| Cabinet | Contact | Échange (date) | Résultat trouvé | Citation demandée | Validée (date du mail) | En ligne | Avis demandé | Avis publié |
|---|---|---|---|---|---|---|---|---|
