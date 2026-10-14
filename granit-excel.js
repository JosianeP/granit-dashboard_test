/* ═══════════════════════════════════════════════════════════════════════════
   granit-excel.js — Mise à jour trimestrielle du tableau de bord par chiffrier Excel
   MRC du Granit — v4.7

   Module partagé entre la plateforme (navigateur) et l'outil de génération (Node).
   Une seule spécification (SPEC) décrit tous les champs modifiables :
     - buildWorkbook(ExcelJS, D, options)  → génère le chiffrier (une feuille par municipalité
                                             + feuilles MRC), avec protection des cellules.
     - readWorkbook(wb)                     → lit un chiffrier (xlsx-populate) et renvoie les blocs.
     - applyImport(D, parsed)               → calcule les changements, les applique à une copie
                                             de D, recalcule les champs dérivés, signale les erreurs.

   Convention du chiffrier : la colonne A (masquée, verrouillée) porte des marqueurs techniques
     F|<chemin>      ligne « champ » (libellé en B, valeur en C, note en D)
     T|<bloc>        ligne titre d'un tableau
     K|              ligne (masquée) des clés de colonnes du tableau
     H|              ligne d'en-tête du tableau
     R|<clé>         ligne de données (clé = identifiant de l'élément existant, vide = nouvel élément)
     E|              fin du tableau
   Les lignes libres (R| sans clé) permettent d'ajouter des éléments; effacer le nom d'une ligne
   retire l'élément.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GranitExcel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '4.7';
  var BOOL_ENUM = ['Oui', 'Non'];
  var MUNI_TYPES = ['Ville', 'Municipalité', 'Canton', 'Paroisse'];
  var MUNI_CATS = ['urbain', 'rural', 'rural_eloigne'];
  var CO_STATUS = ['actif', 'reprise', 'nouveau', 'expansion', 'a_completer'];
  var SECTOR_CATS = ['manufacturier', 'primaire', 'commerce', 'tourisme'];
  var TREND3 = ['up', 'down', 'flat'];
  var TREND2 = ['up', 'down'];
  var KPI_SRC = ['valide', 'estim'];
  var SANTE_LEVELS = ['Atout fort', 'Favorable', 'A surveiller', 'Vigilance', 'Priorite'];
  var TOUR_GRANDE = ['Quoi faire', 'Où manger', 'Où dormir', 'Autres commerces et services'];
  var TOUR_CATEG = ['Attrait, activité, événement', 'Commerce', 'Restauration', 'Camping', 'Entreprise de service',
    'Chalet et résidence de tourisme', 'Hôtel et auberge', 'Gîte et B&B', 'Municipalité', 'Parc nationaux'];
  var TOUR_SOUS = ['Plein air été', 'Plein air hiver', 'Événements', "Artisanat et métier d'art",
    "Centre d'interprétation, musée, exposition", 'Circuit et visite guidée', 'Parc nationaux', 'Détente et bien-être',
    'Restaurant', 'Saveur locale (Boulangerie, pâtisserie, boucherie, distillerie, érablière, agrotourisme, etc.)',
    'Épicerie et magasin général', 'Casse-croûte et restauration rapide',
    'Hôtel, motel et auberge', 'Gîte / B&B', 'Chalet et résidence de tourisme', 'Camping et hébergement insolite',
    'Commerces et services'];
  var TOUR_SECTOR = { 'Quoi faire': 'Tourisme · Attraits & activités', 'Où manger': 'Tourisme · Restauration & saveurs',
    'Où dormir': 'Tourisme · Hébergement', 'Autres commerces et services': 'Tourisme · Commerces & services' };
  var TOUR_GRANDE_COLORS = { 'Quoi faire': '#1d7a8a', 'Où manger': '#d97706', 'Où dormir': '#1d6b4f', 'Autres commerces et services': '#7c3aed' };
  var CLIMAT_SECTEURS = [
    { key: 'transp', label: 'Transport', color: '#b45309' },
    { key: 'agri', label: 'Agriculture', color: '#2d7a4f' },
    { key: 'ind', label: 'Industriel', color: '#374151' },
    { key: 'mr', label: 'Matières résiduelles', color: '#0e7490' },
    { key: 'res', label: 'Résidentiel', color: '#d97706' },
    { key: 'ci', label: 'Commercial et institutionnel', color: '#7c3aed' }
  ];

  /* ─── utilitaires de chemin : a.b[code=30030].c[2] ─── */
  function parsePath(p) {
    var segs = [], re = /([^.\[\]]+)|\[([^\]]+)\]/g, m;
    while ((m = re.exec(p))) {
      if (m[1] !== undefined) segs.push({ key: m[1] });
      else {
        var inner = m[2];
        if (/^\d+$/.test(inner)) segs.push({ index: parseInt(inner, 10) });
        else if (inner.indexOf('=') > 0) segs.push({ find: inner.slice(0, inner.indexOf('=')), val: inner.slice(inner.indexOf('=') + 1) });
        else segs.push({ key: inner.replace(/^['"]|['"]$/g, '') });
      }
    }
    return segs;
  }
  function step(obj, s, create) {
    if (obj == null) return undefined;
    if (s.key !== undefined) { if (create && obj[s.key] == null) obj[s.key] = {}; return obj[s.key]; }
    if (s.index !== undefined) { if (create && obj[s.index] == null) obj[s.index] = {}; return obj[s.index]; }
    if (!Array.isArray(obj)) return undefined;
    for (var i = 0; i < obj.length; i++) if (obj[i] && String(obj[i][s.find]) === String(s.val)) return obj[i];
    return undefined;
  }
  function getPath(obj, p) { var segs = parsePath(p), cur = obj; for (var i = 0; i < segs.length; i++) { cur = step(cur, segs[i]); if (cur === undefined) return undefined; } return cur; }
  function setPath(obj, p, v) {
    var segs = parsePath(p), cur = obj;
    for (var i = 0; i < segs.length - 1; i++) { cur = step(cur, segs[i], true); if (cur === undefined) return false; }
    var last = segs[segs.length - 1];
    if (last.key !== undefined) cur[last.key] = v; else if (last.index !== undefined) cur[last.index] = v; else return false;
    return true;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function round(v, d) { if (v == null || v === '') return null; var f = Math.pow(10, d || 0); return Math.round(v * f) / f; }
  function isBlank(v) { return v === null || v === undefined || (typeof v === 'string' && v.trim() === ''); }
  function normText(v) { if (v == null) return ''; return String(v).replace(/\r\n?/g, '\n').trim(); }
  function normKey(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  function safeSheetName(n) { return String(n).replace(/[\[\]\*\?\/\\:]/g, '-').slice(0, 31); }

  /* ─── construction de la spécification ─── */
  function fld(path, label, kind, opts) { var o = { path: path, label: label, kind: kind || 'text' }; if (opts) for (var k in opts) o[k] = opts[k]; return o; }
  function col(key, label, kind, opts) { var o = { key: key, label: label, kind: kind || 'text' }; if (opts) for (var k in opts) o[k] = opts[k]; return o; }

  function muniList(D) { return (D.municipalities || []).map(function (m) { return { code: m.code, name: m.name }; }); }
  function sectorNames(D) { return (D.sectors || []).map(function (s) { return s.name; }); }

  var YEAR_FIELD_DEMO = ['2001', '2006', '2011', '2016', '2021', '2025'];

  function buildSpec(D) {
    var sheets = [];
    var munis = muniList(D);
    var muniNames = munis.map(function (m) { return m.name; });

    /* ── MRC - Général ── */
    sheets.push({
      name: 'MRC - Général', kind: 'mrc', intro: 'Informations de période, indicateurs validés, indicateurs clés (KPI), emplois par secteur et historique annuel.',
      blocks: [
        { type: 'fields', title: 'Période de mise à jour', items: [
          fld('meta.quarter', 'Trimestre affiché', 'text', { note: 'ex. T4 2026 — apparaît dans la barre latérale et l\'étiquette de version' }),
          fld('meta.updatedBy', 'Mis à jour par', 'text'),
          fld('meta.updatedDate', 'Date de mise à jour', 'text', { note: 'AAAA-MM-JJ — remplie automatiquement à l\'importation si laissée vide' })
        ] },
        { type: 'fields', title: 'Indicateurs validés (sources officielles)', items: [
          fld('meta.validatedIndicators.population_decret_2026', 'Population — décret MAMH', 'int', { note: 'habitants' }),
          fld('meta.validatedIndicators.population_isq_2025', 'Population — estimation ISQ', 'int', { note: 'habitants' }),
          fld('meta.validatedIndicators.part_0_19_pct', 'Part des 0-19 ans', 'num', { decimals: 1, note: '%' }),
          fld('meta.validatedIndicators.part_20_64_pct', 'Part des 20-64 ans', 'num', { decimals: 1, note: '%' }),
          fld('meta.validatedIndicators.part_65plus_pct', 'Part des 65 ans et plus', 'num', { decimals: 1, note: '% — affiché dans le bandeau de l\'aperçu' }),
          fld('meta.validatedIndicators.travailleurs_25_64_2024', 'Travailleurs de 25-64 ans', 'int'),
          fld('meta.validatedIndicators.taux_travailleurs_2024_pct', 'Taux de travailleurs 25-64 ans', 'num', { decimals: 1, note: '%' }),
          fld('meta.validatedIndicators.revenu_emploi_median_25_64_2024', 'Revenu d\'emploi médian 25-64 ans', 'int', { note: '$' }),
          fld('meta.validatedIndicators.revenu_emploi_median_qc_2024', 'Revenu d\'emploi médian — Québec', 'int', { note: '$' }),
          fld('meta.validatedIndicators.revenu_disponible_par_habitant_2023', 'Revenu disponible par habitant', 'int', { note: '$' }),
          fld('meta.validatedIndicators.revenu_median_menages_apres_impot_2020', 'Revenu médian des ménages après impôt', 'int', { note: '$' }),
          fld('meta.validatedIndicators.revenu_total_median_18plus_2020', 'Revenu total médian 18 ans et plus', 'int', { note: '$' }),
          fld('meta.validatedIndicators.taux_faible_revenu_familles_2023_pct', 'Taux de faible revenu des familles', 'num', { decimals: 1, note: '% — affiché dans le bandeau de l\'aperçu' }),
          fld('meta.validatedIndicators.valeur_fonciere_moy_unifamiliale_2026', 'Valeur foncière moyenne — unifamiliale', 'int', { note: '$' }),
          fld('meta.validatedIndicators.permis_batir_2024_kdollars', 'Permis de bâtir — valeur totale', 'int', { note: 'milliers de $' }),
          fld('meta.validatedIndicators.superficie_terrestre_km2_2026', 'Superficie terrestre', 'num', { decimals: 1, note: 'km²' }),
          fld('meta.validatedIndicators.source', 'Source des indicateurs validés', 'text')
        ] },
        { type: 'table', id: 'kpis', title: 'Indicateurs clés (KPI) de l\'aperçu économique', path: 'kpis', keyOf: function (k, i) { return 'k' + i; },
          columns: [col('label', 'Indicateur', 'text', { width: 30 }), col('value', 'Valeur affichée', 'text', { width: 16 }), col('unit', 'Unité / source', 'text', { width: 36 }),
            col('delta', 'Variation affichée', 'text', { width: 30 }), col('trend', 'Tendance', 'enum', { enum: TREND3, width: 11 }), col('src', 'Statut', 'enum', { enum: KPI_SRC, width: 10 })],
          allowAdd: false, note: 'Les valeurs sont des textes affichés tels quels (ex. « 21 935 », « 50 800 $ »). Tendance : up = hausse, down = baisse, flat = stable.' },
        { type: 'table', id: 'sectors', title: 'Emplois estimés par secteur', path: 'sectors', keyOf: function (s) { return s.id; },
          columns: [col('name', 'Secteur', 'text', { width: 30, required: true }), col('jobs', 'Emplois', 'int', { width: 10, blankAs: 0 }), col('trend', 'Variation affichée', 'text', { width: 14 }),
            col('dir', 'Sens', 'enum', { enum: TREND2, width: 9 }), col('cat', 'Catégorie', 'enum', { enum: SECTOR_CATS, width: 14 }), col('desc', 'Description', 'text', { width: 70 })],
          allowAdd: true, spare: 2, newItem: function (D2, rows) { var n = (D2.sectors || []).length + 1; return { id: 's' + n, name: '', jobs: 0, trend: '', dir: 'up', cat: 'commerce', icon: 's' + n, desc: '' }; },
          note: 'Les emplois par secteur sont des estimations. Le nom du secteur est utilisé pour relier les entreprises; renommer un secteur renomme automatiquement le secteur des entreprises liées.' },
        { type: 'table', id: 'trends', title: 'Historique annuel (tendances économiques)', custom: 'trends',
          columns: [col('year', 'Année', 'text', { width: 10, required: true }), col('totalJobs', 'Emplois totaux', 'int', { width: 14 }), col('newBiz', 'Nouvelles entreprises', 'int', { width: 18 }),
            col('permitsMk', 'Permis de bâtir (M$)', 'num', { decimals: 1, width: 18 })].concat(Object.keys((D.trends && D.trends.bySector) || {}).map(function (k) { return col('sec:' + k, 'Emplois — ' + k, 'int', { width: 18 }); })),
          allowAdd: true, spare: 3, note: 'Une ligne par année. Pour ajouter une année, utilisez une ligne libre. Les colonnes « Emplois — … » alimentent le graphique multi-secteurs.' }
      ]
    });

    /* ── MRC - Aménagement ── */
    var am = D.amenagement || {};
    sheets.push({
      name: 'MRC - Aménagement', kind: 'mrc', intro: 'Permis de bâtir, affectation du territoire et conversions résidence / villégiature.',
      blocks: [
        { type: 'table', id: 'amPermits', title: 'Permis de bâtir — valeur annuelle', custom: 'amPermits',
          columns: [col('year', 'Année', 'text', { width: 10, required: true }), col('totalMk', 'Valeur totale (M$)', 'num', { decimals: 1, width: 18 })], allowAdd: true, spare: 3 },
        { type: 'fields', title: 'Permis de bâtir — source', items: [fld('amenagement.permits.source', 'Source affichée', 'text')] },
        { type: 'table', id: 'amByType', title: 'Permis de bâtir — répartition par type (dernière année)', path: 'amenagement.permits.byType', keyOf: function (r, i) { return 'p' + i; },
          columns: [col('type', 'Type', 'text', { width: 30, required: true }), col('mk', 'Valeur (M$)', 'num', { decimals: 1, width: 12 }), col('pct', 'Part (%)', 'int', { width: 10 }), col('est', 'Estimation ?', 'bool', { width: 12 })],
          allowAdd: true, spare: 2, newItem: function () { return { type: '', mk: 0, pct: 0, est: true }; } },
        { type: 'fields', title: 'Affectation du territoire', items: [
          fld('amenagement.landUse.totalKm2', 'Superficie totale', 'int', { note: 'km²' }), fld('amenagement.landUse.totalHa', 'Superficie totale', 'int', { note: 'ha' }),
          fld('amenagement.landUse.estriePct', 'Part de l\'Estrie', 'num', { decimals: 1, note: '%' }), fld('amenagement.landUse.affectationSource', 'Source de la répartition', 'text')] },
        { type: 'table', id: 'amConfirmed', title: 'Affectation — données confirmées', path: 'amenagement.landUse.confirmed', keyOf: function (r, i) { return 'c' + i; },
          columns: [col('label', 'Donnée', 'text', { width: 30, required: true }), col('ha', 'Hectares', 'int', { width: 12 }), col('note', 'Note / source', 'text', { width: 60 }), col('real', 'Donnée réelle ?', 'bool', { width: 14 })],
          allowAdd: true, spare: 2, newItem: function () { return { label: '', ha: 0, note: '', real: true }; } },
        { type: 'table', id: 'amAffect', title: 'Affectation — répartition schématique', path: 'amenagement.landUse.affectation', keyOf: function (r, i) { return 'a' + i; },
          columns: [col('label', 'Affectation', 'text', { width: 30, required: true }), col('ha', 'Hectares', 'int', { width: 12 }), col('pct', 'Part (%)', 'num', { decimals: 1, width: 10 })],
          allowAdd: false, note: 'Les couleurs du graphique sont conservées automatiquement.' },
        { type: 'table', id: 'amConv', title: 'Conversions résidence ↔ villégiature (nombre par année)', custom: 'amConv',
          columns: [col('year', 'Année', 'text', { width: 10, required: true }), col('chaletToResidence', 'Chalet → résidence', 'int', { width: 18 }), col('residenceToChalet', 'Résidence → chalet', 'int', { width: 18 })], allowAdd: true, spare: 3 },
        { type: 'fields', title: 'Conversions — source', items: [fld('amenagement.conversion.source', 'Source affichée', 'text')] },
        { type: 'table', id: 'amConvMuni', title: 'Conversions — lecture par municipalité', path: 'amenagement.conversion.byMuni', keyOf: function (r) { return r.name; },
          columns: [col('name', 'Municipalité', 'enum', { enum: muniNames, width: 26, required: true }), col('villegiature', 'Villégiature', 'enum', { enum: ['Élevée', 'Moyenne', 'Faible'], width: 12 }),
            col('net', 'Tendance nette', 'text', { width: 24 }), col('note', 'Note', 'text', { width: 50 })],
          allowAdd: true, spare: 3, newItem: function () { return { name: '', villegiature: 'Moyenne', net: 'Stable', note: '' }; } }
      ]
    });

    /* ── MRC - Santé ── */
    sheets.push({
      name: 'MRC - Santé', kind: 'mrc', intro: 'Déterminants de la santé des populations (scores et indicateurs).',
      blocks: [
        { type: 'table', id: 'sante', title: 'Déterminants de la santé', path: 'sante.determinants', keyOf: function (d) { return d.id; },
          columns: [col('name', 'Déterminant', 'text', { width: 30, required: true }), col('score', 'Score /100', 'int', { width: 10, min: 0, max: 100 }),
            col('level', 'Niveau', 'enum', { enum: SANTE_LEVELS, width: 13 }), col('source', 'Pilier source', 'text', { width: 24 }),
            col('indicator', 'Indicateur (texte affiché)', 'text', { width: 70 }), col('link', 'Lien avec la santé (texte affiché)', 'text', { width: 70 }), col('real', 'Donnée réelle ?', 'bool', { width: 12 })],
          allowAdd: false, note: 'L\'indice composite est recalculé automatiquement à partir des scores.' }
      ]
    });

    /* ── MRC - Économie (LGP) ── */
    var lgpNum = [col('empN', 'Emplois', 'int', { width: 10 }), col('empP', 'Emplois (%)', 'int', { width: 11 }), col('etN', 'Établissements', 'int', { width: 14 }), col('etP', 'Établ. (%)', 'int', { width: 10 }),
      col('pibN', 'PIB (M$)', 'int', { width: 10 }), col('pibP', 'PIB (%)', 'int', { width: 9 }), col('venN', 'Ventes (M$)', 'int', { width: 11 }), col('venP', 'Ventes (%)', 'int', { width: 10 })];
    sheets.push({
      name: 'MRC - Économie (LGP)', kind: 'mrc', intro: 'Portrait industriel officiel (LGP / Table des MRC de l\'Estrie).',
      blocks: [
        { type: 'fields', title: 'Agrégats du portrait industriel', items: [
          fld('portraitLGP.agregats.etablissements', 'Établissements', 'int'), fld('portraitLGP.agregats.emplois', 'Emplois industriels', 'int'),
          fld('portraitLGP.agregats.pibMk', 'PIB', 'int', { note: 'M$' }), fld('portraitLGP.agregats.ventesMk', 'Ventes', 'int', { note: 'M$' }),
          fld('portraitLGP.agregats.grandsEtab250plus', 'Grands établissements (250 et plus)', 'int'), fld('portraitLGP.source', 'Source affichée', 'text')] },
        { type: 'table', id: 'lgpTailleEtab', title: 'Établissements par taille (%)', path: 'portraitLGP.tailleEtab', keyOf: function (r, i) { return 't' + i; }, columns: [col('label', 'Taille', 'text', { width: 22, required: true }), col('pct', 'Part (%)', 'num', { decimals: 1, width: 10 })], allowAdd: false },
        { type: 'table', id: 'lgpTailleEmp', title: 'Emplois par taille d\'établissement (%)', path: 'portraitLGP.tailleEmplois', keyOf: function (r, i) { return 't' + i; }, columns: [col('label', 'Taille', 'text', { width: 22, required: true }), col('pct', 'Part (%)', 'num', { decimals: 1, width: 10 })], allowAdd: false },
        { type: 'table', id: 'lgpSplit', title: 'Répartition par secteur (%)', path: 'portraitLGP.secteurSplit', keyOf: function (r, i) { return 's' + i; }, columns: [col('label', 'Secteur', 'text', { width: 22, required: true }), col('pct', 'Part (%)', 'num', { decimals: 1, width: 10 })], allowAdd: false },
        { type: 'table', id: 'lgpGrandes', title: 'Grandes industries', path: 'portraitLGP.grandesIndustries', keyOf: function (r) { return r.nom; },
          columns: [col('nom', 'Industrie', 'text', { width: 44, required: true })].concat(lgpNum), allowAdd: true, spare: 2, newItem: function () { return { nom: '', empN: 0, empP: 0, etN: 0, etP: 0, pibN: 0, pibP: 0, venN: 0, venP: 0 }; } },
        { type: 'table', id: 'lgpPiliers', title: 'Piliers (codes SCIAN)', path: 'portraitLGP.piliers', keyOf: function (r) { return r.scian; },
          columns: [col('scian', 'SCIAN', 'text', { width: 8, required: true }), col('nom', 'Industrie', 'text', { width: 44, required: true })].concat(lgpNum), allowAdd: true, spare: 2, newItem: function () { return { scian: '', nom: '', empN: 0, empP: 0, etN: 0, etP: 0, pibN: 0, pibP: 0, venN: 0, venP: 0 }; } },
        { type: 'table', id: 'lgpDistEstrie', title: 'Industries distinctives — indice vs Estrie', path: 'portraitLGP.distinctifsEstrie', keyOf: function (r) { return r.nom; }, columns: [col('nom', 'Industrie', 'text', { width: 44, required: true }), col('indice', 'Indice', 'num', { decimals: 1, width: 10 })], allowAdd: true, spare: 2, newItem: function () { return { nom: '', indice: 0 }; } },
        { type: 'table', id: 'lgpDistQc', title: 'Industries distinctives — indice vs Québec', path: 'portraitLGP.distinctifsQuebec', keyOf: function (r) { return r.nom; }, columns: [col('nom', 'Industrie', 'text', { width: 44, required: true }), col('indice', 'Indice', 'num', { decimals: 1, width: 10 })], allowAdd: true, spare: 2, newItem: function () { return { nom: '', indice: 0 }; } },
        { type: 'table', id: 'lgpEmployeurs', title: 'Grands employeurs', path: 'portraitLGP.grandsEmployeurs', keyOf: function (r) { return r.nom; },
          columns: [col('nom', 'Employeur', 'text', { width: 34, required: true }), col('cat', 'Catégorie d\'emplois', 'text', { width: 14 }), col('industrie', 'Industrie', 'text', { width: 36 }), col('scian', 'Secteur SCIAN', 'text', { width: 36 })], allowAdd: true, spare: 3, newItem: function () { return { nom: '', cat: '', industrie: '', scian: '' }; } }
      ]
    });

    /* ── MRC - Main-d'œuvre ── */
    sheets.push({
      name: 'MRC - Main-d\'œuvre', kind: 'mrc', intro: 'Bassin de main-d\'œuvre, scolarité et relève.',
      blocks: [
        { type: 'fields', title: 'Généralités', items: [fld('mainOeuvre.annee', 'Année de référence', 'text'), fld('mainOeuvre.source', 'Source affichée', 'text'), fld('mainOeuvre.constat', 'Constat (texte affiché)', 'text'),
          fld('mainOeuvre.education.note', 'Scolarité — note', 'text'), fld('mainOeuvre.etudiants.note', 'Relève — note', 'text')] },
        { type: 'table', id: 'moInd', title: 'Indicateurs de main-d\'œuvre', path: 'mainOeuvre.indicateurs', keyOf: function (r, i) { return 'i' + i; },
          columns: [col('label', 'Indicateur', 'text', { width: 32, required: true }), col('value', 'Valeur affichée', 'text', { width: 14 }), col('unit', 'Unité / source', 'text', { width: 44 }), col('real', 'Donnée réelle ?', 'bool', { width: 12 })],
          allowAdd: true, spare: 2, newItem: function () { return { label: '', value: '', unit: '', real: true }; } },
        { type: 'table', id: 'moEdu', title: 'Scolarité (population de 25-64 ans)', path: 'mainOeuvre.education.items', keyOf: function (r, i) { return 'e' + i; },
          columns: [col('label', 'Indicateur', 'text', { width: 44, required: true }), col('granit', 'Granit (%)', 'int', { width: 10 }), col('estrie', 'Estrie (%)', 'int', { width: 10 }), col('comment', 'Commentaire', 'text', { width: 60 })],
          allowAdd: true, spare: 2, newItem: function () { return { label: '', granit: 0, estrie: 0, comment: '' }; } },
        { type: 'table', id: 'moEtu', title: 'Relève et formation', path: 'mainOeuvre.etudiants.items', keyOf: function (r, i) { return 's' + i; },
          columns: [col('label', 'Cohorte', 'text', { width: 40, required: true }), col('value', 'Valeur affichée', 'text', { width: 16 }), col('sub', 'Précision', 'text', { width: 60 })],
          allowAdd: true, spare: 2, newItem: function () { return { label: '', value: '', sub: '' }; } }
      ]
    });

    /* ── MRC - Tourisme ── */
    var memberCols = [col('nom', 'Nom du membre', 'text', { width: 40, required: true }), col('categorie', 'Catégorie', 'enum', { enum: TOUR_CATEG, width: 26 }), col('grande', 'Grande section', 'enum', { enum: TOUR_GRANDE, width: 26 }),
      col('sous', 'Sous-section', 'enum', { enum: TOUR_SOUS, width: 34 }), col('responsable', 'Responsable', 'text', { width: 22 }), col('tel', 'Téléphone', 'text', { width: 14 }), col('courriel', 'Courriel', 'text', { width: 28 }),
      col('chHotel', 'Chambres (hôtel)', 'int', { width: 10, blankAs: 0 }), col('chGite', 'Chambres (gîte)', 'int', { width: 10, blankAs: 0 }), col('camping', 'Empl. camping', 'int', { width: 10, blankAs: 0 }), col('chalets', 'Chalets', 'int', { width: 9, blankAs: 0 }), col('employes', 'Employés (texte)', 'text', { width: 18 })];
    sheets.push({
      name: 'MRC - Tourisme', kind: 'mrc', intro: 'Paramètres du volet tourisme. Les membres situés dans la MRC se saisissent dans la feuille de leur municipalité; les totaux par municipalité et par catégorie sont recalculés automatiquement.',
      blocks: [
        { type: 'fields', title: 'Généralités', items: [fld('tourisme.annee', 'Année du guide', 'text', { note: 'utilisée dans la description des membres' }), fld('tourisme.source', 'Source affichée', 'text'), fld('tourisme.note', 'Note affichée', 'text')] },
        { type: 'table', id: 'tourHors', title: 'Membres situés hors de la MRC', custom: 'tourHors',
          columns: [col('muni', 'Municipalité (hors MRC)', 'text', { width: 22, required: true })].concat(memberCols), allowAdd: true, spare: 5 }
      ]
    });

    /* ── MRC - Logements ── */
    sheets.push({
      name: 'MRC - Logements', kind: 'mrc', intro: 'Agrégats territoriaux du volet logements et services de garde. Le parc total de logements est la somme des municipalités.',
      blocks: [
        { type: 'fields', title: 'Agrégats', items: [fld('logements.annee', 'Année de référence', 'text'), fld('logements.agregats.menagesLocataires', 'Ménages locataires', 'int'),
          fld('logements.agregats.logementsSociaux', 'Logements sociaux et communautaires', 'int'), fld('logements.agregats.tauxInoccupation', 'Taux d\'inoccupation', 'num', { decimals: 1, note: '% — laisser vide si non publié' }),
          fld('logements.agregats.garderiesInstallations', 'Installations (CPE + garderies)', 'int'), fld('logements.agregats.placesGardeTotal', 'Places en service de garde — total', 'int'),
          fld('logements.agregats.placesMilieuFamilial', 'Places en milieu familial', 'int'), fld('logements.source', 'Source affichée', 'text')] }
      ]
    });

    /* ── MRC - Climat ── */
    var K = D.climat || {};
    sheets.push({
      name: 'MRC - Climat', kind: 'mrc', intro: 'Inventaire des émissions de GES. Les émissions par municipalité se saisissent dans chaque feuille municipale; les totaux par secteur, par habitant et les parts sont recalculés automatiquement.',
      blocks: [
        { type: 'fields', title: 'Inventaire — paramètres', items: [fld('climat.annee', 'Année de référence', 'text'), fld('climat.statut', 'Statut des données', 'text'), fld('climat.source', 'Source affichée', 'text'),
          fld('climat.agregats.biogeniques', 'Émissions biogéniques', 'num', { decimals: 1, note: 'tCO₂éq' }), fld('climat.agregats.incertitudePct', 'Incertitude', 'num', { decimals: 2, note: '%' }), fld('climat.agregats.incertitudeAbs', 'Incertitude absolue', 'num', { decimals: 1, note: 'tCO₂éq' }),
          fld('climat.agregats.grandsEmetteurs', 'Grands émetteurs', 'int'), fld('climat.agregats.gazNaturelGJ', 'Gaz naturel', 'num', { decimals: 1, note: 'GJ' }), fld('climat.agregats.litresLiquides', 'Combustibles liquides', 'int', { note: 'litres' }),
          fld('climat.agregats.litresParHab', 'Litres par habitant', 'int'), fld('climat.agregats.elecGWh', 'Électricité', 'num', { decimals: 1, note: 'GWh' }), fld('climat.agregats.vehiculesImmat', 'Véhicules immatriculés', 'int'),
          fld('climat.agregats.vehiculesParHab', 'Véhicules par habitant', 'num', { decimals: 2 }), fld('climat.agregats.mazoutT', 'Mazout — émissions', 'num', { decimals: 1, note: 'tCO₂éq' }), fld('climat.agregats.mazoutL', 'Mazout — volume', 'int', { note: 'litres' })] },
        { type: 'fields', title: 'Transport', items: [fld('climat.transport.litres', 'Carburants routiers', 'int', { note: 'litres' }), fld('climat.transport.vehiculesTotal', 'Véhicules', 'int'), fld('climat.transport.note', 'Note affichée', 'text')] },
        { type: 'table', id: 'clTrTypes', title: 'Transport — par type de véhicule', path: 'climat.transport.types', keyOf: function (r) { return r.l; },
          columns: [col('l', 'Type', 'text', { width: 30, required: true }), col('t', 'tCO₂éq', 'num', { decimals: 1, width: 12 }), col('pct', 'Part (%)', 'num', { decimals: 1, width: 10 }), col('litres', 'Litres', 'int', { width: 12 }), col('nb', 'Nombre', 'int', { width: 10 })], allowAdd: false },
        { type: 'table', id: 'clTrHors', title: 'Transport — hors route', path: 'climat.transport.horsRoute', keyOf: function (r) { return r.l; }, columns: [col('l', 'Type', 'text', { width: 30, required: true }), col('nb', 'Nombre', 'int', { width: 10 })], allowAdd: true, spare: 2, newItem: function () { return { l: '', nb: 0 }; } },
        { type: 'fields', title: 'Bâtiments', items: [fld('climat.batiments.total', 'Bâtiments — total', 'num', { decimals: 2, note: 'tCO₂éq' }), fld('climat.batiments.partMrc', 'Bâtiments — part de la MRC', 'num', { decimals: 1, note: '%' }), fld('climat.batiments.elecT', 'Électricité — émissions', 'num', { decimals: 1, note: 'tCO₂éq' }), fld('climat.batiments.gazNaturel', 'Gaz naturel — mention', 'text'), fld('climat.batiments.cible', 'Cible (texte affiché)', 'text')] },
        { type: 'table', id: 'clBatSrc', title: 'Bâtiments — par source d\'énergie', path: 'climat.batiments.sources', keyOf: function (r) { return r.l; },
          columns: [col('l', 'Source', 'text', { width: 26, required: true }), col('t', 'tCO₂éq', 'num', { decimals: 1, width: 12 }), col('qte', 'Quantité', 'num', { decimals: 1, width: 14 }), col('u', 'Unité', 'text', { width: 10 })], allowAdd: false },
        { type: 'table', id: 'clBatSect', title: 'Bâtiments — par secteur', path: 'climat.batiments.parSecteur', keyOf: function (r) { return r.l; },
          columns: [col('l', 'Secteur', 'text', { width: 26, required: true }), col('t', 'tCO₂éq', 'num', { decimals: 1, width: 12 }), col('surf', 'Surface (m²)', 'num', { decimals: 1, width: 14 }), col('elec', 'Électricité (MWh)', 'num', { decimals: 1, width: 14 })], allowAdd: false },
        { type: 'fields', title: 'Agriculture', items: [fld('climat.agriculture.azoteKg', 'Azote épandu', 'num', { decimals: 1, note: 'kg' }), fld('climat.agriculture.note', 'Note affichée', 'text')] },
        { type: 'table', id: 'clAgSrc', title: 'Agriculture — par source', path: 'climat.agriculture.sources', keyOf: function (r) { return r.l; }, columns: [col('l', 'Source', 'text', { width: 34, required: true }), col('t', 'tCO₂éq', 'num', { decimals: 1, width: 12 }), col('pct', 'Part (%)', 'num', { decimals: 1, width: 10 })], allowAdd: false },
        { type: 'table', id: 'clAgCult', title: 'Agriculture — cultures (hectares)', path: 'climat.agriculture.cultures', keyOf: function (r) { return r.l; }, columns: [col('l', 'Culture', 'text', { width: 34, required: true }), col('ha', 'Hectares', 'num', { decimals: 1, width: 12 })], allowAdd: false },
        { type: 'fields', title: 'Matières résiduelles', items: [fld('climat.matieres.site', 'Site d\'enfouissement', 'text'), fld('climat.matieres.captage', 'Captage du biogaz', 'num', { decimals: 1, note: '%' }), fld('climat.matieres.oxydation', 'Oxydation', 'num', { decimals: 1, note: '%' }), fld('climat.matieres.destruction', 'Destruction', 'num', { decimals: 1, note: '%' }),
          fld('climat.matieres.tonnage2023.res', 'Tonnage résidentiel', 'int', { note: 't' }), fld('climat.matieres.tonnage2023.ici', 'Tonnage ICI', 'int', { note: 't' }), fld('climat.matieres.tonnage2023.crd', 'Tonnage CRD', 'int', { note: 't' }), fld('climat.matieres.tonnage2023.tot', 'Tonnage total', 'int', { note: 't' }), fld('climat.matieres.note', 'Note affichée', 'text')] },
        { type: 'table', id: 'clMatProv', title: 'Matières résiduelles — par provenance', path: 'climat.matieres.parProvenance', keyOf: function (r) { return r.l; }, columns: [col('l', 'Provenance', 'text', { width: 30, required: true }), col('t', 'tCO₂éq', 'num', { decimals: 1, width: 12 })], allowAdd: false }
      ]
    });

    /* ── Une feuille par municipalité ── */
    var bands = (D.demographie && D.demographie.bands) || [];
    var projYears = (D.demographie && D.demographie.projYears) || [2026, 2031, 2036, 2041];
    var trendYears = (D.demographie && D.demographie.trendYears) || YEAR_FIELD_DEMO;
    var convNames = ((am.conversion && am.conversion.byMuni) || []).map(function (x) { return x.name; });
    munis.forEach(function (mu) {
      var mp = 'municipalities[code=' + mu.code + ']';
      var blocks = [];
      blocks.push({ type: 'fields', title: 'Identité', items: [
        fld(mp + '.pop', 'Population', 'int', { note: 'habitants (décret MAMH) — la densité est recalculée automatiquement' }),
        fld(mp + '.surface', 'Superficie terrestre', 'num', { decimals: 1, note: 'km²' }),
        fld(mp + '.type', 'Statut', 'enum', { enum: MUNI_TYPES }), fld(mp + '.cat', 'Catégorie territoriale', 'enum', { enum: MUNI_CATS, note: 'urbain, rural ou rural_eloigne' }),
        fld(mp + '.role', 'Rôle (étiquette affichée)', 'text'), fld(mp + '.note', 'Note (texte affiché)', 'text')] });
      blocks.push({ type: 'table', id: 'demoPyr@' + mu.code, title: 'Démographie — structure par âge (estimation ISQ)', custom: 'demoPyr', code: mu.code,
        columns: [col('band', 'Groupe d\'âge', 'text', { width: 14, locked: true }), col('n', 'Personnes', 'int', { width: 12 })], allowAdd: false, note: 'Le portrait de la MRC (pyramide, totaux, projections) est la somme des 19 municipalités, recalculée automatiquement.' });
      blocks.push({ type: 'fields', title: 'Démographie — totaux', items: [fld(mp + '.demo.agg.a017', '0-17 ans', 'int'), fld(mp + '.demo.agg.a1864', '18-64 ans', 'int'), fld(mp + '.demo.agg.a65', '65 ans et plus', 'int'), fld(mp + '.demo.agg.tot', 'Total (estimation ISQ)', 'int'),
        fld(mp + '.demo.agemoy.2026', 'Âge moyen 2026', 'num', { decimals: 2 }), fld(mp + '.demo.agemoy.2041', 'Âge moyen projeté 2041', 'num', { decimals: 2 })] });
      blocks.push({ type: 'table', id: 'demoTrend@' + mu.code, title: 'Démographie — évolution de la population', custom: 'demoTrend', code: mu.code,
        columns: [col('year', 'Année', 'text', { width: 10, locked: true }), col('pop', 'Population', 'int', { width: 12 })], allowAdd: false });
      blocks.push({ type: 'table', id: 'demoProj@' + mu.code, title: 'Démographie — projections', custom: 'demoProj', code: mu.code,
        columns: [col('year', 'Année', 'text', { width: 10, locked: true }), col('tot', 'Total', 'int', { width: 10 }), col('a019', '0-19 ans', 'int', { width: 10 }), col('a2064', '20-64 ans', 'int', { width: 10 }), col('a65', '65 ans et plus', 'int', { width: 12 })], allowAdd: false });
      var lp = 'logements.parMuni[code=' + mu.code + ']';
      blocks.push({ type: 'fields', title: 'Logements et services de garde', items: [
        fld(lp + '.logements.total', 'Logements — parc total', 'int'), fld(lp + '.logements.locatifs', 'Logements locatifs', 'int'), fld(lp + '.logements.sociaux', 'Logements sociaux', 'int', { note: 'vide = non renseigné' }), fld(lp + '.logements.coop', 'Logements coopératifs', 'int', { note: 'vide = non renseigné' }),
        fld(lp + '.logements.real', 'Logements — donnée réelle ?', 'bool'), fld(lp + '.logements.est', 'Logements — estimation ?', 'bool'), fld(lp + '.logements.source', 'Logements — source (texte affiché)', 'text'),
        fld(lp + '.garderies.cpe', 'CPE (installations)', 'int', { note: 'vide = non renseigné' }), fld(lp + '.garderies.garderies', 'Garderies', 'int'), fld(lp + '.garderies.milieuFamilial', 'Places en milieu familial', 'int'), fld(lp + '.garderies.placesTotal', 'Places — total', 'int'),
        fld(lp + '.garderies.real', 'Garderies — donnée réelle ?', 'bool'), fld(lp + '.garderies.source', 'Garderies — source (texte affiché)', 'text')] });
      var kp = 'climat.parMuni[muni=' + mu.name + ']';
      blocks.push({ type: 'fields', title: 'Plan climat — émissions de GES (tCO₂éq) et activités', items: [
        fld(kp + '.pop', 'Population de référence (inventaire)', 'int'), fld(kp + '.pop36', 'Population projetée 2036', 'int'),
        fld(kp + '.res', 'Émissions — résidentiel', 'num', { decimals: 1 }), fld(kp + '.ci', 'Émissions — commercial et institutionnel', 'num', { decimals: 1 }), fld(kp + '.ind', 'Émissions — industriel', 'num', { decimals: 1 }),
        fld(kp + '.agri', 'Émissions — agriculture', 'num', { decimals: 1 }), fld(kp + '.transp', 'Émissions — transport', 'num', { decimals: 1 }), fld(kp + '.mr', 'Émissions — matières résiduelles', 'num', { decimals: 1 }),
        fld(kp + '.supRes', 'Surface résidentielle', 'num', { decimals: 1, note: 'm²' }), fld(kp + '.supCi', 'Surface commerciale et institutionnelle', 'num', { decimals: 1, note: 'm²' }), fld(kp + '.supInd', 'Surface industrielle', 'num', { decimals: 1, note: 'm²' }), fld(kp + '.supAgri', 'Surface agricole', 'num', { decimals: 1, note: 'm²' }),
        fld(kp + '.cheptel', 'Cheptel (têtes)', 'int'), fld(kp + '.haCult', 'Hectares cultivés', 'num', { decimals: 1 })],
        note: 'Total, périmètre ATCL, émissions par habitant, part de la MRC et secteur dominant sont recalculés automatiquement.' });
      if (convNames.indexOf(mu.name) >= 0) {
        var cp = 'amenagement.conversion.byMuni[name=' + mu.name + ']';
        blocks.push({ type: 'fields', title: 'Aménagement — conversion résidence / villégiature', items: [fld(cp + '.villegiature', 'Villégiature', 'enum', { enum: ['Élevée', 'Moyenne', 'Faible'] }), fld(cp + '.net', 'Tendance nette', 'text'), fld(cp + '.note', 'Note', 'text')] });
      }
      blocks.push({ type: 'table', id: 'companies@' + mu.code, title: 'Entreprises et employeurs', custom: 'companies', code: mu.code, muni: mu.name,
        columns: [col('name', 'Entreprise', 'text', { width: 40, required: true }), col('sector', 'Secteur', 'enum', { enum: sectorNames(D), width: 30 }), col('jobs', 'Emplois', 'int', { width: 9, blankAs: 0 }),
          col('status', 'Statut', 'enum', { enum: CO_STATUS, width: 13 }), col('desc', 'Description (texte affiché)', 'text', { width: 70 })],
        allowAdd: true, spare: 8, note: 'Une ligne par entreprise. Pour ajouter une entreprise, utilisez une ligne libre; pour la retirer, effacez son nom. Statut « a_completer » = effectif non confirmé, exclu des totaux. Les membres touristiques sont saisis dans le tableau suivant.' });
      blocks.push({ type: 'table', id: 'membres@' + mu.code, title: 'Membres de Tourisme Région de Mégantic', custom: 'membres', code: mu.code, muni: mu.name,
        columns: memberCols, allowAdd: true, spare: 6, note: 'Une ligne par membre. Les comptes par municipalité, par catégorie et les fiches « tourisme » de la liste d\'entreprises sont régénérés automatiquement.' });
      sheets.push({ name: safeSheetName(mu.name), kind: 'muni', code: mu.code, muni: mu.name, intro: 'Feuille de la municipalité de ' + mu.name + ' (code géographique ' + mu.code + ').', blocks: blocks });
    });
    return sheets;
  }

  /* ─── accès aux lignes des tableaux (lecture des données actuelles) ─── */
  function tableRows(D, blk) {
    var rows;
    switch (blk.custom) {
      case 'trends': {
        var t = D.trends || { years: [] };
        rows = (t.years || []).map(function (y, i) {
          var r = { year: String(y), totalJobs: (t.totalJobs || [])[i], newBiz: (t.newBiz || [])[i], permitsMk: (t.permitsMk || [])[i] };
          Object.keys(t.bySector || {}).forEach(function (k) { r['sec:' + k] = t.bySector[k][i]; });
          return r;
        });
        return rows.map(function (r) { return { key: r.year, item: r }; });
      }
      case 'amPermits': { var p = (D.amenagement && D.amenagement.permits) || { years: [] }; return (p.years || []).map(function (y, i) { return { key: String(y), item: { year: String(y), totalMk: (p.totalMk || [])[i] } }; }); }
      case 'amConv': { var c = (D.amenagement && D.amenagement.conversion) || { years: [] }; return (c.years || []).map(function (y, i) { return { key: String(y), item: { year: String(y), chaletToResidence: (c.chaletToResidence || [])[i], residenceToChalet: (c.residenceToChalet || [])[i] } }; }); }
      case 'tourHors': return ((D.tourisme && D.tourisme.membres) || []).filter(function (m) { return m.horsMRC; }).map(function (m) { return { key: m.nom, item: m }; });
      case 'demoPyr': { var m1 = getPath(D, 'municipalities[code=' + blk.code + ']'); var pyr = (m1 && m1.demo && m1.demo.pyr) || []; var bands = (D.demographie && D.demographie.bands) || []; return bands.map(function (b, i) { return { key: b, item: { band: b, n: pyr[i] } }; }); }
      case 'demoTrend': { var m2 = getPath(D, 'municipalities[code=' + blk.code + ']'); var tr = (m2 && m2.demo && m2.demo.trend) || {}; var ty = (D.demographie && D.demographie.trendYears) || Object.keys(tr); return ty.map(function (y) { return { key: String(y), item: { year: String(y), pop: tr[String(y)] } }; }); }
      case 'demoProj': { var m3 = getPath(D, 'municipalities[code=' + blk.code + ']'); var pj = (m3 && m3.demo && m3.demo.proj) || {}; var py = (D.demographie && D.demographie.projYears) || Object.keys(pj); return py.map(function (y) { var o = pj[String(y)] || {}; return { key: String(y), item: { year: String(y), tot: o.tot, a019: o.a019, a2064: o.a2064, a65: o.a65 } }; }); }
      case 'companies': return (D.companies || []).filter(function (c) { return c.muni === blk.muni && c.src !== 'tourisme'; }).map(function (c) { return { key: c.id, item: c }; });
      case 'membres': return ((D.tourisme && D.tourisme.membres) || []).filter(function (m) { return m.muni === blk.muni && !m.horsMRC; }).map(function (m) { return { key: m.nom, item: m }; });
      default: { var arr = getPath(D, blk.path) || []; return arr.map(function (it, i) { return { key: String(blk.keyOf(it, i)), item: it }; }); }
    }
  }

  /* ─── valeurs de cellule ─── */
  function toCell(v, kind) {
    if (v === null || v === undefined) return null;
    if (kind === 'bool') return v ? 'Oui' : 'Non';
    if (kind === 'int' || kind === 'num') { var n = Number(v); return isNaN(n) ? null : n; }
    return String(v);
  }
  function fromCell(raw, def, ctx) {
    // renvoie {ok, value, error}
    var kind = def.kind;
    if (raw && typeof raw === 'object' && raw.richText) raw = raw.richText.map(function (r) { return r.text; }).join('');
    if (raw instanceof Date) raw = raw.toISOString().slice(0, 10);
    if (isBlank(raw)) {
      if (def.blankAs !== undefined) return { ok: true, value: def.blankAs };
      if (kind === 'text') return { ok: true, value: '' };
      return { ok: true, value: null };
    }
    if (kind === 'int' || kind === 'num') {
      var n = typeof raw === 'number' ? raw : Number(String(raw).replace(/\s| /g, '').replace(',', '.').replace(/[$%]/g, ''));
      if (isNaN(n)) return { ok: false, error: 'valeur numérique attendue, reçu « ' + raw + ' »' };
      if (def.min !== undefined && n < def.min) return { ok: false, error: 'valeur inférieure au minimum ' + def.min };
      if (def.max !== undefined && n > def.max) return { ok: false, error: 'valeur supérieure au maximum ' + def.max };
      return { ok: true, value: kind === 'int' ? Math.round(n) : round(n, def.decimals !== undefined ? def.decimals : 2) };
    }
    if (kind === 'bool') { var s = String(raw).trim().toLowerCase(); if (['oui', 'o', 'yes', 'true', '1', 'vrai'].indexOf(s) >= 0) return { ok: true, value: true }; if (['non', 'n', 'no', 'false', '0', 'faux'].indexOf(s) >= 0) return { ok: true, value: false }; return { ok: false, error: 'Oui ou Non attendu, reçu « ' + raw + ' »' }; }
    if (kind === 'enum') { var sv = normText(raw); if (def.enum && def.enum.indexOf(sv) < 0) return { ok: false, error: 'valeur « ' + sv + ' » non permise (choix : ' + def.enum.join(', ') + ')' }; return { ok: true, value: sv }; }
    return { ok: true, value: typeof raw === 'number' ? String(raw) : normText(raw) };
  }
  function same(a, b, kind) {
    if (kind === 'int' || kind === 'num') { if (a == null && b == null) return true; if (a == null || b == null) return false; return Math.abs(Number(a) - Number(b)) < 1e-9; }
    if (kind === 'bool') return !!a === !!b;
    return normText(a) === normText(b);
  }

  /* ═════════════ GÉNÉRATION (ExcelJS) ═════════════ */
  var ST = {
    title: { font: { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF0B3D2E' } } },
    sub: { font: { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF555555' } } },
    block: { font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A4D2E' } } },
    head: { font: { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0B3D2E' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3EFE8' } } },
    label: { font: { name: 'Calibri', size: 10, color: { argb: 'FF1C2533' } } },
    note: { font: { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF6B7280' } } },
    input: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8DC' } }, font: { name: 'Calibri', size: 10, color: { argb: 'FF111827' } } },
    spare: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFDF0' } }, font: { name: 'Calibri', size: 10, color: { argb: 'FF111827' } } },
    lockedCell: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }, font: { name: 'Calibri', size: 10, color: { argb: 'FF374151' } } }
  };
  var THIN = { style: 'thin', color: { argb: 'FFD1D5DB' } };
  function border(c) { c.border = { top: THIN, left: THIN, bottom: THIN, right: THIN }; }
  function applyStyle(c, st) { if (st.font) c.font = st.font; if (st.fill) c.fill = st.fill; }

  function numFmt(def) { if (def.kind === 'int') return '#,##0'; if (def.kind === 'num') { var d = def.decimals !== undefined ? def.decimals : 2; return d ? '#,##0.' + new Array(d + 1).join('0') : '#,##0'; } return '@'; }
  function validation(def) {
    var errT = 'Valeur non conforme';
    if (def.kind === 'int') return { type: 'whole', operator: 'between', allowBlank: true, formulae: [def.min !== undefined ? def.min : -1000000000, def.max !== undefined ? def.max : 1000000000000], showErrorMessage: true, errorStyle: 'stop', errorTitle: errT, error: 'Entrez un nombre entier' + (def.min !== undefined ? ' (min ' + def.min + ')' : '') + '.' };
    if (def.kind === 'num') return { type: 'decimal', operator: 'between', allowBlank: true, formulae: [-1e12, 1e12], showErrorMessage: true, errorStyle: 'stop', errorTitle: errT, error: 'Entrez un nombre (décimales avec la virgule ou le point selon vos paramètres Excel).' };
    if (def.kind === 'bool') return { type: 'list', allowBlank: true, formulae: ['"Oui,Non"'], showErrorMessage: true, errorStyle: 'stop', errorTitle: errT, error: 'Choisissez Oui ou Non.' };
    if (def.kind === 'enum' && def.enum && def.enum.length) {
      var joined = def.enum.join(',');
      if (joined.length < 250 && def.enum.every(function (e) { return e.indexOf(',') < 0 && e.indexOf('"') < 0; })) return { type: 'list', allowBlank: true, formulae: ['"' + joined + '"'], showErrorMessage: true, errorStyle: 'stop', errorTitle: errT, error: 'Choisissez une valeur dans la liste déroulante.' };
      return { listRef: true };
    }
    return null;
  }

  function buildWorkbook(ExcelJS, D, options) {
    options = options || {};
    var wb = new ExcelJS.Workbook();
    wb.creator = 'MRC du Granit — Tableau de bord territorial';
    wb.created = new Date();
    var spec = buildSpec(D);
    var sheetPw = options.sheetPassword || options.password || '';
    var listsWs = null, listsCol = 0, protections = [];
    function enumRange(values) {
      if (!listsWs) { listsWs = wb.addWorksheet('_listes', { state: 'veryHidden' }); }
      listsCol++;
      var colLetter = colName(listsCol);
      values.forEach(function (v, i) { listsWs.getCell(colLetter + (i + 1)).value = v; });
      return "'_listes'!$" + colLetter + '$1:$' + colLetter + '$' + values.length;
    }

    /* Feuille Lisez-moi */
    var rm = wb.addWorksheet('Lisez-moi', { properties: { tabColor: { argb: 'FF1A4D2E' } } });
    rm.getColumn(1).width = 110;
    var lines = [
      ['Tableau de bord territorial — MRC du Granit', ST.title],
      ['Chiffrier de mise à jour trimestrielle · généré le ' + new Date().toLocaleDateString('fr-CA') + ' · période actuelle : ' + ((D.meta && D.meta.quarter) || '—') + ' · format v' + VERSION, ST.sub],
      [''],
      ['Comment procéder', ST.block],
      ['1. Ouvrez ce fichier avec le mot de passe fourni. Ne le renommez pas en changeant son extension.', ST.label],
      ['2. Chaque municipalité dispose de sa propre feuille (onglets au bas de l\'écran). Les feuilles « MRC - … » contiennent les données territoriales.', ST.label],
      ['3. Modifiez uniquement les cellules jaunes. Les autres cellules sont verrouillées : elles portent les libellés et la structure dont la plateforme a besoin.', ST.label],
      ['4. Tableaux : une ligne par élément. Pour ajouter un élément, remplissez une ligne libre (jaune pâle) au bas du tableau. Pour retirer un élément, effacez son nom.', ST.label],
      ['5. Listes déroulantes : certaines cellules n\'acceptent que des valeurs précises (Oui / Non, statut, secteur…). Respectez-les, sinon l\'importation signalera une erreur.', ST.label],
      ['6. Enregistrez (Ctrl+S). Le fichier reste chiffré avec le même mot de passe.', ST.label],
      ['7. Sur la plateforme, cliquez « Importer Excel » ou glissez le fichier n\'importe où dans la page, entrez le mot de passe, vérifiez le résumé des changements, puis appliquez et publiez.', ST.label],
      [''],
      ['Ce qui est recalculé automatiquement par la plateforme', ST.block],
      ['• Densité de population de chaque municipalité (population ÷ superficie).', ST.label],
      ['• Portrait démographique de la MRC : pyramide des âges, totaux, évolution et projections = somme des 19 municipalités.', ST.label],
      ['• Tourisme : nombre de membres par municipalité, par grande section et par catégorie, hébergement (chambres, emplacements, chalets), et fiches « tourisme » de la liste d\'entreprises.', ST.label],
      ['• Logements : parc total de la MRC = somme des municipalités.', ST.label],
      ['• Plan climat : totaux par secteur, par habitant, périmètre ATCL, parts de chaque municipalité et secteur dominant.', ST.label],
      ['• Santé : indice composite à partir des scores des déterminants.', ST.label],
      [''],
      ['Ce que ce chiffrier ne modifie pas', ST.block],
      ['Les textes d\'analyse (introductions, constats, maillages, leviers, limites) restent dans la plateforme et se modifient avec l\'outil « Modifier les données » ou par le conseil scientifique.', ST.label],
      [''],
      ['Colonne A et lignes grises : marqueurs techniques utilisés par la plateforme pour reconnaître chaque champ. Ne pas supprimer ni déplacer.', ST.note]
    ];
    lines.forEach(function (l, i) { var c = rm.getCell(i + 1, 1); c.value = l[0]; if (l[1]) applyStyle(c, l[1]); c.alignment = { wrapText: true, vertical: 'top' }; if (l[1] === ST.block) { rm.getRow(i + 1).height = 20; } });
    protections.push(rm.protect(sheetPw, { selectLockedCells: true, selectUnlockedCells: true, spinCount: 2000 }));

    spec.forEach(function (sh) {
      var ws = wb.addWorksheet(sh.name, { properties: { tabColor: { argb: sh.kind === 'muni' ? 'FFD97706' : 'FF1D7A8A' } }, views: [{ state: 'frozen', ySplit: 2 }] });
      ws.getColumn(1).width = 2; ws.getColumn(1).hidden = true;
      ws.getColumn(2).width = 44; ws.getColumn(3).width = 24; ws.getColumn(4).width = 60;
      var r = 1;
      ws.getCell(r, 2).value = sh.name + (sh.kind === 'muni' ? ' — feuille municipale' : ''); applyStyle(ws.getCell(r, 2), ST.title); r++;
      ws.getCell(r, 2).value = sh.intro + ' Cellules jaunes = modifiables.'; applyStyle(ws.getCell(r, 2), ST.sub); ws.getCell(r, 2).alignment = { wrapText: false }; r += 2;
      var maxCols = 4;
      sh.blocks.forEach(function (blk) {
        if (blk.type === 'fields') {
          ws.getCell(r, 1).value = 'B|' + blk.title;
          ws.getCell(r, 2).value = blk.title; applyStyle(ws.getCell(r, 2), ST.block); applyStyle(ws.getCell(r, 3), ST.block); applyStyle(ws.getCell(r, 4), ST.block); r++;
          if (blk.note) { ws.getCell(r, 2).value = blk.note; applyStyle(ws.getCell(r, 2), ST.note); ws.mergeCells(r, 2, r, 4); ws.getCell(r, 2).alignment = { wrapText: true }; ws.getRow(r).height = 26; r++; }
          blk.items.forEach(function (it) {
            ws.getCell(r, 1).value = 'F|' + it.path;
            var lc = ws.getCell(r, 2); lc.value = it.label; applyStyle(lc, ST.label); border(lc);
            var vc = ws.getCell(r, 3); var v = getPath(D, it.path); vc.value = toCell(v, it.kind); applyStyle(vc, ST.input); border(vc); vc.protection = { locked: false };
            vc.numFmt = numFmt(it); if (it.kind === 'text') { vc.alignment = { wrapText: true, vertical: 'top' }; if (v && String(v).length > 60) ws.getColumn(3).width = 24; }
            var val = validation(it); if (val && val.listRef) val = { type: 'list', allowBlank: true, formulae: [enumRange(it.enum)], showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Valeur non conforme', error: 'Choisissez une valeur dans la liste déroulante.' };
            if (val) vc.dataValidation = val;
            var nc = ws.getCell(r, 4); nc.value = it.note || ''; applyStyle(nc, ST.note); border(nc);
            if (it.kind === 'text' && v && String(v).length > 22) { ws.getRow(r).height = Math.min(170, 14 * Math.ceil(String(v).length / 26)); vc.alignment = { wrapText: true, vertical: 'top' }; }
            r++;
          });
          r++;
        } else if (blk.type === 'table') {
          var cols = blk.columns; maxCols = Math.max(maxCols, cols.length + 1);
          ws.getCell(r, 1).value = 'T|' + blk.id;
          ws.getCell(r, 2).value = blk.title; for (var ci = 0; ci < cols.length; ci++) applyStyle(ws.getCell(r, 2 + ci), ST.block); r++;
          if (blk.note) { ws.getCell(r, 2).value = blk.note; applyStyle(ws.getCell(r, 2), ST.note); ws.mergeCells(r, 2, r, Math.max(4, cols.length + 1)); ws.getCell(r, 2).alignment = { wrapText: true, vertical: 'top' }; ws.getRow(r).height = 30; r++; }
          ws.getCell(r, 1).value = 'K|'; cols.forEach(function (c, i) { var kc = ws.getCell(r, 2 + i); kc.value = c.key; applyStyle(kc, ST.note); }); ws.getRow(r).hidden = true; r++;
          ws.getCell(r, 1).value = 'H|'; cols.forEach(function (c, i) { var hc = ws.getCell(r, 2 + i); hc.value = c.label; applyStyle(hc, ST.head); border(hc); hc.alignment = { wrapText: true, vertical: 'center' }; }); ws.getRow(r).height = 30; r++;
          var rows = tableRows(D, blk);
          var validations = cols.map(function (c) { var v = validation(c); if (v && v.listRef) v = { type: 'list', allowBlank: true, formulae: [enumRange(c.enum)], showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Valeur non conforme', error: 'Choisissez une valeur dans la liste déroulante.' }; return v; });
          function writeRow(key, item, spare) {
            var rowLines = 1;
            ws.getCell(r, 1).value = 'R|' + (key || '');
            cols.forEach(function (c, i) {
              var cell = ws.getCell(r, 2 + i); var v = item ? item[c.key] : null; cell.value = toCell(v, c.kind);
              border(cell); cell.numFmt = numFmt(c);
              if (c.locked && !spare) { applyStyle(cell, ST.lockedCell); } else { applyStyle(cell, spare ? ST.spare : ST.input); cell.protection = { locked: false }; if (validations[i]) cell.dataValidation = validations[i]; }
              if (c.kind === 'text' && c.width >= 30) { cell.alignment = { wrapText: true, vertical: 'top' }; if (v) { var ln = Math.ceil(String(v).length / (c.width - 4)); if (ln > 1) rowLines = Math.max(rowLines, ln); } }
            });
            if (rowLines > 1) ws.getRow(r).height = Math.min(120, 14 * rowLines);
            r++;
          }
          rows.forEach(function (rw) { writeRow(rw.key, rw.item, false); });
          var spare = blk.allowAdd ? (blk.spare || 3) : 0;
          for (var s = 0; s < spare; s++) writeRow('', null, true);
          ws.getCell(r, 1).value = 'E|'; r += 2;
          cols.forEach(function (c, i) { var colObj = ws.getColumn(2 + i); if (c.width && (colObj.width || 0) < c.width) colObj.width = c.width; });
        }
      });
      ws.getColumn(2).width = Math.max(ws.getColumn(2).width || 0, 44);
      protections.push(ws.protect(sheetPw, { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true, formatRows: true, insertRows: true, deleteRows: true, sort: false, autoFilter: false, pivotTables: false, spinCount: 2000 }));
    });
    return Promise.all(protections).then(function () { return wb; });
  }
  function colName(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

  /* ═════════════ LECTURE (xlsx-populate) ═════════════ */
  function cellVal(sheet, r, c) { try { var v = sheet.cell(r, c).value(); if (v && typeof v === 'object' && typeof v.text === 'function') return v.text(); return v === undefined ? null : v; } catch (e) { return null; } }
  function readWorkbook(wb) {
    // renvoie { sheets: {name: {fields: {path: {value, ref}}, tables: {blockId: {keys:[], rows:[{key, cells:{k: {value, ref}}, rowNum}]}}}}, sheetNames: [] }
    var out = { sheets: {}, sheetNames: [] };
    wb.sheets().forEach(function (sh) {
      var name = sh.name(); if (name === 'Lisez-moi' || name === '_listes') return;
      out.sheetNames.push(name);
      var S = { fields: {}, tables: {} }; out.sheets[name] = S;
      var used = sh.usedRange(); if (!used) return;
      var maxR = used.endCell().rowNumber(), maxC = used.endCell().columnNumber();
      var r = 1;
      while (r <= maxR) {
        var mk = cellVal(sh, r, 1); mk = mk == null ? '' : String(mk);
        if (mk.indexOf('F|') === 0) { S.fields[mk.slice(2)] = { value: cellVal(sh, r, 3), ref: name + '!C' + r }; r++; continue; }
        if (mk.indexOf('T|') === 0) {
          var id = mk.slice(2); var keys = null, rows = []; r++;
          while (r <= maxR) {
            var m2 = cellVal(sh, r, 1); m2 = m2 == null ? '' : String(m2);
            if (m2 === 'K|') { keys = []; for (var c = 2; c <= maxC; c++) { var kv = cellVal(sh, r, c); if (kv == null || kv === '') break; keys.push(String(kv)); } }
            else if (m2.indexOf('R|') === 0 && keys) { var row = { key: m2.slice(2), rowNum: r, cells: {} }; keys.forEach(function (k, i) { row.cells[k] = { value: cellVal(sh, r, 2 + i), ref: name + '!' + colName(2 + i) + r }; }); rows.push(row); }
            else if (m2 === 'E|') { r++; break; }
            r++;
          }
          S.tables[id] = { keys: keys || [], rows: rows };
          continue;
        }
        r++;
      }
    });
    return out;
  }

  /* ═════════════ APPLICATION ═════════════ */
  function applyImport(D0, parsed, options) {
    options = options || {};
    var D = clone(D0);
    var spec = buildSpec(D);
    var changes = [], errors = [], warnings = [], added = [], removed = [];
    var seenCompanies = {}, companySheets = 0, seenMembers = {}, memberSheets = 0, horsSeen = false;
    var newCompanies = [], newMembers = [];
    function chg(sheet, label, path, oldV, newV) { changes.push({ sheet: sheet, label: label, path: path, old: oldV, new: newV }); }

    spec.forEach(function (sh) {
      var S = parsed.sheets[sh.name]; if (!S) { warnings.push('Feuille « ' + sh.name + ' » absente du chiffrier : aucune modification pour cette feuille.'); return; }
      sh.blocks.forEach(function (blk) {
        if (blk.type === 'fields') {
          blk.items.forEach(function (it) {
            var f = S.fields[it.path]; if (!f) { warnings.push(sh.name + ' : champ « ' + it.label + ' » introuvable (ligne supprimée ?).'); return; }
            var res = fromCell(f.value, it); if (!res.ok) { errors.push(f.ref + ' — ' + it.label + ' : ' + res.error); return; }
            var oldV = getPath(D, it.path);
            if (!same(oldV, res.value, it.kind)) { setPath(D, it.path, res.value); chg(sh.name, it.label, it.path, oldV, res.value); }
          });
        } else if (blk.type === 'table') {
          var T = S.tables[blk.id]; if (!T) { warnings.push(sh.name + ' : tableau « ' + blk.title + ' » introuvable.'); return; }
          var cols = blk.columns; var byKey = {}; cols.forEach(function (c) { byKey[c.key] = c; });
          var keyCol = cols.filter(function (c) { return c.required; })[0] || cols[0];
          // lecture des lignes
          var parsedRows = [];
          T.rows.forEach(function (row) {
            var item = {}, bad = false, blank = true;
            cols.forEach(function (c) {
              var cell = row.cells[c.key]; if (!cell) { item[c.key] = undefined; return; }
              if (!isBlank(cell.value)) blank = false;
              var res = fromCell(cell.value, c); if (!res.ok) { errors.push(cell.ref + ' — ' + blk.title + ' / ' + c.label + ' : ' + res.error); bad = true; return; }
              item[c.key] = res.value;
            });
            var keyBlank = isBlank(item[keyCol.key]);
            if (row.key === '' && (blank || keyBlank)) return; // ligne libre non utilisée
            if (bad) return;
            if (keyBlank && row.key !== '') { parsedRows.push({ key: row.key, deleted: true }); return; }
            parsedRows.push({ key: row.key, item: item, ref: row.cells[keyCol.key] ? row.cells[keyCol.key].ref : sh.name });
          });
          applyTable(D, sh, blk, parsedRows, cols, byKey);
        }
      });
    });

    function applyTable(D, sh, blk, parsedRows, cols, byKey) {
      var label = blk.title;
      function updateItem(existing, item, keyLabel) {
        cols.forEach(function (c) {
          if (c.locked) return; if (item[c.key] === undefined) return;
          if (!same(existing[c.key], item[c.key], c.kind)) { var ov = existing[c.key]; existing[c.key] = item[c.key]; chg(sh.name, keyLabel + ' · ' + c.label, blk.id + '.' + c.key, ov, item[c.key]); }
        });
      }
      switch (blk.custom) {
        case 'trends': case 'amPermits': case 'amConv': {
          var live = parsedRows.filter(function (p) { return !p.deleted; });
          var years = live.map(function (p) { return String(p.item.year); });
          var cur = tableRows(D, blk).map(function (x) { return x.key; });
          var dup = years.filter(function (y, i) { return years.indexOf(y) !== i; }); if (dup.length) { errors.push(sh.name + ' — ' + label + ' : année en double (' + dup.join(', ') + ')'); return; }
          if (blk.custom === 'trends') {
            var t = D.trends; var old = clone(t);
            t.years = years; t.totalJobs = live.map(function (p) { return p.item.totalJobs == null ? 0 : p.item.totalJobs; }); t.newBiz = live.map(function (p) { return p.item.newBiz == null ? 0 : p.item.newBiz; }); t.permitsMk = live.map(function (p) { return p.item.permitsMk == null ? 0 : p.item.permitsMk; });
            var secKeys = cols.filter(function (c) { return c.key.indexOf('sec:') === 0; }).map(function (c) { return c.key.slice(4); });
            t.bySector = {}; secKeys.forEach(function (k) { t.bySector[k] = live.map(function (p) { return p.item['sec:' + k] == null ? 0 : p.item['sec:' + k]; }); });
            if (JSON.stringify(old) !== JSON.stringify(t)) chg(sh.name, label, 'trends', old.years.join(', '), years.join(', ') + ' (séries mises à jour)');
          } else if (blk.custom === 'amPermits') {
            var p = D.amenagement.permits; var o2 = clone({ years: p.years, totalMk: p.totalMk });
            p.years = years; p.totalMk = live.map(function (x) { return x.item.totalMk == null ? 0 : x.item.totalMk; });
            if (JSON.stringify(o2) !== JSON.stringify({ years: p.years, totalMk: p.totalMk })) chg(sh.name, label, 'amenagement.permits', o2.totalMk.join(', '), p.totalMk.join(', '));
          } else {
            var c = D.amenagement.conversion; var o3 = clone({ y: c.years, a: c.chaletToResidence, b: c.residenceToChalet });
            c.years = years; c.chaletToResidence = live.map(function (x) { return x.item.chaletToResidence == null ? 0 : x.item.chaletToResidence; }); c.residenceToChalet = live.map(function (x) { return x.item.residenceToChalet == null ? 0 : x.item.residenceToChalet; });
            if (JSON.stringify(o3) !== JSON.stringify({ y: c.years, a: c.chaletToResidence, b: c.residenceToChalet })) chg(sh.name, label, 'amenagement.conversion', o3.a.join(', ') + ' / ' + o3.b.join(', '), c.chaletToResidence.join(', ') + ' / ' + c.residenceToChalet.join(', '));
          }
          return;
        }
        case 'demoPyr': {
          var m = getPath(D, 'municipalities[code=' + blk.code + ']'); if (!m) return; m.demo = m.demo || {}; m.demo.pyr = m.demo.pyr || [];
          var bands = D.demographie.bands;
          parsedRows.forEach(function (p) { if (p.deleted) return; var i = bands.indexOf(p.key); if (i < 0) return; var nv = p.item.n == null ? 0 : p.item.n; if (!same(m.demo.pyr[i], nv, 'int')) { chg(sh.name, 'Pyramide · ' + p.key, 'municipalities[' + blk.code + '].demo.pyr[' + i + ']', m.demo.pyr[i], nv); m.demo.pyr[i] = nv; } });
          return;
        }
        case 'demoTrend': {
          var m2 = getPath(D, 'municipalities[code=' + blk.code + ']'); if (!m2) return; m2.demo = m2.demo || {}; m2.demo.trend = m2.demo.trend || {};
          parsedRows.forEach(function (p) { if (p.deleted) return; var nv = p.item.pop; if (!same(m2.demo.trend[p.key], nv, 'int')) { chg(sh.name, 'Population ' + p.key, 'municipalities[' + blk.code + '].demo.trend.' + p.key, m2.demo.trend[p.key], nv); m2.demo.trend[p.key] = nv; } });
          return;
        }
        case 'demoProj': {
          var m3 = getPath(D, 'municipalities[code=' + blk.code + ']'); if (!m3) return; m3.demo = m3.demo || {}; m3.demo.proj = m3.demo.proj || {};
          parsedRows.forEach(function (p) { if (p.deleted) return; var o = m3.demo.proj[p.key] = m3.demo.proj[p.key] || {}; ['tot', 'a019', 'a2064', 'a65'].forEach(function (k) { if (!same(o[k], p.item[k], 'int')) { chg(sh.name, 'Projection ' + p.key + ' · ' + k, 'municipalities[' + blk.code + '].demo.proj.' + p.key + '.' + k, o[k], p.item[k]); o[k] = p.item[k]; } }); });
          return;
        }
        case 'companies': {
          companySheets++;
          var byId = {}; (D.companies || []).forEach(function (c) { byId[c.id] = c; });
          parsedRows.forEach(function (p) {
            if (p.deleted) { seenCompanies[p.key] = 'deleted'; return; }
            if (p.key && byId[p.key]) {
              var ex = byId[p.key]; seenCompanies[p.key] = true;
              if (ex.muni !== blk.muni) { chg(sh.name, p.item.name + ' · Municipalité', 'companies[' + p.key + '].muni', ex.muni, blk.muni); ex.muni = blk.muni; }
              updateItem(ex, p.item, p.item.name);
            } else {
              if (p.key && !byId[p.key]) warnings.push(p.ref + ' : identifiant « ' + p.key + ' » inconnu, l\'entreprise est traitée comme un ajout.');
              var nc = { id: null, name: p.item.name, muni: blk.muni, sector: p.item.sector || '', jobs: p.item.jobs == null ? 0 : p.item.jobs, status: p.item.status || 'actif', desc: p.item.desc || '', src: 'eco' };
              newCompanies.push(nc); added.push({ sheet: sh.name, type: 'Entreprise', name: nc.name + ' (' + blk.muni + ')' });
            }
          });
          return;
        }
        case 'membres': case 'tourHors': {
          if (blk.custom === 'membres') memberSheets++; else horsSeen = true;
          var isHors = blk.custom === 'tourHors';
          var list = D.tourisme.membres;
          var byNom = {}; list.forEach(function (m) { if (!!m.horsMRC === isHors && (isHors || m.muni === blk.muni)) byNom[m.nom] = m; });
          parsedRows.forEach(function (p) {
            if (p.deleted) { seenMembers[(isHors ? 'H|' : blk.muni + '|') + p.key] = 'deleted'; return; }
            var ex = p.key ? byNom[p.key] : null;
            if (ex) {
              seenMembers[(isHors ? 'H|' : blk.muni + '|') + p.key] = true;
              if (isHors && p.item.muni !== undefined && !same(ex.muni, p.item.muni, 'text')) { chg(sh.name, ex.nom + ' · Municipalité', 'membres.muni', ex.muni, p.item.muni); ex.muni = p.item.muni; }
              updateItem(ex, p.item, ex.nom);
            } else {
              var nm = { nom: p.item.nom, muni: isHors ? (p.item.muni || '') : blk.muni, horsMRC: isHors, categorie: p.item.categorie || '', grande: p.item.grande || '', sous: p.item.sous || '', section: '', responsable: p.item.responsable || '', tel: p.item.tel || '', courriel: p.item.courriel || '',
                camping: p.item.camping || 0, chGite: p.item.chGite || 0, chHotel: p.item.chHotel || 0, chalets: p.item.chalets || 0, employes: p.item.employes || '' };
              newMembers.push(nm); added.push({ sheet: sh.name, type: 'Membre touristique', name: nm.nom + ' (' + nm.muni + ')' });
            }
          });
          return;
        }
        default: {
          var arr = getPath(D, blk.path); if (!arr) { warnings.push(sh.name + ' : liste « ' + blk.path + ' » absente des données.'); return; }
          var existing = tableRows(D, blk); var exByKey = {}; existing.forEach(function (x) { exByKey[x.key] = x.item; });
          var result = [], seen = {};
          parsedRows.forEach(function (p) {
            if (p.deleted) { seen[p.key] = true; if (exByKey[p.key]) removed.push({ sheet: sh.name, type: label, name: String(p.key) }); return; }
            if (p.key && exByKey[p.key]) { var ex = exByKey[p.key]; seen[p.key] = true; updateItem(ex, p.item, String(p.item[cols[0].key])); result.push(ex); }
            else {
              if (!blk.allowAdd || !blk.newItem) { warnings.push(p.ref + ' : ajout non permis dans « ' + label + ' », ligne ignorée.'); return; }
              var ni = blk.newItem(D, parsedRows); cols.forEach(function (c) { if (item_defined(p.item[c.key])) ni[c.key] = p.item[c.key]; });
              result.push(ni); added.push({ sheet: sh.name, type: label, name: String(p.item[cols[0].key]) });
            }
          });
          existing.forEach(function (x) { if (!seen[x.key]) { if (blk.allowAdd) removed.push({ sheet: sh.name, type: label, name: x.key }); else result.push(x.item); } });
          if (!blk.allowAdd) { // conserver l'ordre d'origine
            result = existing.map(function (x) { return x.item; });
          }
          // réécriture dans D
          arr.length = 0; result.forEach(function (it) { arr.push(it); });
        }
      }
    }
    function item_defined(v) { return v !== undefined; }

    // Entreprises : suppressions et ajouts
    if (companySheets > 0) {
      var muniSheetsSeen = {}; spec.forEach(function (sh) { if (sh.kind === 'muni' && parsed.sheets[sh.name]) muniSheetsSeen[sh.muni] = true; });
      var kept = [];
      (D.companies || []).forEach(function (c) {
        if (c.src === 'tourisme') return; // régénérées plus bas
        if (seenCompanies[c.id] === true) { kept.push(c); return; }
        if (!muniSheetsSeen[c.muni]) { kept.push(c); return; } // feuille absente : on conserve
        removed.push({ sheet: safeSheetName(c.muni), type: 'Entreprise', name: c.name + ' (' + c.muni + ')' });
      });
      var maxId = 0; kept.forEach(function (c) { var mm = /^c(\d+)$/.exec(c.id); if (mm) maxId = Math.max(maxId, parseInt(mm[1], 10)); });
      newCompanies.forEach(function (c) { maxId++; c.id = 'c' + pad(maxId, 2); kept.push(c); });
      D.companies = kept;
    }
    // Membres touristiques
    if (memberSheets > 0 || horsSeen) {
      var muniSeen2 = {}; spec.forEach(function (sh) { if (sh.kind === 'muni' && parsed.sheets[sh.name]) muniSeen2[sh.muni] = true; });
      var keptM = [];
      D.tourisme.membres.forEach(function (m) {
        var k = (m.horsMRC ? 'H|' : m.muni + '|') + m.nom;
        if (seenMembers[k] === true) { keptM.push(m); return; }
        if (m.horsMRC ? !horsSeen : !muniSeen2[m.muni]) { keptM.push(m); return; }
        removed.push({ sheet: m.horsMRC ? 'MRC - Tourisme' : safeSheetName(m.muni), type: 'Membre touristique', name: m.nom + ' (' + m.muni + ')' });
      });
      newMembers.forEach(function (m) { keptM.push(m); });
      D.tourisme.membres = keptM;
    }
    // renommage de secteur → entreprises liées
    (D0.sectors || []).forEach(function (s0) { var s1 = (D.sectors || []).filter(function (s) { return s.id === s0.id; })[0]; if (s1 && s1.name !== s0.name) { (D.companies || []).forEach(function (c) { if (c.sector === s0.name) c.sector = s1.name; }); } });

    if (!errors.length) recomputeDerived(D, D0);
    var touched = changes.length || added.length || removed.length;
    if (D.meta && touched && same(D.meta.updatedDate, D0.meta.updatedDate, 'text')) D.meta.updatedDate = new Date().toISOString().slice(0, 10);
    return { data: D, changes: changes, errors: errors, warnings: warnings, added: added, removed: removed, counts: { changes: changes.length, added: added.length, removed: removed.length, errors: errors.length, warnings: warnings.length } };
  }

  /* ═════════════ CHAMPS DÉRIVÉS ═════════════ */
  function recomputeDerived(D, D0) {
    // densité
    (D.municipalities || []).forEach(function (m) { if (m.pop && m.surface) m.density = round(m.pop / m.surface, 1); });
    // démographie MRC = somme des municipalités
    if (D.demographie && D.municipalities) {
      var dm = D.demographie, bands = dm.bands || [];
      var mrc = { pyr: bands.map(function () { return 0; }), agg: { a017: 0, a1864: 0, a65: 0, tot: 0 }, trend: {}, proj: {} };
      (dm.trendYears || []).forEach(function (y) { mrc.trend[String(y)] = 0; });
      (dm.projYears || []).forEach(function (y) { mrc.proj[String(y)] = { tot: 0, a019: 0, a2064: 0, a65: 0 }; });
      D.municipalities.forEach(function (m) {
        var d = m.demo; if (!d) return;
        (d.pyr || []).forEach(function (v, i) { mrc.pyr[i] += (v || 0); });
        ['a017', 'a1864', 'a65', 'tot'].forEach(function (k) { mrc.agg[k] += ((d.agg || {})[k] || 0); });
        Object.keys(mrc.trend).forEach(function (y) { mrc.trend[y] += ((d.trend || {})[y] || 0); });
        Object.keys(mrc.proj).forEach(function (y) { var p = (d.proj || {})[y] || {}; ['tot', 'a019', 'a2064', 'a65'].forEach(function (k) { mrc.proj[y][k] += (p[k] || 0); }); });
      });
      dm.mrc = dm.mrc || {}; dm.mrc.pyr = mrc.pyr; dm.mrc.agg = mrc.agg; dm.mrc.trend = mrc.trend; dm.mrc.proj = mrc.proj;
    }
    // tourisme
    if (D.tourisme && D.tourisme.membres) {
      var T = D.tourisme, M = T.membres, annee = T.annee || '';
      var muniOrder = (D.municipalities || []).map(function (m) { return m.name; });
      var pm = {}; muniOrder.forEach(function (n) { pm[n] = { muni: n, count: 0, heberg: 0, resto: 0, activites: 0, commerces: 0, chambres: 0, camping: 0, chalets: 0 }; });
      var hors = {}, horsOrder = [], grande = {}, categ = {}, section = {}, sectionOrder = [], categOrder = [];
      var ag = { membres: M.length, membresMRC: 0, horsMRC: 0, municipalitesCouvertes: 0, chambresHotel: 0, chambresGite: 0, empCamping: 0, chalets: 0 };
      M.forEach(function (m) {
        if (!m.section || m.section.indexOf(m.grande) !== 0) m.section = (m.sous && m.sous !== m.grande && m.grande !== 'Autres commerces et services') ? m.grande + ' - ' + m.sous : m.grande;
        ag.chambresHotel += (m.chHotel || 0); ag.chambresGite += (m.chGite || 0); ag.empCamping += (m.camping || 0); ag.chalets += (m.chalets || 0);
        grande[m.grande] = (grande[m.grande] || 0) + 1;
        if (!categ[m.categorie]) categOrder.push(m.categorie); categ[m.categorie] = (categ[m.categorie] || 0) + 1;
        if (!section[m.section]) sectionOrder.push(m.section); section[m.section] = (section[m.section] || 0) + 1;
        if (m.horsMRC) { ag.horsMRC++; if (!hors[m.muni]) horsOrder.push(m.muni); hors[m.muni] = (hors[m.muni] || 0) + 1; return; }
        ag.membresMRC++;
        var p = pm[m.muni]; if (!p) { p = pm[m.muni] = { muni: m.muni, count: 0, heberg: 0, resto: 0, activites: 0, commerces: 0, chambres: 0, camping: 0, chalets: 0 }; muniOrder.push(m.muni); }
        p.count++; if (m.grande === 'Où dormir') p.heberg++; else if (m.grande === 'Où manger') p.resto++; else if (m.grande === 'Quoi faire') p.activites++; else p.commerces++;
        p.chambres += (m.chHotel || 0) + (m.chGite || 0); p.camping += (m.camping || 0); p.chalets += (m.chalets || 0);
      });
      var pmList = muniOrder.map(function (n) { return pm[n]; }).filter(Boolean);
      ag.municipalitesCouvertes = pmList.filter(function (p) { return p.count > 0; }).length;
      T.parMuni = pmList.slice().sort(function (a, b) { return b.count - a.count || a.muni.localeCompare(b.muni, 'fr'); });
      T.agregats = ag;
      var oldColors = {}; (T.parGrande || []).forEach(function (g) { oldColors[g.label] = g.color; });
      T.parGrande = TOUR_GRANDE.filter(function (g) { return grande[g]; }).map(function (g) { return { label: g, count: grande[g], color: oldColors[g] || TOUR_GRANDE_COLORS[g] || '#374151' }; });
      T.parCategorie = categOrder.map(function (k) { return { label: k, count: categ[k] }; }).sort(function (a, b) { return b.count - a.count; });
      T.parSection = sectionOrder.map(function (k) { return { label: k, count: section[k] }; }).sort(function (a, b) { return b.count - a.count; });
      T.horsMuni = horsOrder.map(function (k) { return { muni: k, count: hors[k] }; }).sort(function (a, b) { return b.count - a.count; });
      // fiches « tourisme » de la liste d'entreprises
      var eco = (D.companies || []).filter(function (c) { return c.src !== 'tourisme'; });
      var ecoNames = {}; eco.forEach(function (c) { ecoNames[normKey(c.name)] = true; });
      var n = 0, tour = [];
      M.forEach(function (m) {
        if (m.horsMRC || ecoNames[normKey(m.nom)]) return;
        n++;
        var desc = m.categorie + ((m.sous && m.sous !== m.categorie) ? ' — ' + m.sous : '') + '. Membre Tourisme Région de Mégantic ' + annee;
        if (m.chHotel) desc += ' · ' + m.chHotel + ' chambres'; if (m.chGite) desc += ' · ' + m.chGite + ' ch. (gîte)'; if (m.camping) desc += ' · ' + m.camping + ' empl. camping'; if (m.chalets) desc += ' · ' + m.chalets + ' chalets';
        tour.push({ id: 't' + pad(n, 3), name: m.nom, muni: m.muni, sector: TOUR_SECTOR[m.grande] || 'Tourisme · Attraits & activités', jobs: 0, status: 'tourisme', src: 'tourisme', desc: desc + '.' });
      });
      D.companies = eco.concat(tour);
    }
    // logements
    if (D.logements && D.logements.parMuni) {
      var tot = 0, any = false; D.logements.parMuni.forEach(function (x) { var v = x.logements && x.logements.total; if (v != null) { tot += v; any = true; } });
      D.logements.agregats = D.logements.agregats || {}; if (any) D.logements.agregats.logementsTotal = tot;
    }
    // climat
    if (D.climat && D.climat.parMuni) {
      var K = D.climat, pmc = K.parMuni, sums = { res: 0, ci: 0, ind: 0, agri: 0, transp: 0, mr: 0 }, popT = 0, pop36T = 0, chep = 0, ha = 0;
      pmc.forEach(function (x) {
        ['res', 'ci', 'ind', 'agri', 'transp', 'mr'].forEach(function (k) { x[k] = x[k] == null ? 0 : x[k]; sums[k] += x[k]; });
        x.total = round(x.res + x.ci + x.ind + x.agri + x.transp + x.mr, 1); x.atcl = round(x.res + x.ci + x.transp + x.mr, 1);
        x.perCap = x.pop ? round(x.total / x.pop, 2) : null; x.varPop = (x.pop && x.pop36 != null) ? round(100 * (x.pop36 - x.pop) / x.pop, 1) : null;
        var best = null; CLIMAT_SECTEURS.forEach(function (s) { if (best === null || x[s.key] > x[best.key]) best = s; }); x.dom = best ? best.label : ''; x.domPct = (best && x.total) ? round(100 * x[best.key] / x.total, 1) : 0;
        x.dechetsT = x.mr; popT += (x.pop || 0); pop36T += (x.pop36 || 0); chep += (x.cheptel || 0); ha += (x.haCult || 0);
      });
      var totalG = round(sums.res + sums.ci + sums.ind + sums.agri + sums.transp + sums.mr, 1), totalA = round(sums.res + sums.ci + sums.transp + sums.mr, 1);
      pmc.forEach(function (x) { x.partMrc = totalG ? round(100 * x.total / totalG, 2) : 0; });
      var A = K.agregats = K.agregats || {};
      A.totalGlobal = totalG; A.totalAtcl = totalA; A.pop2024 = popT; A.pop2036 = pop36T; A.varPop2036 = popT ? round(100 * (pop36T - popT) / popT, 1) : null;
      A.perCapGlobal = popT ? round(totalG / popT, 2) : null; A.perCapAtcl = popT ? round(totalA / popT, 2) : null; A.cheptelTotal = chep; A.haCultivees = round(ha, 1);
      var oldSec = {}; (K.secteurs || []).forEach(function (s) { oldSec[s.label] = s; });
      K.secteurs = CLIMAT_SECTEURS.map(function (s) { var t = round(sums[s.key], 1); return { label: s.label, t: t, pct: totalG ? round(100 * t / totalG, 1) : 0, color: (oldSec[s.label] || {}).color || s.color }; });
      if (K.transport) { K.transport.total = round(sums.transp, 1); K.transport.partMrc = totalG ? round(100 * sums.transp / totalG, 1) : 0; K.transport.perCap = popT ? round(sums.transp / popT, 2) : null; }
      if (K.agriculture) { K.agriculture.total = round(sums.agri, 1); K.agriculture.partMrc = totalG ? round(100 * sums.agri / totalG, 1) : 0; K.agriculture.haTotal = round(ha, 1); K.agriculture.cheptel = chep; }
      if (K.matieres) { K.matieres.total = round(sums.mr, 1); K.matieres.partMrc = totalG ? round(100 * sums.mr / totalG, 1) : 0; }
    }
  }

  /* résumé lisible d'un changement */
  function fmtVal(v) { if (v === null || v === undefined || v === '') return '—'; if (typeof v === 'boolean') return v ? 'Oui' : 'Non'; if (typeof v === 'number') return String(v).replace('.', ','); var s = String(v); return s.length > 70 ? s.slice(0, 67) + '…' : s; }

  return { VERSION: VERSION, buildSpec: buildSpec, buildWorkbook: buildWorkbook, readWorkbook: readWorkbook, applyImport: applyImport, recomputeDerived: recomputeDerived, getPath: getPath, setPath: setPath, fmtVal: fmtVal, safeSheetName: safeSheetName };
});
