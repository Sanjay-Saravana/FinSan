'use client';

import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'finsan_users_v2';
const SESSION_KEY = 'finsan_session_v2';
const categories = ['Housing', 'Food', 'Transport', 'Utilities', 'Healthcare', 'Entertainment', 'Investments', 'Salary', 'Freelance', 'Other'];
const sections = ['dashboard', 'transactions', 'budgets', 'goals', 'investments', 'import', 'settings'];

const money = (value) => `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const emptyUserData = () => ({
  transactions: [],
  budgets: {},
  goals: [],
  investments: [],
  recurring: []
});

const parseCSV = (text) => {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((x) => x.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((x) => x.trim().replace(/^"|"$/g, ''));
    return headers.reduce((acc, key, i) => ({ ...acc, [key]: cells[i] || '' }), {});
  });
};

const normalizeImportRows = (rows) => rows.map((row) => {
  const amount = Number((row.amount || row.net_amount || row.total || '0').replace(/[^\d.-]/g, ''));
  const typeRaw = `${row.type || row.transaction_type || ''}`.toLowerCase();
  return {
    id: crypto.randomUUID(),
    date: row.date || row.trade_date || row.transaction_date || new Date().toISOString().slice(0, 10),
    description: row.description || row.symbol || row.details || 'Brokerage import',
    amount: Math.abs(amount),
    type: typeRaw.includes('buy') || typeRaw.includes('debit') || amount < 0 ? 'expense' : 'income',
    category: row.category || 'Other'
  };
});

export default function FinanceTracker() {
  const [users, setUsers] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [authMode, setAuthMode] = useState('signin');
  const [activeSection, setActiveSection] = useState('dashboard');
  const [auth, setAuth] = useState({ email: '', password: '', name: '' });
  const [message, setMessage] = useState('');

  const [transaction, setTransaction] = useState({ date: '', description: '', amount: '', type: 'expense', category: categories[0] });
  const [budget, setBudget] = useState({ category: categories[0], limit: '' });
  const [goal, setGoal] = useState({ title: '', target: '', current: '' });
  const [investment, setInvestment] = useState({ ticker: '', qty: '', cost: '', price: '' });
  const [recurring, setRecurring] = useState({ description: '', amount: '', type: 'expense', category: categories[0], frequency: 'monthly' });

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const loaded = raw ? JSON.parse(raw) : [];
    setUsers(loaded);
    const session = localStorage.getItem(SESSION_KEY);
    if (session && loaded.some((u) => u.id === session)) setCurrentId(session);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }, [users]);

  const currentUser = useMemo(() => users.find((u) => u.id === currentId) || null, [users, currentId]);

  const updateCurrentUser = (updater) => {
    setUsers((prev) => prev.map((u) => (u.id === currentId ? updater(u) : u)));
  };

  const dashboard = useMemo(() => {
    const data = currentUser || emptyUserData();
    const month = new Date().toISOString().slice(0, 7);
    const monthTx = data.transactions.filter((t) => t.date?.startsWith(month));
    const income = monthTx.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = monthTx.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const cashflow = data.transactions.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
    const portfolio = data.investments.reduce((sum, i) => sum + i.qty * i.price, 0);
    const spendingByCategory = data.transactions
      .filter((t) => t.type === 'expense')
      .reduce((acc, t) => ({ ...acc, [t.category]: (acc[t.category] || 0) + t.amount }), {});

    return {
      income,
      expenses,
      netWorth: cashflow + portfolio,
      savingRate: income ? ((income - expenses) / income) * 100 : 0,
      recent: data.transactions.slice(0, 5),
      categoryBreakdown: Object.entries(spendingByCategory).sort((a, b) => b[1] - a[1]).slice(0, 6)
    };
  }, [currentUser]);

  const submitAuth = (e) => {
    e.preventDefault();
    const email = auth.email.trim().toLowerCase();
    if (!email || !auth.password) return;

    if (authMode === 'signup') {
      if (users.some((u) => u.email === email)) {
        setMessage('Email already in use.');
        return;
      }
      const user = { id: crypto.randomUUID(), email, password: auth.password, name: auth.name || email.split('@')[0], ...emptyUserData() };
      setUsers((prev) => [...prev, user]);
      localStorage.setItem(SESSION_KEY, user.id);
      setCurrentId(user.id);
      setMessage('');
      return;
    }

    const existing = users.find((u) => u.email === email && u.password === auth.password);
    if (!existing) {
      setMessage('Invalid credentials.');
      return;
    }
    localStorage.setItem(SESSION_KEY, existing.id);
    setCurrentId(existing.id);
    setMessage('');
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setCurrentId(null);
    setActiveSection('dashboard');
  };

  const addTransaction = (e) => {
    e.preventDefault();
    updateCurrentUser((u) => ({ ...u, transactions: [{ ...transaction, id: crypto.randomUUID(), amount: Number(transaction.amount) }, ...u.transactions] }));
    setTransaction({ date: '', description: '', amount: '', type: 'expense', category: categories[0] });
  };

  const importCSVFile = async (file) => {
    const text = await file.text();
    const imported = normalizeImportRows(parseCSV(text));
    updateCurrentUser((u) => ({ ...u, transactions: [...imported, ...u.transactions] }));
    setMessage(`Imported ${imported.length} rows.`);
    setActiveSection('transactions');
  };

  if (!currentUser) {
    return (
      <main className="auth-wrap">
        <form className="card auth-card" onSubmit={submitAuth}>
          <h1>FinSan</h1>
          <p className="muted">Modern finance tracker in Next.js</p>
          <input type="email" placeholder="Email" required value={auth.email} onChange={(e) => setAuth((v) => ({ ...v, email: e.target.value }))} />
          <input type="password" placeholder="Password" required minLength={6} value={auth.password} onChange={(e) => setAuth((v) => ({ ...v, password: e.target.value }))} />
          {authMode === 'signup' && <input type="text" placeholder="Full Name" value={auth.name} onChange={(e) => setAuth((v) => ({ ...v, name: e.target.value }))} />}
          <button className="primary" type="submit">{authMode === 'signup' ? 'Sign up' : 'Sign in'}</button>
          <button type="button" className="link" onClick={() => setAuthMode((m) => (m === 'signup' ? 'signin' : 'signup'))}>
            {authMode === 'signup' ? 'Have an account? Sign in' : 'Need an account? Sign up'}
          </button>
          {message && <p className="message">{message}</p>}
        </form>
      </main>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar card">
        <h2>FinSan</h2>
        <p className="muted">Hi, {currentUser.name}</p>
        <nav>
          {sections.map((s) => (
            <button key={s} className={`menu ${activeSection === s ? 'active' : ''}`} onClick={() => setActiveSection(s)}>{s[0].toUpperCase() + s.slice(1)}</button>
          ))}
        </nav>
        <button className="ghost" onClick={logout}>Logout</button>
      </aside>

      <main className="content">
        {activeSection === 'dashboard' && (
          <section className="card">
            <h3>Dashboard</h3>
            <div className="grid metrics">
              <Metric title="Net Worth" value={money(dashboard.netWorth)} />
              <Metric title="Monthly Income" value={money(dashboard.income)} />
              <Metric title="Monthly Expenses" value={money(dashboard.expenses)} />
              <Metric title="Saving Rate" value={`${Math.max(0, dashboard.savingRate).toFixed(1)}%`} />
            </div>
            <div className="grid two">
              <PanelList title="Recent Transactions" items={dashboard.recent.map((t) => `${t.date} • ${t.description} • ${t.type === 'expense' ? '-' : '+'}${money(t.amount)}`)} />
              <PanelList title="Expense Breakdown" items={dashboard.categoryBreakdown.map(([k, v]) => `${k}: ${money(v)}`)} />
            </div>
          </section>
        )}

        {activeSection === 'transactions' && (
          <section className="card">
            <h3>Transactions</h3>
            <form className="grid" onSubmit={addTransaction}>
              <input type="date" required value={transaction.date} onChange={(e) => setTransaction((v) => ({ ...v, date: e.target.value }))} />
              <input placeholder="Description" required value={transaction.description} onChange={(e) => setTransaction((v) => ({ ...v, description: e.target.value }))} />
              <input type="number" step="0.01" required placeholder="Amount" value={transaction.amount} onChange={(e) => setTransaction((v) => ({ ...v, amount: e.target.value }))} />
              <select value={transaction.type} onChange={(e) => setTransaction((v) => ({ ...v, type: e.target.value }))}><option value="expense">Expense</option><option value="income">Income</option></select>
              <select value={transaction.category} onChange={(e) => setTransaction((v) => ({ ...v, category: e.target.value }))}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
              <button className="primary" type="submit">Add</button>
            </form>
            <div className="list">
              {currentUser.transactions.map((t) => (
                <div key={t.id} className="row">
                  <span>{t.date} • {t.description} • {t.category}</span>
                  <div>
                    <strong>{t.type === 'expense' ? '-' : '+'}{money(t.amount)}</strong>
                    <button className="ghost small" onClick={() => updateCurrentUser((u) => ({ ...u, transactions: u.transactions.filter((x) => x.id !== t.id) }))}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeSection === 'budgets' && (
          <section className="card">
            <h3>Budgets</h3>
            <form className="grid" onSubmit={(e) => { e.preventDefault(); updateCurrentUser((u) => ({ ...u, budgets: { ...u.budgets, [budget.category]: Number(budget.limit) } })); setBudget({ category: categories[0], limit: '' }); }}>
              <select value={budget.category} onChange={(e) => setBudget((v) => ({ ...v, category: e.target.value }))}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
              <input type="number" step="0.01" required placeholder="Monthly limit" value={budget.limit} onChange={(e) => setBudget((v) => ({ ...v, limit: e.target.value }))} />
              <button className="primary" type="submit">Save Budget</button>
            </form>
            <div className="list">
              {Object.entries(currentUser.budgets).map(([cat, limit]) => {
                const spent = currentUser.transactions.filter((t) => t.type === 'expense' && t.category === cat).reduce((sum, t) => sum + t.amount, 0);
                const pct = Math.min(100, (spent / limit) * 100 || 0);
                return <div className="row" key={cat}><span>{cat}: {money(spent)} / {money(limit)} ({pct.toFixed(1)}%)</span><button className="ghost small" onClick={() => updateCurrentUser((u) => { const next = { ...u.budgets }; delete next[cat]; return { ...u, budgets: next }; })}>Remove</button></div>;
              })}
            </div>
          </section>
        )}

        {activeSection === 'goals' && (
          <section className="card">
            <h3>Goals</h3>
            <form className="grid" onSubmit={(e) => { e.preventDefault(); updateCurrentUser((u) => ({ ...u, goals: [...u.goals, { id: crypto.randomUUID(), title: goal.title, target: Number(goal.target), current: Number(goal.current) }] })); setGoal({ title: '', target: '', current: '' }); }}>
              <input required placeholder="Goal" value={goal.title} onChange={(e) => setGoal((v) => ({ ...v, title: e.target.value }))} />
              <input required type="number" step="0.01" placeholder="Target" value={goal.target} onChange={(e) => setGoal((v) => ({ ...v, target: e.target.value }))} />
              <input required type="number" step="0.01" placeholder="Current" value={goal.current} onChange={(e) => setGoal((v) => ({ ...v, current: e.target.value }))} />
              <button className="primary">Add Goal</button>
            </form>
            <div className="list">{currentUser.goals.map((g) => <div className="row" key={g.id}><span>{g.title}: {money(g.current)} / {money(g.target)}</span><button className="ghost small" onClick={() => updateCurrentUser((u) => ({ ...u, goals: u.goals.filter((x) => x.id !== g.id) }))}>Delete</button></div>)}</div>
          </section>
        )}

        {activeSection === 'investments' && (
          <section className="card">
            <h3>Investments</h3>
            <form className="grid" onSubmit={(e) => { e.preventDefault(); updateCurrentUser((u) => { const found = u.investments.find((i) => i.ticker === investment.ticker.toUpperCase()); const payload = { id: crypto.randomUUID(), ticker: investment.ticker.toUpperCase(), qty: Number(investment.qty), cost: Number(investment.cost), price: Number(investment.price) }; return found ? { ...u, investments: u.investments.map((i) => (i.ticker === payload.ticker ? { ...i, ...payload } : i)) } : { ...u, investments: [...u.investments, payload] }; }); setInvestment({ ticker: '', qty: '', cost: '', price: '' }); }}>
              <input required placeholder="Ticker" value={investment.ticker} onChange={(e) => setInvestment((v) => ({ ...v, ticker: e.target.value }))} />
              <input required type="number" step="0.0001" placeholder="Qty" value={investment.qty} onChange={(e) => setInvestment((v) => ({ ...v, qty: e.target.value }))} />
              <input required type="number" step="0.01" placeholder="Avg Cost" value={investment.cost} onChange={(e) => setInvestment((v) => ({ ...v, cost: e.target.value }))} />
              <input required type="number" step="0.01" placeholder="Current Price" value={investment.price} onChange={(e) => setInvestment((v) => ({ ...v, price: e.target.value }))} />
              <button className="primary">Save</button>
            </form>
            <div className="list">{currentUser.investments.map((i) => { const pl = (i.price - i.cost) * i.qty; return <div className="row" key={i.id}><span>{i.ticker} • Qty {i.qty} • Value {money(i.qty * i.price)} • P/L <b className={pl >= 0 ? 'profit' : 'loss'}>{money(pl)}</b></span><button className="ghost small" onClick={() => updateCurrentUser((u) => ({ ...u, investments: u.investments.filter((x) => x.id !== i.id) }))}>Delete</button></div>; })}</div>
          </section>
        )}

        {activeSection === 'import' && (
          <section className="card">
            <h3>Brokerage Import</h3>
            <p className="muted">Supports common brokerage exports: date/description/amount or trade_date/symbol/net_amount.</p>
            <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && importCSVFile(e.target.files[0])} />
          </section>
        )}

        {activeSection === 'settings' && (
          <section className="card">
            <h3>Recurring Transactions</h3>
            <form className="grid" onSubmit={(e) => { e.preventDefault(); updateCurrentUser((u) => ({ ...u, recurring: [...u.recurring, { ...recurring, id: crypto.randomUUID(), amount: Number(recurring.amount), lastApplied: null }] })); setRecurring({ description: '', amount: '', type: 'expense', category: categories[0], frequency: 'monthly' }); }}>
              <input required placeholder="Description" value={recurring.description} onChange={(e) => setRecurring((v) => ({ ...v, description: e.target.value }))} />
              <input required type="number" step="0.01" placeholder="Amount" value={recurring.amount} onChange={(e) => setRecurring((v) => ({ ...v, amount: e.target.value }))} />
              <select value={recurring.type} onChange={(e) => setRecurring((v) => ({ ...v, type: e.target.value }))}><option value="expense">Expense</option><option value="income">Income</option></select>
              <select value={recurring.category} onChange={(e) => setRecurring((v) => ({ ...v, category: e.target.value }))}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
              <select value={recurring.frequency} onChange={(e) => setRecurring((v) => ({ ...v, frequency: e.target.value }))}><option value="monthly">Monthly</option><option value="weekly">Weekly</option></select>
              <button className="primary">Add recurring</button>
            </form>
            <button className="ghost" onClick={() => {
              const now = new Date();
              const date = now.toISOString().slice(0, 10);
              updateCurrentUser((u) => {
                const additions = [];
                const updated = u.recurring.map((r) => {
                  const diff = r.lastApplied ? Math.floor((now - new Date(r.lastApplied)) / (1000 * 60 * 60 * 24)) : 999;
                  const due = r.frequency === 'weekly' ? diff >= 7 : diff >= 30;
                  if (due) {
                    additions.push({ id: crypto.randomUUID(), date, description: `[Recurring] ${r.description}`, amount: r.amount, type: r.type, category: r.category });
                    return { ...r, lastApplied: date };
                  }
                  return r;
                });
                return { ...u, recurring: updated, transactions: [...additions, ...u.transactions] };
              });
            }}>Apply due recurring entries</button>
            <div className="list">{currentUser.recurring.map((r) => <div className="row" key={r.id}><span>{r.description} • {r.frequency} • {money(r.amount)}</span><button className="ghost small" onClick={() => updateCurrentUser((u) => ({ ...u, recurring: u.recurring.filter((x) => x.id !== r.id) }))}>Delete</button></div>)}</div>
          </section>
        )}
      </main>
    </div>
  );
}

function Metric({ title, value }) {
  return <article className="card metric"><small>{title}</small><h4>{value}</h4></article>;
}

function PanelList({ title, items }) {
  return <article className="card"><h4>{title}</h4><div className="list">{items.length ? items.map((item, i) => <div className="row" key={`${item}-${i}`}>{item}</div>) : <div className="row">No data yet.</div>}</div></article>;
}
