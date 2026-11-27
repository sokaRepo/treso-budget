(function (root) {
  'use strict';
  const KEY = 'creche-tresorerie:v1';
  const listeners = [];
  let db = null;

  function load() {
    try {
      const raw = root.localStorage ? root.localStorage.getItem(KEY) : null;
      if (raw) {
        db = Core.migrate(JSON.parse(raw));
        if (db) { touch(); return db; }
      }
    } catch (e) {
      console.error('Chargement impossible', e);
    }
    db = null;
    return null;
  }
  function touch() {
    if (db && db.meta) db.meta.updatedAt = Core.todayISO();
  }
  function get() { return db; }
  function set(newDB) {
    db = Core.migrate(newDB);
    save();
    notify();
    return db;
  }
  function save() {
    if (!db) return;
    touch();
    try {
      if (root.localStorage) root.localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      console.error('Sauvegarde impossible', e);
    }
  }
  function update(mutator) {
    if (!db) return null;
    const res = mutator(db);
    save();
    notify();
    return res === undefined ? db : res;
  }
  function subscribe(fn) { listeners.push(fn); }
  function notify() { for (const fn of listeners) { try { fn(db); } catch (e) { console.error(e); } } }
  function exportJSON() {
    if (!db) return null;
    touch();
    return JSON.stringify(db, null, 2);
  }
  function importJSON(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { throw new Error('JSON invalide : ' + e.message); }
    const migrated = Core.migrate(parsed);
    if (!migrated) throw new Error('Structure de base invalide.');
    return set(migrated);
  }
  function reset() { db = null; try { if (root.localStorage) root.localStorage.removeItem(KEY); } catch (e) {} notify(); }

  root.Store = {
    KEY: KEY, load: load, get: get, set: set, save: save, update: update,
    subscribe: subscribe, exportJSON: exportJSON, importJSON: importJSON, reset: reset,
  };
})(typeof self !== 'undefined' ? self : globalThis);
