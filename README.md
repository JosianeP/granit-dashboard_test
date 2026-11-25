# Tableau de bord territorial - MRC du Granit (v4.19)

Outil interne de développement territorial à trois piliers (économie, aménagement, santé). Hébergé sur GitHub Pages.

## Fichiers à déployer ensemble

| Fichier | Rôle |
|---|---|
| `index.html` | L'application. Ne pas modifier sauf refonte |
| `data.json` | Toutes les données affichées. C'est le fichier que la mise à jour trimestrielle remplace |
| `chart.umd.min.js` | Bibliothèque de graphiques (Chart.js) |
| `granit-excel.js` | Spécification des champs du chiffrier Excel, lecture et application (partagé avec l'outil de génération) |
| `granit-import.js` | Interface d'importation (glisser-déposer, mot de passe, résumé des changements, publication) |
| `xlsx-populate.min.js` | Déchiffrement et lecture du chiffrier dans le navigateur |
| `exceljs.min.js` | Régénération du gabarit Excel depuis la plateforme |

| `granit-req.js` | Vue « Registre des entreprises » et chargement du registre pour les autres vues |
| `granit-carte.js` | Carte des municipalités, colorée selon l'indicateur choisi |
| `granit-mada.js` | Vue « Constats du milieu » (groupe Milieu de vie) et notes terrain de la vue Logements et garderies |
| `data/mada/constats.json` | Constats de la collecte MADA auprès des organismes, agrégés par axe. Tenu à la main |
| `granit-apprenant.js` | Pilier Santé : registre « De la donnée à la décision », instances, journal des lectures révisées, « Données et gouvernance », navigation regroupée |
| `data/sante/apprenant.json` | Enjeux suivis, décisions tracées, instances, journal et inventaire des jeux de données. Tenu à la main |
| `granit-croise.js` | Croisements entre les vues : le registre, les services de garde et le recensement s'affichent partout où il y a une fiche ou un bloc cliquable |
| `data/req/`, `data/garde/`, `data/logement/` | Extractions automatiques produites par GitHub Actions. Ne pas modifier à la main |
| `data/appariement.json` | Liens entre les fiches locales et le Registraire (par NEQ) |

Ces fichiers doivent se trouver dans le même dossier du dépôt.

## Nouveautés de la version 4.19 (pilier Santé : déterminants sociaux et inégalités sociales de santé)

Le cadre maison de huit déterminants avec scores est remplacé par les 17 déterminants sociaux de la santé reconnus en contexte canadien (liste de Raphael, 2020, telle que présentée par Shareck et Provost à la Table réseau 0-17 ans du RLS de Coaticook, 9 novembre 2026). Les notions de cette présentation structurent maintenant tout le pilier.

- Portrait des déterminants. Dix-sept fiches numérotées, sans score, sans radar et sans indice composite. Chaque fiche dit ce qui est documenté (chiffres, constats du milieu) et ce qui reste à documenter. Huit déterminants n'ont aucun chiffre local; c'est affiché, avec le rappel « petits effectifs, grande prudence ».
- Nouvelle vue « Inégalités sociales de santé » : définition, gradient, les deux mécanismes (distribution des ressources, appropriation de l'espace), les cinq dimensions de l'accès appliquées aux constats du milieu, les données de l'EQSJS 2022-2023 pour le Granit, Sherbrooke et Coaticook, et trois situations du Granit.
- Constats du milieu. Les 61 constats sont rattachés aux nouveaux déterminants; 38 portent en plus une dimension de l'accès (disponibilité, accessibilité spatiale, accessibilité économique, accommodement, acceptabilité), avec un filtre.
- De la donnée à la décision. Les quatre principes d'action figurent en tête; chaque enjeu comporte un regard d'équité (rempli pour le transport, à faire pour les autres). Une colonne Jeunes s'ajoute au tableau des instances.
- Leviers, liens entre piliers et enjeux du registre pointent vers les nouveaux déterminants.
- Limite du cadre. La liste ne comporte pas de déterminant propre à l'environnement physique; le milieu naturel et bâti est rattaché à la géographie.
- Chiffrier trimestriel. `granit-excel.js` n'est pas modifié. La feuille « MRC - Santé » garde ses colonnes Score et Niveau, désormais vides et sans effet; les identifiants des déterminants passent de `d1`-`d8` à `dss01`-`dss17`, de sorte qu'un ancien chiffrier ne peut pas écraser les nouvelles fiches.
- Les valeurs de l'EQSJS ont été transcrites à partir des graphiques de la présentation; elles sont à valider à la source.

## Nouveautés de la version 4.18 (pilier Santé : de la donnée à la décision)

Le pilier Santé décrivait des savoirs sans montrer ce qu'on en fait. Il suit maintenant une boucle en cinq temps (savoirs, délibération, décision, suivi des effets, ajustement), inspirée de la notion de territoire apprenant. La plateforme n'attribue ni score ni étiquette à ce titre : elle garde la trace de ce qui est su, décidé et suivi.

- Navigation du pilier regroupée en trois blocs : Savoirs (portrait des déterminants, constats du milieu), Action (instances et leviers, de la donnée à la décision), Repères (éloignement territorial, données et gouvernance).
- Nouvelle vue « De la donnée à la décision ». Un registre par enjeu (transport, accès aux soins, logement, démarche MADA, garde, information sur les services) montre pour chacune des cinq étapes ce qui est documenté, avec la date et la source. Une étape sans trace s'affiche « À documenter ». Les décisions inscrites viennent des procès-verbaux publics du conseil des maires (17 septembre 2025, 26 novembre 2025, 15 avril 2026) et du communiqué du 11 juillet 2025. Suit un journal des lectures révisées.
- « Gouvernance territoriale » et « Liens développement - santé » sont réunies dans « Instances et leviers ». S'y ajoutent un tableau des instances de la MRC par type de membres (document public des comités, novembre 2025) et un encadré sur les frontières ouvertes du territoire.
- Constats du milieu (Santé). Chaque déterminant se lit à trois voix : chiffres, organismes, citoyens. La troisième est vide et affichée comme telle.
- Nouvelle vue « Données et gouvernance » : fournisseur, mode d'arrivée, fréquence et conditions de réutilisation de chaque jeu de données.
- Corrections. Les scores de 0 à 100 portent la pastille Estimation et l'indice composite est décrit comme une moyenne simple, ce que le code calcule. « Vulnérabilité territoriale » devient « Éloignement territorial », l'indice ne reposant que sur la ruralité, la densité et la superficie. Mentions du CIUSSS remplacées, accents rétablis dans les leviers.
- Règles de `data/sante/apprenant.json` : une décision n'y entre que si une source publique la confirme; aucun nom de personne; aucune comparaison entre municipalités; le registre est une mémoire pour la MRC, pas une évaluation du conseil.
- `granit-excel.js` et `granit-import.js` ne sont pas modifiés. Dans `data.json`, seuls des textes du pilier Santé sont corrigés. La vue `sa-links` est retirée (son contenu passe dans `sa-governance`).

## Nouveautés de la version 4.17 (constats du milieu)

- Nouvelle vue « Constats du milieu » dans le groupe Milieu de vie. Elle présente ce que 10 organismes du territoire ont rapporté lors de la collecte MADA (octobre 2025 à janvier 2026), par axe : habitation, transport, participation sociale, inclusion, loisirs, communication, santé et services sociaux, sécurité, espaces extérieurs et bâtiments. Chaque constat indique combien d'organismes le nomment.
- Nouvelle pastille de provenance « Terrain », décrite dans la Légende. Un constat d'entrevue n'est ni une donnée Réel ni une Estimation : il dit ce que le milieu observe, pas ce qui a été mesuré.
- Vue Logements et garderies. Deux notes terrain s'ajoutent, l'une sous les cartes de capacité (accès au logement social et abordable), l'autre dans la carte des enfants en attente d'une place. Le chiffre d'environ 150 enfants en attente y figure comme propos d'entrevue; le champ « Enfants en attente » reste « À compléter » tant qu'il n'est pas confirmé par écrit.
- Pilier Santé. Nouvelle vue « Constats du milieu », placée après le portrait des déterminants : les mêmes constats y sont classés par déterminant de la santé, à côté du score du déterminant. Chaque fiche du portrait rappelle l'enjeu le plus souvent nommé et mène aux constats liés. Aucun score n'est modifié; le rattachement d'un constat à un déterminant (champ `det` de `constats.json`) est un choix d'analyse à valider avec la Direction de santé publique.
- Confidentialité. Le dépôt est public. `data/mada/constats.json` ne contient ni nom de personne, ni propos attribué à un organisme, ni lieu d'intervention; la fiche de collecte elle-même n'est pas versée au dépôt.
- Aucune répartition par municipalité : la collecte ne nomme que 10 des 19 municipalités, et jamais de façon systématique. Les cartes ne changent pas.
- `data/mada/constats.json` se modifie à la main. Le chiffrier trimestriel et les flux GitHub Actions n'y touchent pas. `data.json`, `granit-excel.js` et `granit-import.js` ne sont pas modifiés.

## Nouveautés de la version 4.16 (emploi revu à la source)

- `tools/emploi_granit.py` lit le Recensement de 2021 pour la division Le Granit (situation d'activité, population active par industrie du SCIAN, lieu de travail, navettage, catégorie de travailleur) et l'écrit dans `data/emploi/`. Le flux « Milieu de vie - Granit » l'exécute avec les autres extractions.
- Vue Emploi. Nouvelle carte « Emploi des résidents - Recensement de 2021 » : 9 860 personnes occupées, taux de chômage de 6,2 % (l'indicateur était « À compléter »), 84 % des résidents travaillent dans la MRC, répartition par industrie.
- Comparaison des estimations de la MRC avec le recensement, par famille de secteurs. Les estimations dépassent le recensement pour les ressources et la fabrication et sont nettement plus basses pour les services.
- Vue Tendances. Les séries d'emplois portent la pastille Estimation, et une note situe la série par rapport au recensement.
- Les 13 estimations par secteur et la série 2019-2024 ne sont pas modifiées : le recensement s'arrête aux grands secteurs et compte des résidents, pas des postes. La révision elle-même revient à la MRC.

## Nouveautés de la version 4.15 (cohérence des données)

- Emplois. Les estimations par secteur et le total estimé ne sont pas conciliés (leur somme dépasse le total). Plutôt que de modifier des chiffres sans source, l'aperçu le dit sous le graphique et la légende décrit les quatre mesures de l'emploi (travailleurs de l'ISQ, emplois industriels du portrait LGP, estimations par secteur, emplois des fiches).
- Secteurs. Royer (chaussures de sécurité) passe de Produits métalliques à Textile & vêtements. Ce secteur affiche 270 emplois, soit le chiffre du portrait LGP (Fil / Textile / Habillement, 5 établissements). Produits métalliques affiche 355 emplois, soit la somme de ses fiches documentées.
- Date. L'en-tête et le menu affichent la date de la dernière mise à jour des données (`meta.updatedDate`); le trimestre reste celui du chiffrier saisi par la MRC.
- Noms. « Centre de services scolaire des Hauts-Cantons » remplace « Commission scolaire », et le CSSS du Granit est rattaché à Santé Québec Estrie - CHUS.

## Nouveautés de la version 4.14

- Identité de la MRC du Granit. Le logo (version 2023) remplace le bandeau de titre, et la palette reprend ses trois couleurs : bleu marine `#004159` (couleur principale), vert `#668e3c` (accents et mentions favorables) et gris `#969491`. La gamme `--g` de `index.html` porte le bleu marine et la gamme `--v` le vert.
- Le logo se trouve dans `assets/logo-mrc-granit.png`. Les polices n'ont pas changé, faute de norme graphique publiée.

## Nouveautés de la version 4.13

- Carte des 19 municipalités en tête de l'aperçu et de la vue Municipalités (`granit-carte.js`). Un menu choisit l'indicateur qui colore la carte (population, 65 ans et plus, entreprises par 1 000 habitants, logements non occupés à l'année, ménages locataires, places de garde, vulnérabilité). Le survol affiche les chiffres de la municipalité et le clic ouvre son portrait.
- Les contours viennent du Système sur les découpages administratifs (SDA) du gouvernement du Québec, extraits par `tools/carte_granit.py` dans `data/carte/`. Le flux « Carte - Granit » se lance à la main si une limite municipale change.

## Nouveautés de la version 4.12 (revue complète avant démonstration)

- Corrections. Les pyramides des âges s'affichaient en noir (un graphique ne lit pas les variables CSS). Les graphiques par municipalité masquaient une étiquette sur deux. Les nombres suivent maintenant l'usage français partout (virgule décimale, espace avant %, espace des milliers dans les graphiques).
- Lisibilité. Le répertoire local et le répertoire touristique sont paginés (25 lignes par page). Les indicateurs de l'aperçu, de l'emploi et des logements tiennent sur des grilles régulières, et le bandeau qui doublait les cartes de la vue Logements est retiré.
- Finitions. Icônes pour les 13 secteurs, bandeau « Données à jour » dans l'aperçu, matrice des maillages avec les noms complets, tirets simples à la place des tirets longs et des points médians dans l'interface.
- Textes. 143 accents manquants corrigés dans les descriptions de `data.json` (les noms d'entreprises ne sont pas touchés).

## Nouveautés de la version 4.11

- Vue « Légende et repères », accessible par le bouton Légende de l'en-tête, par le menu latéral et par le lien au bas de chaque vue. Elle regroupe les pastilles de provenance, les libellés des entreprises, la table des 13 secteurs, les repères de revenu par tranche, les définitions et les sources des logements et des services de garde, ainsi que le calendrier des mises à jour.
- Ces éléments quittent les vues où ils se répétaient : la légende des pastilles au bas de chaque vue, la carte des repères de revenu de l'aperçu, la légende et la carte des sources de la vue Logements, la note de lecture du Registre. Les notes restantes tiennent en une ligne et renvoient à la légende.

## Nouveautés de la version 4.10

- Le Registre des entreprises apparaît dans toutes les vues. Le panneau d'un secteur réunit les fiches locales et les entreprises du Registraire classées dans ce secteur, avec recherche et filtre par municipalité. Le portrait d'une municipalité (et celui de la MRC) affiche ses entreprises actives, leur répartition par secteur et ses principaux employeurs. La vue d'ensemble, le répertoire local, le tourisme, l'emploi et les logements reprennent aussi les inscriptions pertinentes. Chaque liste renvoie au Registre déjà filtré.
- Classement dans les 13 secteurs. Il se fait à partir du code d'activité (CAE) déclaré au Registraire; la table de correspondance se trouve dans `s13De` de `granit-req.js`. Une fiche locale rattachée par le NEQ garde le secteur que la MRC lui a donné. Les sociétés de gestion, les exploitants immobiliers, les associations et la fabrication diverse vont dans « Autres activités ». Le secteur Énergie & granules n'a pas de code propre.
- « Tissu opérant » devient « Entreprises en exploitation », soit les entreprises actives sans les sociétés de gestion.
- Services de garde. Les CPE, les garderies et le bureau coordonnateur proviennent de la liste du ministère de la Famille (Données Québec), extraite par `tools/garde_granit.py`.
- Parc de logements. Les 19 municipalités ont leurs valeurs du Recensement de 2021 (logements privés, logements occupés, ménages locataires), lues par `tools/recensement_granit.py` dans le service Web de Statistique Canada. Les estimations fondées sur la population sont retirées.

## Mises à jour automatiques

| Flux GitHub Actions | Fréquence | Ce qu'il met à jour |
|---|---|---|
| Registre des entreprises - Granit | le 3 et le 18 de chaque mois | `data/req/` |
| Milieu de vie - Granit | le 6 janvier, avril, juillet et octobre | `data/garde/` et `data/logement/` |

Les deux flux se lancent aussi à la main, dans l'onglet Actions du dépôt. À l'affichage, ces extractions priment sur les valeurs saisies dans le chiffrier pour les mêmes champs (installations de garde, places, parc de logements, ménages locataires). Chaque dossier contient un `diagnostic.txt` qui décrit ce qui a été lu et retenu.

Ce qui reste à saisir à la main : le logement social par municipalité (aucune source ouverte, à obtenir de l'Office d'habitation), le taux d'inoccupation et le nombre d'enfants en attente d'une place pour le Granit (le ministère ne publie que par région).

## Nouveautés de la version 4.8

- Aperçu général. Carte « Repères de revenu des ménages » qui donne les tranches faible, modeste, moyen et élevé selon la taille du ménage. Les bornes sont calculées à partir du seuil de la Mesure de faible revenu après impôt de 2020 (26 503 $ pour une personne, Statistique Canada) et de la définition de la classe moyenne de la Chaire en fiscalité et en finances publiques (75 % à 150 % du revenu médian ajusté). Les paramètres se trouvent dans `reperesRevenu` de `data.json`.
- Logements et garderies. Carte « Enfants en attente d'une place » avec la donnée régionale publiée par le ministère de la Famille (Estrie et Québec, 31 mai 2025), un ratio de places pour 100 enfants de 0 à 4 ans calculé par la plateforme et une chronologie sourcée du manque de places. Le nombre d'enfants en attente propre au Granit n'est pas publié; il se saisit dans la feuille « MRC - Logements » du chiffrier (deux nouvelles cellules) et s'affiche « À compléter » d'ici là.
- Municipalités. Vignette « MRC du Granit » placée en tête de grille, au même gabarit que les municipalités (population, superficie, densité, entreprises, structure par âge, logements et places de garde), et son portrait démographique détaillé au clic.
- Le chiffrier Excel doit être régénéré depuis la plateforme pour obtenir les deux nouvelles cellules. Un chiffrier antérieur s'importe toujours, avec un simple avertissement pour ces deux champs.

## Nouveautés de la version 4.7

- La section Culture (pilier économie) et la vue Culture et santé (pilier santé) ont été retirées, de même que les leviers et liens du pilier santé qui s'y rapportaient (quote-part, organismes diffuseurs, médiathèque). Aucune comparaison de dépenses municipales ne subsiste dans la plateforme ni dans `data.json`.
- Mise à jour trimestrielle par chiffrier Excel chiffré, une feuille par municipalité, importé directement dans la plateforme.
- Publication de `data.json` sur GitHub depuis la plateforme (facultatif, par jeton d'accès).
- Le bandeau de l'aperçu (superficie, part des 65 ans et plus, taux de faible revenu, nombre de municipalités) se lit désormais dans les données au lieu d'être fixé dans la page.

## Mise à jour trimestrielle (procédure du secrétariat)

1. Ouvrir `MRC_Granit_mise_a_jour.xlsx` avec son mot de passe.
2. Remplir les cellules jaunes. Chaque municipalité a sa feuille; les feuilles « MRC - … » portent les données territoriales. La feuille « Lisez-moi » explique les règles.
3. Enregistrer (le fichier reste chiffré avec le même mot de passe).
4. Ouvrir le tableau de bord en ligne et glisser le fichier n'importe où dans la page (ou cliquer « Importer Excel »).
5. Entrer le mot de passe du chiffrier. La plateforme vérifie chaque cellule et affiche le résumé (champs modifiés, ajouts, retraits, erreurs). Tant qu'une erreur subsiste, rien n'est appliqué.
6. Cliquer « Appliquer à la plateforme », puis « Publier maintenant » (si la publication GitHub est configurée) ou « Télécharger data.json » et coller son contenu dans `data.json` sur GitHub.
7. Le site en ligne se met à jour en une à deux minutes.

Le chiffrier se conserve d'un trimestre à l'autre. Pour repartir des données publiées (par exemple après une modification faite avec « Modifier les données »), utiliser « Régénérer le gabarit Excel à partir des données actuelles » dans la fenêtre d'importation; un mot de passe est demandé pour chiffrer le nouveau fichier.

## Ce que contient le chiffrier

Feuilles territoriales. `MRC - Général` (période, indicateurs validés, KPI, emplois par secteur, historique annuel), `MRC - Aménagement` (permis, affectation, conversions), `MRC - Santé` (scores des déterminants), `MRC - Économie (LGP)`, `MRC - Main-d'œuvre`, `MRC - Tourisme` (membres hors MRC), `MRC - Logements` (agrégats), `MRC - Climat` (paramètres de l'inventaire).

Feuilles municipales (19). Identité, démographie (structure par âge, totaux, évolution, projections), logements et services de garde, plan climat, conversion résidence et villégiature (six municipalités), entreprises et employeurs, membres de Tourisme Région de Mégantic.

Règles du chiffrier. Seules les cellules jaunes sont modifiables (les feuilles sont protégées). Dans un tableau, une ligne libre sert à ajouter un élément et effacer le nom d'une ligne retire l'élément. Les listes déroulantes imposent les valeurs permises. La colonne A masquée porte les marqueurs techniques qui relient chaque cellule à un champ de `data.json`; elle ne doit pas être supprimée.

Champs recalculés automatiquement à l'importation. Densité de chaque municipalité; portrait démographique de la MRC (somme des municipalités); comptes touristiques par municipalité, par section et par catégorie, hébergement, et fiches « tourisme » de la liste d'entreprises; parc total de logements; totaux du plan climat par secteur, par habitant et parts municipales; indice composite de santé (déjà calculé par la plateforme à partir des scores).

Ce que le chiffrier ne modifie pas. Les textes d'analyse (introductions, constats, maillages, leviers, limites) restent dans la plateforme.

## Publication automatique sur GitHub (configuration unique)

1. Sur GitHub, créer un jeton d'accès personnel « fine-grained » limité au dépôt du tableau de bord, avec la permission Contents en lecture et écriture.
2. Dans la plateforme, « Modifier les données » (mot de passe administrateur), section « Publication automatique sur GitHub », saisir le propriétaire, le dépôt, la branche (`main`), le chemin (`data.json`) et le jeton, puis enregistrer.
3. Le jeton reste dans le navigateur où il a été saisi (stockage local). Il n'est jamais écrit dans `data.json` ni exporté. Chaque poste qui publie doit être configuré.

Sans cette configuration, l'exportation de `data.json` et son dépôt manuel sur GitHub restent possibles.

## Déploiement initial (une seule fois)

1. Créer un dépôt public, par exemple `granit-dashboard`.
2. Téléverser les sept fichiers listés plus haut.
3. Settings, Pages, Source `main`, Save.
4. URL `https://[votre-compte].github.io/granit-dashboard`.

## Mot de passe administrateur par défaut

`granit2025`, à changer dans « Modifier les données ». Le mot de passe du chiffrier Excel est distinct et se choisit à la génération du fichier.

## Outil de génération en ligne de commande (facultatif)

Le dossier `tools/` permet de produire le chiffrier sans passer par le navigateur (Node.js 18 ou plus).

```
cd tools
npm install
node build-excel.js ../data.json ../MRC_Granit_mise_a_jour.xlsx "MotDePasse"
node test-roundtrip.js ../data.json ../MRC_Granit_mise_a_jour.xlsx "MotDePasse"
```

Le second script vérifie qu'un chiffrier non modifié ne produit aucun changement à l'importation.

## Sources des données

Voir le champ `_sources` de `data.json` et les sources affichées dans chaque section.
