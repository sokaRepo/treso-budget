'use strict';
// Tests unitaires du moteur de calcul (exécutés avec node, sans navigateur).
const C = require('../js/core.js');

let passed = 0, failed = 0;
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error('❌ ' + msg + '\n   attendu: ' + e + '\n   reçu:   ' + a); }
}
function ok(cond, msg) { if (cond) passed++; else { failed++; console.error('❌ ' + msg); } }
function near(a, b, msg) { ok(Math.abs(a - b) < 0.01, msg + ' (attendu ' + b + ', reçu ' + a + ')'); }

// ---------- Dates ----------
eq(C.parseFlexibleDate('05/01/2025'), '2025-01-05', 'date FR dd/mm/yyyy');
eq(C.parseFlexibleDate('2025-01-05'), '2025-01-05', 'date ISO');
eq(C.parseFlexibleDate('31-12-2024'), '2024-12-31', 'date dd-mm-yyyy');
eq(C.parseFlexibleDate('05.01.2025'), '2025-01-05', 'date dd.mm.yyyy');
eq(C.parseFlexibleDate('2025-13-40'), null, 'date invalide rejetée');
eq(C.addMonthsISO('2025-01-31', 1), '2025-02-28', 'addMonths clamp jour');
eq(C.addMonthsISO('2024-01-31', 1), '2024-02-29', 'addMonths clamp année bissextile');
eq(C.monthEndISO('2025-02'), '2025-02-28', 'monthEnd février');
eq(C.monthEndISO('2024-02'), '2024-02-29', 'monthEnd février bissextile');
eq(C.monthKeyOf('2025-03-14'), '2025-03', 'monthKey');
eq(C.monthKeysBetween('2025-01', '2025-04').length, 4, 'monthKeysBetween');
eq(C.fmtDate('2025-01-05'), '05/01/2025', 'fmtDate');

// ---------- Montants ----------
near(C.parseAmount('1 234,56'), 1234.56, 'parseAmount espace + virgule');
near(C.parseAmount('1 234,56'), 1234.56, 'parseAmount espace fine');
near(C.parseAmount('1.234,56'), 1234.56, 'parseAmount milliers point');
near(C.parseAmount('-85,30'), -85.30, 'parseAmount négatif');
near(C.parseAmount('(42,00)'), -42.00, 'parseAmount parenthèses');
near(C.parseAmount('1 200'), 1200, 'parseAmount entier');
near(C.parseAmount('12.5'), 12.5, 'parseAmount décimal point');
near(C.parseAmount('1.200'), 1200, 'parseAmount milliers seul point');
eq(C.parseAmount('abc'), null, 'parseAmount invalide');
eq(C.fmtEUR(1234.5).replace(/[\s\u00a0\u202f]/g, ' '), '1 234,50 €', 'fmtEUR fr');

// ---------- Occurrences récurrentes ----------
const recMensuel = { id: 'r1', kind: 'expense', label: 'Loyer', categoryId: 'loyer', amount: 1200, frequency: 'mensuel', dayOfMonth: 31, startDate: '2025-01-01', endDate: null };
const occ = C.occurrences(recMensuel, '2025-01-01', '2025-04-30');
eq(occ.length, 4, 'occurrence mensuelle nb');
eq(occ[1].date, '2025-02-28', 'occurrence clamp 31 -> 28 fév');
const recHebdo = { id: 'r2', kind: 'expense', label: 'Courses', categoryId: 'courses', amount: 90, frequency: 'hebdo', startDate: '2025-01-02', endDate: null };
eq(C.occurrences(recHebdo, '2025-01-01', '2025-01-31').length, 5, 'occurrence hebdo nb (jeudis)');
const recAnnuel = { id: 'r3', kind: 'expense', label: 'Assurance annuelle', categoryId: 'assurances', amount: 600, frequency: 'annuel', dayOfMonth: 10, startDate: '2024-03-10', endDate: null };
const occA = C.occurrences(recAnnuel, '2024-01-01', '2026-12-31');
eq(occA.map(function (o) { return o.date; }), ['2024-03-10', '2025-03-10', '2026-03-10'], 'occurrences annuelles');
const recFin = { id: 'r4', kind: 'expense', label: 'X', categoryId: 'autre_dep', amount: 10, frequency: 'mensuel', dayOfMonth: 5, startDate: '2025-01-05', endDate: '2025-03-05' };
eq(C.occurrences(recFin, '2025-01-01', '2025-12-31').length, 3, 'occurrence avec date de fin');

