'use strict';
// Test de fumée : démarre l'application dans node avec un DOM minimal
// et rend chaque vue avec la base de démo pour détecter les erreurs d'exécution.

function makeEl(tag) {
  const el = {
    tagName: tag, children: [], attributes: {}, listeners: {}, style: {}, dataset: {},
    className: '', _innerHTML: '', value: '', textContent: '', parent: null,
  };
  el.classList = {
    _set: new Set(),
    add: function (c) { this._set.add(c); },
    remove: function (c) { this._set.delete(c); },
    toggle: function (c, force) {
      if (force === undefined) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); }
      else if (force) this._set.add(c); else this._set.delete(c);
    },
    contains: function (c) { return this._set.has(c); },
  };
  el.setAttribute = function (k, v) { this.attributes[k] = String(v); };
  el.getAttribute = function (k) { return this.attributes[k]; };
  el.addEventListener = function (t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); };
  el.appendChild = function (c) { c.parent = this; this.children.push(c); return c; };
  el.remove = function () {
    if (this.parent) { const i = this.parent.children.indexOf(this); if (i >= 0) this.parent.children.splice(i, 1); }
  };
  el.click = function () { (this.listeners.click || []).forEach(function (f) { f({ target: el }); }); };
  el.querySelector = function () { return null; };
  el.querySelectorAll = function () { return []; };
  el.scrollIntoView = function () {};
  el.select = function () {};
  Object.defineProperty(el, 'innerHTML', {
    set: function (v) { this._innerHTML = v; if (v === '') this.children = []; },
    get: function () { return this._innerHTML; },
  });
  Object.defineProperty(el, 'lastChild', { get: function () { return this.children[this.children.length - 1] || null; } });
  Object.defineProperty(el, 'firstChild', { get: function () { return this.children[0] || null; } });
  Object.defineProperty(el, 'childNodes', { get: function () { return this.children; } });
  return el;
}

const byId = {};
['view', 'tabs', 'modal-root', 'toast-root', 'app-title', 'app-subtitle', 'top-solde',
  'btn-export-top', 'btn-import-top', 'import-file-top', 'save-state'].forEach(function (id) {
  const e = makeEl('div'); e.id = id; byId[id] = e;
});
const tabs = ['dashboard', 'expenses', 'invoices', 'subventions', 'team', 'reports', 'simulator', 'data'].map(function (v) {
  const t = makeEl('button'); t.dataset.view = v; return t;
});

global.document = {
  readyState: 'complete',
  createElement: function (t) { return makeEl(t); },
  createElementNS: function (ns, t) { return makeEl(t); },
  createTextNode: function (txt) { const n = makeEl('#text'); n.textContent = String(txt); return n; },
  getElementById: function (id) { return byId[id] || null; },
  querySelectorAll: function (sel) { return sel === '.tab' ? tabs : []; },
  querySelector: function () { return null; },
  addEventListener: function () {},
  body: makeEl('body'),
};
global.window = globalThis;
global.self = globalThis;
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
global.localStorage = {
  _s: {},
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
  setItem: function (k, v) { this._s[k] = String(v); },
  removeItem: function (k) { delete this._s[k]; },
};

require('../js/core.js');
require('../js/store.js');
require('../js/charts.js');
require('../js/app.js');
require('../js/views/dashboard.js');
require('../js/views/expenses.js');
require('../js/views/invoices.js');
require('../js/views/subventions.js');
require('../js/views/team.js');
require('../js/views/reports.js');
require('../js/views/simulator.js');
require('../js/views/data.js');

const C = globalThis.Core, S = globalThis.Store, App = globalThis.App;
let failed = 0;
function check(cond, msg) {
  if (cond) console.log('✅ ' + msg);
  else { failed++; console.error('❌ ' + msg); }
}

// 1) Démarrage à vide -> écran d'accueil
check(byId['view'].children.length > 0, 'écran d\'accueil rendu sans base');

// 2) Chargement de la démo puis rendu de toutes les vues
S.set(C.seedDemoDB());
check(S.get() && S.get().families.length === 8, 'base de démo chargée');

const viewNames = ['dashboard', 'expenses', 'invoices', 'subventions', 'team', 'reports', 'simulator', 'data'];
for (const v of viewNames) {
  try {
    App.navigate(v);
    check(byId['view'].children.length > 0, 'vue « ' + v + ' » rendue (' + byId['view'].children.length + ' panneau(x))');
  } catch (e) {
    failed++;
    console.error('❌ vue « ' + v + ' » a levé une erreur : ' + e.stack);
  }
}

// 3) Simulateur avec un scénario complet -> rendu des résultats
try {
  const today = C.todayISO();
  App.state.sim = {
    scenarioId: null, name: 'Test', result: null,
    items: [
      { id: 'a', type: 'prime', label: 'Prime', amount: 1000, startDate: today, frequency: 'ponctuel', endDate: null },
      { id: 'b', type: 'augmentation', label: 'Augmentation +100', amount: 100, startDate: today, frequency: 'mensuel', endDate: null },
      { id: 'c', type: 'subvention', label: 'Subvention espérée', amount: 5000, startDate: C.addMonthsISO(today, 3), frequency: 'ponctuel', endDate: null },
    ],
  };
  App.state.sim.result = C.simulate(S.get(), App.state.sim.items, { horizonMonths: 24 });
  App.navigate('simulator');
  check(byId['view'].children.length >= 4, 'résultats du simulateur rendus');
  check(App.state.sim.result.scenario.months.length === 24, 'simulation : 24 mois de projection');
} catch (e) {
  failed++;
  console.error('❌ simulateur : ' + e.stack);
}

// 4) Export / import JSON (aller-retour)
try {
  const json = S.exportJSON();
  const parsed = JSON.parse(json);
  check(parsed.version === 1 && parsed.families.length === 8, 'export JSON valide');
  const before = C.balanceAt(S.get(), C.todayISO());
  S.importJSON(json);
  const after = C.balanceAt(S.get(), C.todayISO());
  check(before === after, 'import JSON : solde identique après aller-retour (' + after + ')');
} catch (e) {
  failed++;
  console.error('❌ export/import : ' + e.stack);
}

// 5) Persistance localStorage
try {
  check(global.localStorage.getItem(S.KEY) !== null, 'base persistée dans localStorage');
  const reloaded = S.load();
  check(reloaded && reloaded.invoices.length === S.get().invoices.length, 'rechargement depuis localStorage OK');
} catch (e) {
  failed++;
  console.error('❌ persistance : ' + e.stack);
}

// 6) Ajout/suppression d'une dépense via le store (comme le fait l'UI)
try {
  const before = C.balanceAt(S.get(), C.todayISO());
  S.update(function (d) { d.expenses.push({ id: C.uid('dep'), date: C.todayISO(), label: 'Test smoke', categoryId: 'courses', amount: 42, method: 'Espèces', note: '', bankRef: null }); });
  const after = C.balanceAt(S.get(), C.todayISO());
  check(Math.abs((before - 42) - after) < 0.01, 'ajout dépense pris en compte dans le solde');
  S.update(function (d) { d.expenses = d.expenses.filter(function (e) { return e.label !== 'Test smoke'; }); });
  check(C.balanceAt(S.get(), C.todayISO()) === before, 'suppression dépense restaurée');
} catch (e) {
  failed++;
  console.error('❌ CRUD dépense : ' + e.stack);
}

console.log('\n' + (failed ? '❌ ' + failed + ' échec(s)' : '✅ Test de fumée UI : TOUT EST VERT'));
process.exit(failed ? 1 : 0);
