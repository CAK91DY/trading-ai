# Trading AI — phases 1 et 2, phase 3 en cours

Plateforme locale d’analyse des marchés, en français. React/TypeScript + FastAPI + PostgreSQL.

## Fonctionnalités livrées

- **Foundation** : architecture modulaire, Docker Compose, migrations Alembic, inscription/connexion/déconnexion, récupération de mot de passe, profil et routes privées, navigation responsive et dashboard initial.
- **Market Data** : catalogue de 18 actions/ETF, recherche, filtres, tri et pagination, historique réel Yahoo Finance, fiche actif et graphiques interactifs de 1D à 5Y.
- **Indicateurs** : SMA20, EMA20/50, RSI14, MACD12/26/9, ATR14, bandes de Bollinger20 et volume, activables individuellement.
- **Watchlists privées** : création, renommage, suppression, ajout/retrait d’actifs et cotations.
- **Constructeur de stratégies (début de phase 3)** : création, modification, duplication, activation/désactivation et suppression de règles combinant EMA rapide/lente et RSI14 (ET/OU), sans écrire de code. Une stratégie active peut être sélectionnée pour un backtest marché ; sa définition est figée dans le résultat (`strategy_snapshot`), indépendamment de modifications ultérieures.
- Le laboratoire EMA sur CSV existant est conservé avec des résultats privés par utilisateur.

Les futurs modules signaux, risque, paper trading, portefeuille et IA sont identifiés comme indisponibles. Aucun broker ni ordre réel n’est connecté. Le dashboard laisse les données de portefeuille absentes au lieu de les inventer.

## Démarrage avec Docker

Prérequis : Docker Desktop démarré.

```sh
cp .env.example .env
# Remplacer POSTGRES_PASSWORD par un mot de passe local aléatoire, URL-safe.
docker compose up --build -d
```

Ouvrir **http://127.0.0.1:5173** puis créer son compte. API : http://127.0.0.1:8000/docs.
Les migrations s’exécutent automatiquement au démarrage de l’API. Les trois services sont exposés uniquement sur la machine locale ; PostgreSQL écoute sur le port 55432.

```sh
docker compose ps
docker compose logs --tail=50 backend
docker compose down
```

Les volumes `postgres_data` et `app_work` conservent les données après l’arrêt. Ne pas utiliser `down -v` pour un arrêt ordinaire : cette option supprime les volumes.

## Sans Docker

Prérequis : Python 3.13+ et Node 22.12+. Depuis la racine :

```sh
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
cd backend
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.api.main:app --host 127.0.0.1 --port 8000
```

Dans un second terminal :