// ---------- Trésorerie ----------
const db = C.emptyDB();
db.settings.openingBalance = 1000;
db.settings.openingDate = '2025-01-01';
db.expenses.push({ id: 'e1', date: '2025-01-10', label: 'Courses', categoryId: 'courses', amount: 200, method: 'CB', note: '', bankRef: null });
db.revenues.push({ id: 'v1', date: '2025-01-15', label: 'Subvention', categoryId: 'subventions', amount: 500, method: 'Virement', note: '', subventionId: null });
db.invoices.push({ id: 'i1', number: 'F2025-01', familyId: 'f1', issueDate: '2025-01-05', dueDate: '2025-01-25', lines: [{ label: 'Garde', qty: 1, unitPrice: 400 }], payments: [{ id: 'p1', date: '2025-01-20', amount: 400, method: 'Virement', note: '' }] });
db.recurring.push({ id: 'r1', kind: 'expense', label: 'Loyer', categoryId: 'loyer', amount: 300, frequency: 'mensuel', dayOfMonth: 5, startDate: '2025-01-01', endDate: null });
near(C.balanceAt(db, '2024-12-31'), 0, 'solde avant date ouverture = 0');
near(C.balanceAt(db, '2025-01-01'), 1000, 'solde à la date d’ouverture');
near(C.balanceAt(db, '2025-01-04'), 1000, 'solde avant 1ère opération (loyer le 5 pas encore)');
near(C.balanceAt(db, '2025-01-05'), 700, 'solde après loyer');
near(C.balanceAt(db, '2025-01-10'), 500, 'solde après courses');
near(C.balanceAt(db, '2025-01-20'), 1400, 'solde après paiement facture (1000-300-200+500+400)');
near(C.balanceAt(db, '2025-01-31'), 1400, 'solde fin janvier');

// ---------- Factures ----------
const inv = db.invoices[0];
const st = C.invoiceStatus(inv, '2025-01-31');
eq(st.status, 'payée', 'facture payée');
near(st.remaining, 0, 'reste 0');
db.invoices.push({ id: 'i2', number: 'F2025-02', familyId: 'f1', issueDate: '2025-02-01', dueDate: '2025-02-20', lines: [{ label: 'Garde', qty: 1, unitPrice: 400 }], payments: [] });
eq(C.invoiceStatus(db.invoices[1], '2025-02-25').status, 'en retard', 'facture en retard après échéance');
eq(C.invoiceStatus(db.invoices[1], '2025-02-10').status, 'en attente', 'facture en attente avant échéance');
db.invoices[1].payments.push({ id: 'p2', date: '2025-02-22', amount: 100, method: 'Chèque', note: '' });
eq(C.invoiceStatus(db.invoices[1], '2025-02-25').status, 'en retard', 'partielle mais en retard si échéance passée');
eq(C.invoiceStatus(db.invoices[1], '2025-02-10').status, 'partielle', 'partielle avant échéance');
eq(C.nextInvoiceNumber(db), 'F' + new Date().getFullYear() + '-03', 'numéro de facture suivant');

