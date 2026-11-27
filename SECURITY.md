# Sécurité du tableau de bord

## Nature de la plateforme

Un site statique public, hébergé par GitHub Pages. Tout son contenu est lisible par tous : `data.json`, les fichiers de `data/` et le code. Rien de confidentiel ne doit donc y être versé, et aucune donnée personnelle.

## Qui peut modifier quoi

- Consulter : tout le monde, sans mot de passe.
- Modifier à l'écran : le mode « Modifier les données » demande un mot de passe. Ce contrôle s'exerce dans le navigateur; les changements restent locaux tant qu'ils ne sont pas publiés. Il protège contre l'erreur, pas contre une personne déterminée.
- Publier : seule la personne qui détient un jeton GitHub ayant le droit d'écrire dans le dépôt peut modifier le contenu que tout le monde voit. C'est la vraie barrière.

## Réglages à faire dans GitHub (non modifiables par le code)

1. Jeton de publication. Utiliser un jeton à portée fine (fine-grained), limité à ce seul dépôt, avec le seul droit « Contents : Read and write » et une date d'expiration d'au plus 90 jours. Révoquer tout jeton classique.
2. Protection de la branche `main`. Interdire les poussées forcées et la suppression de la branche.
3. Secret scanning et push protection. Les activer dans Settings, Code security.
4. Authentification à deux facteurs sur le compte propriétaire du dépôt.
5. Actions. Dans Settings, Actions, General, n'autoriser que les actions de GitHub et laisser les droits du jeton par défaut en lecture seule.

## Bonnes pratiques

- Ne publier qu'à partir d'un poste personnel. Le jeton est conservé dans le stockage local du navigateur; l'effacer sur un poste partagé.
- Ne jamais importer un fichier JSON ou un chiffrier reçu d'une source inconnue.
- Changer le mot de passe du mode « Modifier les données » et celui du chiffrier si l'un d'eux a circulé par courriel ou figuré dans le dépôt.

## Signaler un problème

Écrire à la scientifique en chef de la MRC du Granit, sans publier le détail dans une issue publique.