```sh
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Sans `DATABASE_URL`, le backend utilise SQLite dans son répertoire courant. Pour PostgreSQL local, définir l’URL commentée dans `.env.example` puis appliquer les migrations à cette base. Le frontend utilise le proxy `/api` de Vite ou Nginx.

## Mot de passe oublié

Par défaut, `MAIL_MODE=file` écrit les messages de récupération dans `work/mail/*.eml`, sans envoyer d’e-mail. Avec Docker, ils sont dans le volume du backend, à `/app/work/mail`. Pour les consulter localement :

```sh
mkdir -p work
# Ces fichiers contiennent des liens privés : ne jamais les publier.
docker compose cp backend:/app/work/mail ./work/mail
```

Pour une livraison réelle, configurer `MAIL_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` et `SMTP_TLS` dans `.env`, puis recréer le backend. `FRONTEND_URL` doit correspondre à l’adresse ouverte dans le navigateur.

Les mots de passe sont hachés avec Argon2. La session utilise un cookie HttpOnly/SameSite et un jeton opaque dont seul le hash est stocké. Les liens de récupération sont limités dans le temps et à usage unique ; leur utilisation révoque les sessions. Les mutations vérifient l’origine et un en-tête anti-CSRF. Les listes et résultats sont isolés par utilisateur.

## Données et calculs

L’adaptateur Yahoo Finance via yfinance télécharge des cours **ajustés**, sans clé API. Les cours ne sont pas garantis temps réel. Les dates, la source et un éventuel cache périmé sont affichés. Une panne sans cache produit une indisponibilité explicite, jamais de cours fictifs.

- Historique quotidien jusqu’à 10 ans, affichage limité à la période choisie ; le catalogue initial est défini dans `backend/app/market_data/catalog.py`.
- 1D : barres de 5 minutes de la dernière séance disponible. Les autres périodes utilisent les clôtures quotidiennes. Les heures sont affichées dans le fuseau du navigateur.
- Cache SQL de 15 minutes pour les cours quotidiens, 1 minute pour l’intraday. Un rafraîchissement manuel demande une nouvelle récupération.
- Les indicateurs sont calculés avant le découpage de la période, avec des valeurs nulles pendant leur initialisation. RSI/ATR suivent le lissage de Wilder ; les bandes utilisent un écart-type de population.
- La volatilité affichée est l’écart-type des 30 derniers rendements quotidiens, annualisé sur 252 séances.

Cet adaptateur sert au développement et à la recherche personnelle. Avant une offre SaaS, choisir un fournisseur et des droits de redistribution adaptés ; le catalogue initial ne couvre pas tout le marché.

## Backtests sur historiques réels — début de phase 3

Depuis Backtesting (ou le lien sur une fiche actif), choisir un actif, une période et les paramètres EMA. Le capital est exprimé dans la devise de l’actif, sans conversion de change. Les paramètres et les résultats restent privés et sont sauvegardés dans PostgreSQL.

`POST /api/backtests/market` récupère l’historique quotidien ajusté et initialise les EMA sur les séances antérieures au début choisi. Ces séances ne déclenchent aucun ordre et ne font pas partie des métriques. Un historique d’initialisation insuffisant est refusé. La date de fin doit précéder aujourd’hui (UTC) pour éviter une séance en cours. Les dates effectives et le nombre de séances sont affichés ; les jours non cotés sont ignorés.

Règle fixe et paramétrable : entrer long lorsque l’EMA rapide dépasse l’EMA lente, sortir dans le cas contraire ; décision sur la clôture précédente et exécution à l’ouverture suivante. Il s’agit d’une condition de tendance, pas uniquement d’un croisement. Les frais et le glissement s’appliquent aux deux côtés, et toute position finale est liquidée à la clôture.

Les données ajustées d’entrée, leur empreinte SHA-256, les paramètres, la source, l’état du cache et la version de stratégie sont figés dans chaque expérience. Les listes API omettent les données d’entrée volumineuses. Le Sharpe utilise les rendements quotidiens, un taux sans risque nul et 252 séances/an. Il est indéfini en l’absence de variabilité. Le profit factor utilise les gains/pertes nets des transactions clôturées et reste indéfini sans perte. Les métriques indéfinies apparaissent sous la forme « — ». L’annualisation est calculée uniquement pour une période d’au moins 365 jours.

`POST /api/backtests/market` accepte optionnellement `strategy_id` : les règles d’entrée/sortie de la stratégie active remplacent alors la simple croisée EMA, et sa définition est figée dans le résultat sous `strategy_snapshot`. La sortie est prioritaire si les conditions d’entrée et de sortie sont vraies simultanément.

La comparaison de stratégies et la validation hors échantillon (Train/Test) restent à développer. Ce premier parcours ne remplace pas les contrôles de risque et le paper trading de phase 4.

## Laboratoire CSV conservé

CSV UTF-8, virgules, dates ISO croissantes et uniques, prix positifs finis : colonnes `date,open,close`. Maximum 10 000 séances et 2 Mo ; il faut plus de séances que la période EMA lente.

Les signaux utilisent la clôture, les exécutions l’ouverture suivante, avec frais et glissement défavorable. Une seule position longue, fractions de titres, sans levier ; liquidation finale à la dernière clôture. L’utilisateur fournit des prix ajustés de façon cohérente. Les résultats historiques V1 sans propriétaire ne sont pas attribués automatiquement à un compte.

## Validation

```sh
cd backend
.venv/bin/python -m pytest tests -q
cd ../frontend
npm ci
npm test
npm run build
npm run lint
```

Les tests couvrent l’authentification, les sessions et leur révocation, la récupération, l’isolation des comptes, les watchlists, les indicateurs, le cache et ses pannes, le moteur financier et la mise à jour de session React après connexion.

Voir [architecture](docs/architecture.md) et [stockage](database/README.md). Les dépendances sont figées par `requirements.txt` et `package-lock.json`. Le déploiement hébergé, les sauvegardes, le monitoring et le durcissement de production restent en phase 6 ; pour HTTPS, activer notamment `SECURE_COOKIES=true`.
