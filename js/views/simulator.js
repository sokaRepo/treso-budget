(function () {
  'use strict';
  const App = window.App, C = App.C, h = App.h;

  App.registerView('simulator', { render: render });

  const FREQ = [['ponctuel', 'Ponctuel (une fois)'], ['mensuel', 'Tous les mois'], ['hebdo', 'Toutes les semaines'], ['trimestriel', 'Tous les 3 mois'], ['annuel', 'Tous les ans']];

  function simState() {
    if (!App.state.sim) {
      App.state.sim = { scenarioId: null, name: '', items: [], result: null };
    }
    return App.state.sim;
  }

  function render(container) {
    const db = App.S.get();
    const st = simState();

    // ---- Barre de gestion des scénarios ----
    const top = h('div', { class: 'panel' });
    top.appendChild(h('h2', {}, '🔮 Simulateur de décisions',
      h('span', { class: 'flex' },
        h('button', { class: 'btn small', onclick: newScenario }, '🆕 Nouveau'),
        h('button', { class: 'btn small', onclick: saveScenario }, '💾 Enregistrer le scénario'),
        db.scenarios.length ? scenarioSelect() : null,
        db.scenarios.length ? h('button', { class: 'btn small danger', onclick: deleteScenario }, '🗑 Supprimer') : null)));
    top.appendChild(h('p', { class: 'muted small' },
      'Composez un scénario (dépense, travaux, augmentation de salaire, prime, cadeaux, subvention attendue, hausse des tarifs…), puis lancez la simulation. ',
      'La prévision de base inclut déjà : dépenses récurrentes, salaires des salariés actifs et encaissement attendu des factures impayées.'));
    container.appendChild(top);

    // ---- Nom du scénario ----
    const namePanel = h('div', { class: 'panel' });
    const nameInput = h('input', { type: 'text', value: st.name, placeholder: 'Nom du scénario (ex : « Prime de fin d’année + hausse de salaire »)', style: 'min-width:320px;flex:2',
      oninput: function () { st.name = nameInput.value; } });
    namePanel.appendChild(h('div', { class: 'row' }, h('div', { class: 'field full' }, h('label', {}, 'Nom du scénario'), nameInput)));
    container.appendChild(namePanel);

    // ---- Formulaire d'ajout d'item ----
    const addPanel = h('div', { class: 'panel' });
    addPanel.appendChild(h('h2', {}, '➕ Ajouter un élément au scénario'));
    const typeSel = h('select', { style: 'min-width:240px' });
    for (const k in C.ITEM_TYPES) typeSel.appendChild(h('option', { value: k }, C.ITEM_TYPES[k].label));
    const label = h('input', { type: 'text', placeholder: 'Description (ex : Prime de Noël)', style: 'flex:2;min-width:200px' });
    const amount = h('input', { type: 'number', step: '0.01', min: '0', placeholder: 'Montant (€)', style: 'width:130px' });
    const start = h('input', { type: 'date', value: C.todayISO(), style: 'width:160px' });
    const freq = h('select', { style: 'width:170px' });
    for (const o of FREQ) freq.appendChild(h('option', { value: o[0] }, o[1]));
    const end = h('input', { type: 'date', style: 'width:160px', title: 'Date de fin (optionnel)' });
    function defaultFreq() {
      const t = typeSel.value;
      return (t === 'augmentation' || t === 'charge' || t === 'hausseTarif' || t === 'depenseRecurrente') ? 'mensuel' : 'ponctuel';
    }
    typeSel.addEventListener('change', function () { freq.value = defaultFreq(); });
    freq.value = defaultFreq();
    addPanel.appendChild(h('div', { class: 'row' },
      h('div', { class: 'field', style: 'flex:0 0 250px' }, h('label', {}, 'Type'), typeSel),
      h('div', { class: 'field', style: 'flex:2' }, h('label', {}, 'Libellé'), label),
      h('div', { class: 'field', style: 'flex:0 0 140px' }, h('label', {}, 'Montant (€)'), amount)));
    addPanel.appendChild(h('div', { class: 'row' },
      h('div', { class: 'field' }, h('label', {}, 'À partir du'), start),
      h('div', { class: 'field' }, h('label', {}, 'Fréquence'), freq),
      h('div', { class: 'field' }, h('label', {}, 'Jusqu’au (opt.)'), end),
      h('button', {
        class: 'btn primary', style: 'align-self:flex-end', onclick: function () {
          const amt = C.round2(parseFloat(amount.value));
          if (!label.value.trim() || !(amt > 0) || !start.value) { App.toast('Libellé, montant et date requis.', 'err'); return; }
          st.items.push({
            id: C.uid('sim'), type: typeSel.value, label: label.value.trim(), amount: amt,
            startDate: start.value, frequency: freq.value, endDate: end.value || null,
          });
          st.result = null;
          label.value = ''; amount.value = ''; end.value = '';
          App.renderView();
        },
      }, '＋ Ajouter')));
    // Exemple pré-rempli
    addPanel.appendChild(h('div', { class: 'mt' },
      h('button', { class: 'btn small', onclick: function () {
        const today = C.todayISO();
        const dec = C.monthKeyOf(today).slice(0, 8) + '20';
        st.items = [
          { id: C.uid('sim'), type: 'prime', label: 'Prime de fin d’année (tous les salariés)', amount: 1500, startDate: dec, frequency: 'ponctuel', endDate: null },
          { id: C.uid('sim'), type: 'augmentation', label: 'Augmentation de salaire (+150 €/mois)', amount: 150, startDate: C.addMonthsISO(today, 1).slice(0, 8) + '01', frequency: 'mensuel', endDate: null },
          { id: C.uid('sim'), type: 'travaux', label: 'Travaux de rénovation (peinture)', amount: 2500, startDate: C.addMonthsISO(today, 2).slice(0, 8) + '10', frequency: 'ponctuel', endDate: null },
          { id: C.uid('sim'), type: 'subvention', label: 'Subvention département espérée', amount: 5000, startDate: C.addMonthsISO(today, 3).slice(0, 8) + '15', frequency: 'ponctuel', endDate: null },
        ];
        st.name = 'Exemple : prime + augmentation + travaux + subvention';
        st.result = null;
        App.renderView();
      } }, '✨ Pré-remplir avec un exemple (prime, augmentation, travaux, subvention)')));
    container.appendChild(addPanel);

    // ---- Liste des items ----
    const listPanel = h('div', { class: 'panel' });
    listPanel.appendChild(h('h2', {}, '📋 Éléments du scénario (' + st.items.length + ')'));
    if (!st.items.length) {
      listPanel.appendChild(h('div', { class: 'empty' }, 'Aucun élément pour le moment. Ajoutez une dépense, une augmentation, une prime… ci-dessus.'));
    } else {
      for (const it of st.items) {
        const sign = C.itemSign(it.type);
        const freqTxt = it.frequency === 'ponctuel'
          ? 'le ' + C.fmtDate(it.startDate)
          : FREQ.find(function (f) { return f[0] === it.frequency; })[1].toLowerCase() + ' depuis le ' + C.fmtDate(it.startDate) + (it.endDate ? ' jusqu’au ' + C.fmtDate(it.endDate) : '');
        const row = h('div', { class: 'sim-item' },
          h('span', { class: 'tag ' + (sign < 0 ? 'red' : 'green') }, C.ITEM_TYPES[it.type].label),
          h('span', { class: 'lbl' }, it.label),
          h('span', { class: 'num ' + (sign < 0 ? 'neg' : 'pos') }, (sign < 0 ? '− ' : '+ ') + C.fmtEUR(it.amount)),
          h('span', { class: 'muted small' }, freqTxt),
          h('button', {
            class: 'btn small danger', onclick: function () {
              st.items = st.items.filter(function (x) { return x.id !== it.id; });
              st.result = null;
              App.renderView();
            },
          }, '✕'));
        listPanel.appendChild(row);
      }
    }
    const runRow = h('div', { class: 'form-actions' });
    runRow.appendChild(h('button', {
      class: 'btn primary', disabled: st.items.length ? null : 'disabled',
      onclick: function () {
        st.result = C.simulate(db, st.items, { horizonMonths: 24 });
        App.renderView();
        const el = document.getElementById('sim-results');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    }, '▶ Lancer la simulation (24 mois)'));
    listPanel.appendChild(runRow);
    container.appendChild(listPanel);

    // ---- Résultats ----
    if (st.result) renderResults(container, db, st);
  }

  function renderResults(container, db, st) {
    const res = st.result;
    const panel = h('div', { class: 'panel', id: 'sim-results' });
    panel.appendChild(h('h2', {}, '📊 Résultats de la simulation — « ' + (st.name || 'Scénario sans nom') + ' »'));

    // Alertes
    if (res.firstNegativeScen) {
      panel.appendChild(h('div', { class: 'alert red' },
        '🚨 Avec ce scénario, la trésorerie devient <strong>négative en ' + C.monthLabel(res.firstNegativeScen) + '</strong> (minimum ' + C.fmtEUR(res.minBalanceScen) + ').'));
    } else if (db.settings.minThreshold > 0 && res.minBalanceScen < db.settings.minThreshold) {
      panel.appendChild(h('div', { class: 'alert amber' },
        '⚠️ Avec ce scénario, la trésorerie passe sous le seuil d’alerte (' + C.fmtEUR(db.settings.minThreshold) + '). Minimum : ' + C.fmtEUR(res.minBalanceScen) + '.'));
    } else {
      panel.appendChild(h('div', { class: 'alert green' },
        '✅ Ce scénario reste soutenable : trésorerie minimale prévue de ' + C.fmtEUR(res.minBalanceScen) + ' sur 24 mois.'));
    }

    // KPIs
    const kpis = h('div', { class: 'kpi-row' });
    function kpi(k, v, s, cls) {
      kpis.appendChild(h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v ' + (cls || '') }, v), s ? h('div', { class: 's' }, s) : null));
    }
    kpi('Trésorerie min. (sans scénario)', C.fmtEUR(res.baseline.minBalance), res.firstNegativeBase ? 'négative dès ' + C.monthLabel(res.firstNegativeBase) : '');
    kpi('Trésorerie min. (avec scénario)', C.fmtEUR(res.minBalanceScen), res.firstNegativeScen ? 'négative dès ' + C.monthLabel(res.firstNegativeScen) : '', res.minBalanceScen < 0 ? 'neg' : 'pos');
    kpi('Solde fin horizon (24 mois) — avec scénario', C.fmtEUR(res.scenario.finalBalance), 'sans scénario : ' + C.fmtEUR(res.baseline.finalBalance), '');
    container.appendChild(panel);
    panel.appendChild(kpis);

    // ---- Tableau comparatif année en cours / suivante ----
    panel.appendChild(h('h3', {}, '🗓️ Impact par année'));
    const yt = h('table', { class: 'data' });
    yt.appendChild(h('thead', {}, h('tr', {},
      h('th', {}, 'Année'), h('th', { class: 'num' }, 'Recettes (base)'), h('th', { class: 'num' }, 'Recettes (scénario)'),
      h('th', { class: 'num' }, 'Dépenses (base)'), h('th', { class: 'num' }, 'Dépenses (scénario)'),
      h('th', { class: 'num' }, 'Résultat (base)'), h('th', { class: 'num' }, 'Résultat (scénario)'), h('th', { class: 'num' }, 'Δ résultat'), h('th', { class: 'num' }, 'Solde fin (scénario)'))));
    const yb = h('tbody', {});
    [['current', 'Année en cours (' + res.years.current.year + ')'], ['next', 'Année suivante (' + res.years.next.year + ')']].forEach(function (pair) {
      const y = res.years[pair[0]];
      const delta = C.round2(y.scen.net - y.base.net);
      yb.appendChild(h('tr', {},
        h('td', {}, h('strong', {}, pair[1])),
        h('td', { class: 'num' }, C.fmtEUR(y.base.in)),
        h('td', { class: 'num' }, C.fmtEUR(y.scen.in)),
        h('td', { class: 'num neg' }, '− ' + C.fmtEUR(y.base.out)),
        h('td', { class: 'num neg' }, '− ' + C.fmtEUR(y.scen.out)),
        h('td', { class: 'num ' + (y.base.net < 0 ? 'neg' : 'pos') }, (y.base.net < 0 ? '− ' : '+ ') + C.fmtEUR(Math.abs(y.base.net))),
        h('td', { class: 'num ' + (y.scen.net < 0 ? 'neg' : 'pos') }, (y.scen.net < 0 ? '− ' : '+ ') + C.fmtEUR(Math.abs(y.scen.net))),
        h('td', { class: 'num ' + (delta < 0 ? 'neg' : 'pos') }, (delta < 0 ? '− ' : '+ ') + C.fmtEUR(Math.abs(delta))),
        h('td', { class: 'num ' + (y.scen.endBalance < 0 ? 'neg' : '') }, C.fmtEUR(y.scen.endBalance))));
    });
    yt.appendChild(yb);
    panel.appendChild(yt);

    // ---- Graphique comparatif ----
    panel.appendChild(h('h3', {}, '📈 Trésorerie prévue : sans vs avec le scénario'));
    const chartBox = h('div', {});
    panel.appendChild(chartBox);
    panel.appendChild(h('div', { class: 'legend' },
      h('span', { class: 'item' }, h('span', { class: 'dot', style: 'background:#2563eb' }), 'Sans le scénario (prévision de base)'),
      h('span', { class: 'item' }, h('span', { class: 'dot', style: 'background:#dc2626' }), 'Avec le scénario')));
    const labels = res.scenario.months.map(function (m) { return m.label; });
    window.Charts.lineChart(chartBox, {
      labels: labels,
      series: [
        { points: res.baseline.months.map(function (m, i) { return { i: i, y: m.balance, label: m.label }; }), color: '#2563eb' },
        { points: res.scenario.months.map(function (m, i) { return { i: i, y: m.balance, label: m.label }; }), color: '#dc2626', dashed: true },
      ],
      height: 300,
    });

    // ---- Tableau mensuel détaillé ----
    panel.appendChild(h('h3', {}, '🗓️ Détail mois par mois (24 mois)'));
    const mt = h('table', { class: 'data' });
    mt.appendChild(h('thead', {}, h('tr', {},
      h('th', {}, 'Mois'), h('th', { class: 'num' }, 'Entrées (scénario)'), h('th', { class: 'num' }, 'Sorties (scénario)'),
      h('th', { class: 'num' }, 'Solde base'), h('th', { class: 'num' }, 'Solde scénario'), h('th', { class: 'num' }, 'Écart'))));
    const mb = h('tbody', {});
    res.scenario.months.forEach(function (m, i) {
      const b = res.baseline.months[i];
      const delta = C.round2(m.balance - b.balance);
      mb.appendChild(h('tr', {},
        h('td', {}, m.label + (i === 0 ? ' (en cours)' : '')),
        h('td', { class: 'num pos' }, m.in ? C.fmtEUR(m.in) : '—'),
        h('td', { class: 'num neg' }, m.out ? '− ' + C.fmtEUR(m.out) : '—'),
        h('td', { class: 'num ' + (b.balance < 0 ? 'neg' : '') }, C.fmtEUR(b.balance)),
        h('td', { class: 'num ' + (m.balance < 0 ? 'neg' : '') }, h('strong', {}, C.fmtEUR(m.balance))),
        h('td', { class: 'num ' + (delta < 0 ? 'neg' : 'pos') }, delta !== 0 ? (delta < 0 ? '− ' : '+ ') + C.fmtEUR(Math.abs(delta)) : '—')));
    });
    mt.appendChild(mb);
    panel.appendChild(mt);
    container.appendChild(panel);
  }

  function scenarioSelect() {
    const st = simState();
    const sel = h('select', { style: 'min-width:260px', onchange: function () {
      const sc = App.S.get().scenarios.find(function (x) { return x.id === sel.value; });
      if (sc) {
        st.scenarioId = sc.id; st.name = sc.name; st.items = sc.items.map(function (i) { return Object.assign({}, i); }); st.result = null;
        App.renderView();
      }
    } });
    sel.appendChild(h('option', { value: '' }, '— Charger un scénario enregistré —'));
    for (const sc of App.S.get().scenarios) {
      sel.appendChild(h('option', { value: sc.id, selected: st.scenarioId === sc.id ? 'selected' : null }, sc.name + ' (' + sc.items.length + ' élém.)'));
    }
    return sel;
  }

  function newScenario() {
    const st = simState();
    st.scenarioId = null; st.name = ''; st.items = []; st.result = null;
    App.renderView();
    App.toast('Nouveau scénario — ajoutez des éléments ci-dessous.');
  }

  function saveScenario() {
    const st = simState();
    if (!st.items.length) { App.toast('Ajoutez au moins un élément avant d’enregistrer.', 'err'); return; }
    if (!st.name.trim()) { App.toast('Donnez un nom au scénario.', 'err'); return; }
    App.S.update(function (d) {
      const sc = {
        id: st.scenarioId || C.uid('scen'), name: st.name.trim(),
        createdAt: C.todayISO(), items: st.items.map(function (i) {
          return { id: i.id, type: i.type, label: i.label, amount: i.amount, startDate: i.startDate, frequency: i.frequency, endDate: i.endDate };
        }),
      };
      const i = d.scenarios.findIndex(function (x) { return x.id === sc.id; });
      if (i >= 0) d.scenarios[i] = sc; else d.scenarios.push(sc);
      st.scenarioId = sc.id;
    });
    App.toast('Scénario « ' + st.name.trim() + ' » enregistré ✔', 'ok');
    App.renderView();
  }

  function deleteScenario() {
    const st = simState();
    if (!st.scenarioId) { App.toast('Sélectionnez d’abord un scénario à supprimer.', 'err'); return; }
    App.confirmDialog({
      title: 'Supprimer le scénario',
      text: 'Supprimer « ' + st.name + ' » ?',
      danger: true, okLabel: 'Supprimer',
      onConfirm: function () {
        App.S.update(function (d) { d.scenarios = d.scenarios.filter(function (x) { return x.id !== st.scenarioId; }); });
        newScenario();
        App.toast('Scénario supprimé.', 'ok');
      },
    });
  }
})();
