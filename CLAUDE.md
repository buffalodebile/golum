# golum — Site public Prisma Capital

Site statique (HTML/CSS/JS plats, pas de framework) publié sur GitHub Pages (buffalodebile.github.io/golum) et prisma-capital.xyz.

Règles clés :
- **golum est la source CANONIQUE du design.** Le dossier `site/` de Finance Backtest n'est qu'une zone de staging de données : Finance Backtest ne pousse QUE les données (JSON/JS), jamais le design.
- **Publier les résultats, JAMAIS la recette** : aucun paramètre exact de stratégie (fenêtres, seuils, poids) ne doit apparaître dans le contenu public.
- Vérifier les URLs live avant de conclure qu'un changement « n'est pas déployé ».
- **`partners.html` est un fichier GÉNÉRÉ** (page client protégée, contenu chiffré AES) : source et
  build dans `Finance Backtest/scripts/partners_page/` — ne jamais l'éditer à la main, ne jamais le
  lier (nav/footer/sitemap), ne jamais ajouter de Disallow robots.txt pour lui (ça révélerait l'URL).
- **`follower.sh`** (installeur client, servi à la racine du site) et **`feed/*.json`** (signaux chiffrés
  quotidiens) font partie du système client « feed + follower ». `follower.sh` clone le repo public
  `buffalodebile/prisma-follower`. Les `feed/*.json` sont publiés par `Finance Backtest/scripts/feed/publish_signals.py`.

## Wiki de connaissances (Obsidian)

Un wiki central existe dans `C:\Coding\wiki` (framework obsidian-wiki, skills `wiki-*` globales).

- **En fin de session significative** (décision d'architecture, incident résolu, idée testée ou
  rejetée, leçon apprise), mets à jour le wiki via la skill `wiki-update`.
  Projet wiki : `projects/prisma-capital/`.
- Critère : si relire le code suffit à répondre, pas de wiki ; si la réponse exige de reconstituer
  un raisonnement passé, wiki. Pas de page pour du travail trivial.
- Fusionne dans les pages existantes plutôt que d'en créer. Idée rejetée → tag `#rejete` + suffixe `-REJETE`.
- Contenu sensible (stratégies, accès) : autorisé localement, tag `#confidentiel`.
- Pour retrouver une décision passée : skill `wiki-query`.
- **Avant de proposer une amélioration ou une idée de stratégie/design : vérifie via `wiki-query`
  qu'elle n'a pas déjà été testée ou rejetée** (pages `#rejete`). Si rejetée, ne pas re-proposer.
