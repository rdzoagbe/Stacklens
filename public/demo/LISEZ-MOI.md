# Kit de démonstration Stacklens — Atelier Lumen

Une entreprise fictive, racontée dans tous les fichiers que le site sait lire.
De quoi tester chaque fonction vous-même, et montrer à un prospect ce que
Stacklens trouve, sur un cas qui ressemble au sien.

**Atelier Lumen** est une agence de design de 17 personnes à Lyon : 14 en
poste, 2 parties cet été, 1 sur le départ. Tout est inventé ; les adresses
utilisent le domaine `atelier-lumen.example`, réservé à la documentation.

| Fichier | À quoi il sert |
|---|---|
| `atelier-lumen-application.csv` | **Tout pour l'application, en un seul fichier** : les logiciels, l'équipe, et qui a accès à quoi. |
| `releve-bancaire-atelier-lumen.csv` | 24 mois du compte pro (oct. 2024 → sept. 2026). Pour l'audit gratuit. |
| `fec-atelier-lumen-2026-09-30.txt` | Le fichier des écritures comptables de l'exercice clos le 30/09/2026. Pour l'audit gratuit, mode FEC. |

Tout se télécharge sur **stacklens.fr/demo/**.

Pourquoi pas un seul fichier pour tout le site : l'audit gratuit lit un relevé
bancaire (ou un FEC), l'application lit la liste des logiciels et des
personnes. Ce sont deux choses différentes, comme chez un vrai client.

---

## 1. L'audit gratuit avec le relevé bancaire (5 minutes)

Sur **stacklens.fr/audit-saas**, déposez `releve-bancaire-atelier-lumen.csv`.
Rien n'est envoyé : tout se passe dans le navigateur.

**Ce qui s'affiche :** 16 abonnements, environ 2 286 € par mois (TTC, tels
que prélevés). Les points à regarder de près :

- **Renouvellement imminent :** Adobe Creative Cloud, 3 239,88 € le 14 octobre, dans 16 jours.
- **Doublons :** deux lignes Notion (un second espace payé sur une autre carte depuis juin 2025) et deux lignes « Google Workspace » (l'une est en réalité Google Ads, voir plus bas).
- **Plusieurs prélèvements par mois :** Figma, deux licences achetées séparément.
- **Hausses de prix :** HubSpot +10 % en janvier, Notion +20 % en avril.
- **Petits abonnements anciens :** Zoom, Dropbox, Canva, Calendly, Miro… chacun sous 30 € par mois depuis deux ans.

**Le moment clé de la démo : la vérification.** Trois lignes trompent la
lecture d'un relevé, exactement comme dans la vraie vie :

- « PRLV SEPA GOOGLE ADS » est lue comme Google Workspace. C'est de la publicité → **Pas un logiciel**.
- « CB QONTO ABONNEMENT » est lue comme un logiciel. Ce sont des frais bancaires → **Pas un logiciel**.
- « CB MONDAY CAFE LYON 2 » est lue comme monday.com. C'est le café d'en face → **Pas un logiciel**.

Et une ligne manque : **Wimi**, un logiciel collaboratif français que l'outil
ne connaît pas. Ouvrez « autres prélèvements récurrents » et cliquez **C'est
un logiciel**. Les totaux se mettent à jour à chaque clic.

Ensuite :

- **Rapport client (PDF)** : saisissez un nom de cabinet et « Atelier Lumen », puis Imprimer → Enregistrer au format PDF. C'est le document que l'expert-comptable envoie à son client.
- **Envoyer mes corrections par email** : votre messagerie s'ouvre avec les libellés corrigés, sans montants. C'est ainsi que les retours nous arrivent.

À savoir : Loom a été résilié en juin ; son dernier prélèvement date du
9 mai 2026. L'audit le range à part, sous **Abonnements arrêtés**, avec la
date de ce dernier prélèvement, et ne le compte plus dans le total. C'est
aussi une question à poser au client : la résiliation est-elle bien
effective, ou le prélèvement est-il passé sur une autre carte ?

## 2. Le même client, avec son FEC (5 minutes)

Cliquez **Auditer un autre fichier** et déposez
`fec-atelier-lumen-2026-09-30.txt`. La page affiche « FEC · bêta ».

**Ce qui s'affiche :** 12 abonnements, environ 1 434 € HT par mois (Loom est là aussi
rangé parmi les abonnements arrêtés).

C'est le cœur de la démonstration pour un expert-comptable : **le compte de
charge tranche là où le libellé ne peut pas.**

- Les trois pièges ont disparu tout seuls : Google Ads est en 6231 (publicité), Qonto en 6278 (frais bancaires), le café en 6257 (réceptions).
- Wimi est trouvé sans que personne ne le connaisse : il est comptabilisé en 6512 (licences).
- « Realtimeboard » apparaît : c'est la raison sociale de Miro. Cliquez **Renommer** → Miro.
- Adobe, payé une fois par an, est bien là, avec son renouvellement du 14 octobre.

Une limite, visible volontairement : **Pennylane** est absent, car le cabinet
l'a comptabilisé en 6226 (honoraires), un compte que l'outil exclut. Dans
« autres prélèvements récurrents », cliquez **C'est un logiciel**. C'est
exactement le genre de retour que la phase bêta doit récolter.

Pourquoi les deux totaux diffèrent : le relevé est en TTC sur 24 mois et
compte les trois pièges ; le FEC est en HT sur 12 mois et les exclut.

## 3. Dans l'application (10 minutes)

Créez un compte : les nouveaux comptes ont 7 jours d'essai avec toutes les
fonctions. Puis, un seul fichier, une seule fois :

1. Allez sur **stacklens.fr/import**, onglet **Importer des données**.
2. Choisissez **Données entreprise**.
3. Cliquez **J'ai déjà un CSV — passer au téléversement**.
4. Déposez `atelier-lumen-application.csv`, puis **Importer**.

Utilisez un compte neuf : en mode démo, le fichier s'ajoute aux données
d'exemple déjà présentes et les chiffres ci-dessous ne correspondent plus.

**Ce qui s'affiche :** 14 outils, 17 personnes, 76 accès, et une dépense de
1 506 € HT par mois (Loom, résilié, n'est plus compté).

Les alertes du tableau de bord :

- **8 accès appartiennent à d'anciens salariés.** Julien Moreau (parti le 30 juin) a toujours Slack, Google Workspace, et les droits admin sur HubSpot et Zoom. Sarah Lefèvre (partie le 31 août) a toujours Slack, Notion, Figma et l'admin de Dropbox.
- **1 outil sans responsable :** Miro. Personne n'y a accès, il est pourtant payé : c'est une économie immédiate.
- **6 accès admin non revus depuis plus de 6 mois.**
- **4 outils inutilisés depuis plus de 90 jours :** Zoom, Dropbox, Miro et Loom.

À montrer ensuite : **Offboarding** (Maxime Blanc part le 15 octobre ; ses
accès sont à retirer), **Finance → Renouvellements** (Adobe le 14 octobre,
HubSpot le 30 novembre), **Carte des accès** et **Sécurité**.

Les dates d'usage sont figées à fin septembre 2026 : plus la démo est tardive,
plus d'outils apparaîtront inutilisés. Les chiffres ci-dessus sont vérifiés au
1er octobre 2026.

## 4. Une démo de 15 minutes avec un expert-comptable

1. **Le relevé (3 min).** Déposez-le, laissez-le lire les résultats. Montrez Adobe dans 16 jours.
2. **Les pièges (3 min).** Demandez-lui : « Google Ads, c'est un logiciel ? » Corrigez les trois devant lui.
3. **Le FEC (4 min).** Même client, et les pièges disparaissent seuls. C'est son métier qui fait la différence : le compte de charge.
4. **Le rapport (2 min).** Imprimez-le au nom de son cabinet.
5. **La question (3 min).** « Combien de vos clients ont ce genre de lignes ? » puis l'offre d'accès anticipé.

---

Ces fichiers sont générés par `tools/make-demo-kit.mjs` et vérifiés par
`src/lib/demo-kit.test.jsx` : si l'outil change, le test échoue avant que ce
guide ne devienne faux.
