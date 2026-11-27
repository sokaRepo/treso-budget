(function () {
  'use strict';
  const App = window.App, C = App.C, h = App.h;

  App.registerView('subventions', { render: render });

  const STATUS = {
    'en attente': ['amber', 'En attente'],
    'demandée': ['blue', 'Demandée'],
    'obtenue': ['green', 'Obtenue'],
    'refusée': ['red', 'Refusée'],
  };

  function render(container) {
    const db = App.S.get();
    const today = C.todayISO();

    let requested = 0, granted = 0, received = 0;
    for (const s of db.subventions) {
      requested = C.round2(requested + (s.amountRequested || 0));
      if (s.status === 'obtenue') granted = C.round2(granted + (s.amountGranted || 0));
      if (s.revenueId) {
        const r = db.revenues.find(function (x) { return x.id === s.revenueId; });
        if (r) received = C.round2(received + r.amount);
      }
    }
    const kpis = h('div', { class: 'kpi-row' });
    function kpi(k, v, s, cls) {
      kpis.appendChild(h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v ' + (cls || '') }, v), s ? h('div', { class: 's' }, s) : null));
    }
    kpi('Demandé', C.fmtEUR(requested), db.subventions.length + ' dossier(s)');
    kpi('Accordé', C.fmtEUR(granted), 'subventions obtenues', 'pos');
    kpi('Encaissé', C.fmtEUR(received), 'versements reçus', 'pos');
    kpi('En attente de décision', C.fmtEUR(db.subventions.filter(function (s) { return s.status === 'en attente' || s.status === 'demandée'; }).reduce(function (a, s) { return a + (s.amountRequested || 0); }, 0)));
    container.appendChild(kpis);

    const panel = h('div', { class: 'panel' });
    panel.appendChild(h('h2', {}, '🏛️ Subventions demandées / obtenues',
      h('button', { class: 'btn primary small', onclick: function () { subModal(null); } }, '＋ Nouvelle subvention')));
    if (!db.subventions.length) {
      panel.appendChild(h('div', { class: 'empty' },
        h('div', { class: 'big' }, '🏛️'),
        'Aucune subvention suivie. Ajoutez les aides demandées (CAF, département, mairie, fondations…) pour suivre les montants attendus dans vos prévisions.'));
    } else {
      const tbl = h('table', { class: 'data' });
      tbl.appendChild(h('thead', {}, h('tr', {},
        h('th', {}, 'Subvention'), h('th', {}, 'Organisme'), h('th', { class: 'num' }, 'Demandé'), h('th', { class: 'num' }, 'Accordé'),
        h('th', {}, 'Statut'), h('th', {}, 'Demande'), h('th', {}, 'Décision'), h('th', {}, 'Versement'), h('th', {}, 'Notes'), h('th', {}, 'Actions'))));
      const tbody = h('tbody', {});
      for (const s of db.subventions.slice().sort(function (a, b) { return C.compareISO(b.requestDate || '0000', a.requestDate || '0000'); })) {
        const st = STATUS[s.status] || ['gray', s.status];
        tbody.appendChild(h('tr', {},
          h('td', {}, h('strong', {}, s.name)),
          h('td', {}, s.organism || '—'),
          h('td', { class: 'num' }, C.fmtEUR(s.amountRequested || 0)),
          h('td', { class: 'num pos' }, s.amountGranted != null ? C.fmtEUR(s.amountGranted) : '—'),
          h('td', {}, h('span', { class: 'tag ' + st[0] }, st[1])),
          h('td', { class: 'mono' }, C.fmtDate(s.requestDate)),
          h('td', { class: 'mono' }, C.fmtDate(s.decisionDate)),
          h('td', { class: 'mono' }, C.fmtDate(s.paymentDate)),
          h('td', { class: 'muted small' }, s.notes || ''),
          h('td', { class: 'flex' },
            (s.status === 'obtenue' && (s.amountGranted || 0) > 0 && !s.revenueId)
              ? h('button', { class: 'btn small primary', title: 'Créer la recette correspondante dans la trésorerie', onclick: function () { recordReceipt(s.id); } }, '💰 Encaisser')
              : null,
            h('button', { class: 'btn small', onclick: function () { subModal(s); } }, 'Modifier'),
            h('button', { class: 'btn small danger', onclick: function () { delSub(s.id); } }, 'Suppr.'))));
      }
      tbl.appendChild(tbody);
      panel.appendChild(tbl);
    }
    container.appendChild(panel);

    // Info prévision
    const pending = db.subventions.filter(function (s) { return (s.status === 'en attente' || s.status === 'demandée') && (s.amountRequested || 0) > 0; });
    if (pending.length) {
      panel.appendChild(h('div', { class: 'alert blue mt' },
        'ℹ️ ' + pending.length + ' subvention(s) en attente de décision (' + C.fmtEUR(pending.reduce(function (a, s) { return a + s.amountRequested; }, 0)) + ' demandés). Utilisez le simulateur pour tester l’impact si elles sont obtenues… ou non.'));
    }
  }

  function subModal(existing) {
    const db = App.S.get();
    App.openModal({
      title: existing ? 'Modifier la subvention' : 'Nouvelle subvention',
      render: function (body) {
        const f = h('form', {});
        const name = h('input', { type: 'text', required: 'required', value: existing ? existing.name : '', placeholder: 'ex : CAF — PSU 2025' });
        const org = h('input', { type: 'text', value: existing ? (existing.organism || '') : '', placeholder: 'CAF, Département, Mairie…' });
        const req = h('input', { type: 'number', step: '0.01', min: '0', required: 'required', value: existing ? (existing.amountRequested || '') : '' });
        const granted = h('input', { type: 'number', step: '0.01', min: '0', value: existing && existing.amountGranted != null ? existing.amountGranted : '' });
        const status = h('select', {});
        Object.keys(STATUS).forEach(function (k) {
          status.appendChild(h('option', { value: k, selected: existing && existing.status === k ? 'selected' : null }, STATUS[k][1]));
        });
        if (!existing) status.value = 'demandée';
        const rDate = h('input', { type: 'date', value: existing ? (existing.requestDate || '') : C.todayISO() });
        const dDate = h('input', { type: 'date', value: existing ? (existing.decisionDate || '') : '' });
        const pDate = h('input', { type: 'date', value: existing ? (existing.paymentDate || '') : '' });
        const notes = h('input', { type: 'text', value: existing ? (existing.notes || '') : '' });
        f.appendChild(h('div', { class: 'row' },
          h('div', { class: 'field', style: 'flex:2' }, h('label', {}, 'Nom de la subvention'), name),
          h('div', { class: 'field' }, h('label', {}, 'Organisme'), org)));
        f.appendChild(h('div', { class: 'row' },
          h('div', { class: 'field' }, h('label', {}, 'Montant demandé (€)'), req),
          h('div', { class: 'field' }, h('label', {}, 'Montant accordé (€)'), granted),
          h('div', { class: 'field' }, h('label', {}, 'Statut'), status)));
        f.appendChild(h('div', { class: 'row' },
          h('div', { class: 'field' }, h('label', {}, 'Date de demande'), rDate),
          h('div', { class: 'field' }, h('label', {}, 'Date de décision'), dDate),
          h('div', { class: 'field' }, h('label', {}, 'Date de versement'), pDate)));
        f.appendChild(h('div', { class: 'row' }, h('div', { class: 'field full' }, h('label', {}, 'Notes'), notes)));
        const actions = h('div', { class: 'form-actions' });
        actions.appendChild(h('button', { type: 'button', class: 'btn', onclick: App.closeModal }, 'Annuler'));
        actions.appendChild(h('button', { type: 'submit', class: 'btn primary' }, 'Enregistrer'));
        f.appendChild(actions);
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          if (!name.value.trim() || !(parseFloat(req.value) >= 0)) { App.toast('Nom et montant demandés requis.', 'err'); return; }
          const sub = {
            id: existing ? existing.id : C.uid('sub'),
            name: name.value.trim(), organism: org.value.trim(),
            amountRequested: C.round2(parseFloat(req.value) || 0),
            amountGranted: granted.value === '' ? null : C.round2(parseFloat(granted.value)),
            status: status.value,
            requestDate: rDate.value || null, decisionDate: dDate.value || null, paymentDate: pDate.value || null,
            notes: notes.value.trim(),
            revenueId: existing ? existing.revenueId || null : null,
          };
          App.S.update(function (d) {
            if (existing) {
              const i = d.subventions.findIndex(function (x) { return x.id === existing.id; });
              if (i >= 0) d.subventions[i] = sub;
            } else d.subventions.push(sub);
          });
          App.closeModal();
          App.toast('Subvention enregistrée ✔', 'ok');
        });
        body.appendChild(f);
      },
    });
  }

  function recordReceipt(subId) {
    const db = App.S.get();
    const s = db.subventions.find(function (x) { return x.id === subId; });
    if (!s) return;
    App.S.update(function (d) {
      const sub = d.subventions.find(function (x) { return x.id === subId; });
      const rev = {
        id: C.uid('rev'), date: sub.paymentDate || C.todayISO(),
        label: 'Subvention ' + sub.name + ' (' + sub.organism + ')',
        categoryId: 'subventions', amount: sub.amountGranted, method: 'Virement',
        note: 'Versement enregistré depuis le suivi des subventions', subventionId: sub.id,
      };
      d.revenues.push(rev);
      sub.revenueId = rev.id;
    });
    App.toast('Encaissement de ' + C.fmtEUR(s.amountGranted) + ' enregistré dans la trésorerie ✔', 'ok');
  }

  function delSub(id) {
    App.confirmDialog({
      title: 'Supprimer la subvention',
      text: 'Supprimer ce dossier de subvention ? (La recette éventuellement déjà encaissée est conservée.)',
      danger: true, okLabel: 'Supprimer',
      onConfirm: function () {
        App.S.update(function (d) { d.subventions = d.subventions.filter(function (x) { return x.id !== id; }); });
        App.toast('Subvention supprimée.', 'ok');
      },
    });
  }
})();
