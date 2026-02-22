'use client';

import { useEffect, useMemo, useState } from 'react';

const categories = ['Housing', 'Food', 'Transport', 'Utilities', 'Healthcare', 'Entertainment', 'Investments', 'Salary', 'Freelance', 'Other'];
const currencies = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD'];
const sections = ['dashboard', 'transactions', 'budgets', 'goals', 'investments', 'import', 'settings'];

const formatMoney = (amount, currency, locale = 'en-US') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount || 0));

const createFinance = (currency = 'USD') => ({
  preferences: { currency, locale: 'en-US', refreshIntervalMs: 30000 },
  transactions: [],
  budgets: {},
  goals: [],
  investments: [],
  recurring: [],
  snapshots: {}
});

const parseCsvRows = (text) => {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((x) => x.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((x) => x.trim().replace(/^"|"$/g, ''));
    return headers.reduce((obj, key, i) => ({ ...obj, [key]: values[i] || '' }), {});
  });
};

const normalizeImportedRows = (rows) => rows.map((row) => {
  const amount = Number((row.amount || row.net_amount || row.total || '0').replace(/[^\d.-]/g, ''));
  const typeRaw = `${row.type || row.transaction_type || ''}`.toLowerCase();
  return {
    id: crypto.randomUUID(),
    date: row.date || row.trade_date || row.transaction_date || new Date().toISOString().slice(0, 10),
    description: row.description || row.symbol || row.details || 'Imported transaction',
    amount: Math.abs(amount),
    type: typeRaw.includes('debit') || typeRaw.includes('buy') || amount < 0 ? 'expense' : 'income',
    category: row.category || 'Other'
  };
});

