# Stockage

PostgreSQL via Docker Compose ; SQLite pour le développement sans Docker.

Le schéma est versionné avec Alembic. Depuis `backend`, exécuter `.venv/bin/alembic upgrade head` avant le démarrage local. Docker le fait automatiquement. La migration initiale contient explicitement les tables et index : ne pas remplacer les migrations par `create_all` au démarrage.

Tables livrées : `users`, `auth_sessions`, `password_resets`, `auth_attempts`, `assets`, `market_prices`, `market_fetches`, `watchlists`, `watchlist_assets`, `experiments`, `audit_logs`.

Les cotations sont uniques par symbole/intervalle/date. Les listes et expériences appartiennent à un utilisateur. Les mots de passe et jetons d’authentification ne sont jamais stockés en clair. Les suppressions de listes suppriment leurs associations aux actifs.

La table `backtests` d’une éventuelle installation V1 est conservée ; ses données sans utilisateur ne sont pas exposées aux nouveaux comptes. Les nouveaux résultats privés sont stockés en JSON dans `experiments`. Les modèles des phases suivantes seront ajoutés par de nouvelles migrations.
