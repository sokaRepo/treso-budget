(function () {
  'use strict';
  const C = Core, S = Store;

  const App = {
    C: C, S: S,
    state: { view: 'dashboard', filters: {} },
    views: {},
  };
  window.App = App;

  // ---------- DOM helper ----------
  App.h = function h(tag, attrs) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'dataset') Object.assign(e.dataset, v);
        else e.setAttribute(k, v);
      }
    }
    for (let i = 2; i < arguments.length; i++) {
      const c = arguments[i];
      if (c == null || c === false) continue;
      const arr = Array.isArray(c) ? c : [c];
      for (const item of arr) {
        if (item == null || item === false) continue;
        e.appendChild(typeof item === 'string' || typeof item === 'number' ? document.createTextNode(String(item)) : item);
      }
    }
    return e;
  };

  App.toast = function (msg, type) {
    const root = document.getElementById('toast-root');
    const t = App.h('div', { class: 'toast' + (type ? ' ' + type : '') }, msg);
    root.appendChild(t);
    setTimeout(function () {
      t.style.opacity = '0'; t.style.transition = 'opacity .3s';
      setTimeout(function () { t.remove(); }, 320);
    }, 2800);
  };

  // ---------- Modal ----------
  App.openModal = function (opts) {
    App.closeModal();
    const backdrop = App.h('div', {
      class: 'modal-backdrop',
      onclick: function (e) { if (e.target === backdrop && opts.dismissable !== false) App.closeModal(); },
    });
    const modal = App.h('div', { class: 'modal' + (opts.wide ? ' wide' : '') });
    modal.appendChild(App.h('button', { class: 'btn small modal-close', title: 'Fermer', onclick: function () { App.closeModal(); } }, '✕'));
    modal.appendChild(App.h('h2', {}, opts.title || ''));
    const body = App.h('div', {});
    modal.appendChild(body);
    backdrop.appendChild(modal);
    document.getElementById('modal-root').appendChild(backdrop);
    if (opts.render) opts.render(body);
    return { close: App.closeModal, body: body, modal: modal };
  };
  App.closeModal = function () {
    const r = document.getElementById('modal-root');
    if (r) r.innerHTML = '';
  };
  App.modalOpen = function () { return !!document.querySelector('.modal-backdrop'); };

  App.confirmDialog = function (opts) {
    App.openModal({
      title: opts.title || 'Confirmation',
      render: function (body) {
        body.appendChild(App.h('p', { html: opts.text || '' }));
        const actions = App.h('div', { class: 'form-actions' });
        actions.appendChild(App.h('button', { class: 'btn', onclick: App.closeModal }, 'Annuler'));
        actions.appendChild(App.h('button', {
          class: 'btn ' + (opts.danger ? 'danger' : 'primary'),
          onclick: function () { App.closeModal(); if (opts.onConfirm) opts.onConfirm(); },
        }, opts.okLabel || 'Confirmer'));
        body.appendChild(actions);
      },
    });
  };

  // ---------- Router ----------
  App.registerView = function (name, def) { App.views[name] = def; };
  App.navigate = function (name) {
    App.state.view = name;
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.view === name); });
    App.renderView();
  };
  App.renderView = function () {
    const container = document.getElementById('view');
    container.innerHTML = '';
    if (!S.get()) { showWelcome(container); return; }
    const v = App.views[App.state.view];
    if (v && v.render) v.render(container);
    updateTopSolde();
  };
  function updateTopSolde() {
    const chip = document.getElementById('top-solde');
    const db = S.get();
    if (!db) { chip.textContent = '—'; return; }
    const bal = C.balanceAt(db, C.todayISO());
    chip.textContent = 'Solde : ' + C.fmtEUR(bal);
    chip.classList.toggle('neg', bal < 0);
  }

  // ---------- Export / import ----------
  App.exportJSON = function () {
    const json = S.exportJSON();
    if (!json) { App.toast('Aucune base à exporter.', 'err'); return; }
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'creche-tresorerie-' + C.todayISO() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
    App.toast('Base de données exportée ✔', 'ok');
  };
  App.importFile = function (file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        S.importJSON(String(reader.result));
        App.toast('Base importée avec succès ✔', 'ok');
      } catch (e) {
        App.toast('Import impossible : ' + e.message, 'err');
      }
    };
    reader.onerror = function () { App.toast('Lecture du fichier impossible.', 'err'); };
    reader.readAsText(file);
  };

  // ---------- Welcome (no db yet) ----------
  function showWelcome(container) {
    container.innerHTML = '';
    const p = App.h('div', { class: 'panel', style: 'max-width:680px;margin:48px auto;text-align:center;padding:32px' });
    p.appendChild(App.h('div', { style: 'font-size:44px' }, '🍼'));
    p.appendChild(App.h('h2', { style: 'margin:10px 0 6px' }, 'Bienvenue dans votre outil de trésorerie'));
    p.appendChild(App.h('p', { class: 'muted' },
      'Aucune base de données trouvée dans ce navigateur. Choisissez comment démarrer :'));
    const row = App.h('div', { class: 'flex', style: 'justify-content:center;margin-top:16px' });
    row.appendChild(App.h('button', {
      class: 'btn primary', onclick: function () { S.set(C.emptyDB()); App.toast('Base créée ✔', 'ok'); },
    }, '✨ Créer une base vide'));
    row.appendChild(App.h('button', {
      class: 'btn', onclick: function () { S.set(C.seedDemoDB()); App.toast('Données de démonstration chargées ✔', 'ok'); },
    }, '🎬 Charger des données de démo'));
    const importBtn = App.h('button', { class: 'btn' }, '📂 Importer une base JSON…');
    const fileInput = App.h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    importBtn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () { App.importFile(fileInput.files[0]); });
    row.appendChild(importBtn);
    row.appendChild(fileInput);
    p.appendChild(row);
    p.appendChild(App.h('p', { class: 'muted small mt' },
      'Vos données sont stockées dans le navigateur (localStorage) et peuvent être téléchargées / rechargées au format JSON à tout moment.'));
    container.appendChild(p);
  }

  // ---------- Init ----------
  function init() {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () { App.navigate(t.dataset.view); });
    });
    document.getElementById('btn-export-top').addEventListener('click', App.exportJSON);
    const topImport = document.getElementById('btn-import-top');
    const topFile = document.getElementById('import-file-top');
    topImport.addEventListener('click', function () { topFile.click(); });
    topFile.addEventListener('change', function () { App.importFile(topFile.files[0]); topFile.value = ''; });

    S.subscribe(function () {
      document.getElementById('app-title').textContent = (S.get() && S.get().settings.name) || 'Trésorerie Crèche Parentale';
      document.getElementById('app-subtitle').textContent = S.get() ? 'Base : ' + (S.get().meta.name || '') : '';
      App.renderView();
    });

    const loaded = S.load();
    if (loaded) S.set(loaded);
    else App.renderView();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