// ---------- Rapports ----------
const jan = C.monthlyReport(db, '2025-01');
near(jan.out, 500, 'dépenses janvier = 200 + loyer 300');
near(jan.in, 900, 'recettes janvier = 500 subvention + 400 paiement');
near(jan.payments, 400, 'paiements familles janvier');
near(jan.net, 400, 'net janvier');
near(jan.balanceEnd, 1400, 'solde fin janvier rapport');
near(jan.byCategory['loyer'], 300, 'cat loyer janvier');
near(jan.byCategory['courses'], 200, 'cat courses janvier');
const yr = C.yearlyReport(db, 2025);
near(yr.totals.out, 500 + 300 * 11, 'dépenses année (loyer 12 mois + courses)'); // loyer tous les mois de 2025
near(yr.totals.in, 1000, 'recettes année (subvention + paiement janv. + acompte fév.)');
ok(Array.isArray(yr.months) && yr.months.length === 12, '12 mois dans le rapport annuel');

// ---------- Employés ----------
db.employees.push({ id: 'emp1', name: 'Marie', role: 'Éducatrice', monthlyCost: 3000, startDate: '2024-06-01', endDate: null, notes: '' });
ok(C.employeeActiveInMonth(db.employees[0], '2025-01'), 'salarié actif');
ok(!C.employeeActiveInMonth(db.employees[0], '2024-05'), 'salarié inactif avant arrivée');
db.employees.push({ id: 'emp2', name: 'Paul', role: 'Aux', monthlyCost: 2000, startDate: '2025-06-01', endDate: null, notes: '' });
ok(!C.employeeActiveInMonth(db.employees[1], '2025-01'), 'salarié pas encore arrivé');
ok(C.employeeActiveInMonth(db.employees[1], '2025-06'), 'salarié arrivé en juin');

// ---------- Projection & simulation ----------
const proj = C.project(db, '2025-02-01', '2025-04-30', []);
eq(proj.months.length, 3, 'projection 3 mois');
// février : loyer 300 + salaire Marie 3000 + facture i2 restante 300 (échéance fév, en retard -> bucket février)
near(proj.months[0].out, 3300, 'sorties février (loyer + salaire)');
near(proj.months[0].in, 300, 'entrée février = reste facture i2');
near(proj.months[1].out, 3300, 'sorties mars');
near(proj.months[2].out, 3300, 'sorties avril (loyer + Marie, Paul pas encore là)');
const proj2 = C.project(db, '2025-06-01', '2025-06-30', []);
near(proj2.months[0].out, 300 + 3000 + 2000, 'sorties juin avec les deux salariés');

const sim = C.simulate(db, [
  { id: 's1', type: 'prime', label: 'Prime', amount: 1000, startDate: '2025-02-15', frequency: 'ponctuel', endDate: null },
  { id: 's2', type: 'augmentation', label: 'Augmentation', amount: 200, startDate: '2025-03-01', frequency: 'mensuel', endDate: null },
], { today: '2025-02-01', horizonMonths: 12 });
ok(sim.scenario.months.length === 12, 'simulation horizon 12 mois');
near(sim.scenario.months[0].out, proj.months[0].out + 1000, 'prime ajoutée en février');
near(sim.scenario.months[1].out - sim.baseline.months[1].out, 200, 'augmentation mensuelle à partir de mars');
near(sim.scenario.months[5].out - sim.baseline.months[5].out, 200, 'augmentation persiste en juillet');
ok(sim.years.current && sim.years.next, 'résumé par année présent');
near(sim.years.current.scen.net - sim.years.current.base.net, -(1000 + 200 * 10), 'delta année en cours = prime + 10 mois d’augmentation');

// item ponctuel hors période
near(C.itemOccurrences({ type: 'depense', amount: 50, startDate: '2030-01-01', frequency: 'ponctuel' }, '2025-01-01', '2025-12-31').length, 0, 'item hors période ignoré');
eq(C.itemSign('subvention'), 1, 'subvention = entrée');
eq(C.itemSign('cadeau'), -1, 'cadeau = sortie');

