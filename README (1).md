# Tableau de bord économique — MRC du Granit

Outil interne de développement économique. Hébergé gratuitement sur GitHub Pages.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | L'application — ne pas modifier sauf refonte |
| `data.json` | **Toutes les données** — c'est ce qu'on met à jour chaque trimestre |

## Déploiement initial (une seule fois)

1. Créer un compte sur [github.com](https://github.com)
2. Créer un nouveau dépôt public nommé `granit-dashboard`
3. Téléverser `index.html` et `data.json`
4. Aller dans **Settings → Pages → Source: main → Save**
5. URL : `https://[votre-compte].github.io/granit-dashboard`

## Mise à jour trimestrielle

1. Ouvrir le tableau de bord en ligne
2. Cliquer **✏️ Mettre à jour** → entrer le mot de passe
3. Modifier les données → **Enregistrer**
4. Cliquer **💾 Exporter data.json**
5. Sur GitHub, ouvrir `data.json` → ✏️ → coller le contenu → **Commit**
6. Tout le monde voit les nouvelles données en ~2 minutes ✅

## Mot de passe par défaut

`granit2025` — À changer dans le panel admin.

## Sources des données réelles incluses

- **Population** : MAMH, Décret de population 1499-2025
- **Indicateurs ISQ** : Institut de la statistique du Québec, 2024-2025
- **Acériculture** : PPAQ, MAPAQ, affairesmegantic.com
- **Éolien** : Énergie du Granit (EDG), mrcgranit.qc.ca
- **Emplois par secteur** : estimations — à valider avec Emploi-Québec / CLD Granit
