# Tableau de bord territorial - MRC du Granit (v4.20)

Outil interne de développement territorial à trois piliers (économie, aménagement, santé). Hébergé sur GitHub Pages.

## Fichiers à déployer ensemble

| Fichier | Rôle |
|---|---|
| `index.html` | L'application. Ne pas modifier sauf refonte |
| `data.json` | Toutes les données affichées. C'est le fichier que la mise à jour trimestrielle remplace |
| `chart.umd.min.js` | Bibliothèque de graphiques (Chart.js) |
| `granit-excel.js` | Spécification des champs du chiffrier Excel, lecture et application (partagé avec l'outil de génération) |
| `granit-import.js` | Interface de mise à jour (chiffrier à jour, glisser-déposer, résumé des changements, publication en un commit) |
| `granit-rapport.js` | Rapport imprimable bâti à partir des vues affichées |
| `xlsx-populate.min.js` | Déchiffrement et lecture du chiffrier dans le navigateur |
| `exceljs.min.js` | Régénération du gabarit Excel depuis la plateforme |

| `granit-req.js` | Vue « Registre des entreprises » et chargement du registre pour les autres vues |
| `granit-carte.js` | Carte des municipalités, colorée selon l'indicateur choisi |
| `granit-mada.js` | Vue « Constats du milieu » (groupe Milieu de vie) et notes terrain de la vue Logements et garderies |
| `data/mada/constats.json` | Constats de la collecte MADA auprès des organismes, agrégés par axe. Tenu à la main |
| `granit-apprenant.js` | Pilier Santé : registre « De la donnée à la décision », instances, journal des lectures révisées, « Données et gouvernance », navigation regroupée |
| `data/sante/apprenant.json` | Enjeux suivis, décisions tracées, instances, journal et inventaire des jeux de données. Tenu à la main |
| `granit-securite.js` | Assainissement des données avant affichage, validation des imports, empreinte du mot de passe. Chargé en premier |
| `granit-croise.js` | Croisements entre les vues : le registre, les services de garde et le recensement s'affichent partout où il y a une fiche ou un bloc cliquable |
| `data/req/`, `data/garde/`, `data/logement/` | Extractions automatiques produites par GitHub Actions. Ne pas modifier à la main |
| `data/appariement.json` | Liens entre les fiches locales et le Registraire (par NEQ) |

Ces fichiers doivent se trouver dans le même dossier du dépôt.

## Nouveautés de la version 4.21

- Chiffrier complet. Le chiffrier de mise à jour couvre maintenant toutes les sections : textes d'analyse, collaborations, leviers et liens du pilier Santé, repères de revenu, compléments logements et climat, constats MADA et territoire apprenant (32 feuilles, environ 920 champs et 200 tableaux).
- Plus de mot de passe sur le chiffrier, dont le contenu est public une fois publié. Un ancien chiffrier chiffré s'importe encore.
- Publication en un clic. « Appliquer et publier » crée un seul commit pour tous les fichiers touchés. L'autorisation d'un poste se fait dans la fenêtre de publication, avec vérification du jeton.
- Garde-fous. Détection d'un chiffrier plus ancien que les données publiées; avertissement si un déterminant ou une source cité n'existe pas; un `data.json` glissé dans la page passe par le même contrôle que « Importer JSON »; tout contenu du chiffrier est assaini.
- Rapport imprimable automatique (`granit-rapport.js`). La liste des sections est lue dans la page et chaque section est une copie de la vue affichée, graphiques compris. Le rapport passe de 14 à 25 sections et suit toute vue ajoutée ou donnée modifiée, sans entretien. L'ancien gabarit par section (`buildSection` dans `index.html`) n'est plus appelé.
- Tests. `tools/test-roundtrip.js` (un chiffrier intact ne change aucun fichier) et `tools/test-modif.js` (ajouts, retraits, erreurs, chiffrier périmé).

## Nouveautés de la version 4.20 (sécurité)

Aucun mot de passe n'est ajouté pour consulter la plateforme. Le durcissement porte sur ce qui se passe derrière l'écran.

- Mot de passe du mode « Modifier les données ». Il figurait en clair dans `data.json`, dans la page et dans ce README. Il est remplacé par une empreinte PBKDF2-SHA-256 salée (310 000 itérations). Le mot de passe en vigueur continue de fonctionner, mais il a été public : il faut le changer. Trois essais ratés imposent une attente croissante.
- Assainissement des données. Tout ce qui est affiché passe par `granit-securite.js` : `data.json`, les fichiers de `data/`, un JSON importé, le stockage local, le chiffrier. Seules des balises de mise en forme sont conservées; scripts, gestionnaires d'événements et liens `javascript:` sont retirés. Un fichier piégé ne peut plus exécuter de code dans le navigateur de la personne qui publie, ni lire son jeton GitHub.
- Import JSON. Le fichier doit avoir la structure d'un `data.json` et ne pas dépasser 8 Mo.
- Politique de sécurité du contenu (CSP). Aucun script, cadre ou objet externe; les seuls échanges réseau permis sont le site lui-même, l'API de GitHub pour la publication et Google Fonts pour les polices.
- Bibliothèques tierces (`chart.umd.min.js`, `exceljs.min.js`, `xlsx-populate.min.js`) verrouillées par une empreinte d'intégrité.
- Flux GitHub Actions. Actions épinglées par empreinte de commit, droits réduits à l'écriture du contenu pour le seul job qui publie, exécutions mises en file, contrôle des fichiers JSON avant publication. Dependabot propose les mises à jour des actions.
- Dépôt. `.gitignore` empêche de verser un chiffrier ou un fichier de secrets; `tools/test-modif.js` ne contient plus de mot de passe (variable `GRANIT_XLSX_PW`).
- `granit-excel.js` et `granit-import.js` ne sont pas modifiés. Le jeton GitHub reste donc conservé dans le stockage local du navigateur; voir `SECURITY.md` pour les réglages recommandés.

## Nouveautés de la version 4.19 (pilier Santé : déterminants sociaux et inégalités sociales de santé)

Le cadre maison de huit déterminants avec scores est remplacé par les 17 déterminants sociaux de la santé reconnus en contexte canadien (liste de Raphael, 2020, telle que présentée par Shareck et Provost, 9 novembre 2026). Les notions de cette présentation structurent maintenant tout le pilier.

- Portrait des déterminants. Dix-sept fiches numérotées, sans score, sans radar et sans indice composite. Chaque fiche dit ce qui est documenté (chiffres, constats du milieu) et ce qui reste à documenter. Huit déterminants n'ont aucun chiffre local; c'est affiché, avec le rappel « petits effectifs, grande prudence ».
- Nouvelle vue « Inégalités sociales de santé » : définition, gradient, les deux mécanismes (distribution des ressources, appropriation de l'espace), les cinq dimensions de l'accès appliquées aux constats du milieu, les données de l'EQSJS 2022-2023 pour le Granit, et trois situations du Granit.
- Constats du milieu. Les 61 constats sont rattachés aux nouveaux déterminants; 38 portent en plus une dimension de l'accès (disponibilité, accessibilité spatiale, accessibilité économique, accommodement, acceptabilité), avec un filtre.
- De la donnée à la décision. Les quatre principes d'action figurent en tête; chaque enjeu comporte un regard d'équité (rempli pour le transport, à faire pour les autres). Une colonne Jeunes s'ajoute au tableau des instances.
- Leviers, liens entre piliers et enjeux du registre pointent vers les nouveaux déterminants.
- Limite du cadre. La liste ne comporte pas de déterminant propre à l'environnement physique; le milieu naturel et bâti est rattaché à la géographie.
- Chiffrier trimestriel. `granit-excel.js` n'est pas modifié. La feuille « MRC - Santé » garde ses colonnes Score et Niveau, désormais vides et sans effet; les identifiants des déterminants passent de `d1`-`d8` à `dss01`-`dss17`, de sorte qu'un ancien chiffrier ne peut pas écraser les nouvelles fiches.
- EQSJS. La vue ne présente que le RLS du Granit; aucun autre territoire n'y figure. Les 17 valeurs ont été vérifiées dans le tableau-synthèse publié par la Direction de santé publique de l'Estrie; la vue indique pour chacune si elle diffère du reste du Québec au seuil de 5 % (quatre le font) et signale les trois proportions peu précises.
- Référence. Le portrait indique sous les fiches que la liste est adaptée de Raphael et coll. (2020); la liste d'origine comprend la mondialisation là où celle retenue ici comprend l'orientation sexuelle. Les textes explicatifs du pilier ont été resserrés.

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

| Flux GitHub Actions | Fréquence | Données mises à jour |
|---|---|---|
| Registre des entreprises - Granit | le 3 et le 18 de chaque mois | `data/req/` |
| Milieu de vie - Granit | le 6 janvier, avril, juillet et octobre | `data/garde/` et `data/logement/` |

Les deux flux se lancent aussi à la main, dans l'onglet Actions du dépôt. À l'affichage, ces extractions priment sur les valeurs saisies dans le chiffrier pour les mêmes champs (installations de garde, places, parc de logements, ménages locataires). Chaque dossier contient un `diagnostic.txt` qui décrit ce qui a été lu et retenu.

Saisie manuelle restante : le logement social par municipalité (aucune source ouverte, à obtenir de l'Office d'habitation), le taux d'inoccupation et le nombre d'enfants en attente d'une place pour le Granit (le ministère ne publie que par région).

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

## Mise à jour des données (procédure, sans programmation)

1. Ouvrir le tableau de bord en ligne et cliquer « Mise à jour Excel », puis « Télécharger le chiffrier à jour ». Le fichier contient toutes les sections telles que publiées à ce moment. Il n'a pas de mot de passe.
2. Remplir les cellules jaunes dans Excel et enregistrer. La feuille « Lisez-moi » explique les règles.
3. Glisser le fichier n'importe où dans la page. La plateforme vérifie chaque cellule et affiche le résumé (champs modifiés, ajouts, retraits, erreurs). Tant qu'une erreur subsiste, rien n'est appliqué.
4. Cliquer « Appliquer et publier ». Un seul commit met à jour `data.json` et, s'ils ont changé, `data/mada/constats.json` et `data/sante/apprenant.json`. Le site se met à jour en une à deux minutes.

Toujours repartir d'un chiffrier fraîchement téléchargé. Chaque chiffrier porte une empreinte des données au moment de sa génération : si les données publiées ont changé depuis, la plateforme l'annonce avant d'appliquer quoi que ce soit, pour éviter d'écraser des valeurs plus récentes.

## Contenu du chiffrier

- Feuilles « MRC - … » : Général (période, indicateurs validés, KPI, secteurs, historique, repères de revenu), Aménagement, Santé (déterminants, leviers, liens entre piliers), Économie (LGP), Main-d'œuvre, Tourisme, Logements (agrégats, enfants en attente, chronologie), Climat (inventaire, constats, limites, sources), Collaborations.
- Feuille « Textes d'analyse » : introductions, notes, sources et constats rédigés de chaque section.
- Feuille « Milieu - Constats MADA » : tout le contenu de `data/mada/constats.json`.
- Feuilles « Santé - Apprenant » et « Santé - Enjeux » : tout le contenu de `data/sante/apprenant.json` (sources, journal des décisions, instances, gouvernance des données, équité, portrait des jeunes, traces par enjeu et par étape).
- Une feuille par municipalité (19) : identité, démographie, logements et services de garde, plan climat, conversion résidence et villégiature, entreprises, membres touristiques.

Règles. Seules les cellules jaunes sont modifiables. Dans un tableau, une ligne libre sert à ajouter un élément et effacer le nom (ou le texte principal) d'une ligne retire l'élément. Une cellule à plusieurs éléments en porte un par ligne (Alt+Entrée). La colonne A masquée porte les marqueurs techniques; elle ne doit pas être supprimée.

Champs recalculés à l'importation. Densité, portrait démographique de la MRC, totaux touristiques et fiches « tourisme », parc total de logements, totaux du plan climat. Un domaine dont les données d'entrée n'ont pas changé garde ses valeurs d'origine à la décimale près.

Hors de portée du chiffrier. Les extractions automatiques de `data/` (Registraire, services de garde, recensement, carte), qui priment à l'affichage, et la structure des pages.

## Autoriser un poste à publier (une seule fois par poste)

1. Sur GitHub, créer un jeton d'accès « fine-grained » limité au dépôt du tableau de bord, permission Contents en lecture et écriture, expiration d'au plus 90 jours.
2. Sur le poste, déposer un chiffrier, cliquer « Appliquer », coller le jeton dans « Publier sur le site », puis « Vérifier et autoriser ce poste ». La plateforme valide le jeton auprès de GitHub.
3. Le jeton reste dans le navigateur de ce poste (stockage local). Il n'est jamais écrit dans les données. « Retirer l'autorisation de ce poste » l'efface.

Sans jeton, la fenêtre de publication offre de télécharger les fichiers modifiés pour les téléverser à la main dans GitHub.

## Déploiement initial (une seule fois)

1. Créer un dépôt public, par exemple `granit-dashboard`.
2. Téléverser les sept fichiers listés plus haut.
3. Settings, Pages, Source `main`, Save.
4. URL `https://[votre-compte].github.io/granit-dashboard`.

## Mot de passe du mode « Modifier les données »

Il n'est plus écrit en clair nulle part : `data.json` n'en garde qu'une empreinte PBKDF2 salée. Il se change dans « Modifier les données » (10 caractères au minimum). Le mot de passe du chiffrier Excel est distinct et se choisit à la génération du fichier. Voir `SECURITY.md`.

## Outil de génération en ligne de commande (facultatif)

Le dossier `tools/` permet de produire le chiffrier sans passer par le navigateur (Node.js 18 ou plus).

```
cd tools
npm install
node build-excel.js ../data.json /tmp/chiffrier.xlsx
node test-roundtrip.js ../data.json /tmp/chiffrier.xlsx
node test-modif.js
```

Le second script vérifie qu'un chiffrier non modifié ne produit aucun changement à l'importation.

## Sources des données

Voir le champ `_sources` de `data.json` et les sources affichées dans chaque section.