// ---------- CSV bancaire ----------
const csv1 = 'Date;Libellé;Débit;Crédit\n05/01/2025;LOYER JANVIER;1200,00;\n10/01/2025;VIREMENT FAMILLE MARTIN;;450,00\n12/01/2025;CARREFOUR MARKET;85,30;\n';
const p1 = C.parseBankCSV(csv1);
ok(p1.ok, 'CSV point-virgule parsé');
eq(p1.rows.length, 3, '3 lignes CSV');
eq(p1.rows[0].dateISO, '2025-01-05', 'date CSV FR');
near(p1.rows[0].amount, -1200, 'débit = négatif');
near(p1.rows[1].amount, 450, 'crédit = positif');
eq(p1.rows[2].label, 'CARREFOUR MARKET', 'libellé CSV');
const csv2 = 'date,description,montant\n2025-02-01,"Courses LECLERC, Paris","-73.5"\n2025-02-03,"Subvention CAF",4250.00\n';
const p2 = C.parseBankCSV(csv2);
ok(p2.ok, 'CSV virgule parsé');
eq(p2.rows.length, 2, '2 lignes CSV virgule');
near(p2.rows[0].amount, -73.5, 'montant signé CSV virgule');
near(p2.rows[1].amount, 4250, 'montant positif');
const csv3 = 'Date de valeur;Intitulé;Montant\n01/03/2025;PRELEVEMENT EDF;"1 250,00"\n';
const p3 = C.parseBankCSV(csv3);
ok(p3.ok, 'CSV montant unique parsé');
near(p3.rows[0].amount, 1250, 'montant avec espace milliers');
eq(C.parseBankCSV('').ok, false, 'CSV vide rejeté');
const csv4 = 'foo;bar\n1;2\n';
eq(C.parseBankCSV(csv4).ok, false, 'CSV sans colonne date rejeté');

// signature & rapprochement
const sig = C.bankRowSignature({ dateISO: '2025-01-05', amount: -1200, label: 'LOYER  JANVIER' });
eq(sig, C.bankRowSignature({ dateISO: '2025-01-05', amount: -1200, label: 'loyer janvier' }), 'signature insensible à la casse/espaces');
const db2 = C.emptyDB();
db2.recurring.push({ id: 'r9', kind: 'expense', label: 'Loyer', categoryId: 'loyer', amount: 1200, frequency: 'mensuel', dayOfMonth: 5, startDate: '2025-01-01', endDate: null });
const m = C.matchRecurring(db2, { dateISO: '2025-01-07', amount: -1200, label: 'PRELEVEMENT LOYER' });
ok(m && m.recurringId === 'r9' && m.date === '2025-01-05', 'rapprochement relevé <-> récurrent (±3 jours)');
ok(!C.matchRecurring(db2, { dateISO: '2025-01-20', amount: -1200, label: 'X' }), 'pas de rapprochement si date trop éloignée');
ok(!C.matchRecurring(db2, { dateISO: '2025-01-05', amount: -999, label: 'X' }), 'pas de rapprochement si montant différent');

// ---------- Migration & démo ----------
const demo = C.seedDemoDB();
ok(demo.families.length === 8 && demo.employees.length === 2 && demo.invoices.length > 0 && demo.recurring.length > 0, 'démo peuplée');
const balDemo = C.balanceAt(demo, C.todayISO());
ok(isFinite(balDemo) && balDemo > 0, 'solde démo positif et calculable: ' + balDemo);
const simDemo = C.simulate(demo, [{ id: 'x', type: 'augmentation', label: '+100€/mois', amount: 100, startDate: C.addMonthsISO(C.todayISO(), 1).slice(0, 8) + '01', frequency: 'mensuel', endDate: null }], { horizonMonths: 24 });
ok(simDemo.scenario.months.length === 24, 'simulation démo 24 mois');
const migrated = C.migrate({ version: 1, expenses: [{ id: 'e', date: '2025-01-01', label: 'x', categoryId: 'courses', amount: 10 }] });
ok(Array.isArray(migrated.categories) && migrated.categories.length > 0, 'migration complète les champs manquants');
eq(C.migrate(null), null, 'migration null rejetée');

console.log('\n' + (failed ? '❌ ' + failed + ' échec(s), ' : '✅ ') + passed + ' test(s) réussi(s)' + (failed ? '' : ' — TOUT EST VERT'));
process.exit(failed ? 1 : 0);
