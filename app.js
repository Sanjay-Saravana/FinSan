const STORAGE_KEY = "finsan_users_v1";
const SESSION_KEY = "finsan_session_v1";

const categories = ["Housing", "Food", "Transport", "Utilities", "Healthcare", "Entertainment", "Investments", "Salary", "Freelance", "Other"];

let authMode = "signin";
let currentUser = null;
let users = loadUsers();

const els = {
  authSection: byId("authSection"),
  appSection: byId("appSection"),
  authForm: byId("authForm"),
  authTitle: byId("authTitle"),
  authSubmit: byId("authSubmit"),
  authMessage: byId("authMessage"),
  toggleAuthMode: byId("toggleAuthMode"),
  signupOnly: byId("signupOnly"),
  authEmail: byId("authEmail"),
  authPassword: byId("authPassword"),
  authName: byId("authName"),
  welcomeTitle: byId("welcomeTitle"),
  welcomeSubtitle: byId("welcomeSubtitle"),
  logoutBtn: byId("logoutBtn"),
};

populateCategorySelects();
bindEvents();
autoLogin();

function byId(id) { return document.getElementById(id); }
function saveUsers() { localStorage.setItem(STORAGE_KEY, JSON.stringify(users)); }
function loadUsers() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
function money(v) { return `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function createUser(email, password, name) {
  return {
    id: crypto.randomUUID(),
    email,
    password,
    name: name || email.split("@")[0],
    transactions: [],
    budgets: {},
    goals: [],
    investments: [],
    recurring: [],
  };
}

function getData() {
  return currentUser || {};
}

function bindEvents() {
  els.toggleAuthMode.addEventListener("click", () => {
    authMode = authMode === "signin" ? "signup" : "signin";
    els.authTitle.textContent = authMode === "signin" ? "Sign in" : "Create account";
    els.authSubmit.textContent = authMode === "signin" ? "Sign in" : "Sign up";
    els.toggleAuthMode.textContent = authMode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in";
    els.signupOnly.classList.toggle("hidden", authMode === "signin");
    els.authMessage.textContent = "";
  });

  els.authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = els.authEmail.value.trim().toLowerCase();
    const password = els.authPassword.value;
    const name = els.authName.value.trim();

    if (authMode === "signup") {
      if (users.some((u) => u.email === email)) {
        els.authMessage.textContent = "Email already registered.";
        return;
      }
      const user = createUser(email, password, name);
      users.push(user);
      saveUsers();
      login(user);
      return;
    }

    const user = users.find((u) => u.email === email && u.password === password);
    if (!user) {
      els.authMessage.textContent = "Invalid credentials.";
      return;
    }
    login(user);
  });

  els.logoutBtn.addEventListener("click", logout);

  byId("menu").addEventListener("click", (e) => {
    if (!e.target.classList.contains("menu-item")) return;
    document.querySelectorAll(".menu-item").forEach((btn) => btn.classList.remove("active"));
    e.target.classList.add("active");
    const target = e.target.dataset.section;
    document.querySelectorAll("#appSection > .section-card").forEach((s) => s.classList.add("hidden"));
    byId(target).classList.remove("hidden");
  });

  byId("transactionForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = getData();
    data.transactions.unshift({
      id: crypto.randomUUID(),
      date: byId("tDate").value,
      description: byId("tDescription").value.trim(),
      amount: Number(byId("tAmount").value),
      type: byId("tType").value,
      category: byId("tCategory").value,
    });
    persistAndRender();
    e.target.reset();
  });

  byId("budgetForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const cat = byId("bCategory").value;
    const limit = Number(byId("bLimit").value);
    getData().budgets[cat] = limit;
    persistAndRender();
    e.target.reset();
  });

  byId("goalForm").addEventListener("submit", (e) => {
    e.preventDefault();
    getData().goals.push({ id: crypto.randomUUID(), title: byId("gTitle").value.trim(), target: Number(byId("gTarget").value), current: Number(byId("gCurrent").value) });
    persistAndRender();
    e.target.reset();
  });

  byId("investmentForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const ticker = byId("iTicker").value.trim().toUpperCase();
    const qty = Number(byId("iQuantity").value);
    const cost = Number(byId("iCost").value);
    const price = Number(byId("iPrice").value);
    const investments = getData().investments;
    const found = investments.find((i) => i.ticker === ticker);
    if (found) Object.assign(found, { qty, cost, price });
    else investments.push({ id: crypto.randomUUID(), ticker, qty, cost, price });
    persistAndRender();
    e.target.reset();
  });

  byId("recurringForm").addEventListener("submit", (e) => {
    e.preventDefault();
    getData().recurring.push({
      id: crypto.randomUUID(),
      description: byId("rDescription").value.trim(),
      amount: Number(byId("rAmount").value),
      type: byId("rType").value,
      category: byId("rCategory").value,
      frequency: byId("rFrequency").value,
      lastApplied: null,
    });
    persistAndRender();
    e.target.reset();
  });

  byId("applyRecurringBtn").addEventListener("click", () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    getData().recurring.forEach((r) => {
      if (isRecurringDue(r, today)) {
        getData().transactions.unshift({ id: crypto.randomUUID(), date: dateStr, description: `[Recurring] ${r.description}`, amount: r.amount, type: r.type, category: r.category });
        r.lastApplied = dateStr;
      }
    });
    persistAndRender();
  });

  byId("importCsvBtn").addEventListener("click", importCSV);
}

function isRecurringDue(recurring, today) {
  if (!recurring.lastApplied) return true;
  const last = new Date(recurring.lastApplied);
  const diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));
  return recurring.frequency === "weekly" ? diffDays >= 7 : diffDays >= 30;
}

function importCSV() {
  const file = byId("csvFile").files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    const rows = csvToRows(text);
    const normalized = normalizeRows(rows);
    getData().transactions.unshift(...normalized);
    byId("importResult").textContent = `Imported ${normalized.length} transactions.`;
    persistAndRender();
  };
  reader.readAsText(file);
}

function csvToRows(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(",").map((h) => h.trim().toLowerCase());
  return lines.map((line) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const obj = {};
    headers.forEach((h, i) => obj[h] = cells[i] || "");
    return obj;
  });
}

function normalizeRows(rows) {
  return rows.map((r) => {
    const date = r.date || r.trade_date || r.transaction_date || new Date().toISOString().slice(0, 10);
    const description = r.description || r.symbol || r.details || "Brokerage Import";
    const amount = Number((r.amount || r.net_amount || r.total || "0").replace(/[^\d.-]/g, ""));
    const typeRaw = (r.type || r.transaction_type || "").toLowerCase();
    const type = typeRaw.includes("buy") || amount < 0 || typeRaw.includes("debit") ? "expense" : "income";
    const category = r.category || (description.toLowerCase().includes("dividend") ? "Investments" : "Other");
    return {
      id: crypto.randomUUID(),
      date,
      description,
      amount: Math.abs(amount),
      type,
      category,
    };
  });
}

function login(user) {
  currentUser = user;
  localStorage.setItem(SESSION_KEY, user.id);
  els.authSection.classList.add("hidden");
  els.appSection.classList.remove("hidden");
  els.logoutBtn.classList.remove("hidden");
  els.welcomeTitle.textContent = `Hi, ${user.name}`;
  els.welcomeSubtitle.textContent = "Your money at a glance";
  renderAll();
}

function autoLogin() {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return;
  const user = users.find((u) => u.id === id);
  if (user) login(user);
}

function logout() {
  currentUser = null;
  localStorage.removeItem(SESSION_KEY);
  els.authSection.classList.remove("hidden");
  els.appSection.classList.add("hidden");
  els.logoutBtn.classList.add("hidden");
  els.welcomeTitle.textContent = "Welcome";
  els.welcomeSubtitle.textContent = "Sign in to continue";
}

function persistAndRender() {
  users = users.map((u) => u.id === currentUser.id ? currentUser : u);
  saveUsers();
  renderAll();
}

function renderAll() {
  if (!currentUser) return;
  const data = getData();
  const month = new Date().toISOString().slice(0, 7);
  const monthTx = data.transactions.filter((t) => (t.date || "").startsWith(month));

  const income = monthTx.filter((t) => t.type === "income").reduce((a, b) => a + b.amount, 0);
  const expenses = monthTx.filter((t) => t.type === "expense").reduce((a, b) => a + b.amount, 0);
  const investmentsValue = data.investments.reduce((sum, i) => sum + i.qty * i.price, 0);
  const cashflow = data.transactions.reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);

  byId("metricIncome").textContent = money(income);
  byId("metricExpenses").textContent = money(expenses);
  byId("metricNetWorth").textContent = money(cashflow + investmentsValue);
  byId("metricSavingRate").textContent = income ? `${Math.max(0, ((income - expenses) / income * 100)).toFixed(1)}%` : "0%";

  renderTransactions();
  renderBudgets();
  renderGoals();
  renderInvestments();
  renderRecurring();
  renderDashboardLists();
}

function renderTransactions() {
  const body = byId("transactionTable");
  body.innerHTML = "";
  getData().transactions.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${t.date}</td><td>${t.description}</td><td>${t.category}</td><td>${t.type}</td><td>${money(t.amount)}</td><td><button data-id="${t.id}" class="ghost">Delete</button></td>`;
    tr.querySelector("button").onclick = () => {
      currentUser.transactions = currentUser.transactions.filter((x) => x.id !== t.id);
      persistAndRender();
    };
    body.appendChild(tr);
  });
}

