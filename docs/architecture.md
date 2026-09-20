# Architecture et périmètre

## Flux livré

React Router → TanStack Query → API FastAPI → services → SQLAlchemy → PostgreSQL.
Les appels au fournisseur de marché passent uniquement par le backend. `MarketProvider` permet de remplacer Yahoo sans modifier les pages.

## Organisation

- `frontend/src/components`, `layouts`, `pages` : présentation, navigation et écrans.
- `hooks`, `store`, `services` : requêtes, session et client HTTP commun.
- `backend/app/api`, `schemas`, `core` : routes, validation, configuration et sécurité.
- `market_data`, `services`, `indicators` : catalogue, adaptateur, cache et calculs.
- `models` et `database/migrations` : stockage et migrations versionnées.
- `strategies`, `backtesting`, `risk` : laboratoire EMA existant, indépendant de l’interface.
- `signals`, `portfolio`, `brokers`, `ai` : points d’extension réservés.

## API

OpenAPI est disponible à `/docs` sur le backend. `/api/auth` gère les comptes ; `/api/assets` les fiches/historiques ; `/api/markets` l’exploration ; `/api/watchlists` les listes privées ; `/api/strategies` le constructeur de stratégies (EMA/RSI, sans code) ; `/api/backtests` les expériences CSV et marché, avec figement de la stratégie utilisée ; `/api/settings` le profil des connexions. Seul `/api/health` et le parcours initial d’authentification sont accessibles sans session.

## Frontières des phases

Phase 1 : socle, comptes, base, conteneurs, navigation et dashboard initial.
Phase 2 : marchés, historiques, indicateurs, graphiques et watchlists.
Phase 3 (en cours) : constructeur de stratégies EMA/RSI livré (CRUD, activation, figement dans les backtests) ; moteur de signaux, comparaison de stratégies et validation hors échantillon restent à développer.
Phase 4 : règles de risque indépendantes, ordres simulés, portefeuille, journal et arrêt d’urgence.
Phase 5 : analyse IA côté backend. Phase 6 : exploitation et déploiement.

Aucun endpoint d’envoi d’ordre n’existe dans les phases livrées. Les indicateurs ne sont pas présentés comme des recommandations d’achat ou de vente.

## Exploitation locale

Ne pas publier `.env`, les bases, les courriels locaux ou `work/`. Le service de courrier en mode fichier est destiné au développement. Avant une exposition publique, prévoir HTTPS, fournisseur de données autorisé, SMTP, sauvegardes, tests de charge, politique de rétention et revue de sécurité. Le système de limitation de tentatives repose sur l’adresse vue par l’API ; derrière un proxy, sa configuration doit être adaptée.
