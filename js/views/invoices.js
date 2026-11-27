(function () {
  'use strict';
  const App = window.App, C = App.C, h = App.h;

  App.registerView('invoices', { render: render });

  function filters() {
    if (!App.state.filters.invoices) App.state.filters.invoices = { status: 'all', family: 'all' };
    return App.state.filters.invoices;
  }
  const STATUS_LABEL = { 'payée': ['green', 'Payée'], 'partielle': ['amber', 'Partielle'], 'en attente': ['blue', 'En attente'], 'en retard': ['red', 'En retard'] };

  function render(container) {
    const db = App.S.get();
    const f = filters();
    const today = C.todayISO();

    // ---- Résumé ----
    let totalBilled = 0, totalPaid = 0, unpaid = 0, late = 0;
    for (const inv of db.invoices) {
      const st = C.invoiceStatus(inv, today);
      totalBilled = C.round2(totalBilled + st.total);
      totalPaid = C.round2(totalPaid + st.paid);
      unpaid = C.round2(unpaid + st.remaining);
      if (st.status === 'en retard') late = C.round2(late + st.remaining);
    }
    const kpis = h('div', { class: 'kpi-row' });
    function kpi(k, v, s, cls) {
      kpis.appendChild(h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v ' + (cls || '') }, v), s ? h('div', { class: 's' }, s) : null));
    }
    kpi('Total facturé', C.fmtEUR(totalBilled), db.invoices.length + ' facture(s)');
    kpi('Encaissé', C.fmtEUR(totalPaid), 'taux : ' + (totalBilled ? Math.round(totalPaid / totalBilled * 100) : 0) + ' %', 'pos');
    kpi('Impayé', C.fmtEUR(unpaid), 'à encaisser', unpaid > 0 ? 'warn' : '');
    kpi('En retard', C.fmtEUR(late), 'échéance dépassée', late > 0 ? 'neg' : '');
    container.appendChild(kpis);

    // ---- Familles ----
    const famPanel = h('div', { class: 'panel' });
    famPanel.appendChild(h('h2', {}, '👨‍👩‍👧 Familles & tarifs mensuels',
      h('button', { class: 'btn primary small', onclick: addFamily }, '＋ Ajouter une famille')));
    if (!db.families.length) {
      famPanel.appendChild(h('div', { class: 'empty' }, 'Aucune famille enregistrée pour le moment.'));
    } else {
      const tbl = h('table', { class: 'data' });
      tbl.appendChild(h('thead', {}, h('tr', {},
        h('th', {}, 'Famille'), h('th', {}, 'Enfant(s)'), h('th', { class: 'num' }, 'Tarif mensuel'), h('th', {}, 'Depuis le'), h('th', {}, 'Actions'))));
      const tbody = h('tbody', {});
      for (const fam of db.families) {
        tbody.appendChild(h('tr', {},
          h('td', {}, h('strong', {}, fam.name)),
          h('td', {}, (fam.children || []).map(function (c) { return c.name + (c.birthdate ? ' (' + C.fmtDate(c.birthdate) + ')' : ''); }).join(', ') || '—'),
          h('td', { class: 'num' }, C.fmtEUR(fam.monthlyFee || 0)),
          h('td', { class: 'mono' }, C.fmtDate(fam.startDate)),
          h('td', { class: 'flex' },
            h('button', { class: 'btn small', onclick: function () { editFamily(fam.id); } }, 'Modifier'),
            h('button', { class: 'btn small danger', onclick: function () { delFamily(fam.id); } }, 'Suppr.'))));
      }
      tbl.appendChild(tbody);
      famPanel.appendChild(tbl);
    }
    container.appendChild(famPanel);

    // ---- Factures ----
    const invPanel = h('div', { class: 'panel' });
    const head = h('h2', {}, '🧾 Factures envoyées aux familles',
      h('button', { class: 'btn primary small', onclick: addInvoice }, '＋ Nouvelle facture'));
    invPanel.appendChild(head);

    const frow = h('div', { class: 'filters' });
    const stSel = h('select', { onchange: function () { f.status = stSel.value; App.renderView(); } });
    [['all', 'Tous les statuts'], ['en retard', 'En retard'], ['en attente', 'En attente'], ['partielle', 'Partielles'], ['payée', 'Payées']].forEach(function (o) {
      stSel.appendChild(h('option', { value: o[0], selected: f.status === o[0] ? 'selected' : null }, o[1]));
    });
    const famSel = h('select', { onchange: function () { f.family = famSel.value; App.renderView(); } });
    famSel.appendChild(h('option', { value: 'all' }, 'Toutes les familles'));
    for (const fam of db.families) famSel.appendChild(h('option', { value: fam.id, selected: f.family === fam.id ? 'selected' : null }, fam.name));
    frow.appendChild(h('div', { class: 'field' }, h('label', {}, 'Statut'), stSel));
    frow.appendChild(h('div', { class: 'field' }, h('label', {}, 'Famille'), famSel));
    invPanel.appendChild(frow);

    let invs = db.invoices.slice().sort(function (a, b) { return C.compareISO(b.issueDate, a.issueDate); });
    if (f.status !== 'all') invs = invs.filter(function (inv) { return C.invoiceStatus(inv, today).status === f.status; });
    if (f.family !== 'all') invs = invs.filter(function (inv) { return inv.familyId === f.family; });

    if (!invs.length) {
      invPanel.appendChild(h('div', { class: 'empty' }, h('div', { class: 'big' }, '🧾'), 'Aucune facture ne correspond à ces filtres.'));
    } else {
      const tbl = h('table', { class: 'data' });
      tbl.appendChild(h('thead', {}, h('tr', {},
        h('th', {}, 'N°'), h('th', {}, 'Famille'), h('th', {}, 'Émission'), h('th', {}, 'Échéance'),
        h('th', { class: 'num' }, 'Montant'), h('th', { class: 'num' }, 'Payé'), h('th', { class: 'num' }, 'Restant'),
        h('th', {}, 'Statut'), h('th', {}, 'Actions'))));
      const tbody = h('tbody', {});
      for (const inv of invs) {
        const st = C.invoiceStatus(inv, today);
        const fam = C.familyOf(db, inv.familyId);
        const sl = STATUS_LABEL[st.status];
        tbody.appendChild(h('tr', {},
          h('td', { class: 'mono' }, inv.number),
          h('td', {}, fam ? fam.name : '—'),
          h('td', { class: 'mono' }, C.fmtDate(inv.issueDate)),
          h('td', { class: 'mono' }, C.fmtDate(inv.dueDate)),
          h('td', { class: 'num' }, C.fmtEUR(st.total)),
          h('td', { class: 'num pos' }, C.fmtEUR(st.paid)),
          h('td', { class: 'num ' + (st.remaining > 0 ? 'neg' : '') }, C.fmtEUR(st.remaining)),
          h('td', {}, h('span', { class: 'tag ' + sl[0] }, sl[1])),
          h('td', { class: 'flex' },
            st.remaining > 0 ? h('button', { class: 'btn small primary', onclick: function () { addPayment(inv.id); } }, '＋ Paiement') : null,
            st.status === 'en retard' ? h('button', { class: 'btn small', title: 'Copier un texte de relance', onclick: function () { relance(inv, st); } }, '✉️ Relance') : null,
            h('button', { class: 'btn small', onclick: function () { viewInvoice(inv.id); } }, 'Détails'),
            h('button', { class: 'btn small', onclick: function () { editInvoice(inv.id); } }, 'Modifier'),
            h('button', { class: 'btn small danger', onclick: function () { delInvoice(inv.id); } }, 'Suppr.'))));
      }
      tbl.appendChild(tbody);
      invPanel.appendChild(tbl);
    }
    container.appendChild(invPanel);
  }

  // ---------- Familles ----------
  function familyModal(existing) {
    App.openModal({
      title: existing ? 'Modifier la famille' : 'Nouvelle famille',
      render: function (body) {
        const f = h('form', {});
        const name = h('input', { type: 'text', required: 'required', value: existing ? existing.name : '', placeholder: 'Nom de la famille' });
        const children = h('textarea', { rows: 3, placeholder: 'Un enfant par ligne : Prénom, AAAA-MM-JJ\nex: Léa, 2022-03-14' },
          existing ? (existing.children || []).map(function (c) { return c.name + (c.birthdate ? ', ' + c.birthdate : ''); }).join('\n') : '');
        const fee = h('input', { type: 'number', step: '0.01', min: '0', required: 'required', value: existing ? (existing.monthlyFee || '') : '' });
        const start = h('input', { type: 'date', required: 'required', value: existing ? existing.startDate : C.todayISO() });
        const end = h('input', { type: 'date', value: existing && existing.endDate ? existing.endDate : '' });
        const notes = h('input', { type: 'text', value: existing ? (existing.notes || '') : '' });
        f.appendChild(h('div', { class: 'row' }, h('div', { class: 'field', style: 'flex:2' }, h('label', {}, 'Nom de la famille'), name)));
        f.appendChild(h('div', { class: 'row' }, h('div', { class: 'field full' }, h('label', {}, 'Enfant(s) (un par ligne : Prénom, date de naissance)'), children)));
        f.appendChild(h('div', { class: 'row' },
          h('div', { class: 'field' }, h('label', {}, 'Tarif mensuel (€)'), fee),
          h('div', { class: 'field' }, h('label', {}, 'Arrivée le'), start),
          h('div', { class: 'field' }, h('label', {}, 'Départ le (opt.)'), end)));
        f.appendChild(h('div', { class: 'row' }, h('div', { class: 'field full' }, h('label', {}, 'Notes'), notes)));
        const actions = h('div', { class: 'form-actions' });
        actions.appendChild(h('button', { type: 'button', class: 'btn', onclick: App.closeModal }, 'Annuler'));
        actions.appendChild(h('button', { type: 'submit', class: 'btn primary' }, 'Enregistrer'));
        f.appendChild(actions);
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          const kids = children.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
            const parts = l.split(',');
            return { id: C.uid('enf'), name: parts[0].trim(), birthdate: (parts[1] || '').trim() || null };
          });
          App.S.update(function (d) {
            const fam = {
              id: existing ? existing.id : C.uid('fam'), name: name.value.trim(), children: kids,
              monthlyFee: C.round2(parseFloat(fee.value) || 0), startDate: start.value, endDate: end.value || null, notes: notes.value.trim(),
            };
            if (existing) {
              const i = d.families.findIndex(function (x) { return x.id === existing.id; });
              if (i >= 0) d.families[i] = fam;
            } else d.families.push(fam);
          });
          App.closeModal();
          App.toast('Famille enregistrée ✔', 'ok');
        });
        body.appendChild(f);
      },
    });
  }
  function addFamily() { familyModal(null); }
  function editFamily(id) {
    const f = App.S.get().families.find(function (x) { return x.id === id; });
    if (f) familyModal(f);
  }
  function delFamily(id) {
    const db = App.S.get();
    const hasInv = db.invoices.some(function (i) { return i.familyId === id; });
    App.confirmDialog({
      title: 'Supprimer la famille',
      text: hasInv ? 'Cette famille a des factures associées (elles seront conservées mais la famille ne sera plus affichée). Continuer ?' : 'Supprimer cette famille ?',
      danger: true, okLabel: 'Supprimer',
      onConfirm: function () {
        App.S.update(function (d) { d.families = d.families.filter(function (x) { return x.id !== id; }); });
        App.toast('Famille supprimée.', 'ok');
      },
    });
  }

  // ---------- Factures ----------
  function invoiceModal(existing) {
    const db = App.S.get();
    const today = C.todayISO();
    App.openModal({
      title: existing ? 'Modifier la facture ' + existing.number : 'Nouvelle facture',
      wide: true,
      render: function (body) {
        const f = h('form', {});
        const famSel = h('select', { required: 'required' });
        famSel.appendChild(h('option', { value: '' }, '— Choisir une famille —'));
        for (const fam of db.families) {
          famSel.appendChild(h('option', {
            value: fam.id,
            selected: existing ? existing.familyId === fam.id : null,
            'data-fee': fam.monthlyFee || 0,
          }, fam.name + ' (' + C.fmtEUR(fam.monthlyFee || 0) + '/mois)'));
        }
        const number = h('input', { type: 'text', required: 'required', value: existing ? existing.number : C.nextInvoiceNumber(db) });
        const issue = h('input', { type: 'date', required: 'required', value: existing ? existing.issueDate : today });
        const due = h('input', { type: 'date', required: 'required', value: existing ? existing.dueDate : C.addDaysISO(today, 20) });
        f.appendChild(h('div', { class: 'row' },
          h('div', { class: 'field', style: 'flex:2' }, h('label', {}, 'Famille'), famSel),
          h('div', { class: 'field' }, h('label', {}, 'N° de facture'), number),
          h('div', { class: 'field' }, h('label', {}, 'Date d’émission'), issue),
          h('div', { class: 'field' }, h('label', {}, 'Date d’échéance'), due)));

        // Lignes
        const linesBox = h('div', { class: 'mb' });
        f.appendChild(h('h3', {}, 'Lignes de la facture'));
        const lines = existing ? existing.lines.map(function (l) { return { label: l.label, qty: l.qty, unitPrice: l.unitPrice }; }) : [];
        function defaultLine() {
          const fam = db.families.find(function (x) { return x.id === famSel.value; });
          return { label: fam ? 'Frais de garde — ' + fam.children.map(function (c) { return c.name; }).join(', ') : 'Frais de garde', qty: 1, unitPrice: fam ? (fam.monthlyFee || 0) : 0 };
        }
        if (!lines.length) lines.push(defaultLine());
        function renderLines() {
          linesBox.innerHTML = '';
          lines.forEach(function (l, i) {
            const lab = h('input', { type: 'text', required: 'required', value: l.label, style: 'flex:2;min-width:180px' });
            const qty = h('input', { type: 'number', step: '0.01', min: '0', required: 'required', value: l.qty, style: 'width:80px' });
            const up = h('input', { type: 'number', step: '0.01', min: '0', required: 'required', value: l.unitPrice, style: 'width:110px' });
            lab.addEventListener('input', function () { l.label = lab.value; });
            qty.addEventListener('input', function () { l.qty = parseFloat(qty.value) || 0; });
            up.addEventListener('input', function () { l.unitPrice = parseFloat(up.value) || 0; });
            linesBox.appendChild(h('div', { class: 'row', style: 'align-items:flex-end' },
              h('div', { class: 'field', style: 'flex:2' }, h('label', {}, 'Libellé'), lab),
              h('div', { class: 'field', style: 'flex:0 0 90px' }, h('label', {}, 'Qté'), qty),
              h('div', { class: 'field', style: 'flex:0 0 130px' }, h('label', {}, 'Prix unit. (€)'), up),
              h('button', { type: 'button', class: 'btn small danger', onclick: function () { lines.splice(i, 1); renderLines(); } }, '✕')));
          });
          linesBox.appendChild(h('button', { type: 'button', class: 'btn small', onclick: function () { lines.push(defaultLine()); renderLines(); } }, '＋ Ajouter une ligne'));
        }
        famSel.addEventListener('change', function () { if (!existing && lines.length === 1 && !lines[0].label.includes('—')) { lines[0] = defaultLine(); renderLines(); } });
        renderLines();
        f.appendChild(linesBox);

        const totalBox = h('p', { class: 'muted' }, '');
        function refreshTotal() {
          const t = lines.reduce(function (s, l) { return s + (l.qty || 0) * (l.unitPrice || 0); }, 0);
          totalBox.textContent = 'Total de la facture : ' + C.fmtEUR(C.round2(t));
        }
        setInterval(refreshTotal, 500);
        refreshTotal();
        f.appendChild(totalBox);

        const actions = h('div', { class: 'form-actions' });
        actions.appendChild(h('button', { type: 'button', class: 'btn', onclick: App.closeModal }, 'Annuler'));
        actions.appendChild(h('button', { type: 'submit', class: 'btn primary' }, 'Enregistrer la facture'));
        f.appendChild(actions);
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          if (!famSel.value) { App.toast('Choisissez une famille.', 'err'); return; }
          App.S.update(function (d) {
            const inv = {
              id: existing ? existing.id : C.uid('inv'),
              number: number.value.trim(), familyId: famSel.value,
              issueDate: issue.value, dueDate: due.value,
              lines: lines.map(function (l) { return { label: l.label, qty: l.qty, unitPrice: l.unitPrice }; }),
              payments: existing ? existing.payments : [],
            };
            if (existing) {
              const i = d.invoices.findIndex(function (x) { return x.id === existing.id; });
              if (i >= 0) d.invoices[i] = inv;
            } else d.invoices.push(inv);
          });
          App.closeModal();
          App.toast('Facture enregistrée ✔', 'ok');
        });
        body.appendChild(f);
      },
    });
  }
  function addInvoice() { invoiceModal(null); }
  function editInvoice(id) {
    const inv = App.S.get().invoices.find(function (x) { return x.id === id; });
    if (inv) invoiceModal(inv);
  }
  function delInvoice(id) {
    App.confirmDialog({
      title: 'Supprimer la facture',
      text: 'La facture et ses paiements enregistrés seront supprimés. Continuer ?',
      danger: true, okLabel: 'Supprimer',
      onConfirm: function () {
        App.S.update(function (d) { d.invoices = d.invoices.filter(function (x) { return x.id !== id; }); });
        App.toast('Facture supprimée.', 'ok');
      },
    });
  }

  function viewInvoice(id) {
    const db = App.S.get();
    const inv = db.invoices.find(function (x) { return x.id === id; });
    if (!inv) return;
    const st = C.invoiceStatus(inv, C.todayISO());
    const fam = C.familyOf(db, inv.familyId);
    App.openModal({
      title: 'Facture ' + inv.number + ' — ' + (fam ? fam.name : ''),
      render: function (body) {
        const info = h('div', { class: 'mb' },
          h('p', {}, 'Émise le ', h('strong', {}, C.fmtDate(inv.issueDate)), ' — échéance ', h('strong', {}, C.fmtDate(inv.dueDate)), ' — ',
            h('span', { class: 'tag ' + STATUS_LABEL[st.status][0] }, STATUS_LABEL[st.status][1])));
        body.appendChild(info);
        const tbl = h('table', { class: 'data' });
        tbl.appendChild(h('thead', {}, h('tr', {}, h('th', {}, 'Ligne'), h('th', { class: 'num' }, 'Qté'), h('th', { class: 'num' }, 'PU'), h('th', { class: 'num' }, 'Total'))));
        const tb = h('tbody', {});
        for (const l of inv.lines) {
          tb.appendChild(h('tr', {},
            h('td', {}, l.label), h('td', { class: 'num' }, l.qty), h('td', { class: 'num' }, C.fmtEUR(l.unitPrice)),
            h('td', { class: 'num' }, C.fmtEUR(C.round2(l.qty * l.unitPrice)))));
        }
        tbl.appendChild(tb);
        const totalRow = h('tr', {},
          h('td', { colspan: 3 }, h('strong', {}, 'Total facture')),
          h('td', { class: 'num' }, h('strong', {}, C.fmtEUR(st.total))));
        tbl.appendChild(h('tfoot', {}, totalRow));
        body.appendChild(tbl);
        body.appendChild(h('h3', {}, 'Paiements reçus'));
        if (!inv.payments.length) body.appendChild(h('p', { class: 'muted' }, 'Aucun paiement enregistré.'));
        else {
          const pt = h('table', { class: 'data' });
          pt.appendChild(h('thead', {}, h('tr', {}, h('th', {}, 'Date'), h('th', { class: 'num' }, 'Montant'), h('th', {}, 'Moyen'), h('th', {}, 'Note'), h('th', {}, ''))));
          const pb = h('tbody', {});
          for (const p of inv.payments) {
            pb.appendChild(h('tr', {},
              h('td', { class: 'mono' }, C.fmtDate(p.date)), h('td', { class: 'num pos' }, C.fmtEUR(p.amount)),
              h('td', {}, p.method || '—'), h('td', {}, p.note || ''),
              h('td', {}, h('button', { class: 'btn small danger', onclick: function () {
                App.confirmDialog({ title: 'Supprimer ce paiement', text: 'Confirmer la suppression du paiement de ' + C.fmtEUR(p.amount) + ' ?', danger: true, okLabel: 'Supprimer',
                  onConfirm: function () { App.S.update(function (d) { const x = d.invoices.find(function (i) { return i.id === id; }); if (x) x.payments = x.payments.filter(function (q) { return q.id !== p.id; }); }); App.closeModal(); } });
              } }, '✕'))));
          }
          pt.appendChild(pb);
          body.appendChild(pt);
        }
        body.appendChild(h('p', {}, h('strong', {}, 'Restant dû : '), h('span', { class: st.remaining > 0 ? 'neg' : 'pos' }, C.fmtEUR(st.remaining))));
        if (st.remaining > 0) {
          body.appendChild(h('button', { class: 'btn primary', onclick: function () { App.closeModal(); addPayment(id); } }, '＋ Enregistrer un paiement'));
        }
      },
    });
  }

  function addPayment(invId) {
    const db = App.S.get();
    const inv = db.invoices.find(function (x) { return x.id === invId; });
    if (!inv) return;
    const st = C.invoiceStatus(inv, C.todayISO());
    App.openModal({
      title: 'Paiement — facture ' + inv.number,
      render: function (body) {
        body.appendChild(h('p', { class: 'muted' }, 'Restant dû : ' + C.fmtEUR(st.remaining)));
        const f = h('form', {});
        const date = h('input', { type: 'date', required: 'required', value: C.todayISO() });
        const amount = h('input', { type: 'number', step: '0.01', min: '0.01', required: 'required', value: st.remaining });
        const method = h('select', {});
        for (const m of db.settings.paymentMethods) method.appendChild(h('option', { value: m }, m));
        const note = h('input', { type: 'text', placeholder: 'Référence du virement…' });
        f.appendChild(h('div', { class: 'row' },
          h('div', { class: 'field' }, h('label', {}, 'Date d’encaissement'), date),
          h('div', { class: 'field' }, h('label', {}, 'Montant (€)'), amount)));
        f.appendChild(h('div', { class: 'row' },
          h('div', { class: 'field' }, h('label', {}, 'Moyen de paiement'), method),
          h('div', { class: 'field' }, h('label', {}, 'Note'), note)));
        const actions = h('div', { class: 'form-actions' });
        actions.appendChild(h('button', { type: 'button', class: 'btn', onclick: App.closeModal }, 'Annuler'));
        actions.appendChild(h('button', { type: 'submit', class: 'btn primary' }, 'Enregistrer le paiement'));
        f.appendChild(actions);
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          const amt = C.round2(parseFloat(amount.value));
          if (!(amt > 0)) { App.toast('Montant invalide.', 'err'); return; }
          App.S.update(function (d) {
            const x = d.invoices.find(function (i) { return i.id === invId; });
            if (x) x.payments.push({ id: C.uid('pay'), date: date.value, amount: amt, method: method.value, note: note.value.trim() });
          });
          App.closeModal();
          App.toast('Paiement enregistré ✔ (' + C.fmtEUR(amt) + ')', 'ok');
        });
        body.appendChild(f);
      },
    });
  }

  function relance(inv, st) {
    const db = App.S.get();
    const fam = C.familyOf(db, inv.familyId);
    const text = 'Bonjour ' + (fam ? fam.name : '') + ',\n\nSauf erreur de notre part, la facture ' + inv.number +
      ' du ' + C.fmtDate(inv.issueDate) + ' d’un montant de ' + C.fmtEUR(st.total) +
      ' (reste ' + C.fmtEUR(st.remaining) + ') était à régler pour le ' + C.fmtDate(inv.dueDate) + ' et n’a pas encore été encaissée.\n\n' +
      'Pourriez-vous régulariser la situation dans les plus brefs délais ? Merci d’avance.\n\nBien cordialement,\nLa crèche ' + (db.settings.name || '');
    App.openModal({
      title: '✉️ Texte de relance — facture ' + inv.number,
      render: function (body) {
        const ta = h('textarea', { rows: 10, style: 'width:100%' }, text);
        body.appendChild(ta);
        const actions = h('div', { class: 'form-actions' });
        actions.appendChild(h('button', { class: 'btn', onclick: App.closeModal }, 'Fermer'));
        actions.appendChild(h('button', {
          class: 'btn primary', onclick: function () {
            const done = function () { App.toast('Texte copié dans le presse-papiers ✔', 'ok'); App.closeModal(); };
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { App.toast('Copie impossible — sélectionnez et copiez le texte.', 'err'); });
            else { ta.select(); document.execCommand('copy'); done(); }
          },
        }, '📋 Copier'));
        body.appendChild(actions);
      },
    });
  }
})();
