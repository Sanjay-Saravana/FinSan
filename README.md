# FinSan (Next.js + API Backend)

Professional finance tracker built with **Next.js App Router** and backend route handlers.

## What is included
- Secure-ish demo auth flow with backend APIs (`/api/auth/signup`, `/api/auth/login`, `/api/session`)
- Server-backed finance data storage (`/api/finance`) persisted in `data/db.json`
- Dashboard with net worth, monthly income/expense, and savings rate
- Transactions, budgets, goals, recurring entries, and brokerage CSV import
- Investments with snapshot price autofill and periodic automatic refresh
- Currency selector (USD, EUR, GBP, INR, JPY, CAD, AUD)

## API tools connected
- **Auth APIs** for sign-up/sign-in/logout and session cookie management
- **Finance API** for saving/loading all user finance data from backend JSON database
- **Market snapshot API** for ticker price lookup (`/api/market/snapshot?symbol=AAPL`) with fallback source

## Run locally
```bash
npm install
npm run dev
```
Open `http://localhost:4173`.

## Notes
- Data file: `data/db.json`
- This project is ready to migrate from file storage to Postgres/Mongo in production.