function renderBudgets() {
  const list = byId("budgetList");
  list.innerHTML = "";
  Object.entries(getData().budgets).forEach(([cat, limit]) => {
    const spent = getData().transactions.filter((t) => t.type === "expense" && t.category === cat).reduce((s, t) => s + t.amount, 0);
    const pct = Math.min(100, (spent / limit) * 100 || 0);
    const li = document.createElement("li");
    li.innerHTML = `<div><strong>${cat}</strong> ${money(spent)} / ${money(limit)}<div class="progress"><span style="width:${pct}%"></span></div></div><button class="ghost">Remove</button>`;
    li.querySelector("button").onclick = () => { delete currentUser.budgets[cat]; persistAndRender(); };
    list.appendChild(li);
  });
}

function renderGoals() {
  const list = byId("goalList");
  list.innerHTML = "";
  getData().goals.forEach((g) => {
    const pct = Math.min(100, (g.current / g.target) * 100 || 0);
    const li = document.createElement("li");
    li.innerHTML = `<div><strong>${g.title}</strong> ${money(g.current)} / ${money(g.target)}<div class="progress"><span style="width:${pct}%"></span></div></div><button class="ghost">Delete</button>`;
    li.querySelector("button").onclick = () => { currentUser.goals = currentUser.goals.filter((x) => x.id !== g.id); persistAndRender(); };
    list.appendChild(li);
  });
}

