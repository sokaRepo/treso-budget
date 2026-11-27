# 🍼 Trésorerie Crèche Parentale

Application web **100 % côté navigateur** (aucun serveur, aucune dépendance externe) pour suivre la trésorerie d'une crèche parentale : dépenses, factures familles, subventions, paies, prévisions et **simulations de décisions** (dépense, augmentation de salaire, prime, cadeaux…) avec impact sur l'année en cours **et** l'année suivante.

## ▶️ Utilisation

Ouvrir simplement `index.html` dans un navigateur (double-clic, ou `python3 -m http.server` dans le dossier). Aucune installation, aucune connexion Internet requise.

- **Données stockées dans le navigateur** (localStorage), enregistrées automatiquement à chaque modification.
- **Base JSON téléchargeable / rechargeable** : bouton « ⬇ Exporter » (télécharge `creche-tresorerie-AAAA-MM-JJ.json`) et « ⬆ Importer » pour recharger une base sur un autre navigateur/ordinateur. Onglet 💾 Données pour voir le JSON brut, changer les paramètres, ou charger les **données de démo**.

## 📦 Fonctionnalités

| Onglet | Ce que ça fait |
|---|---|
| 📊 **Tableau de bord** | Solde du jour (barre du haut), recettes/dépenses du mois, impayés & retards, prévision fin de mois / fin d'année, alertes (trésorerie négative prévue, seuil d'alerte), courbe d'évolution 12 mois + prévision 6 mois, dépenses du mois par catégorie, dernières opérations. |
| 💸 **Dépenses** | Saisie manuelle, **import de relevé bancaire CSV** (détection auto des formats bancaires FR : `Date;Libellé;Débit;Crédit`, montants `1 234,56`, doublons ignorés, **rapprochement automatique** avec les dépenses récurrentes), filtres mois/catégorie/recherche, règles **récurrentes** (loyer, abonnements, courses hebdo…) prises en compte automatiquement. |
| 🧾 **Factures & familles** | Familles & tarifs mensuels, factures avec lignes détaillées, enregistrement des paiements, statut (payée / partielle / en attente / **en retard**), texte de **relance** copiable, taux d'encaissement. |
| 🏛️ **Subventions** | Suivi des demandes (CAF, département, mairie…), montants demandés/accordés, statuts, dates, et bouton « Encaisser » qui crée la recette correspondante. |
| 👥 **Équipe** | Salariés avec coût mensuel total employeur, bouton « Générer la paie du mois », le coût des salariés actifs alimente automatiquement la trésorerie réelle et les prévisions. |
| 📅 **Mensuel / Annuel** | Bilan par mois (recettes dont familles, dépenses, résultat, trésorerie début/fin) et par année (tableau des 12 mois, totaux, graphiques par catégorie et résultat mensuel). |
| 🔮 **Simulateur** | Scénarios enregistrés composés d'éléments : dépense ponctuelle ou récurrente, travaux, prime, cadeaux, **augmentation de salaire**, charge, subvention attendue, hausse des tarifs… Résultats : trésorerie min., premier mois négatif, **impact année en cours / année suivante** (recettes, dépenses, résultat, solde fin), courbe comparatif 24 mois, détail mois par mois. Pré-remplissage « exemple » disponible. |
| 💾 **Données** | Paramètres (nom, solde de départ, seuil d'alerte, moyens de paiement), catégories personnalisables, export/import JSON, démo, réinitialisation, statistiques de la base. |

## 🧠 Modèle de calcul

- **Trésorerie réelle** = solde de départ + recettes diverses + paiements des factures − dépenses (manuelles + récurrentes échues + relevés importés).
- **Prévision** (tableau de bord & simulateur) = trésorerie d'aujourd'hui + dépenses récurrentes futures + salaires des salariés actifs + encaissement attendu des factures impayées, sur 24 mois.
- Les scénarios s'ajoutent par-dessus cette prévision de base.

## 🗂️ Structure du projet

```
index.html          page unique
css/styles.css      styles
js/core.js          moteur de calcul pur (dates, trésorerie, projections, simulation, CSV) — testable en node
js/store.js         persistance localStorage + export/import JSON
js/charts.js        graphiques SVG (courbes, barres, donuts) sans dépendance
js/app.js           routeur, modales, notifications, export/import
js/views/*.js       une vue par onglet
tests/core.test.js  93 tests unitaires du moteur (node tests/core.test.js)
tests/ui.smoke.js   test de fumée : démarre l'app (DOM simulé) et rend chaque vue (node tests/ui.smoke.js)
```

## 🧪 Tests

```bash
node tests/core.test.js   # moteur de calcul
node tests/ui.smoke.js    # rendu de toutes les vues
```

## 🔒 Confidentialité

Tout reste sur votre machine : aucune donnée n'est envoyée sur Internet. Le fichier JSON exporté contient toutes vos données — protégez-le comme un document comptable.
