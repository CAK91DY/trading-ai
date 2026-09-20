# Trading AI

Laboratoire local de backtesting : React + TypeScript, FastAPI et PostgreSQL.
Interface en français. Simulation uniquement : aucun courtier, ordre réel ou modèle IA connecté.

## Démarrage Docker

Prérequis : Docker Desktop démarré.

```sh
cp .env.example .env
# Remplacer le mot de passe local dans .env (caractères URL-safe).
docker compose up --build
```

Interface : http://localhost:5173 — API : http://localhost:8000/docs.
Les résultats persistent dans le volume PostgreSQL. `docker compose down` conserve ce volume.
Les services ne sont exposés que sur l'interface locale. Aucune authentification : ne pas publier tel quel.

## Démarrage sans Docker (Mac)

Prérequis : Python 3.13+ et Node 22.12+.

Terminal 1, depuis la racine :

```sh
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
cd backend
.venv/bin/uvicorn app.api.main:app --host 127.0.0.1 --port 8000
```

Terminal 2, depuis la racine :

```sh
cd frontend
npm ci
npm run dev
```

Ce mode utilise SQLite (`backend/trading.db`) sans changer le code applicatif. Docker utilise PostgreSQL via `DATABASE_URL`.

## Premier backtest

1. Ouvrir Backtesting.
2. Importer un CSV quotidien, ou charger la **démo synthétique** fournie.
3. Choisir les périodes EMA, le capital, les frais, le glissement et l'allocation.
4. Lancer le backtest : courbe, performance nette, drawdown, frais et journal sont enregistrés.

Format CSV UTF-8, séparateur virgule, décimales avec un point :

```csv
date,open,close
2025-01-02,100.20,101.30
2025-01-03,101.40,100.80
```

Cet extrait décrit le format ; il faut plus de séances que la période lente (51 minimum avec EMA 50).
Maximum 10 000 séances et 2 Mo. Dates ISO strictement croissantes, aucun doublon, prix positifs finis.
Une seule devise ; open et close doivent être ajustés de façon cohérente. La source réelle est fournie par l'utilisateur : aucun téléchargement automatique de cotations dans V1.
Le fichier `frontend/public/demo-synthetique.csv` contient des prix générés mathématiquement, pas des prix de marché. Ses résultats ne constituent aucune preuve de performance.

## Modèle de calcul

EMA initialisée au premier cours, période de chauffe égale à la période lente.
Signal long lorsque l'EMA rapide dépasse l'EMA lente. Ordre à l'ouverture suivante ; sortie à l'ouverture après inversion. La position finale est liquidée à la dernière clôture.
Une seule position, fractions de titres, pas de levier. Allocation appliquée au cash disponible à chaque achat, frais inclus dans le budget. Frais et glissement défavorable à chaque exécution. Les dividendes ne sont pas versés séparément. Drawdown calculé sur le capital quotidien valorisé à la clôture, capital initial inclus.
Pas encore de RSI, benchmark, validation hors échantillon, modélisation de liquidité ou limites de pertes. Aucune garantie de rentabilité.

## Structure

- `frontend/src` : dashboard, configuration, journal, navigation et états vides des futurs modules.
- `backend/app/api` : API REST et stockage SQLAlchemy.
- `backend/app/market_data` : validation CSV.
- `backend/app/strategies` : EMA.
- `backend/app/backtesting` : simulation.
- `backend/app/risk` : allocation sans emprunt.
- `backend/app/ai`, `backend/app/brokers` : extensions documentées, non implémentées.
- `database` : documentation du stockage.
- `backend/tests` : calculs et API.

## Validation

```sh
cd backend
.venv/bin/python -m pytest tests -q
cd ../frontend
npm ci
npm run build
npm run lint
```

Dépendances Python figées dans requirements.txt et JavaScript dans package-lock.json.
La table est créée automatiquement pour V1 ; prévoir des migrations avant de modifier son schéma.

## Étapes suivantes

Import depuis un fournisseur historique documenté, benchmark, évaluation hors échantillon, puis paper trading et règles de risque supplémentaires. L'assistant IA expliquera les résultats ; il ne remplacera pas les règles d'exécution.