async function api(path, options) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function FinanceTracker() {
  const [user, setUser] = useState(null);
  const [finance, setFinance] = useState(createFinance());
  const [authMode, setAuthMode] = useState('signin');
  const [activeSection, setActiveSection] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', currency: 'USD' });
  const [transaction, setTransaction] = useState({ date: '', description: '', amount: '', type: 'expense', category: categories[0] });
  const [budget, setBudget] = useState({ category: categories[0], limit: '' });
  const [goal, setGoal] = useState({ title: '', target: '', current: '' });
  const [investment, setInvestment] = useState({ ticker: '', qty: '', cost: '', price: '' });
  const [recurring, setRecurring] = useState({ description: '', amount: '', type: 'expense', category: categories[0], frequency: 'monthly' });

  useEffect(() => {
    (async () => {
      try {
        const session = await api('/api/session');
        if (session.user) {
          setUser(session.user);
          const financeRes = await api('/api/finance');
          setFinance(financeRes.finance || createFinance());
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user || !finance.investments.length) return;
    const interval = setInterval(() => refreshAllSnapshotPrices(), finance.preferences.refreshIntervalMs || 30000);
    return () => clearInterval(interval);
  }, [user, finance.investments.length, finance.preferences.refreshIntervalMs]);

  const saveFinance = async (next) => {
    setFinance(next);
    await api('/api/finance', { method: 'PUT', body: JSON.stringify({ finance: next }) });
  };

  const updateFinance = async (updater) => {
    const next = updater(finance);
    await saveFinance(next);
  };

  const dashboard = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    const monthTx = finance.transactions.filter((t) => t.date?.startsWith(month));
    const income = monthTx.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = monthTx.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const cashflow = finance.transactions.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
    const portfolio = finance.investments.reduce((sum, i) => sum + i.qty * i.price, 0);
    const categorySpend = finance.transactions
      .filter((t) => t.type === 'expense')
      .reduce((map, t) => ({ ...map, [t.category]: (map[t.category] || 0) + t.amount }), {});

    return {
      income,
      expenses,
      netWorth: cashflow + portfolio,
      savingsRate: income ? ((income - expenses) / income) * 100 : 0,
      recent: finance.transactions.slice(0, 5),
      categorySpend: Object.entries(categorySpend).sort((a, b) => b[1] - a[1]).slice(0, 6)
    };
  }, [finance]);

  const onAuthSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const res = await api(endpoint, { method: 'POST', body: JSON.stringify(authForm) });
      setUser(res.user);
      const financeRes = await api('/api/finance');
      setFinance(financeRes.finance || createFinance(authForm.currency));
      setAuthForm({ name: '', email: '', password: '', currency: authForm.currency });
    } catch (error) {
      setMessage(error.message);
    }
  };

  const logout = async () => {
    await api('/api/session', { method: 'DELETE' });
    setUser(null);
    setFinance(createFinance());
    setActiveSection('dashboard');
  };

  const refreshSnapshot = async (ticker) => {
    const data = await api(`/api/market/snapshot?symbol=${encodeURIComponent(ticker)}`);
    return data;
  };

  const autofillPrice = async () => {
    if (!investment.ticker) return;
    try {
      const snap = await refreshSnapshot(investment.ticker.toUpperCase());
      setInvestment((prev) => ({ ...prev, price: String(snap.price) }));
      setMessage(`Latest ${snap.symbol} price loaded from ${snap.source}.`);
    } catch {
      setMessage('Could not fetch current price snapshot.');
    }
  };

  const refreshAllSnapshotPrices = async () => {
    if (!finance.investments.length) return;
    const updates = await Promise.all(
      finance.investments.map(async (item) => {
        try {
          const snap = await refreshSnapshot(item.ticker);
          return { ...item, price: snap.price, lastSnapshotAt: snap.asOf, source: snap.source };
        } catch {
          return item;
        }
      })
    );

    const snapshotMap = updates.reduce((acc, item) => ({
      ...acc,
      [item.ticker]: { price: item.price, asOf: item.lastSnapshotAt || new Date().toISOString(), source: item.source || 'cached' }
    }), finance.snapshots || {});

    await saveFinance({ ...finance, investments: updates, snapshots: snapshotMap });
    setMessage('Portfolio prices refreshed from snapshots.');
  };

  if (loading) return <main className="auth-wrap"><div className="card">Loading FinSan…</div></main>;

  if (!user) {
    return (
      <main className="auth-wrap">
        <form className="card auth-card" onSubmit={onAuthSubmit}>
          <h1>FinSan</h1>
          <p className="muted">Professional finance tracker with backend APIs.</p>
          {authMode === 'signup' && <input placeholder="Full name" value={authForm.name} onChange={(e) => setAuthForm((v) => ({ ...v, name: e.target.value }))} />}
          <input type="email" placeholder="Email" required value={authForm.email} onChange={(e) => setAuthForm((v) => ({ ...v, email: e.target.value }))} />
          <input type="password" minLength={6} placeholder="Password" required value={authForm.password} onChange={(e) => setAuthForm((v) => ({ ...v, password: e.target.value }))} />
          <select value={authForm.currency} onChange={(e) => setAuthForm((v) => ({ ...v, currency: e.target.value }))}>
            {currencies.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button className="primary" type="submit">{authMode === 'signup' ? 'Create Account' : 'Sign In'}</button>
          <button type="button" className="link" onClick={() => setAuthMode((m) => m === 'signup' ? 'signin' : 'signup')}>
            {authMode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
          </button>
          {message && <p className="message">{message}</p>}
        </form>
      </main>
    );
  }

  const currency = finance.preferences.currency || 'USD';

  return (
    <div className="shell">
      <aside className="sidebar card">
        <div>
          <h2>FinSan</h2>
          <p className="muted">Welcome, {user.name}</p>
        </div>
        <nav>
          {sections.map((item) => (
            <button key={item} className={`menu ${activeSection === item ? 'active' : ''}`} onClick={() => setActiveSection(item)}>
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
        <button className="ghost" onClick={logout}>Logout</button>
      </aside>

      <main className="content">
        <header className="card topbar">
          <h3>Financial command center</h3>
          <div className="inline-controls">
            <label>Currency</label>
            <select
              value={currency}
              onChange={(e) => updateFinance((f) => ({ ...f, preferences: { ...f.preferences, currency: e.target.value } }))}
            >
              {currencies.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button className="ghost" onClick={refreshAllSnapshotPrices}>Refresh snapshots</button>
          </div>
          {message && <p className="message">{message}</p>}
        </header>

        {activeSection === 'dashboard' && (
          <section className="card">
            <div className="grid metrics">
              <Metric title="Net Worth" value={formatMoney(dashboard.netWorth, currency)} />
              <Metric title="Monthly Income" value={formatMoney(dashboard.income, currency)} />
              <Metric title="Monthly Expenses" value={formatMoney(dashboard.expenses, currency)} />
              <Metric title="Savings Rate" value={`${Math.max(0, dashboard.savingsRate).toFixed(1)}%`} />
            </div>
            <div className="grid two">
              <Panel title="Recent Transactions" rows={dashboard.recent.map((t) => `${t.date} • ${t.description} • ${t.type === 'expense' ? '-' : '+'}${formatMoney(t.amount, currency)}`)} />
              <Panel title="Expense Breakdown" rows={dashboard.categorySpend.map(([k, v]) => `${k}: ${formatMoney(v, currency)}`)} />
            </div>
          </section>
        )}

        {activeSection === 'transactions' && (
          <section className="card">
            <h3>Transactions</h3>
            <form className="grid" onSubmit={async (e) => {
              e.preventDefault();
              await updateFinance((f) => ({ ...f, transactions: [{ ...transaction, id: crypto.randomUUID(), amount: Number(transaction.amount) }, ...f.transactions] }));
              setTransaction({ date: '', description: '', amount: '', type: 'expense', category: categories[0] });
            }}>
              <input type="date" value={transaction.date} required onChange={(e) => setTransaction((v) => ({ ...v, date: e.target.value }))} />
              <input placeholder="Description" value={transaction.description} required onChange={(e) => setTransaction((v) => ({ ...v, description: e.target.value }))} />
              <input type="number" step="0.01" placeholder="Amount" value={transaction.amount} required onChange={(e) => setTransaction((v) => ({ ...v, amount: e.target.value }))} />
              <select value={transaction.type} onChange={(e) => setTransaction((v) => ({ ...v, type: e.target.value }))}><option value="expense">Expense</option><option value="income">Income</option></select>
              <select value={transaction.category} onChange={(e) => setTransaction((v) => ({ ...v, category: e.target.value }))}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
              <button className="primary">Add</button>
            </form>
            <div className="list">{finance.transactions.map((t) => <div className="row" key={t.id}><span>{t.date} • {t.description} • {t.category}</span><div><strong>{t.type === 'expense' ? '-' : '+'}{formatMoney(t.amount, currency)}</strong><button className="ghost small" onClick={() => updateFinance((f) => ({ ...f, transactions: f.transactions.filter((x) => x.id !== t.id) }))}>Delete</button></div></div>)}</div>
          </section>
        )}

        {activeSection === 'budgets' && (
          <section className="card">
            <h3>Budgets</h3>
            <form className="grid" onSubmit={async (e) => { e.preventDefault(); await updateFinance((f) => ({ ...f, budgets: { ...f.budgets, [budget.category]: Number(budget.limit) } })); setBudget({ category: categories[0], limit: '' }); }}>
              <select value={budget.category} onChange={(e) => setBudget((v) => ({ ...v, category: e.target.value }))}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
              <input type="number" step="0.01" value={budget.limit} required onChange={(e) => setBudget((v) => ({ ...v, limit: e.target.value }))} placeholder="Monthly limit" />
              <button className="primary">Save budget</button>
            </form>
            <div className="list">{Object.entries(finance.budgets).map(([cat, limit]) => {
              const spent = finance.transactions.filter((t) => t.type === 'expense' && t.category === cat).reduce((sum, t) => sum + t.amount, 0);
              return <div className="row" key={cat}><span>{cat}: {formatMoney(spent, currency)} / {formatMoney(limit, currency)}</span><button className="ghost small" onClick={() => updateFinance((f) => { const next = { ...f.budgets }; delete next[cat]; return { ...f, budgets: next }; })}>Remove</button></div>;
            })}</div>
          </section>
        )}

        {activeSection === 'goals' && (
          <section className="card">
            <h3>Goals</h3>
            <form className="grid" onSubmit={async (e) => { e.preventDefault(); await updateFinance((f) => ({ ...f, goals: [...f.goals, { id: crypto.randomUUID(), title: goal.title, target: Number(goal.target), current: Number(goal.current) }] })); setGoal({ title: '', target: '', current: '' }); }}>
              <input placeholder="Goal name" value={goal.title} required onChange={(e) => setGoal((v) => ({ ...v, title: e.target.value }))} />
              <input type="number" step="0.01" placeholder="Target" value={goal.target} required onChange={(e) => setGoal((v) => ({ ...v, target: e.target.value }))} />
              <input type="number" step="0.01" placeholder="Current" value={goal.current} required onChange={(e) => setGoal((v) => ({ ...v, current: e.target.value }))} />
              <button className="primary">Add goal</button>
            </form>
            <div className="list">{finance.goals.map((g) => <div className="row" key={g.id}><span>{g.title}: {formatMoney(g.current, currency)} / {formatMoney(g.target, currency)}</span><button className="ghost small" onClick={() => updateFinance((f) => ({ ...f, goals: f.goals.filter((x) => x.id !== g.id) }))}>Delete</button></div>)}</div>
          </section>
        )}

        {activeSection === 'investments' && (
          <section className="card">
            <h3>Investments</h3>
            <form className="grid" onSubmit={async (e) => { e.preventDefault(); const payload = { id: crypto.randomUUID(), ticker: investment.ticker.toUpperCase(), qty: Number(investment.qty), cost: Number(investment.cost), price: Number(investment.price), lastSnapshotAt: new Date().toISOString() }; await updateFinance((f) => { const exists = f.investments.find((i) => i.ticker === payload.ticker); return exists ? { ...f, investments: f.investments.map((i) => i.ticker === payload.ticker ? { ...i, ...payload } : i) } : { ...f, investments: [...f.investments, payload] }; }); setInvestment({ ticker: '', qty: '', cost: '', price: '' }); }}>
              <input placeholder="Ticker" value={investment.ticker} required onChange={(e) => setInvestment((v) => ({ ...v, ticker: e.target.value.toUpperCase() }))} />
              <input type="number" step="0.0001" placeholder="Quantity" value={investment.qty} required onChange={(e) => setInvestment((v) => ({ ...v, qty: e.target.value }))} />
              <input type="number" step="0.01" placeholder="Avg cost" value={investment.cost} required onChange={(e) => setInvestment((v) => ({ ...v, cost: e.target.value }))} />
              <input type="number" step="0.01" placeholder="Current price" value={investment.price} required onChange={(e) => setInvestment((v) => ({ ...v, price: e.target.value }))} />
              <button type="button" className="ghost" onClick={autofillPrice}>Autofill price</button>
              <button className="primary">Save</button>
            </form>
            <div className="list">{finance.investments.map((i) => {
              const pl = (i.price - i.cost) * i.qty;
              return <div className="row" key={i.id}><span>{i.ticker} • Qty {i.qty} • Value {formatMoney(i.qty * i.price, currency)} • P/L <b className={pl >= 0 ? 'profit' : 'loss'}>{formatMoney(pl, currency)}</b> • Updated {i.lastSnapshotAt ? new Date(i.lastSnapshotAt).toLocaleString() : '—'}</span><button className="ghost small" onClick={() => updateFinance((f) => ({ ...f, investments: f.investments.filter((x) => x.id !== i.id) }))}>Delete</button></div>;
            })}</div>
          </section>
        )}

        {activeSection === 'import' && (
          <section className="card">
            <h3>Brokerage Import</h3>
            <p className="muted">Upload CSV exported from brokerage apps. Common headers are auto-normalized.</p>
            <input type="file" accept=".csv" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              const rows = normalizeImportedRows(parseCsvRows(text));
              await updateFinance((f) => ({ ...f, transactions: [...rows, ...f.transactions] }));
              setMessage(`Imported ${rows.length} transactions successfully.`);
            }} />
          </section>
        )}

        {activeSection === 'settings' && (
          <section className="card">
            <h3>Settings & Recurring</h3>
            <div className="grid">
              <label>Snapshot refresh interval (ms)</label>
              <input type="number" min="5000" step="1000" value={finance.preferences.refreshIntervalMs} onChange={(e) => updateFinance((f) => ({ ...f, preferences: { ...f.preferences, refreshIntervalMs: Number(e.target.value) } }))} />
            </div>
            <form className="grid" onSubmit={async (e) => { e.preventDefault(); await updateFinance((f) => ({ ...f, recurring: [...f.recurring, { ...recurring, id: crypto.randomUUID(), amount: Number(recurring.amount), lastApplied: null }] })); setRecurring({ description: '', amount: '', type: 'expense', category: categories[0], frequency: 'monthly' }); }}>
              <input placeholder="Description" value={recurring.description} required onChange={(e) => setRecurring((v) => ({ ...v, description: e.target.value }))} />
              <input type="number" step="0.01" placeholder="Amount" value={recurring.amount} required onChange={(e) => setRecurring((v) => ({ ...v, amount: e.target.value }))} />
              <select value={recurring.type} onChange={(e) => setRecurring((v) => ({ ...v, type: e.target.value }))}><option value="expense">Expense</option><option value="income">Income</option></select>
              <select value={recurring.category} onChange={(e) => setRecurring((v) => ({ ...v, category: e.target.value }))}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
              <select value={recurring.frequency} onChange={(e) => setRecurring((v) => ({ ...v, frequency: e.target.value }))}><option value="monthly">Monthly</option><option value="weekly">Weekly</option></select>
              <button className="primary">Add recurring</button>
            </form>
            <button className="ghost" onClick={async () => {
              const now = new Date();
              const today = now.toISOString().slice(0, 10);
              await updateFinance((f) => {
                const additions = [];
                const recurringUpdated = f.recurring.map((r) => {
                  const diff = r.lastApplied ? Math.floor((now - new Date(r.lastApplied)) / (1000 * 60 * 60 * 24)) : 999;
                  const due = r.frequency === 'weekly' ? diff >= 7 : diff >= 30;
                  if (!due) return r;
                  additions.push({ id: crypto.randomUUID(), date: today, description: `[Recurring] ${r.description}`, amount: r.amount, type: r.type, category: r.category });
                  return { ...r, lastApplied: today };
                });
                return { ...f, recurring: recurringUpdated, transactions: [...additions, ...f.transactions] };
              });
            }}>Apply due recurring entries</button>
          </section>
        )}
      </main>
    </div>
  );
}

function Metric({ title, value }) {
  return <article className="card metric"><small>{title}</small><h4>{value}</h4></article>;
}

function Panel({ title, rows }) {
  return <article className="card"><h4>{title}</h4><div className="list">{rows.length ? rows.map((row, i) => <div className="row" key={`${row}-${i}`}>{row}</div>) : <div className="row">No data available yet.</div>}</div></article>;
}
