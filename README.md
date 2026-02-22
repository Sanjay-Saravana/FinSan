# FinSan Finance Tracker

Modern single-page personal finance tracker with:

- Login / signup (localStorage-backed demo auth)
- Dashboard with net worth, income, expenses, and savings rate
- Transaction management
- Budget tracking with progress bars
- Financial goals tracking
- Investment portfolio tracking with P/L
- Recurring transactions automation
- CSV import for brokerage exports (Robinhood/Fidelity/Schwab/generic mappings)

## Run

Open `index.html` directly or run a static server:

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

## CSV import format

Supported headers include combinations like:

- `date`, `description`, `amount`, `type`, `category`
- `trade_date`, `symbol`, `net_amount`, `transaction_type`
- `transaction_date`, `details`, `total`

The importer normalizes rows to app transactions automatically.
