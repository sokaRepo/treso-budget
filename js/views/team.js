(function () {
  'use strict';
  const App = window.App, C = App.C, h = App.h;

  App.registerView('team', { render: render });

  function render(container) {
    const db = App.S.get();
    const today = C.todayISO();
    const curKey = C.monthKeyOf(today);

    const active = db.employees.filter(function (e) { return C.employeeActiveInMonth(e, curKey); });
    const totalCost = active.reduce(function (s, e) { return s + (e.monthlyCost || 0); }, 0);

    const kpis = h('div', { class: 'kpi-row' });
    kpis.appendChild(h('div', { class: 'stat' },
      h('div', { class: 'k' }, 'Coût mensuel de l’équipe (mois en cours)'),
      h('div', { class: 'v neg' }, '− ' + C.fmtEUR(totalCost)),
      h('div', { class: 's' }, active.length + ' salarié(s) actif(s) — coût total employeur (net + charges)')));
    const paidThisMonth = db.expenses.filter(function (e) {
      return e.categoryId === 'salaires' && C.monthKeyOf(e.date) === curKey;
    }).reduce(function (s, e) { return s + e.amount; }, 0);
    kpis.appendChild(h('div', { class: 'stat' },
      h('div', { class: 'k' }, 'Paies déjà saisies ce mois-ci'),
      h('div', { class: 'v' }, C.fmtEUR(paidThisMonth)),
      h('div', { class: 's' }, 'Les salaires sont automatiquement prévus dans les projections et le simulateur')));
    container.appendChild(kpis);

    const panel = h('div', { class: 'panel' });
    panel.appendChild(h('h2', {}, '👥 Équipe salariée',
      h('span', { class: 'flex' },
        h('button', { class: 'btn', onclick: generatePayroll }, '💶 Générer la paie du mois en cours'),
        h('button', { class: 'btn primary small', onclick: function () { empModal(null); } }, '＋ Ajouter un salarié'))));
    if (!db.employees.length) {
      panel.appendChild(h('div', { class: 'empty' },
        h('div', { class: 'big' }, '👥'),
        'Aucun salarié enregistré. Le coût mensuel de chaque salarié alimentera automatiquement la trésorerie réelle et les prévisions.'));
    } else {
      const tbl = h('table', { class: 'data' });
      tbl.appendChild(h('thead', {}, h('tr', {},
        h('th', {}, 'Nom'), h('th', {}, 'Rôle / poste'), h('th', { class: 'num' }, 'Coût mensuel (€)'),
        h('th', {}, 'Début'), h('th', {}, 'Fin'), h('th', {}, 'Statut'), h('th', {}, 'Notes'), h('th', {}, 'Actions'))));
      const tbody = h('tbody', {});
      for (const e of db.employees) {
        const isActive = C.employeeActiveInMonth(e, curKey);
        tbody.appendChild(h('tr', {},
          h('td', {}, h('strong', {}, e.name)),
          h('td', {}, e.role || '—'),
          h('td', { class: 'num neg' }, '− ' + C.fmtEUR(e.monthlyCost || 0)),
          h('td', { class: 'mono' }, C.fmtDate(e.startDate)),
          h('td', { class: 'mono' }, e.endDate ? C.fmtDate(e.endDate) : '—'),
          h('td', {}, h('span', { class: 'tag ' + (isActive ? 'green' : 'gray') }, isActive ? 'Actif' : 'Inactif ce mois-ci')),
          h('td', { class: 'muted small' }, e.notes || ''),
          h('td', { class: 'flex' },
            h('button', { class: 'btn small', onclick: function () { empModal(e); } }, 'Modifier'),
            h('button', { class: 'btn small danger', onclick: function () { delEmp(e.id); } }, 'Suppr.'))));
      }
      tbl.appendChild(tbody);
      panel.appendChild(tbl);
    }
    panel.appendChild(h('p', { class: 'muted small mt' },
      '💡 Le coût mensuel (salaire net + charges patronales) sert aux prévisions : chaque mois futur inclut automatiquement le coût des salariés actifs. Pour simuler une augmentation, une prime ou un cadeau, utilisez l’onglet 🔮 Simulateur.'));
    container.appendChild(panel);
  }

  function generatePayroll() {
    const db = App.S.get();
    const today = C.todayISO();
    const key = C.monthKeyOf(today);
    const created = [];
    App.S.update(function (d) {
      for (const emp of d.employees) {
        if (!C.employeeActiveInMonth(emp, key)) continue;
        const paieKey = emp.id + '|' + key;
        if (d.expenses.some(function (e) { return e.paieKey === paieKey; })) continue;
        d.expenses.push({
          id: C.uid('dep'), date: today, label: 'Salaire ' + emp.name + ' — ' + C.monthLabel(key),
          categoryId: 'salaires', amount: emp.monthlyCost, method: 'Virement',
          note: 'Paie mensuelle générée automatiquement', bankRef: null, paieKey: paieKey,
        });
        created.push(emp.name);
      }
    });
    if (created.length) App.toast('Paie générée pour : ' + created.join(', ') + ' ✔', 'ok');
    else App.toast('La paie du mois en cours est déjà saisie.', '');
  }

  function empModal(existing) {
    App.openModal({
      title: existing ? 'Modifier le salarié' : 'Nouveau salarié',
      render: function (body) {
        const f = h('form', {});
        const name = h('input', { type: 'text', required: 'required', value: existing ? existing.name : '', placeholder: 'Prénom Nom' });
        const role = h('input', { type: 'text', value: existing ? (existing.role || '') : '', placeholder: 'Éducatrice, auxiliaire de puériculture…' });
        const cost = h('input', { type: 'number', step: '0.01', min: '0', required: 'required', value: existing ? (existing.monthlyCost || '') : '', placeholder: 'net + charges patronales' });
        const start = h('input', { type: 'date', required: 'required', value: existing ? existing.startDate : C.todayISO() });
        const end = h('input', { type: 'date', value: existing && existing.endDate ? existing.endDate : '' });
        const notes = h('input', { type: 'text', value: existing ? (existing.notes || '') : '' });
        f.appendChild(h('div', { class: 'row' },
          h('div', { class: 'field' }, h('label', {}, 'Nom'), name),
          h('div', { class: 'field', style: 'flex:2' }, h('label', {}, 'Rôle / poste'), role)));
        f.appendChild(h('div', { class: 'row' },
          h('div', { class: 'field' }, h('label', {}, 'Coût mensuel total (€)'), cost),
          h('div', { class: 'field' }, h('label', {}, 'Date d’arrivée'), start),
          h('div', { class: 'field' }, h('label', {}, 'Date de départ (opt.)'), end)));
        f.appendChild(h('div', { class: 'row' }, h('div', { class: 'field full' }, h('label', {}, 'Notes'), notes)));
        const actions = h('div', { class: 'form-actions' });
        actions.appendChild(h('button', { type: 'button', class: 'btn', onclick: App.closeModal }, 'Annuler'));
        actions.appendChild(h('button', { type: 'submit', class: 'btn primary' }, 'Enregistrer'));
        f.appendChild(actions);
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          if (!name.value.trim() || !(parseFloat(cost.value) >= 0)) { App.toast('Nom et coût requis.', 'err'); return; }
          const emp = {
            id: existing ? existing.id : C.uid('emp'), name: name.value.trim(), role: role.value.trim(),
            monthlyCost: C.round2(parseFloat(cost.value) || 0), startDate: start.value,
            endDate: end.value || null, notes: notes.value.trim(),
          };
          App.S.update(function (d) {
            if (existing) {
              const i = d.employees.findIndex(function (x) { return x.id === existing.id; });
              if (i >= 0) d.employees[i] = emp;
            } else d.employees.push(emp);
          });
          App.closeModal();
          App.toast('Salarié enregistré ✔', 'ok');
        });
        body.appendChild(f);
      },
    });
  }

  function delEmp(id) {
    App.confirmDialog({
      title: 'Supprimer le salarié',
      text: 'Supprimer ce salarié ? Ses paies déjà saisies restent dans les dépenses.',
      danger: true, okLabel: 'Supprimer',
      onConfirm: function () {
        App.S.update(function (d) { d.employees = d.employees.filter(function (x) { return x.id !== id; }); });
        App.toast('Salarié supprimé.', 'ok');
      },
    });
  }
})();
