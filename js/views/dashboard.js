(function () {
  'use strict';
  const App = window.App, C = App.C, h = App.h;

  App.registerView('dashboard', { render: render });

  function render(container) {
    const db = App.S.get();
    const today = C.todayISO();
    const curKey = C.monthKeyOf(today);
    const cur = C.monthlyReport(db, curKey);

    // Factures impayées
    let unpaid = 0, late = 0;
    const lateInvs = [];
    for (const inv of db.invoices) {
      const st = C.invoiceStatus(inv, today);
      if (st.remaining > 0) {
        unpaid = C.round2(unpaid + st.remaining);
        if (st.status === 'en retard') { late = C.round2(late + st.remaining); lateInvs.push({ inv: inv, st: st }); }
      }
    }

    // Prévisions
    const to6 = C.monthEndISO(C.monthKeyOf(C.addMonthsISO(today, 5)));
    const proj6 = C.project(db, today, to6, []);
    const projYear = C.project(db, today, C.monthEndISO(C.yearOf(today) + '-12-31'), []);
    const th = db.settings.minThreshold || 0;
    const bal = C.balanceAt(db, today);

    // ---- KPI ----
    const kpis = h('div', { class: 'kpi-row' });
    function kpi(k, v, s, cls) {
      kpis.appendChild(h('div', { class: 'stat' },
        h('div', { class: 'k' }, k),
        h('div', { class: 'v ' + (cls || '') }, v),
        s ? h('div', { class: 's' }, s) : null));
    }
    kpi('Solde aujourd’hui', C.fmtEUR(bal), C.fmtDate(today), bal < 0 ? 'neg' : 'pos');
    kpi('Recettes du mois', C.fmtEUR(cur.in), 'dont familles : ' + C.fmtEUR(cur.payments), 'pos');
    kpi('Dépenses du mois', C.fmtEUR(cur.out), 'solde du mois : ' + C.fmtEUR(cur.net), cur.net < 0 ? 'neg' : 'pos');
    kpi('Impayés familles', C.fmtEUR(unpaid), late > 0 ? 'dont en retard : ' + C.fmtEUR(late) : 'aucun retard', late > 0 ? 'neg' : '');
    const endMonth = proj6.months.length ? proj6.months[0].balance : bal;
    kpi('Trésorerie fin de mois (prévu)', C.fmtEUR(endMonth), 'projection à partir d’aujourd’hui', endMonth < th ? 'neg' : '');
    kpi('Trésorerie fin ' + C.yearOf(today) + ' (prévu)', C.fmtEUR(projYear.finalBalance), 'min prévu : ' + C.fmtEUR(projYear.minBalance), projYear.minBalance < th ? 'neg' : 'pos');
    container.appendChild(kpis);

    // ---- Alertes ----
    const alerts = h('div', {});
    if (lateInvs.length) {
      alerts.appendChild(h('div', { class: 'alert red' },
        h('span', {}, '⚠️'),
        h('div', {},
          h('strong', {}, lateInvs.length + ' facture(s) en retard — ' + C.fmtEUR(late) + ' à relancer : '),
          lateInvs.map(function (x) { return (C.familyOf(db, x.inv.familyId) || {}).name + ' (' + x.inv.number + ')'; }).join(', '))));
    }
    if (proj6.firstNegativeKey) {
      alerts.appendChild(h('div', { class: 'alert red' },
        h('span', {}, '🚨'),
        h('div', {}, 'La trésorerie prévisionnelle devient <strong>négative en ' + C.monthLabel(proj6.firstNegativeKey) + '</strong> (min : ' + C.fmtEUR(proj6.minBalance) + ').')));
    } else if (th > 0 && proj6.minBalance < th) {
      alerts.appendChild(h('div', { class: 'alert amber' },
        h('span', {}, '⚠️'),
        h('div', {}, 'La trésorerie prévisionnelle passe sous votre seuil d’alerte (' + C.fmtEUR(th) + ') en ' + C.monthLabel(proj6.months.reduce(function (a, m) { return m.balance < th ? m : a; }, proj6.months[0]).key) + ' — minimum ' + C.fmtEUR(proj6.minBalance) + '.')));
    }
    if (!alerts.childNodes.length) {
      alerts.appendChild(h('div', { class: 'alert green' }, h('span', {}, '✅'), h('div', {}, 'Aucune alerte : trésorerie saine sur les 6 prochains mois.')));
    }
    container.appendChild(alerts);

    // ---- Graphique évolution ----
    const chartPanel = h('div', { class: 'panel' });
    chartPanel.appendChild(h('h2', {}, '📈 Évolution de la trésorerie (12 derniers mois + prévision 6 mois)'));
    const chartBox = h('div', {});
    chartPanel.appendChild(chartBox);
    const legend = h('div', { class: 'legend' },
      h('span', { class: 'item' }, h('span', { class: 'dot', style: 'background:#2563eb' }), 'Réalisé (journalier)'),
      h('span', { class: 'item' }, h('span', { class: 'dot', style: 'background:#d97706' }), 'Prévisionnel (mensuel, sans changement)'));
    chartPanel.appendChild(legend);
    container.appendChild(chartPanel);

    const from = C.addMonthsISO(today, -12);
    const actual = C.balanceSeriesDaily(db, from, today);
    const labels = actual.map(function (p) { return C.fmtDate(p.date); });
    const baseIdx = labels.length;
    for (const m of proj6.months) labels.push(m.label + ' (prév.)');
    window.Charts.lineChart(chartBox, {
      labels: labels,
      series: [
        { points: actual.map(function (p, i) { return { i: i, y: p.balance, label: C.fmtDate(p.date) }; }), color: '#2563eb' },
        { points: proj6.months.map(function (m, k) { return { i: baseIdx + k, y: m.balance, label: m.label }; }), color: '#d97706', dashed: true },
      ],
      height: 280,
    });

    // ---- Deux graphiques côte à côte ----
    const grid = h('div', { class: 'grid cols-2' });
    const pDep = h('div', { class: 'panel' });
    pDep.appendChild(h('h2', {}, '💸 Dépenses du mois en cours par catégorie'));
    const depBox = h('div', { class: 'flex', style: 'align-items:center;gap:18px;flex-wrap:wrap' });
    const donutBox = h('div', {});
    depBox.appendChild(donutBox);
    const depLegend = h('div', { class: 'legend', style: 'flex-direction:column;align-items:flex-start' });
    depBox.appendChild(depLegend);
    pDep.appendChild(depBox);
    grid.appendChild(pDep);

    const pNet = h('div', { class: 'panel' });
    pNet.appendChild(h('h2', {}, '📊 Résultat net des 12 derniers mois'));
    const netBox = h('div', {});
    pNet.appendChild(netBox);
    grid.appendChild(pNet);
    container.appendChild(grid);

    const depCats = [];
    for (const catId in cur.byCategory) {
      const cat = C.categoryOf(db, catId);
      depCats.push({ label: cat.label, value: cur.byCategory[catId], color: cat.color });
    }
    depCats.sort(function (a, b) { return b.value - a.value; });
    if (depCats.length) {
      window.Charts.donut(donutBox, depCats, { centerLabel: 'Dépenses' });
      for (const c of depCats.slice(0, 10)) {
        depLegend.appendChild(h('span', { class: 'item' },
          h('span', { class: 'dot', style: 'background:' + c.color }), c.label + ' : ' + C.fmtEUR(c.value)));
      }
    } else {
      donutBox.appendChild(h('div', { class: 'empty' }, 'Aucune dépense ce mois-ci'));
    }

    const months12 = C.monthKeysBetween(C.monthKeyOf(C.addMonthsISO(today, -11)), curKey);
    window.Charts.barChart(netBox, months12.map(function (k) {
      const r = C.monthlyReport(db, k);
      return { label: C.monthLabel(k), value: r.net, color: r.net < 0 ? '#dc2626' : '#16a34a' };
    }), { height: 240 });

    // ---- Dernières opérations ----
    const opsPanel = h('div', { class: 'panel' });
    opsPanel.appendChild(h('h2', {}, '🧾 Dernières opérations'));
    const entries = C.cashEntries(db, today).slice(-14).reverse();
    if (!entries.length) {
      opsPanel.appendChild(h('div', { class: 'empty' }, 'Aucune opération pour le moment. Ajoutez une dépense ou importez un relevé bancaire.'));
    } else {
      const tbl = h('table', { class: 'data' });
      tbl.appendChild(h('thead', {}, h('tr', {},
        h('th', {}, 'Date'), h('th', {}, 'Libellé'), h('th', {}, 'Type'), h('th', { class: 'num' }, 'Montant'), h('th', {}, 'Catégorie'))));
      const tbody = h('tbody', {});
      for (const e of entries) {
        const cat = e.categoryId ? C.categoryOf(db, e.categoryId) : null;
        const kindLabel = { expense: 'Dépense', revenue: 'Recette', payment: 'Paiement famille', recurring: 'Récurrent' }[e.kind] || e.kind;
        tbody.appendChild(h('tr', {},
          h('td', { class: 'mono' }, C.fmtDate(e.date)),
          h('td', {}, e.label),
          h('td', {}, h('span', { class: 'tag gray' }, kindLabel)),
          h('td', { class: 'num ' + (e.amount < 0 ? 'neg' : 'pos') }, (e.amount < 0 ? '− ' : '+ ') + C.fmtEUR(Math.abs(e.amount)).replace('−', '')),
          h('td', {}, cat ? h('span', {}, h('span', { class: 'dot', style: 'background:' + cat.color }), cat.label) : '—')));
      }
      tbl.appendChild(tbody);
      opsPanel.appendChild(tbl);
    }
    container.appendChild(opsPanel);
  }
})();
