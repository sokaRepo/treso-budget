(function () {
  'use strict';
  const App = window.App, C = App.C, h = App.h;

  App.registerView('expenses', { render: render });

  function filters() {
    if (!App.state.filters.expenses) App.state.filters.expenses = { month: 'all', cat: 'all', q: '', kind: 'all' };
    return App.state.filters.expenses;
  }

  const KEYWORDS = [
    [/loyer|foncier/i, 'loyer'], [/salaire|paie|urssaf|pole emploi|pôle emploi/i, 'salaires'],
    [/course|carrefour|leclerc|auchan|lidl|intermarche|super u|primeur|boulanger|traiteur|marché/i, 'courses'],
    [/edf|engie|gaz|eau|veolia|suez|chauffage/i, 'energie'], [/assurance|macif|maif|groupama|allianz/i, 'assurances'],
    [/internet|orange|sfr|free|bouygues|ovh|telephone|teléphone/i, 'abonnements'],
    [/travaux|leroy|bricolage|brico|castorama|peinture|plombier|electricien|électricien|menuisier/i, 'travaux'],
    [/banque|frais bancaires|agios|commission/i, 'banque'], [/impot|impôt|taxe|cfe|cvae/i, 'impots'],
    [/sncf|essence|carburant|péage|peage|uber|taxi|transport/i, 'transports'],
    [/resto|restaurant|cantines?|repas/i, 'restauration'], [/formation|livre|magazine|documentation/i, 'formations'],
    [/fourniture|papier|peinture|jouet|jeu|petit materiel|petit matériel/i, 'fournitures'],
  ];
  function guessCategory(label) {
    for (const [re, cat] of KEYWORDS) if (re.test(label || '')) return cat;
    return 'autre_dep';
  }

  function monthOptions(db) {
    const keys = new Set();
    for (const e of db.expenses) keys.add(C.monthKeyOf(e.date));
    for (const r of db.recurring) keys.add(C.monthKeyOf(r.startDate));
    const today = C.todayISO();
    keys.add(C.monthKeyOf(today));
    return Array.from(keys).sort().reverse();
  }

  function render(container) {
    const db = App.S.get();
    const f = filters();
    const today = C.todayISO();

    // ---- Barre d'actions + filtres ----
    const top = h('div', { class: 'panel' });
    const btnRow = h('div', { class: 'flex mb' });
    btnRow.appendChild(h('button', { class: 'btn primary', onclick: addExpense }, '＋ Nouvelle dépense'));
    btnRow.appendChild(h('button', { class: 'btn', onclick: addRecurring }, '🔁 Nouvelle dépense/recette récurrente'));
    btnRow.appendChild(h('button', { class: 'btn', onclick: importCSV }, '⬆ Importer un relevé bancaire (CSV)'));
    top.appendChild(btnRow);

    const frow = h('div', { class: 'filters' });
    const monthSel = h('select', { onchange: function () { f.month = monthSel.value; App.renderView(); } });
    monthSel.appendChild(h('option', { value: 'all' }, 'Tous les mois'));
    for (const k of monthOptions(db)) monthSel.appendChild(h('option', { value: k, selected: f.month === k ? 'selected' : null }, C.monthLabel(k)));
    const catSel = h('select', { onchange: function () { f.cat = catSel.value; App.renderView(); } });
    catSel.appendChild(h('option', { value: 'all' }, 'Toutes catégories'));
    for (const c of db.categories.filter(function (c) { return c.type === 'expense'; })) {
      catSel.appendChild(h('option', { value: c.id, selected: f.cat === c.id ? 'selected' : null }, c.label));
    }
    const kindSel = h('select', { onchange: function () { f.kind = kindSel.value; App.renderView(); } });
    [['all', 'Toutes'], ['manual', 'Saisies manuellement'], ['recurring', 'Récurrentes']].forEach(function (o) {
      kindSel.appendChild(h('option', { value: o[0], selected: f.kind === o[0] ? 'selected' : null }, o[1]));
    });
    const q = h('input', { type: 'search', placeholder: 'Rechercher un libellé…', value: f.q, style: 'min-width:200px',
      oninput: function () { f.q = q.value; renderTable(); } });
    frow.appendChild(h('div', { class: 'field' }, h('label', {}, 'Mois'), monthSel));
    frow.appendChild(h('div', { class: 'field' }, h('label', {}, 'Catégorie'), catSel));
    frow.appendChild(h('div', { class: 'field' }, h('label', {}, 'Type'), kindSel));
    frow.appendChild(h('div', { class: 'field', style: 'min-width:220px' }, h('label', {}, 'Recherche'), q));
    top.appendChild(frow);
    container.appendChild(top);

    // ---- Tableau ----
    const tablePanel = h('div', { class: 'panel' });
    container.appendChild(tablePanel);

    function renderTable() {
      tablePanel.innerHTML = '';
      tablePanel.appendChild(h('h2', {}, '💸 Dépenses & sorties d’argent'));
      const from = f.month === 'all' ? '0000-01-01' : C.monthStartISO(f.month);
      const to = f.month === 'all' ? today : C.monthEndISO(f.month);
      const rows = [];
      for (const e of db.expenses) {
        if (C.compareISO(e.date, from) < 0 || C.compareISO(e.date, to) > 0) continue;
        if (f.cat !== 'all' && e.categoryId !== f.cat) continue;
        rows.push({ date: e.date, label: e.label, categoryId: e.categoryId, amount: e.amount, method: e.method, note: e.note, id: e.id, recurring: false, bankRef: e.bankRef });
      }
      const rec = C.expandRecurrings(db, from, to);
      for (const o of rec.expenses) {
        if (f.cat !== 'all' && o.categoryId !== f.cat) continue;
        rows.push({ date: o.date, label: o.label, categoryId: o.categoryId, amount: o.amount, method: 'Récurrent', note: '', id: null, recurring: true, recurringId: o.recurringId, pointed: db.pointed.some(function (p) { return p.recurringId === o.recurringId && p.date === o.date; }) });
      }
      if (f.kind === 'manual') rows = rows.filter(function (r) { return !r.recurring; });
      if (f.kind === 'recurring') rows = rows.filter(function (r) { return r.recurring; });
      if (f.q) {
        const nq = C.normalizeLabel(f.q);
        rows = rows.filter(function (r) { return C.normalizeLabel(r.label).indexOf(nq) !== -1; });
      }
      rows.sort(function (a, b) { return C.compareISO(b.date, a.date) || (b.amount - a.amount); });

      if (!rows.length) {
        tablePanel.appendChild(h('div', { class: 'empty' },
          h('div', { class: 'big' }, '🧾'), 'Aucune dépense sur cette période.',
          h('div', { class: 'mt' }, 'Ajoutez une dépense manuellement ou importez un relevé bancaire CSV.')));
        return;
      }
      const tbl = h('table', { class: 'data' });
      tbl.appendChild(h('thead', {}, h('tr', {},
        h('th', {}, 'Date'), h('th', {}, 'Libellé'), h('th', {}, 'Catégorie'), h('th', {}, 'Méthode'),
        h('th', { class: 'num' }, 'Montant'), h('th', {}, 'Infos'), h('th', {}, 'Actions'))));
      const tbody = h('tbody', {});
      let total = 0;
      for (const r of rows) {
        total = C.round2(total + r.amount);
        const cat = C.categoryOf(db, r.categoryId);
        const tr = h('tr', {},
          h('td', { class: 'mono' }, C.fmtDate(r.date)),
          h('td', {}, r.label),
          h('td', {}, h('span', { class: 'dot', style: 'background:' + cat.color }), cat.label),
          h('td', {}, r.method || '—'),
          h('td', { class: 'num neg' }, '− ' + C.fmtEUR(r.amount)),
          h('td', {}, r.recurring
            ? h('span', { class: 'tag blue' }, r.pointed ? 'récurrent ✔ pointé' : 'récurrent')
            : (r.bankRef ? h('span', { class: 'tag gray' }, 'relevé bancaire') : h('span', { class: 'tag gray' }, 'manuel'))),
          h('td', { class: 'flex' },
            r.recurring
              ? h('button', { class: 'btn small', title: 'Modifier la règle récurrente', onclick: function () { editRecurring(r.recurringId); } }, 'Règle')
              : [h('button', { class: 'btn small', onclick: function () { editExpense(r.id); } }, 'Modifier'),
                 h('button', { class: 'btn small danger', onclick: function () { delExpense(r.id); } }, 'Suppr.')]));
        tbody.appendChild(tr);
      }
      tbl.appendChild(tbody);
      const tfoot = h('tfoot', {}, h('tr', {},
        h('td', { colspan: 4 }, h('strong', {}, 'Total : ' + rows.length + ' opération(s)')),
        h('td', { class: 'num neg' }, h('strong', {}, '− ' + C.fmtEUR(total))),
        h('td', { colspan: 2 }, '')));
      tbl.appendChild(tfoot);
      tablePanel.appendChild(tbl);
    }
    renderTable();

    // ---- Règles récurrentes ----
    const recPanel = h('div', { class: 'panel' });
    recPanel.appendChild(h('h2', {}, '🔁 Règles récurrentes (loyer, abonnements, courses hebdo…)'));
    if (!db.recurring.length) {
      recPanel.appendChild(h('div', { class: 'empty' }, 'Aucune règle récurrente. Elles sont automatiquement prises en compte dans la trésorerie et les prévisions.'));
    } else {
      const tbl = h('table', { class: 'data' });
      tbl.appendChild(h('thead', {}, h('tr', {},
        h('th', {}, 'Type'), h('th', {}, 'Libellé'), h('th', {}, 'Catégorie'), h('th', { class: 'num' }, 'Montant'),
        h('th', {}, 'Fréquence'), h('th', {}, 'Début'), h('th', {}, 'Fin'), h('th', {}, 'Actions'))));
      const tbody = h('tbody', {});
      const freqLabel = { mensuel: 'Mensuel', hebdo: 'Hebdomadaire', trimestriel: 'Trimestriel', annuel: 'Annuel' };
      for (const r of db.recurring.slice().sort(function (a, b) { return C.compareISO(a.startDate, b.startDate); })) {
        const cat = C.categoryOf(db, r.categoryId);
        tbody.appendChild(h('tr', {},
          h('td', {}, h('span', { class: 'tag ' + (r.kind === 'revenue' ? 'green' : 'red') }, r.kind === 'revenue' ? 'Recette' : 'Dépense')),
          h('td', {}, r.label),
          h('td', {}, h('span', { class: 'dot', style: 'background:' + cat.color }), cat.label),
          h('td', { class: 'num ' + (r.kind === 'revenue' ? 'pos' : 'neg') }, (r.kind === 'revenue' ? '+ ' : '− ') + C.fmtEUR(r.amount)),
          h('td', {}, freqLabel[r.frequency] + (r.frequency !== 'hebdo' && r.dayOfMonth ? ' (le ' + r.dayOfMonth + ')' : '')),
          h('td', { class: 'mono' }, C.fmtDate(r.startDate)),
          h('td', { class: 'mono' }, r.endDate ? C.fmtDate(r.endDate) : '—'),
          h('td', { class: 'flex' },
            h('button', { class: 'btn small', onclick: function () { editRecurring(r.id); } }, 'Modifier'),
            h('button', { class: 'btn small danger', onclick: function () { delRecurring(r.id); } }, 'Suppr.'))));
      }
      tbl.appendChild(tbody);
      recPanel.appendChild(tbl);
    }
    container.appendChild(recPanel);
  }

  // ---------- Modales ----------
  function expenseModal(existing) {
    const db = App.S.get();
    App.openModal({
      title: existing ? 'Modifier la dépense' : 'Nouvelle dépense',
      render: function (body) {
        const f = h('form', {});
        const date = h('input', { type: 'date', required: 'required', value: existing ? existing.date : C.todayISO() });
        const label = h('input', { type: 'text', required: 'required', value: existing ? existing.label : '', placeholder: 'ex : Courses supermarché' });
        const cat = h('select', {});
        for (const c of db.categories.filter(function (c) { return c.type === 'expense'; })) {
          cat.appendChild(h('option', { value: c.id, selected: existing && existing.categoryId === c.id ? 'selected' : null }, c.label));
        }
        if (existing && !db.categories.some(function (c) { return c.id === existing.categoryId; })) cat.appendChild(h('option', { value: existing.categoryId, selected: 'selected' }, existing.categoryId));
        const amount = h('input', { type: 'number', step: '0.01', min: '0.01', required: 'required', value: existing ? existing.amount : '', placeholder: '0.00' });
        const method = h('select', {});
        for (const m of db.settings.paymentMethods) method.appendChild(h('option', { value: m, selected: existing && existing.method === m ? 'selected' : null }, m));
        const note = h('input', { type: 'text', value: existing ? (existing.note || '') : '' });
        f.appendChild(h('div', { class: 'row' },
          h('div', { class: 'field' }, h('label', {}, 'Date'), date),
          h('div', { class: 'field' }, h('label', {}, 'Montant (€)'), amount)));
        f.appendChild(h('div', { class: 'row' },
          h('div', { class: 'field', style: 'flex:2' }, h('label', {}, 'Libellé'), label),
          h('div', { class: 'field' }, h('label', {}, 'Catégorie'), cat)));
        f.appendChild(h('div', { class: 'row' },
          h('div', { class: 'field' }, h('label', {}, 'Moyen de paiement'), method),
          h('div', { class: 'field' }, h('label', {}, 'Note'), note)));
        const actions = h('div', { class: 'form-actions' });
        actions.appendChild(h('button', { type: 'button', class: 'btn', onclick: App.closeModal }, 'Annuler'));
        actions.appendChild(h('button', { type: 'submit', class: 'btn primary' }, existing ? 'Enregistrer' : 'Ajouter'));
        f.appendChild(actions);
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          if (!label.value.trim() || !(parseFloat(amount.value) > 0)) { App.toast('Libellé et montant requis.', 'err'); return; }
          App.S.update(function (d) {
            if (existing) {
              Object.assign(existing, { date: date.value, label: label.value.trim(), categoryId: cat.value, amount: C.round2(parseFloat(amount.value)), method: method.value, note: note.value.trim() });
            } else {
              d.expenses.push({ id: C.uid('dep'), date: date.value, label: label.value.trim(), categoryId: cat.value, amount: C.round2(parseFloat(amount.value)), method: method.value, note: note.value.trim(), bankRef: null });
            }
          });
          App.closeModal();
          App.toast(existing ? 'Dépense modifiée ✔' : 'Dépense ajoutée ✔', 'ok');
        });
        body.appendChild(f);
      },
    });
  }
  function addExpense() { expenseModal(null); }
  function editExpense(id) {
    const e = App.S.get().expenses.find(function (x) { return x.id === id; });
    if (e) expenseModal(e);
  }
  function delExpense(id) {
    App.confirmDialog({
      title: 'Supprimer la dépense',
      text: 'Supprimer définitivement cette dépense ?',
      danger: true, okLabel: 'Supprimer',
      onConfirm: function () {
        App.S.update(function (d) { d.expenses = d.expenses.filter(function (x) { return x.id !== id; }); });
        App.toast('Dépense supprimée.', 'ok');
      },
    });
  }

  function recurringModal(existing) {
    const db = App.S.get();
    App.openModal({
      title: existing ? 'Modifier la règle récurrente' : 'Nouvelle règle récurrente',
      render: function (body) {
        const f = h('form', {});
        const kind = h('select', {});
        [['expense', 'Dépense (sortie)'], ['revenue', 'Recette (entrée)']].forEach(function (o) {
          kind.appendChild(h('option', { value: o[0], selected: existing && existing.kind === o[0] ? 'selected' : null }, o[1]));
        });
        const label = h('input', { type: 'text', required: 'required', value: existing ? existing.label : '', placeholder: 'ex : Loyer' });
        const cat = h('select', {});
        function fillCats() {
          cat.innerHTML = '';
          for (const c of db.categories.filter(function (c) { return c.type === (kind.value === 'revenue' ? 'revenue' : 'expense'); })) {
            cat.appendChild(h('option', { value: c.id, selected: existing && existing.categoryId === c.id ? 'selected' : null }, c.label));
          }
        }
        kind.addEventListener('change', fillCats);
        fillCats();
        const amount = h('input', { type: 'number', step: '0.01', min: '0.01', required: 'required', value: existing ? existing.amount : '' });
        const freq = h('select', {});
        [['mensuel', 'Mensuelle'], ['hebdo', 'Hebdomadaire'], ['trimestriel', 'Trimestrielle'], ['annuel', 'Annuelle']].forEach(function (o) {
          freq.appendChild(h('option', { value: o[0], selected: existing && existing.frequency === o[0] ? 'selected' : null }, o[1]));
        });
        const dom = h('input', { type: 'number', min: '1', max: '31', value: existing ? (existing.dayOfMonth || '') : '', placeholder: 'Jour du mois' });
        const start = h('input', { type: 'date', required: 'required', value: existing ? existing.startDate : C.todayISO() });
        const end = h('input', { type: 'date', value: existing && existing.endDate ? existing.endDate : '' });
        f.appendChild(h('div', { class: 'row' },
          h('div', { class: 'field' }, h('label', {}, 'Type'), kind),
          h('div', { class: 'field', style: 'flex:2' }, h('label', {}, 'Libellé'), label),
          h('div', { class: 'field' }, h('label', {}, 'Catégorie'), cat)));
        f.appendChild(h('div', { class: 'row' },
          h('div', { class: 'field' }, h('label', {}, 'Montant (€)'), amount),
          h('div', { class: 'field' }, h('label', {}, 'Fréquence'), freq),
          h('div', { class: 'field' }, h('label', {}, 'Jour du mois (si mensuel+)'), dom)));
        f.appendChild(h('div', { class: 'row' },
          h('div', { class: 'field' }, h('label', {}, 'Date de début'), start),
          h('div', { class: 'field' }, h('label', {}, 'Date de fin (optionnel)'), end)));
        const actions = h('div', { class: 'form-actions' });
        actions.appendChild(h('button', { type: 'button', class: 'btn', onclick: App.closeModal }, 'Annuler'));
        actions.appendChild(h('button', { type: 'submit', class: 'btn primary' }, 'Enregistrer'));
        f.appendChild(actions);
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          if (!label.value.trim() || !(parseFloat(amount.value) > 0) || !start.value) { App.toast('Champs requis manquants.', 'err'); return; }
          const rec = {
            id: existing ? existing.id : C.uid('rec'),
            kind: kind.value, label: label.value.trim(), categoryId: cat.value,
            amount: C.round2(parseFloat(amount.value)),
            frequency: freq.value,
            dayOfMonth: parseInt(dom.value || '1', 10) || 1,
            startDate: start.value, endDate: end.value || null,
          };
          App.S.update(function (d) {
            if (existing) {
              const i = d.recurring.findIndex(function (x) { return x.id === existing.id; });
              if (i >= 0) d.recurring[i] = rec;
            } else d.recurring.push(rec);
          });
          App.closeModal();
          App.toast('Règle enregistrée ✔', 'ok');
        });
        body.appendChild(f);
      },
    });
  }
  function addRecurring() { recurringModal(null); }
  function editRecurring(id) {
    const r = App.S.get().recurring.find(function (x) { return x.id === id; });
    if (r) recurringModal(r);
  }
  function delRecurring(id) {
    App.confirmDialog({
      title: 'Supprimer la règle récurrente',
      text: 'La règle sera supprimée (les opérations déjà pointées restent dans l’historique).',
      danger: true, okLabel: 'Supprimer',
      onConfirm: function () {
        App.S.update(function (d) {
          d.recurring = d.recurring.filter(function (x) { return x.id !== id; });
          d.pointed = d.pointed.filter(function (p) { return p.recurringId !== id; });
        });
        App.toast('Règle supprimée.', 'ok');
      },
    });
  }

  // ---------- Import relevé bancaire CSV ----------
  function importCSV() {
    App.openModal({
      title: '⬆ Importer un relevé bancaire (CSV)',
      wide: true,
      render: function (body) {
        body.appendChild(h('p', { class: 'muted small' },
          'Formats acceptés : CSV français (point-virgule ou virgule), avec colonnes Date / Libellé / Débit-Crédit ou Montant. Exemple : « 05/01/2025;LOYER JANVIER;1200,00; » ou « 2025-01-05;Courses; ;85,30 ».'));
        const fileInput = h('input', { type: 'file', accept: '.csv,.txt,.ofx' });
        body.appendChild(h('div', { class: 'row' }, h('div', { class: 'field full' }, h('label', {}, 'Fichier du relevé'), fileInput)));
        const zone = h('div', { class: 'mt' });
        body.appendChild(zone);
        fileInput.addEventListener('change', function () {
          const file = fileInput.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function () { preview(String(reader.result), zone); };
          reader.onerror = function () { App.toast('Lecture impossible.', 'err'); };
          reader.readAsText(file);
        });
      },
    });
  }

  function preview(text, zone) {
    zone.innerHTML = '';
    const parsed = C.parseBankCSV(text);
    if (!parsed.ok) { zone.appendChild(h('div', { class: 'alert red' }, '❌ ' + parsed.error)); return; }
    const db = App.S.get();
    const existing = new Set(db.bankRefs);
    let dup = 0;
    const rows = parsed.rows.map(function (r) {
      const sig = C.bankRowSignature(r);
      const isDup = existing.has(sig);
      if (isDup) dup++;
      return { row: r, sig: sig, dup: isDup, cat: guessCategory(r.label), checked: !isDup };
    });
    zone.appendChild(h('p', {}, h('strong', {}, rows.length + ' opération(s) reconnue(s)'),
      ' — ' + dup + ' déjà importée(s) (décochées), ' + parsed.skipped + ' ignorée(s). Cochez ce que vous voulez importer, choisissez la catégorie :'));
    const tbl = h('table', { class: 'data' });
    tbl.appendChild(h('thead', {}, h('tr', {},
      h('th', {}), h('th', {}, 'Date'), h('th', {}, 'Libellé'), h('th', { class: 'num' }, 'Montant'), h('th', {}, 'Catégorie'), h('th', {}, 'Note'))));
    const tbody = h('tbody', {});
    rows.forEach(function (r, i) {
      const cb = h('input', { type: 'checkbox', checked: r.checked ? 'checked' : null });
      cb.addEventListener('change', function () { r.checked = cb.checked; });
      const catSel = h('select', {});
      const cats = db.categories.filter(function (c) { return r.row.amount < 0 ? c.type === 'expense' : c.type === 'revenue'; });
      for (const c of cats) catSel.appendChild(h('option', { value: c.id, selected: r.cat === c.id ? 'selected' : null }, c.label));
      catSel.addEventListener('change', function () { r.cat = catSel.value; });
      tbody.appendChild(h('tr', { style: r.dup ? 'opacity:.45' : '' },
        h('td', {}, cb),
        h('td', { class: 'mono' }, C.fmtDate(r.row.dateISO)),
        h('td', {}, r.row.label + (r.dup ? ' (doublon)' : '')),
        h('td', { class: 'num ' + (r.row.amount < 0 ? 'neg' : 'pos') }, (r.row.amount < 0 ? '− ' : '+ ') + C.fmtEUR(Math.abs(r.row.amount))),
        h('td', {}, catSel),
        h('td', { class: 'muted small' }, r.row.note || '')));
    });
    tbl.appendChild(tbody);
    const wrap = h('div', { class: 'preview-table' });
    wrap.appendChild(tbl);
    zone.appendChild(wrap);
    const actions = h('div', { class: 'form-actions mt' });
    actions.appendChild(h('button', {
      class: 'btn', onclick: function () {
        rows.forEach(function (r) { r.checked = true; });
        zone.querySelectorAll('input[type=checkbox]').forEach(function (c, i) { c.checked = true; });
      },
    }, 'Tout cocher'));
    actions.appendChild(h('button', {
      class: 'btn', onclick: function () {
        rows.forEach(function (r) { r.checked = false; });
        zone.querySelectorAll('input[type=checkbox]').forEach(function (c) { c.checked = false; });
      },
    }, 'Tout décocher'));
    actions.appendChild(h('button', {
      class: 'btn primary', onclick: function () {
        let imported = 0, pointed = 0, skipped = 0;
        App.S.update(function (d) {
          for (const r of rows) {
            if (!r.checked) { skipped++; continue; }
            if (d.bankRefs.includes(r.sig)) { skipped++; continue; }
            const match = C.matchRecurring(d, r.row);
            if (match && r.row.amount < 0) {
              if (!d.pointed.some(function (p) { return p.recurringId === match.recurringId && p.date === match.date; })) {
                d.pointed.push({ recurringId: match.recurringId, date: match.date });
              }
              pointed++;
            } else if (r.row.amount < 0) {
              d.expenses.push({ id: C.uid('dep'), date: r.row.dateISO, label: r.row.label, categoryId: r.cat, amount: C.round2(Math.abs(r.row.amount)), method: 'Relevé bancaire', note: r.row.note || '', bankRef: r.sig });
              imported++;
            } else {
              d.revenues.push({ id: C.uid('rev'), date: r.row.dateISO, label: r.row.label, categoryId: r.cat === 'paiements' ? 'autre_rec' : r.cat, amount: C.round2(r.row.amount), method: 'Relevé bancaire', note: r.row.note || '', subventionId: null });
              imported++;
            }
            d.bankRefs.push(r.sig);
          }
        });
        App.closeModal();
        App.toast('Import terminé : ' + imported + ' opération(s) ajoutée(s), ' + pointed + ' pointée(s) sur une règle récurrente, ' + skipped + ' ignorée(s).', 'ok');
      },
    }, '💾 Importer la sélection'));
    zone.appendChild(actions);
  }
})();
