(function (root, factory) {
  const Core = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  if (root) root.Core = Core;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const VERSION = 1;

  // ---------------- Utils ----------------
  function uid(prefix) {
    const rnd = Math.random().toString(36).slice(2, 8);
    const time = Date.now().toString(36);
    return (prefix || 'id') + '_' + time + rnd;
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function toISO(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function todayISO() { return toISO(new Date()); }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function parseISODate(str) {
    if (typeof str !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) return null;
    return d;
  }
  function parseFlexibleDate(str) {
    if (typeof str !== 'string') return null;
    const s = str.trim();
    let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
    if (m) {
      const d = new Date(+m[1], +m[2] - 1, +m[3]);
      if (d.getMonth() === +m[2] - 1 && d.getDate() === +m[3]) return toISO(d);
      return null;
    }
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
    if (m) {
      const d = new Date(+m[3], +m[2] - 1, +m[1]);
      if (d.getMonth() === +m[2] - 1 && d.getDate() === +m[1]) return toISO(d);
      return null;
    }
    return null;
  }
  function addDaysISO(iso, n) {
    const d = parseISODate(iso);
    if (!d) return null;
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  function addMonthsISO(iso, n) {
    const d = parseISODate(iso);
    if (!d) return null;
    const day = d.getDate();
    const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
    target.setDate(Math.min(day, daysInMonth(target.getFullYear(), target.getMonth())));
    return toISO(target);
  }
  function monthKeyOf(iso) { return iso.slice(0, 7); }
  function monthStartISO(key) { return key + '-01'; }
  function monthEndISO(key) {
    const y = +key.slice(0, 4), m = +key.slice(5, 7) - 1;
    return key + '-' + pad2(daysInMonth(y, m));
  }
  function yearOf(iso) { return +iso.slice(0, 4); }
  function compareISO(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function monthLabel(key) {
    const y = +key.slice(0, 4), m = +key.slice(5, 7);
    return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' }).format(new Date(y, m - 1, 1));
  }
  function fmtDate(iso) {
    if (!iso) return '';
    const d = parseISODate(iso);
    if (!d) return iso;
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  const eurFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  function fmtEUR(n) { return eurFmt.format(n || 0); }
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function parseAmount(str) {
    if (typeof str === 'number') return round2(str);
    if (typeof str !== 'string') return null;
    let s = str.trim().replace(/[\s\u00a0\u202f\u2007\u2009]/g, '');
    if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (s.startsWith('-')) { neg = true; s = s.slice(1); }
    if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
    s = s.replace(/[€$]/g, '').trim();
    if (s.includes(',') && s.includes('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, '');
    }
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    const v = parseFloat(s);
    if (isNaN(v)) return null;
    return round2(neg ? -v : v);
  }
  function normalizeLabel(s) {
    return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function stripAccents(s) {
    return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function escapeHtml(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function monthKeysBetween(fromKey, toKey) {
    const out = [];
    let cur = fromKey;
    let guard = 0;
    while (compareISO(cur, toKey) <= 0 && guard < 1200) {
      out.push(cur);
      cur = monthKeyOf(addMonthsISO(monthStartISO(cur), 1));
      guard++;
    }
    return out;
  }

  // ---------------- Defaults / model ----------------
  function defaultCategories() {
    const exp = [
      ['courses', 'Courses & alimentation', '#e67e22'],
      ['abonnements', 'Abonnements & services', '#8e44ad'],
      ['travaux', 'Travaux & entretien', '#795548'],
      ['salaires', 'Salaires & charges', '#c0392b'],
      ['loyer', 'Loyer & charges locatives', '#2c3e50'],
      ['energie', 'Énergie, eau, chauffage', '#f1c40f'],
      ['assurances', 'Assurances', '#16a085'],
      ['fournitures', 'Fournitures & petit matériel', '#3498db'],
      ['transports', 'Transports & déplacements', '#27ae60'],
      ['restauration', 'Restauration extérieure', '#d35400'],
      ['formations', 'Formations & documentation', '#9b59b6'],
      ['banque', 'Frais bancaires', '#7f8c8d'],
      ['impots', 'Impôts & taxes', '#34495e'],
      ['autre_dep', 'Autres dépenses', '#95a5a6'],
    ];
    const rev = [
      ['paiements', 'Paiements des familles', '#27ae60'],
      ['subventions', 'Subventions', '#2980b9'],
      ['dons', 'Dons', '#e91e63'],
      ['autre_rec', 'Autres recettes', '#95a5a6'],
    ];
    return exp.map(function (e) { return { id: e[0], label: e[1], type: 'expense', color: e[2] }; })
      .concat(rev.map(function (e) { return { id: e[0], label: e[1], type: 'revenue', color: e[2] }; }));
  }
  function defaultSettings(today) {
    return {
      name: 'Ma crèche parentale',
      openingBalance: 0,
      openingDate: today,
      minThreshold: 0,
      fiscalYearStartMonth: 1,
      paymentMethods: ['Virement', 'Chèque', 'Espèces', 'Carte bancaire', 'Prélèvement'],
    };
  }
  function emptyDB() {
    const today = todayISO();
    return {
      version: VERSION,
      meta: { name: 'Ma crèche parentale', createdAt: today, updatedAt: today },
      settings: defaultSettings(today),
      categories: defaultCategories(),
      families: [],
      invoices: [],
      expenses: [],
      revenues: [],
      subventions: [],
      employees: [],
      recurring: [],
      bankRefs: [],
      pointed: [],
      scenarios: [],
    };
  }
  function migrate(db) {
    if (!db || typeof db !== 'object') return null;
    const base = emptyDB();
    const out = Object.assign({}, base, db);
    out.version = VERSION;
    out.meta = Object.assign({}, base.meta, db.meta || {});
    out.settings = Object.assign({}, base.settings, db.settings || {});
    out.categories = Array.isArray(db.categories) && db.categories.length ? db.categories : base.categories;
    for (const k of ['families', 'invoices', 'expenses', 'revenues', 'subventions', 'employees', 'recurring', 'bankRefs', 'pointed', 'scenarios']) {
      out[k] = Array.isArray(db[k]) ? db[k] : [];
    }
    return out;
  }
  function categoryOf(db, id) {
    return db.categories.find(function (c) { return c.id === id; }) || { id: id || 'autre', label: id || 'Autre', color: '#95a5a6', type: 'expense' };
  }

  // ---------------- Recurring ----------------
  // recurring: {id, kind:'expense'|'revenue', label, categoryId, amount, frequency, dayOfMonth, startDate, endDate}
  function occurrences(recurring, fromISO, toISO) {
    const out = [];
    if (!recurring || !recurring.startDate) return out;
    const start = recurring.startDate;
    const end = recurring.endDate || null;
    const freq = recurring.frequency || 'mensuel';
    function push(date, amount) {
      if (date && compareISO(date, fromISO) >= 0 && compareISO(date, toISO) <= 0 && compareISO(date, start) >= 0 && (!end || compareISO(date, end) <= 0)) {
        out.push({ date: date, amount: round2(amount), label: recurring.label, categoryId: recurring.categoryId, recurringId: recurring.id });
      }
    }
    if (freq === 'hebdo') {
      let d = start;
      let guard = 0;
      while (compareISO(d, toISO) <= 0 && guard < 3000) {
        push(d, recurring.amount);
        d = addDaysISO(d, 7);
        guard++;
      }
    } else if (freq === 'mensuel' || freq === 'trimestriel' || freq === 'annuel') {
      const step = freq === 'mensuel' ? 1 : freq === 'trimestriel' ? 3 : 12;
      const base = parseISODate(start);
      let y = base.getFullYear(), m = base.getMonth();
      const dom = recurring.dayOfMonth || base.getDate();
      let guard = 0;
      let limit = parseISODate(toISO);
      while (limit && new Date(y, m, 1) <= new Date(limit.getFullYear(), limit.getMonth(), 1) && guard < 1200) {
        const day = Math.min(dom, daysInMonth(y, m));
        push(y + '-' + pad2(m + 1) + '-' + pad2(day), recurring.amount);
        if (freq === 'annuel') { y += 1; } else { m += step; while (m > 11) { m -= 12; y += 1; } }
        guard++;
      }
    }
    out.sort(function (a, b) { return compareISO(a.date, b.date); });
    return out;
  }
  function expandRecurrings(db, fromISO, toISO) {
    const expenses = [], revenues = [];
    for (const r of db.recurring) {
      const occ = occurrences(r, fromISO, toISO);
      for (const o of occ) {
        if (r.kind === 'revenue') revenues.push(o); else expenses.push(o);
      }
    }
    return { expenses: expenses, revenues: revenues };
  }

  // ---------------- Employees ----------------
  // employee: {id, name, role, monthlyCost, startDate, endDate}
  function employeeActiveInMonth(emp, key) {
    const ms = monthStartISO(key), me = monthEndISO(key);
    if (!emp.startDate || compareISO(emp.startDate, me) > 0) return false;
    if (emp.endDate && compareISO(emp.endDate, ms) < 0) return false;
    return true;
  }

  // ---------------- Invoices ----------------
  // invoice: {id, number, familyId, issueDate, dueDate, lines:[{label,qty,unitPrice}], payments:[{id,date,amount,method,note}]}
  function invoiceTotal(inv) {
    return round2((inv.lines || []).reduce(function (s, l) { return s + (l.qty || 0) * (l.unitPrice || 0); }, 0));
  }
  function invoicePaid(inv) {
    return round2((inv.payments || []).reduce(function (s, p) { return s + (p.amount || 0); }, 0));
  }
  function invoiceStatus(inv, today) {
    const total = invoiceTotal(inv);
    const paid = invoicePaid(inv);
    const remaining = round2(total - paid);
    let status;
    if (remaining <= 0.005) status = 'payée';
    else if (inv.dueDate && compareISO(inv.dueDate, today) < 0) status = 'en retard';
    else if (paid > 0) status = 'partielle';
    else status = 'en attente';
    return { total: total, paid: paid, remaining: Math.max(0, remaining), status: status };
  }
  function nextInvoiceNumber(db) {
    let max = 0;
    for (const inv of db.invoices) {
      const m = /(\d+)\D*$/.exec(inv.number || '');
      if (m) max = Math.max(max, +m[1]);
    }
    const y = new Date().getFullYear();
    return 'F' + y + '-' + pad2(max + 1);
  }
  function familyOf(db, id) {
    return db.families.find(function (f) { return f.id === id; }) || null;
  }

  // ---------------- Cash / balance ----------------
  function cashEntries(db, upToISO) {
    const limit = upToISO || '9999-12-31';
    const out = [];
    for (const e of db.expenses) {
      if (compareISO(e.date, limit) <= 0) out.push({ date: e.date, amount: -round2(e.amount), kind: 'expense', refId: e.id, label: e.label, categoryId: e.categoryId });
    }
    for (const r of db.revenues) {
      if (compareISO(r.date, limit) <= 0) out.push({ date: r.date, amount: round2(r.amount), kind: 'revenue', refId: r.id, label: r.label, categoryId: r.categoryId });
    }
    for (const inv of db.invoices) {
      for (const p of (inv.payments || [])) {
        if (compareISO(p.date, limit) <= 0) out.push({ date: p.date, amount: round2(p.amount), kind: 'payment', refId: inv.id, label: 'Paiement ' + inv.number });
      }
    }
    const rec = expandRecurrings(db, '0000-01-01', limit);
    for (const o of rec.expenses) out.push({ date: o.date, amount: -o.amount, kind: 'recurring', refId: o.recurringId, label: o.label, categoryId: o.categoryId, recurring: true });
    for (const o of rec.revenues) out.push({ date: o.date, amount: o.amount, kind: 'recurring', refId: o.recurringId, label: o.label, categoryId: o.categoryId, recurring: true });
    out.sort(function (a, b) { return compareISO(a.date, b.date) || (a.amount - b.amount); });
    return out;
  }
  function balanceAt(db, iso) {
    let bal = 0;
    const od = db.settings.openingDate;
    if (od && compareISO(iso, od) >= 0) bal = round2(db.settings.openingBalance || 0);
    for (const e of cashEntries(db, iso)) bal = round2(bal + e.amount);
    return bal;
  }
  function balanceSeriesDaily(db, fromISO, toISO) {
    const entries = cashEntries(db, toISO);
    const out = [];
    let bal = 0;
    const od = db.settings.openingDate;
    if (od && compareISO(fromISO, od) >= 0) bal = round2(db.settings.openingBalance || 0);
    let idx = 0;
    // entries are sorted; opening applies when date >= openingDate
    let d = fromISO;
    while (compareISO(d, toISO) <= 0) {
      if (od && compareISO(d, od) === 0) bal = round2(db.settings.openingBalance || 0);
      while (idx < entries.length && compareISO(entries[idx].date, d) <= 0) {
        if (compareISO(entries[idx].date, od || '0000-01-01') >= 0 || !od) bal = round2(bal + entries[idx].amount);
        idx++;
      }
      out.push({ date: d, balance: bal });
      d = addDaysISO(d, 1);
    }
    return out;
  }

  // ---------------- Reports ----------------
  function monthlyReport(db, key) {
    const ms = monthStartISO(key), me = monthEndISO(key);
    const rec = expandRecurrings(db, ms, me);
    const byCategory = {};
    let out = 0, inTotal = 0, payments = 0, otherIn = 0;
    function addExp(amount, catId) {
      out = round2(out + amount);
      byCategory[catId || 'autre_dep'] = round2((byCategory[catId || 'autre_dep'] || 0) + amount);
    }
    for (const e of db.expenses) if (compareISO(e.date, ms) >= 0 && compareISO(e.date, me) <= 0) addExp(e.amount, e.categoryId);
    for (const o of rec.expenses) addExp(o.amount, o.categoryId);
    const revByCat = {};
    for (const r of db.revenues) if (compareISO(r.date, ms) >= 0 && compareISO(r.date, me) <= 0) {
      inTotal = round2(inTotal + r.amount); otherIn = round2(otherIn + r.amount);
      revByCat[r.categoryId || 'autre_rec'] = round2((revByCat[r.categoryId || 'autre_rec'] || 0) + r.amount);
    }
    for (const o of rec.revenues) {
      inTotal = round2(inTotal + o.amount); otherIn = round2(otherIn + o.amount);
      revByCat[o.categoryId || 'autre_rec'] = round2((revByCat[o.categoryId || 'autre_rec'] || 0) + o.amount);
    }
    for (const inv of db.invoices) for (const p of (inv.payments || [])) {
      if (compareISO(p.date, ms) >= 0 && compareISO(p.date, me) <= 0) {
        inTotal = round2(inTotal + p.amount); payments = round2(payments + p.amount);
      }
    }
    return {
      key: key, label: monthLabel(key),
      out: out, in: inTotal, payments: payments, otherIn: otherIn, net: round2(inTotal - out),
      byCategory: byCategory, revByCat: revByCat,
      balanceStart: balanceAt(db, addDaysISO(ms, -1)),
      balanceEnd: balanceAt(db, me),
    };
  }
  function yearlyReport(db, year) {
    const months = [];
    for (let m = 1; m <= 12; m++) months.push(monthlyReport(db, year + '-' + pad2(m)));
    const totals = months.reduce(function (acc, r) {
      acc.out = round2(acc.out + r.out); acc.in = round2(acc.in + r.in);
      acc.payments = round2(acc.payments + r.payments); acc.otherIn = round2(acc.otherIn + r.otherIn);
      acc.net = round2(acc.net + r.net);
      for (const k in r.byCategory) acc.byCategory[k] = round2((acc.byCategory[k] || 0) + r.byCategory[k]);
      for (const k in r.revByCat) acc.revByCat[k] = round2((acc.revByCat[k] || 0) + r.revByCat[k]);
      return acc;
    }, { out: 0, in: 0, payments: 0, otherIn: 0, net: 0, byCategory: {}, revByCat: {} });
    totals.balanceStart = balanceAt(db, (year - 1) + '-12-31');
    totals.balanceEnd = balanceAt(db, year + '-12-31');
    return { year: year, months: months, totals: totals };
  }
  function availableYears(db) {
    const set = {};
    const scan = function (d) { if (d) set[yearOf(d)] = true; };
    scan(db.settings.openingDate);
    for (const c of [db.expenses, db.revenues, db.invoices, db.recurring]) {
      for (const it of c) { scan(it.date || it.startDate || it.issueDate); }
    }
    for (const inv of db.invoices) { scan(inv.issueDate); for (const p of inv.payments || []) scan(p.date); }
    const years = Object.keys(set).map(Number).sort();
    const now = +todayISO().slice(0, 4);
    if (!years.includes(now)) years.push(now);
    years.sort(function (a, b) { return a - b; });
    return years;
  }

  // ---------------- Projection & simulation ----------------
  const ITEM_TYPES = {
    depense: { label: 'Dépense ponctuelle', sign: -1 },
    depenseRecurrente: { label: 'Dépense récurrente', sign: -1 },
    travaux: { label: 'Travaux', sign: -1 },
    prime: { label: 'Prime versée (salariés)', sign: -1 },
    cadeau: { label: 'Cadeaux (familles, salariés...)', sign: -1 },
    augmentation: { label: 'Augmentation de salaire (par mois)', sign: -1 },
    charge: { label: 'Charge supplémentaire (par mois)', sign: -1 },
    subvention: { label: 'Subvention attendue', sign: 1 },
    recette: { label: 'Recette ponctuelle', sign: 1 },
    hausseTarif: { label: 'Hausse des tarifs familles (par mois)', sign: 1 },
  };
  function itemSign(type) { return (ITEM_TYPES[type] || ITEM_TYPES.depense).sign; }
  function itemOccurrences(item, fromISO, toISO) {
    if (!item || !item.startDate) return [];
    if (!item.frequency || item.frequency === 'ponctuel') {
      if (compareISO(item.startDate, fromISO) >= 0 && compareISO(item.startDate, toISO) <= 0) {
        return [{ date: item.startDate, amount: round2(item.amount) }];
      }
      return [];
    }
    const pseudo = {
      startDate: item.startDate, endDate: item.endDate || null,
      frequency: item.frequency, dayOfMonth: parseISODate(item.startDate).getDate(),
      amount: round2(item.amount), label: item.label,
    };
    return occurrences(pseudo, fromISO, toISO).map(function (o) { return { date: o.date, amount: o.amount }; });
  }
  // Project monthly cash flows from fromISO to toISO.
  // Baseline includes: recurring entries, active employees' monthly cost, expected collection of unpaid invoices.
  // extraItems: scenario items appended on top.
  function project(db, fromISO, toISO, extraItems) {
    const firstKey = monthKeyOf(fromISO), lastKey = monthKeyOf(toISO);
    const keys = monthKeysBetween(firstKey, lastKey);
    const startBalance = balanceAt(db, addDaysISO(fromISO, -1));
    const months = keys.map(function (k) { return { key: k, label: monthLabel(k), in: 0, out: 0, net: 0, balance: 0, details: [] }; });
    const idx = {};
    keys.forEach(function (k, i) { idx[k] = i; });
    function bucket(date) {
      let k = monthKeyOf(date);
      if (compareISO(k, firstKey) < 0) k = firstKey;
      if (compareISO(k, lastKey) > 0) k = lastKey;
      return k;
    }
    function add(date, amount, label) {
      const k = bucket(date);
      const m = months[idx[k]];
      if (amount >= 0) { m.in = round2(m.in + amount); } else { m.out = round2(m.out - amount); }
      m.details.push({ date: date, amount: amount, label: label });
    }
    const rec = expandRecurrings(db, fromISO, toISO);
    for (const o of rec.expenses) add(o.date, -o.amount, o.label);
    for (const o of rec.revenues) add(o.date, o.amount, o.label);
    for (const emp of db.employees) {
      for (const k of keys) {
        if (employeeActiveInMonth(emp, k)) {
          const m = months[idx[k]];
          const date = monthEndISO(k);
          m.out = round2(m.out + emp.monthlyCost);
          m.details.push({ date: date, amount: -emp.monthlyCost, label: 'Salaire ' + emp.name });
        }
      }
    }
    const today = todayISO();
    for (const inv of db.invoices) {
      const st = invoiceStatus(inv, today);
      if (st.remaining > 0 && compareISO(inv.issueDate, toISO) <= 0) {
        add(inv.dueDate || inv.issueDate, st.remaining, 'Facture ' + inv.number + ' (attendu)');
      }
    }
    for (const item of (extraItems || [])) {
      const sign = itemSign(item.type);
      for (const o of itemOccurrences(item, fromISO, toISO)) add(o.date, sign * o.amount, item.label);
    }
    let bal = startBalance;
    let minBalance = Infinity, firstNegativeKey = null;
    for (const m of months) {
      m.net = round2(m.in - m.out);
      bal = round2(bal + m.net);
      m.balance = bal;
      if (bal < minBalance) minBalance = bal;
      if (bal < 0 && !firstNegativeKey) firstNegativeKey = m.key;
    }
    return {
      from: fromISO, to: toISO, startBalance: startBalance,
      months: months, finalBalance: bal,
      minBalance: months.length ? minBalance : startBalance,
      firstNegativeKey: firstNegativeKey,
    };
  }
  function summarizeYears(proj, year) {
    const months = proj.months.filter(function (m) { return +m.key.slice(0, 4) === year; });
    const s = months.reduce(function (acc, m) {
      acc.in = round2(acc.in + m.in); acc.out = round2(acc.out + m.out); acc.net = round2(acc.net + m.net);
      return acc;
    }, { in: 0, out: 0, net: 0 });
    s.endBalance = months.length ? months[months.length - 1].balance : proj.startBalance;
    return s;
  }
  function simulate(db, items, opts) {
    opts = opts || {};
    const today = opts.today || todayISO();
    const horizon = opts.horizonMonths || 24;
    const from = today;
    const to = monthEndISO(monthKeyOf(addMonthsISO(today, horizon - 1)));
    const baseline = project(db, from, to, []);
    const scenario = project(db, from, to, items || []);
    const y1 = yearOf(today), y2 = y1 + 1;
    return {
      today: today, from: from, to: to,
      baseline: baseline, scenario: scenario,
      years: {
        current: { year: y1, base: summarizeYears(baseline, y1), scen: summarizeYears(scenario, y1) },
        next: { year: y2, base: summarizeYears(baseline, y2), scen: summarizeYears(scenario, y2) },
      },
      minBalanceScen: scenario.minBalance,
      firstNegativeScen: scenario.firstNegativeKey,
      firstNegativeBase: baseline.firstNegativeKey,
    };
  }

  // ---------------- Bank statement CSV ----------------
  function detectDelimiter(text) {
    const lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); }).slice(0, 5);
    const counts = { ';': 0, ',': 0, '\t': 0, '|': 0 };
    for (const l of lines) {
      for (const d in counts) counts[d] += (l.split(d).length - 1);
    }
    let best = ';', bestN = 0;
    for (const d in counts) if (counts[d] > bestN) { bestN = counts[d]; best = d; }
    return bestN > 0 ? best : ',';
  }
  function splitLine(line, delim) {
    const out = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === delim) { out.push(cur); cur = ''; }
        else cur += c;
      }
    }
    out.push(cur);
    return out.map(function (s) { return s.trim(); });
  }
  const COL_SYNONYMS = {
    date: ['date', 'date operation', 'date d operation', 'date de valeur', 'date comptabilisation', 'date comptable', 'date valeur', 'date de l operation'],
    label: ['libelle', 'description', 'details', 'detail', 'operation', 'nature', 'intitule', 'motif', 'libelle operation', 'texte'],
    debit: ['debit', 'montant debit', 'depense', 'depenses', 'sortie', 'sorties', 'decaissement', 'debits', 'montant en debit'],
    credit: ['credit', 'montant credit', 'recette', 'recettes', 'entree', 'entrees', 'encaissement', 'credits', 'montant en credit'],
    amount: ['montant', 'amount', 'valeur', 'montant total', 'total'],
    note: ['categorie', 'note', 'commentaire', 'reference', 'numero', 'libelle court', 'code'],
  };
  function mapColumns(headers) {
    const map = {};
    headers.forEach(function (h, i) {
      const n = stripAccents(h).replace(/\s+/g, ' ').trim();
      for (const role in COL_SYNONYMS) {
        if (map[role] !== undefined) continue;
        if (COL_SYNONYMS[role].indexOf(n) !== -1) { map[role] = i; break; }
      }
      if (map.label === undefined && n.indexOf('libelle') !== -1) map.label = i;
      if (map.date === undefined && n.indexOf('date') !== -1) map.date = i;
    });
    return map;
  }
  function parseBankCSV(text) {
    if (!text || !text.trim()) return { ok: false, error: 'Fichier vide.' };
    const delim = detectDelimiter(text);
    const lines = text.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
    if (lines.length < 2) return { ok: false, error: 'Pas assez de lignes (il faut un en-tête et au moins une opération).' };
    const headerCells = splitLine(lines[0], delim);
    const firstLineHasDate = headerCells.some(function (c) { return parseFlexibleDate(c); });
    let map, rows;
    if (firstLineHasDate) {
      map = { date: -1, label: -1, amount: -1, debit: -1, credit: -1, note: -1 };
      headerCells.forEach(function (c, i) {
        if (parseFlexibleDate(c) && map.date === -1) map.date = i;
        else if (parseAmount(c) !== null && map.amount === -1 && map.debit === -1 && map.credit === -1) map.amount = i;
        else if (map.label === -1) map.label = i;
      });
      rows = lines;
    } else {
      map = mapColumns(headerCells);
      rows = lines.slice(1);
    }
    if (map.date === undefined || map.date === -1) return { ok: false, error: 'Colonne de date introuvable. En-têtes lus : ' + headerCells.join(' | ') };
    const out = [];
    let skipped = 0;
    for (const line of rows) {
      const cells = splitLine(line, delim);
      const rawDate = cells[map.date] || '';
      const dateISO = parseFlexibleDate(rawDate);
      const label = map.label >= 0 && cells[map.label] !== undefined ? cells[map.label] : cells.filter(function (c, i) { return i !== map.date; }).join(' ');
      let amount = null;
      if (map.debit >= 0 || map.credit >= 0) {
        const debit = map.debit >= 0 ? parseAmount(cells[map.debit] || '') : 0;
        const credit = map.credit >= 0 ? parseAmount(cells[map.credit] || '') : 0;
        const d = debit || 0, c = credit || 0;
        amount = round2(c - d);
      } else if (map.amount >= 0) {
        amount = parseAmount(cells[map.amount] || '');
      } else {
        const cand = cells.map(parseAmount).filter(function (v) { return v !== null && v !== 0; });
        if (cand.length) amount = cand[cand.length - 1];
      }
      const note = map.note >= 0 && cells[map.note] ? cells[map.note] : '';
      if (!dateISO || amount === null || amount === 0) { skipped++; continue; }
      out.push({ dateISO: dateISO, label: label, amount: amount, note: note, raw: line });
    }
    if (!out.length) return { ok: false, error: 'Aucune opération reconnue (' + skipped + ' ligne(s) ignorée(s)).' };
    return { ok: true, delimiter: delim, headers: headerCells, rows: out, skipped: skipped };
  }
  function bankRowSignature(row) {
    return row.dateISO + '|' + round2(row.amount) + '|' + normalizeLabel(row.label).slice(0, 60);
  }
  // Match an imported bank row against a recurring occurrence (same amount, date within tolerance days)
  function matchRecurring(db, row, toleranceDays) {
    toleranceDays = toleranceDays == null ? 3 : toleranceDays;
    const tol = toleranceDays;
    for (const r of db.recurring) {
      const occ = occurrences(r, addDaysISO(row.dateISO, -tol), addDaysISO(row.dateISO, tol));
      for (const o of occ) {
        if (Math.abs(round2(o.amount) - Math.abs(row.amount)) < 0.01 && row.amount < 0 === (r.kind !== 'revenue')) {
          return { recurringId: r.id, date: o.date };
        }
      }
    }
    return null;
  }

  // ---------------- Demo seed ----------------
  function seedDemoDB() {
    const db = emptyDB();
    const today = todayISO();
    db.meta.name = 'Crèche Les P\'tits Loups (démo)';
    db.settings.name = 'Crèche Les P\'tits Loups';
    db.settings.openingBalance = 18000;
    db.settings.openingDate = addMonthsISO(today, -14);
    db.settings.minThreshold = 3000;

    const fam = [
      { name: 'Famille Martin', children: [{ name: 'Léa Martin', birthdate: '2022-03-14' }], monthlyFee: 900, startDate: addMonthsISO(today, -13) },
      { name: 'Famille Dubois', children: [{ name: 'Noah Dubois', birthdate: '2023-01-30' }, { name: 'Emma Dubois', birthdate: '2024-06-11' }], monthlyFee: 1450, startDate: addMonthsISO(today, -13) },
      { name: 'Famille Bernard', children: [{ name: 'Jade Bernard', birthdate: '2022-09-02' }], monthlyFee: 850, startDate: addMonthsISO(today, -13) },
      { name: 'Famille Petit', children: [{ name: 'Chloé Petit', birthdate: '2023-11-05' }], monthlyFee: 950, startDate: addMonthsISO(today, -13) },
      { name: 'Famille Garcia', children: [{ name: 'Lucas Garcia', birthdate: '2024-02-18' }], monthlyFee: 800, startDate: addMonthsISO(today, -10) },
      { name: 'Famille Nguyen', children: [{ name: 'Inès Nguyen', birthdate: '2022-07-25' }], monthlyFee: 880, startDate: addMonthsISO(today, -8) },
      { name: 'Famille Robert', children: [{ name: 'Tom Robert', birthdate: '2023-04-09' }], monthlyFee: 820, startDate: addMonthsISO(today, -6) },
      { name: 'Famille Leroy', children: [{ name: 'Mia Leroy', birthdate: '2024-09-30' }], monthlyFee: 780, startDate: addMonthsISO(today, -5) },
    ];
    db.families = fam.map(function (f) {
      return { id: uid('fam'), name: f.name, children: f.children.map(function (c) { return { id: uid('enf'), name: c.name, birthdate: c.birthdate }; }), monthlyFee: f.monthlyFee, startDate: f.startDate, endDate: null, notes: '' };
    });

    db.employees = [
      { id: uid('emp'), name: 'Marie L.', role: 'Éducatrice diplômée d\'État', monthlyCost: 2200, startDate: addMonthsISO(today, -13), endDate: null, notes: 'Coût total employeur (net + charges)' },
      { id: uid('emp'), name: 'Sophie R.', role: 'Auxiliaire de puériculture', monthlyCost: 1600, startDate: addMonthsISO(today, -13), endDate: null, notes: 'Coût total employeur' },
    ];

    db.recurring = [
      { id: uid('rec'), kind: 'expense', label: 'Loyer du local', categoryId: 'loyer', amount: 1100, frequency: 'mensuel', dayOfMonth: 5, startDate: addMonthsISO(today, -13), endDate: null },
      { id: uid('rec'), kind: 'expense', label: 'Électricité / eau', categoryId: 'energie', amount: 260, frequency: 'mensuel', dayOfMonth: 12, startDate: addMonthsISO(today, -13), endDate: null },
      { id: uid('rec'), kind: 'expense', label: 'Assurance responsabilité civile', categoryId: 'assurances', amount: 95, frequency: 'mensuel', dayOfMonth: 8, startDate: addMonthsISO(today, -13), endDate: null },
      { id: uid('rec'), kind: 'expense', label: 'Box internet + téléphonie', categoryId: 'abonnements', amount: 55, frequency: 'mensuel', dayOfMonth: 15, startDate: addMonthsISO(today, -13), endDate: null },
      { id: uid('rec'), kind: 'expense', label: 'Courses alimentaires (traiteur)', categoryId: 'courses', amount: 320, frequency: 'hebdo', dayOfMonth: 0, startDate: addDaysISO(addMonthsISO(today, -13), 3), endDate: null },
      { id: uid('rec'), kind: 'expense', label: 'Fournitures diverses', categoryId: 'fournitures', amount: 150, frequency: 'mensuel', dayOfMonth: 20, startDate: addMonthsISO(today, -13), endDate: null },
      { id: uid('rec'), kind: 'expense', label: 'Site web & comptabilité', categoryId: 'abonnements', amount: 720, frequency: 'annuel', dayOfMonth: 10, startDate: addMonthsISO(today, -12), endDate: null },
    ];

    // Salaires des 13 derniers mois
    for (let i = 13; i >= 1; i--) {
      const payDate = addMonthsISO(today, -i).slice(0, 8) + '28';
      for (const emp of db.employees) {
        db.expenses.push({ id: uid('dep'), date: payDate, label: 'Salaire ' + emp.name, categoryId: 'salaires', amount: emp.monthlyCost, method: 'Virement', notes: 'Paie mensuelle', bankRef: null });
      }
    }
    // Quelques dépenses diverses
    const extra = [
      ['Achat matériel cuisine', 'fournitures', 340, -2], ['Réparation fuite sanitaire', 'travaux', 420, -5],
      ['Formation premiers secours équipe', 'formations', 600, -7], ['Achat livres & jeux', 'fournitures', 210, -3],
      ['Frais de dossier banque', 'banque', 18.5, -1], ['Déplacement sortie au parc', 'transports', 45, -4],
      ['Achat produits ménagers', 'courses', 85, -1], ['Petit déjeuner équipe', 'restauration', 60, -6],
    ];
    for (const e of extra) {
      db.expenses.push({ id: uid('dep'), date: addMonthsISO(today, e[3]).slice(0, 8) + '15', label: e[0], categoryId: e[1], amount: e[2], method: 'Carte bancaire', notes: '', bankRef: null });
    }

    // Subventions
    const sub1 = { id: uid('sub'), name: 'CAF - Prestation de service unique (PSU)', organism: 'CAF', amountRequested: 9000, amountGranted: 8500, status: 'obtenue', requestDate: addMonthsISO(today, -10), decisionDate: addMonthsISO(today, -8), paymentDate: addMonthsISO(today, -7), notes: 'Versée en deux fois' };
    const sub2 = { id: uid('sub'), name: 'Conseil départemental - Aide au fonctionnement', organism: 'Département', amountRequested: 5000, amountGranted: null, status: 'en attente', requestDate: addMonthsISO(today, -2), decisionDate: null, paymentDate: null, notes: 'Dossier déposé, réponse sous 2 mois' };
    const sub3 = { id: uid('sub'), name: 'Mairie - Subvention exceptionnelle travaux', organism: 'Mairie', amountRequested: 3000, amountGranted: 0, status: 'refusée', requestDate: addMonthsISO(today, -6), decisionDate: addMonthsISO(today, -5), paymentDate: null, notes: 'Budget travaux non ouvert cette année' };
    db.subventions = [sub1, sub2, sub3];
    db.revenues.push({ id: uid('rev'), date: addMonthsISO(today, -7), label: 'Subvention CAF PSU (1ère part)', categoryId: 'subventions', amount: 4250, subventionId: sub1.id, method: 'Virement', notes: '' });
    db.revenues.push({ id: uid('rev'), date: addMonthsISO(today, -3), label: 'Subvention CAF PSU (2ème part)', categoryId: 'subventions', amount: 4250, subventionId: sub1.id, method: 'Virement', notes: '' });
    db.revenues.push({ id: uid('rev'), date: addMonthsISO(today, -9), label: 'Don entreprise locale', categoryId: 'dons', amount: 500, subventionId: null, method: 'Chèque', notes: '' });

    // Factures familles : tous les mois depuis l'arrivée de chaque famille
    let n = 0;
    const curKey = monthKeyOf(today);
    db.families.forEach(function (f) {
      const keys = monthKeysBetween(monthKeyOf(f.startDate), curKey);
      keys.forEach(function (k, idx) {
        const issue = monthStartISO(k).slice(0, 8) + '05';
        const due = monthStartISO(k).slice(0, 8) + '25';
        n++;
        const inv = {
          id: uid('inv'), number: 'F' + new Date().getFullYear() + '-' + pad2(n),
          familyId: f.id, issueDate: issue, dueDate: due,
          lines: [{ label: 'Frais de garde - ' + f.children.map(function (c) { return c.name; }).join(', ') + ' (' + monthLabel(k) + ')', qty: 1, unitPrice: f.monthlyFee }],
          payments: [],
        };
        const rel = keys.length - idx; // 1 = mois en cours
        if (rel >= 3) {
          inv.payments.push({ id: uid('pay'), date: addDaysISO(due, 2), amount: f.monthlyFee, method: 'Virement', note: 'Payé dans les délais' });
        } else if (rel === 2) {
          inv.payments.push({ id: uid('pay'), date: addDaysISO(due, 5), amount: round2(f.monthlyFee / 2), method: 'Virement', note: 'Acompte' });
        } // rel === 1 : impayée (en retard si l'échéance est passée)
        db.invoices.push(inv);
      });
    });
    return db;
  }

  return {
    VERSION: VERSION,
    uid: uid, pad2: pad2, toISO: toISO, todayISO: todayISO, daysInMonth: daysInMonth,
    parseISODate: parseISODate, parseFlexibleDate: parseFlexibleDate,
    addDaysISO: addDaysISO, addMonthsISO: addMonthsISO,
    monthKeyOf: monthKeyOf, monthStartISO: monthStartISO, monthEndISO: monthEndISO,
    yearOf: yearOf, compareISO: compareISO, monthLabel: monthLabel, monthKeysBetween: monthKeysBetween,
    fmtDate: fmtDate, fmtEUR: fmtEUR, round2: round2, parseAmount: parseAmount,
    normalizeLabel: normalizeLabel, stripAccents: stripAccents, escapeHtml: escapeHtml,
    defaultCategories: defaultCategories, defaultSettings: defaultSettings,
    emptyDB: emptyDB, migrate: migrate, categoryOf: categoryOf,
    occurrences: occurrences, expandRecurrings: expandRecurrings,
    employeeActiveInMonth: employeeActiveInMonth,
    invoiceTotal: invoiceTotal, invoicePaid: invoicePaid, invoiceStatus: invoiceStatus,
    nextInvoiceNumber: nextInvoiceNumber, familyOf: familyOf,
    cashEntries: cashEntries, balanceAt: balanceAt, balanceSeriesDaily: balanceSeriesDaily,
    monthlyReport: monthlyReport, yearlyReport: yearlyReport, availableYears: availableYears,
    ITEM_TYPES: ITEM_TYPES, itemSign: itemSign, itemOccurrences: itemOccurrences,
    project: project, simulate: simulate, summarizeYears: summarizeYears,
    detectDelimiter: detectDelimiter, splitLine: splitLine, mapColumns: mapColumns,
    parseBankCSV: parseBankCSV, bankRowSignature: bankRowSignature, matchRecurring: matchRecurring,
    seedDemoDB: seedDemoDB,
  };
});