function renderInvestments() {
  const body = byId("investmentTable");
  body.innerHTML = "";
  getData().investments.forEach((i) => {
    const value = i.qty * i.price;
    const pl = (i.price - i.cost) * i.qty;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i.ticker}</td><td>${i.qty}</td><td>${money(i.cost)}</td><td>${money(i.price)}</td><td>${money(value)}</td><td style="color:${pl >= 0 ? "var(--success)" : "var(--danger)"}">${money(pl)}</td><td><button class="ghost">Delete</button></td>`;
    tr.querySelector("button").onclick = () => { currentUser.investments = currentUser.investments.filter((x) => x.id !== i.id); persistAndRender(); };
    body.appendChild(tr);
  });
}

function renderRecurring() {
  const list = byId("recurringList");
  list.innerHTML = "";
  getData().recurring.forEach((r) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${r.description} • ${r.frequency} • ${money(r.amount)}</span><button class="ghost">Delete</button>`;
    li.querySelector("button").onclick = () => { currentUser.recurring = currentUser.recurring.filter((x) => x.id !== r.id); persistAndRender(); };
    list.appendChild(li);
  });
}

function renderDashboardLists() {
  const recent = byId("recentTransactions");
  recent.innerHTML = "";
  getData().transactions.slice(0, 5).forEach((t) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${t.date} • ${t.description}</span><strong>${t.type === "expense" ? "-" : "+"}${money(t.amount)}</strong>`;
    recent.appendChild(li);
  });

  const breakdown = byId("categoryBreakdown");
  breakdown.innerHTML = "";
  const map = {};
  getData().transactions.filter((t) => t.type === "expense").forEach((t) => map[t.category] = (map[t.category] || 0) + t.amount);
  Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0, 6).forEach(([cat, amount]) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${cat}</span><strong>${money(amount)}</strong>`;
    breakdown.appendChild(li);
  });
}

function populateCategorySelects() {
  ["tCategory", "bCategory", "rCategory"].forEach((id) => {
    const select = byId(id);
    categories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
  });
}
