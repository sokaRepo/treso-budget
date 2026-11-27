(function () {
  'use strict';
  const App = window.App, C = App.C, h = App.h;

  App.registerView('data', { render: render });

  function render(container) {
    const db = App.S.get();

    // ---- Paramètres ----
    const setPanel = h('div', { class: 'panel' });
    setPanel.appendChild(h('h2', {}, '⚙️ Paramètres généraux'));
    const f = h('form', {});
    const name = h('input', { type: 'text', required: 'required', value: db.settings.name });
    const opening = h('input', { type: 'number', step: '0.01', value: db.settings.openingBalance });
    const openingDate = h('input', { type: 'date', required: 'required', value: db.settings.openingDate });
    const threshold = h('input', { type: 'number', step: '0.01', min: '0', value: db.settings.minThreshold });
    const fiscal = h('select', {});
    for (let m = 1; m <= 12; m++) fiscal.appendChild(h('option', { value: m, selected: db.settings.fiscalYearStartMonth === m ? 'selected' : null }, C.monthLabel('2000-' + C.pad2(m)).replace(' 2000', '')));
    const methods = h('input', { type: 'text', value: (db.settings.paymentMethods || []).join(', ') });
    f.appendChild(h('div', { class: 'row' },
      h('div', { class: 'field', style: 'flex:2' }, h('label', {}, 'Nom de la crèche'), name),
      h('div', { class: 'field' }, h('label', {}, 'Solde de départ (€)'), opening),
      h('div', { class: 'field' }, h('label', {}, 'Date du solde de départ'), openingDate)));
    f.appendChild(h('div', { class: 'row' },
      h('div', { class: 'field' }, h('label', {}, 'Seuil d’alerte trésorerie (€)'), threshold),
      h('div', { class: 'field' }, h('label', {}, 'Mois de début d’exercice'), fiscal),
      h('div', { class: 'field', style: 'flex:2' }, h('label', {}, 'Moyens de paiement (séparés par des virgules)'), methods)));
    const actions = h('div', { class: 'form-actions' });
    actions.appendChild(h('button', { type: 'submit', class: 'btn primary' }, '💾 Enregistrer les paramètres'));
    f.appendChild(actions);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      App.S.update(function (d) {
        d.settings.name = name.value.trim();
        d.settings.openingBalance = C.round2(parseFloat(opening.value) || 0);
        d.settings.openingDate = openingDate.value;
        d.settings.minThreshold = C.round2(parseFloat(threshold.value) || 0);
        d.settings.fiscalYearStartMonth = parseInt(fiscal.value, 10);
        d.settings.paymentMethods = methods.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        d.meta.name = d.settings.name;
      });
      App.toast('Paramètres enregistrés ✔', 'ok');
    });
    setPanel.appendChild(f);
    container.appendChild(setPanel);

    // ---- Catégories ----
    const catPanel = h('div', { class: 'panel' });
    catPanel.appendChild(h('h2', {}, '🏷️ Catégories de dépenses / recettes',
      h('button', { class: 'btn primary small', onclick: addCategory }, '＋ Ajouter une catégorie')));
    const tbl = h('table', { class: 'data' });
    tbl.appendChild(h('thead', {}, h('tr', {}, h('th', {}, 'Type'), h('th', {}, 'Libellé'), h('th', {}, 'Couleur'), h('th', {}, 'Utilisation'), h('th', {}, 'Actions'))));
    const tb = h('tbody', {});
    const usage = {};
    for (const e of db.expenses) usage[e.categoryId] = (usage[e.categoryId] || 0) + 1;
    for (const r of db.revenues) usage[r.categoryId] = (usage[r.categoryId] || 0) + 1;
    for (const r of db.recurring) usage[r.categoryId] = (usage[r.categoryId] || 0) + 1;
    for (const c of db.categories) {
      tb.appendChild(h('tr', {},
        h('td', {}, h('span', { class: 'tag ' + (c.type === 'revenue' ? 'green' : 'red') }, c.type === 'revenue' ? 'Recette' : 'Dépense')),
        h('td', {}, h('span', { class: 'dot', style: 'background:' + c.color }), c.label),
        h('td', {}, h('input', { type: 'color', value: c.color, style: 'width:36px;height:26px;padding:0;border:none;background:none',
          onchange: function (ev) {
            App.S.update(function (d) { const x = d.categories.find(function (y) { return y.id === c.id; }); if (x) x.color = ev.target.value; });
          } })),
        h('td', { class: 'muted small' }, (usage[c.id] || 0) + ' mouvement(s)'),
        h('td', { class: 'flex' },
          h('button', { class: 'btn small', onclick: function () { editCategory(c); } }, 'Renommer'),
          h('button', { class: 'btn small danger', onclick: function () { delCategory(c.id); } }, 'Suppr.'))));
    }
    tbl.appendChild(tb);
    catPanel.appendChild(tbl);
    container.appendChild(catPanel);

    // ---- Base de données ----
    const dataPanel = h('div', { class: 'panel' });
    dataPanel.appendChild(h('h2', {}, '💾 Base de données (JSON)'));
    const json = App.S.exportJSON();
    const counts = {
      familles: db.families.length, factures: db.invoices.length, dépenses: db.expenses.length,
      recettes: db.revenues.length, subventions: db.subventions.length, salariés: db.employees.length,
      récurrentes: db.recurring.length, scénarios: db.scenarios.length, opérations_bancaires_importées: db.bankRefs.length,
    };
    dataPanel.appendChild(h('p', { class: 'muted' },
      'La base est stockée automatiquement dans le navigateur (localStorage) à chaque modification : ' +
      Object.keys(counts).map(function (k) { return counts[k] + ' ' + k; }).join(' · ') +
      ' — taille du JSON : ' + Math.round(json.length / 1024 * 10) / 10 + ' Ko.'));
    const row = h('div', { class: 'flex' });
    row.appendChild(h('button', { class: 'btn primary', onclick: App.exportJSON }, '⬇ Télécharger la base (JSON)'));
    const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    const importBtn = h('button', { class: 'btn', onclick: function () { fileInput.click(); } }, '⬆ Charger une base depuis un fichier…');
    fileInput.addEventListener('change', function () {
      const file = fileInput.files[0];
      if (!file) return;
      App.confirmDialog({
        title: 'Remplacer la base actuelle ?',
        text: 'Le chargement de « ' + file.name + ' » remplacera toutes les données actuelles de ce navigateur. Pensez à exporter la base actuelle avant si besoin.',
        danger: true, okLabel: 'Charger le fichier',
        onConfirm: function () { App.importFile(file); },
      });
    });
    row.appendChild(importBtn);
    row.appendChild(fileInput);
    row.appendChild(h('button', { class: 'btn', onclick: function () { viewRawJSON(); } }, '👁 Voir le JSON brut'));
    row.appendChild(h('button', {
      class: 'btn', onclick: function () {
        App.confirmDialog({
          title: 'Charger les données de démonstration ?',
          text: 'La base actuelle sera remplacée par un jeu de données de démo (familles, factures, subventions, salariés, dépenses récurrentes…).',
          danger: true, okLabel: 'Charger la démo',
          onConfirm: function () { App.S.set(C.seedDemoDB()); App.toast('Données de démonstration chargées ✔', 'ok'); },
        });
      },
    }, '🎬 Données de démo'));
    row.appendChild(h('button', {
      class: 'btn danger', onclick: function () {
        App.confirmDialog({
          title: 'Réinitialiser complètement ?',
          text: 'Toutes les données de ce navigateur seront supprimées définitivement. Exportez d’abord la base JSON si vous voulez les conserver.',
          danger: true, okLabel: 'Tout supprimer',
          onConfirm: function () { App.S.reset(); App.toast('Base réinitialisée.', 'ok'); },
        });
      },
    }, '🗑 Nouvelle base vide'));
    dataPanel.appendChild(row);
    container.appendChild(dataPanel);
  }

  function addCategory() { categoryModal(null); }
  function editCategory(cat) { categoryModal(cat); }

  function categoryModal(existing) {
    App.openModal({
      title: existing ? 'Renommer la catégorie' : 'Nouvelle catégorie',
      render: function (body) {
        const f = h('form', {});
        const type = h('select', {});
        [['expense', 'Dépense'], ['revenue', 'Recette']].forEach(function (o) {
          type.appendChild(h('option', { value: o[0], selected: existing && existing.type === o[0] ? 'selected' : null }, o[1]));
        });
        const label = h('input', { type: 'text', required: 'required', value: existing ? existing.label : '' });
        const color = h('input', { type: 'color', value: existing ? existing.color : '#2563eb', style: 'width:50px;height:32px;padding:0;border:none;background:none' });
        f.appendChild(h('div', { class: 'row' },
          h('div', { class: 'field' }, h('label', {}, 'Type'), type),
          h('div', { class: 'field', style: 'flex:2' }, h('label', {}, 'Libellé'), label),
          h('div', { class: 'field' }, h('label', {}, 'Couleur'), color)));
        const actions = h('div', { class: 'form-actions' });
        actions.appendChild(h('button', { type: 'button', class: 'btn', onclick: App.closeModal }, 'Annuler'));
        actions.appendChild(h('button', { type: 'submit', class: 'btn primary' }, 'Enregistrer'));
        f.appendChild(actions);
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          if (!label.value.trim()) return;
          App.S.update(function (d) {
            if (existing) {
              const i = d.categories.findIndex(function (x) { return x.id === existing.id; });
              if (i >= 0) { d.categories[i].label = label.value.trim(); d.categories[i].color = color.value; d.categories[i].type = type.value; }
            } else {
              const base = label.value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
              d.categories.push({ id: base + '_' + Math.random().toString(36).slice(2, 6), label: label.value.trim(), type: type.value, color: color.value });
            }
          });
          App.closeModal();
          App.toast('Catégorie enregistrée ✔', 'ok');
        });
        body.appendChild(f);
      },
    });
  }

  function delCategory(id) {
    const db = App.S.get();
    const used = db.expenses.some(function (e) { return e.categoryId === id; }) ||
      db.revenues.some(function (r) { return r.categoryId === id; }) ||
      db.recurring.some(function (r) { return r.categoryId === id; });
    if (used) {
      App.toast('Cette catégorie est utilisée : renommez-la plutôt que de la supprimer.', 'err');
      return;
    }
    App.confirmDialog({
      title: 'Supprimer la catégorie',
      text: 'Supprimer définitivement cette catégorie ?',
      danger: true, okLabel: 'Supprimer',
      onConfirm: function () {
        App.S.update(function (d) { d.categories = d.categories.filter(function (x) { return x.id !== id; }); });
        App.toast('Catégorie supprimée.', 'ok');
      },
    });
  }

  function viewRawJSON() {
    const json = App.S.exportJSON();
    App.openModal({
      title: '👁 Base de données JSON brute',
      wide: true,
      render: function (body) {
        const ta = h('textarea', { rows: 22, style: 'width:100%;font-family:monospace;font-size:11px' }, json);
        body.appendChild(ta);
        const actions = h('div', { class: 'form-actions' });
        actions.appendChild(h('button', { class: 'btn', onclick: App.closeModal }, 'Fermer'));
        actions.appendChild(h('button', {
          class: 'btn primary', onclick: function () {
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(json).then(function () { App.toast('JSON copié ✔', 'ok'); }, function () {});
            else { ta.select(); document.execCommand('copy'); App.toast('JSON copié ✔', 'ok'); }
          },
        }, '📋 Copier'));
        actions.appendChild(h('button', { class: 'btn', onclick: App.exportJSON }, '⬇ Télécharger'));
        body.appendChild(actions);
      },
    });
  }
})();
