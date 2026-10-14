# Tableau de bord territorial - MRC du Granit (v4.7)

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

Les sept fichiers doivent se trouver dans le même dossier du dépôt.

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
