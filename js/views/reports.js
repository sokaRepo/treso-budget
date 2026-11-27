(function () {
  'use strict';
  const App = window.App, C = App.C, h = App.h;

  App.registerView('reports', { render: render });

  function filters() {
    const today = C.todayISO();
    if (!App.state.filters.reports) {
      App.state.filters.reports = { mode: 'mensuel', year: C.yearOf(today), month: C.monthKeyOf(today) };
    }
    return App.state.filters.reports;
  }

  function render(container) {
    const db = App.S.get();
    const f = filters();
    const years = C.availableYears(db);
    const today = C.todayISO();

    const panel = h('div', { class: 'panel' });
    const frow = h('div', { class: 'filters' });
    const modeSel = h('select', { onchange: function () { f.mode = modeSel.value; App.renderView(); } });
    [['mensuel', '📅 Vue mensuelle'], ['annuel', '📆 Vue annuelle']].forEach(function (o) {
      modeSel.appendChild(h('option', { value: o[0], selected: f.mode === o[0] ? 'selected' : null }, o[1]));
    });
    const yearSel = h('select', { onchange: function () { f.year = +yearSel.value; App.renderView(); } });
    for (const y of years) yearSel.appendChild(h('option', { value: y, selected: f.year === y ? 'selected' : null }, 'Année ' + y));
    frow.appendChild(h('div', { class: 'field' }, h('label', {}, 'Vue'), modeSel));
    frow.appendChild(h('div', { class: 'field' }, h('label', {}, 'Année'), yearSel));
    if (f.mode === 'mensuel') {
      const monthSel = h('select', { onchange: function () { f.month = monthSel.value; App.renderView(); } });
      for (let m = 1; m <= 12; m++) {
        const k = f.year + '-' + C.pad2(m);
        monthSel.appendChild(h('option', { value: k, selected: f.month === k ? 'selected' : null }, C.monthLabel(k)));
      }
      frow.appendChild(h('div', { class: 'field' }, h('label', {}, 'Mois'), monthSel));
    }
    panel.appendChild(frow);
    container.appendChild(panel);

    if (f.mode === 'mensuel') renderMonth(container, db, f);
    else renderYear(container, db, f);
  }

  function catTable(db, byCat, type) {
    const entries = Object.keys(byCat).map(function (k) {
      const c = C.categoryOf(db, k);
      return { id: k, label: c.label, color: c.color, value: byCat[k] };
    }).filter(function (e) { return e.value > 0; }).sort(function (a, b) { return b.value - a.value; });
    if (!entries.length) return h('p', { class: 'muted' }, '—');
    const tbl = h('table', { class: 'data' });
    tbl.appendChild(h('thead', {}, h('tr', {}, h('th', {}, 'Catégorie'), h('th', { class: 'num' }, 'Montant'), h('th', { class: 'num' }, '%'))));
    const total = entries.reduce(function (s, e) { return s + e.value; }, 0);
    const tb = h('tbody', {});
    for (const e of entries) {
      tb.appendChild(h('tr', {},
        h('td', {}, h('span', { class: 'dot', style: 'background:' + e.color }), e.label),
        h('td', { class: 'num' }, C.fmtEUR(e.value)),
        h('td', { class: 'num' }, total ? Math.round(e.value / total * 100) + ' %' : '—')));
    }
    tbl.appendChild(tb);
    return tbl;
  }

  function renderMonth(container, db, f) {
    const r = C.monthlyReport(db, f.month);
    const kpis = h('div', { class: 'kpi-row' });
    function kpi(k, v, s, cls) {
      kpis.appendChild(h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v ' + (cls || '') }, v), s ? h('div', { class: 's' }, s) : null));
    }
    kpi('Recettes', C.fmtEUR(r.in), 'dont familles ' + C.fmtEUR(r.payments) + ' + autres ' + C.fmtEUR(r.otherIn), 'pos');
    kpi('Dépenses', C.fmtEUR(r.out), '', 'neg');
    kpi('Résultat du mois', C.fmtEUR(r.net), '', r.net < 0 ? 'neg' : 'pos');
    kpi('Trésorerie début de mois', C.fmtEUR(r.balanceStart), '');
    kpi('Trésorerie fin de mois', C.fmtEUR(r.balanceEnd), '', r.balanceEnd < 0 ? 'neg' : 'pos');
    container.appendChild(kpis);

    const panel = h('div', { class: 'panel' });
    panel.appendChild(h('h2', {}, '📅 ' + C.monthLabel(f.month) + ' ' + f.year));
    const grid = h('div', { class: 'grid cols-2' });
    const pDep = h('div', {});
    pDep.appendChild(h('h3', {}, '💸 Dépenses par catégorie'));
    pDep.appendChild(catTable(db, r.byCategory, 'expense'));
    const donutBox = h('div', { class: 'mt' });
    pDep.appendChild(donutBox);
    grid.appendChild(pDep);
    const pRec = h('div', {});
    pRec.appendChild(h('h3', {}, '💰 Recettes par source'));
    const recSources = [{ label: 'Paiements des familles', value: r.payments, color: '#27ae60' }];
    for (const k in r.revByCat) {
      const c = C.categoryOf(db, k);
      recSources.push({ label: c.label, value: r.revByCat[k], color: c.color });
    }
    const recFiltered = recSources.filter(function (x) { return x.value > 0; });
    pRec.appendChild(catTable(db, r.revByCat, 'revenue'));
    const recDonut = h('div', { class: 'mt' });
    pRec.appendChild(recDonut);
    grid.appendChild(pRec);
    panel.appendChild(grid);
    container.appendChild(panel);
    if (r.out > 0) {
      window.Charts.donut(donutBox, Object.keys(r.byCategory).map(function (k) {
        const c = C.categoryOf(db, k); return { label: c.label, value: r.byCategory[k], color: c.color };
      }), { centerLabel: 'Dépenses', size: 170 });
    }
    if (recFiltered.length) {
      window.Charts.donut(recDonut, recFiltered, { centerLabel: 'Recettes', size: 170 });
    }
  }

  function renderYear(container, db, f) {
    const y = C.yearlyReport(db, f.year);
    const t = y.totals;
    const kpis = h('div', { class: 'kpi-row' });
    function kpi(k, v, s, cls) {
      kpis.appendChild(h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v ' + (cls || '') }, v), s ? h('div', { class: 's' }, s) : null));
    }
    kpi('Recettes ' + f.year, C.fmtEUR(t.in), 'dont familles ' + C.fmtEUR(t.payments) + ' + autres ' + C.fmtEUR(t.otherIn), 'pos');
    kpi('Dépenses ' + f.year, C.fmtEUR(t.out), '', 'neg');
    kpi('Résultat ' + f.year, C.fmtEUR(t.net), 'variation de trésorerie sur l’année', t.net < 0 ? 'neg' : 'pos');
    kpi('Trésorerie fin ' + f.year, C.fmtEUR(t.balanceEnd), 'début : ' + C.fmtEUR(t.balanceStart), t.balanceEnd < 0 ? 'neg' : 'pos');
    container.appendChild(kpis);

    const panel = h('div', { class: 'panel' });
    panel.appendChild(h('h2', {}, '📆 Bilan mensuel ' + f.year));
    const tbl = h('table', { class: 'data' });
    tbl.appendChild(h('thead', {}, h('tr', {},
      h('th', {}, 'Mois'), h('th', { class: 'num' }, 'Recettes'), h('th', { class: 'num' }, 'dont familles'),
      h('th', { class: 'num' }, 'Dépenses'), h('th', { class: 'num' }, 'Résultat'), h('th', { class: 'num' }, 'Trésorerie fin de mois'))));
    const tb = h('tbody', {});
    for (const m of y.months) {
      const isCur = m.key === C.monthKeyOf(C.todayISO());
      tb.appendChild(h('tr', { style: isCur ? 'background:#eff6ff' : '' },
        h('td', {}, (isCur ? '▶ ' : '') + m.label),
        h('td', { class: 'num pos' }, m.in ? C.fmtEUR(m.in) : '—'),
        h('td', { class: 'num' }, m.payments ? C.fmtEUR(m.payments) : '—'),
        h('td', { class: 'num neg' }, m.out ? '− ' + C.fmtEUR(m.out) : '—'),
        h('td', { class: 'num ' + (m.net < 0 ? 'neg' : 'pos') }, m.net ? (m.net < 0 ? '− ' : '+ ') + C.fmtEUR(Math.abs(m.net)) : '—'),
        h('td', { class: 'num ' + (m.balanceEnd < 0 ? 'neg' : '') }, C.fmtEUR(m.balanceEnd))));
    }
    tbl.appendChild(tb);
    tbl.appendChild(h('tfoot', {}, h('tr', {},
      h('td', {}, h('strong', {}, 'Total ' + f.year)),
      h('td', { class: 'num pos' }, h('strong', {}, C.fmtEUR(t.in))),
      h('td', { class: 'num' }, h('strong', {}, C.fmtEUR(t.payments))),
      h('td', { class: 'num neg' }, h('strong', {}, '− ' + C.fmtEUR(t.out))),
      h('td', { class: 'num ' + (t.net < 0 ? 'neg' : 'pos') }, h('strong', {}, (t.net < 0 ? '− ' : '+ ') + C.fmtEUR(Math.abs(t.net)))),
      h('td', { class: 'num' }, h('strong', {}, C.fmtEUR(t.balanceEnd))))));
    panel.appendChild(tbl);
    container.appendChild(panel);

    const grid = h('div', { class: 'grid cols-2' });
    const p1 = h('div', { class: 'panel' });
    p1.appendChild(h('h2', {}, '📊 Résultat net par mois'));
    const barBox = h('div', {});
    p1.appendChild(barBox);
    grid.appendChild(p1);
    const p2 = h('div', { class: 'panel' });
    p2.appendChild(h('h2', {}, '💸 Dépenses ' + f.year + ' par catégorie'));
    const donutBox = h('div', {});
    p2.appendChild(donutBox);
    p2.appendChild(catTable(db, t.byCategory, 'expense'));
    grid.appendChild(p2);
    container.appendChild(grid);

    window.Charts.barChart(barBox, y.months.map(function (m) {
      return { label: m.label, value: m.net, color: m.net < 0 ? '#dc2626' : '#16a34a' };
    }), { height: 260 });
    const cats = Object.keys(t.byCategory).map(function (k) {
      const c = C.categoryOf(db, k); return { label: c.label, value: t.byCategory[k], color: c.color };
    }).filter(function (x) { return x.value > 0; });
    if (cats.length) window.Charts.donut(donutBox, cats, { centerLabel: 'Dépenses ' + f.year, size: 190 });
  }
})();
