/* granit-req.js - Vue « Registre des entreprises » (v4.9)
   Lit data/req/*.json produits par tools/req_granit.py (extraction automatisée du
   Registre des entreprises du Québec, données ouvertes, licence CC BY-NC-SA 4.0).
   S'insère de lui-même dans le pilier Économie : aucun autre changement requis dans index.html
   que la balise <script src="./granit-req.js"></script>. */
(function () {
  'use strict';
  var BASE = './data/req/';
  var PAGE = 40;
  var S = { loaded: false, loading: false, rows: [], hist: null, mouv: null, extraction: '', source: '',
            portee: 'tout', q: '', muni: '', sect: '', emp: '', forme: '', sort: 'nom', dir: 1, page: 0, parHab: false };
  var charts = {};

  /* Grands secteurs : regroupement des divisions de la Classification des activités économiques (CAE) */
  var SECTEURS = [
    ['agri', 'Agriculture et services agricoles', 1, 2, '#2d8a52'],
    ['peche', 'Pêche et piégeage', 3, 3, '#0e7490'],
    ['foret', 'Exploitation et services forestiers', 4, 5, '#14532d'],
    ['mines', 'Mines et carrières', 6, 9, '#64748b'],
    ['manuf', 'Fabrication', 10, 39, '#b45309'],
    ['constr', 'Construction', 40, 44, '#d97706'],
    ['transp', 'Transport et entreposage', 45, 47, '#155e63'],
    ['comm', 'Communications et services publics', 48, 49, '#0891b2'],
    ['gros', 'Commerce de gros', 50, 59, '#7c3aed'],
    ['detail', 'Commerce de détail', 60, 69, '#be185d'],
    ['fin', 'Finance, assurances et sociétés de gestion', 70, 74, '#334155'],
    ['immo', 'Services immobiliers et agences d\'assurances', 75, 76, '#475569'],
    ['servent', 'Services aux entreprises', 77, 77, '#1d6b4f'],
    ['gouv', 'Services gouvernementaux', 81, 84, '#374151'],
    ['ens', 'Enseignement', 85, 85, '#854d0e'],
    ['sante', 'Santé et services sociaux', 86, 86, '#22b8cf'],
    ['hebrest', 'Hébergement et restauration', 91, 92, '#f59e0b'],
    ['autres', 'Autres services', 96, 99, '#52a878']
  ];
  var SECT_NC = ['nc', 'Non classé', 0, 0, '#94a3b8'];
  var SECT_BY = {}; SECTEURS.concat([SECT_NC]).forEach(function (s) { SECT_BY[s[0]] = s; });
  var EMP = { O: 'Aucun', A: '1 à 5', B: '6 à 10', C: '11 à 25', D: '26 à 49', E: '50 à 99', F: '100 à 249',
              G: '250 à 499', H: '500 à 749', I: '750 à 999', J: '1 000 à 2 499', K: '2 500 à 4 999', L: '5 000 et plus', N: 'Non déclaré' };
  var EMP_ORDRE = 'OABCDEFGHIJKLN';
  var FORME = { CIE: 'Société par actions', SENC: 'Société en nom collectif', IND: 'Entreprise individuelle',
                APE: 'Association personnifiée (OBNL)', COP: 'Coopérative', ASS: 'Association', SYC: 'Syndicat de copropriété',
                SEP: 'Société en participation', SEC: 'Société en commandite', AUG: 'Autre groupement', MUT: 'Mutuelle' };
  var RE_GESTION = /(soci[ée]t[ée]|compagnie|cie)\s+de\s+(gestion|portefeuille|placements?)|^\s*gestion\s*$|gestion\s+(de\s+)?(portefeuille|placements?|priv[ée]e)|holding|^\s*placements?\s*$/i;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('fr-CA'); }
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/\b(inc|ltee|ltd|limitee|enr|senc|s e n c|cie|corp|corporation|canada|quebec|the|la|le|les|l|de|du|des|d)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function secteurDe(cae) {
    if (!cae || !/^\d{4}$/.test(cae)) return SECT_NC;
    var d = parseInt(cae.slice(0, 2), 10);
    for (var i = 0; i < SECTEURS.length; i++) if (d >= SECTEURS[i][2] && d <= SECTEURS[i][3]) return SECTEURS[i];
    return SECT_NC;
  }
  function dateFr(iso) {
    if (!iso) return '';
    var m = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    var p = iso.split('-'); return parseInt(p[2], 10) + (p[2] === '01' ? 'er' : '') + ' ' + m[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }
  function pop() {
    var o = {}; try { (window.D.municipalities || []).forEach(function (m) { o[m.name] = m.pop; }); } catch (e) {}
    return o;
  }
  function getJSON(f, optional) {
    return fetch(BASE + f + '?t=' + Date.now()).then(function (r) {
      if (!r.ok) { if (optional) return null; throw new Error(f + ' introuvable (' + r.status + ')'); }
      return r.json();
    }).catch(function (e) { if (optional) return null; throw e; });
  }

  /* ── Insertion dans la page ── */
  function monter() {
    if (document.getElementById('view-eco-registre')) return;
    var css = document.createElement('style');
    css.textContent =
      '.rq-note{background:var(--am50);border:1px solid var(--am100);border-radius:var(--r2);padding:12px 15px;font-size:14px;line-height:1.55;color:var(--am800);margin-bottom:16px}' +
      '.rq-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}' +
      '.rq-pill{font-size:12px;font-weight:700;padding:2px 7px;border-radius:10px;white-space:nowrap}' +
      '.rq-p-eta{background:var(--sa50);color:var(--sa800);border:1px solid var(--sa100)}' +
      '.rq-p-loc{background:var(--g100);color:var(--g700)}' +
      '.rq-p-ges{background:var(--border2);color:var(--muted)}' +
      '.rq-p-new{background:var(--am100);color:var(--am700)}' +
      '.rq-th{cursor:pointer;user-select:none}.rq-th:hover{color:var(--g700)}' +
      '.rq-pager{display:flex;align-items:center;gap:10px;justify-content:flex-end;margin-top:11px;font-size:14px;color:var(--muted)}' +
      '.rq-btn{padding:7px 13px;border-radius:8px;border:1px solid var(--border);background:var(--white);font-size:14px;font-weight:600;color:var(--text2);cursor:pointer;font-family:inherit;box-shadow:var(--sh-sm)}' +
      '.rq-btn:hover{border-color:var(--g400);color:var(--g700)}.rq-btn:disabled{opacity:.4;cursor:default}' +
      '.rq-mv{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}' +
      '.rq-mv h4{font-size:14px;margin:0 0 7px;color:var(--text)}.rq-mv ul{margin:0;padding-left:16px;font-size:14px;line-height:1.6;color:var(--text2);max-height:190px;overflow:auto}' +
      '.rq-sw{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);cursor:pointer;margin-left:auto;text-transform:none;letter-spacing:0;font-weight:600}' +
      '@media(max-width:900px){.rq-grid2,.rq-mv{grid-template-columns:1fr}}';
    document.head.appendChild(css);

    var view = document.createElement('div');
    view.className = 'view'; view.id = 'view-eco-registre';
    view.innerHTML =
      '<div class="section-header"><div class="sh-left"><h2>Registre des entreprises</h2>' +
      '<p>Toutes les entreprises immatriculées sur le territoire, mises à jour automatiquement deux fois par mois</p></div>' +
      '<span class="pillar-badge pb-eco">Économie</span></div><div id="rqBody"><div class="card" style="color:var(--muted);font-size:14.5px">Chargement du registre...</div></div>';
    var apres = document.getElementById('view-eco-companies');
    apres.parentNode.insertBefore(view, apres.nextSibling);

    var nav = document.getElementById('sbnEco');
    var ref = null;
    nav.querySelectorAll('.ni').forEach(function (b) { if ((b.getAttribute('onclick') || '').indexOf("'eco-companies'") > -1) ref = b; });
    var btn = document.createElement('button');
    btn.className = 'ni'; btn.id = 'rqNav';
    btn.setAttribute('onclick', "V('eco-registre',this)");
    btn.innerHTML = '<div class="ni-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7M9 11h7"/></svg></div>Registre des entreprises';
    if (ref) nav.insertBefore(btn, ref.nextSibling); else nav.appendChild(btn);

    var V0 = window.V;
    window.V = function (id, b) { V0(id, b); if (id === 'eco-registre') ouvrir(); };
  }

  function ouvrir() {
    if (S.loaded) { rendre(); return; }
    if (S.loading) return;
    S.loading = true;
    Promise.all([getJSON('granit_latest.json'), getJSON('historique.json', true), getJSON('mouvements.json', true)])
      .then(function (r) {
        var g = r[0]; S.hist = r[1]; S.mouv = r[2];
        S.extraction = g.extraction || ''; S.source = g._source || '';
        var local = [];
        try { (window.D.companies || []).forEach(function (c) { if (c.src === 'eco') { var k = norm(c.name); if (k.length >= 4) local.push(k); } }); } catch (e) {}
        var il = new Date(S.extraction || Date.now()); il.setFullYear(il.getFullYear() - 1);
        var seuil = il.toISOString().slice(0, 10);
        S.rows = (g.entreprises || []).map(function (e) {
          var sx = secteurDe(e.cae);
          var noms = [e.nom || ''].concat(e.autres_noms || []);
          var keys = noms.map(norm).filter(Boolean);
          var act = (e.cae_desc && e.cae_desc !== '-') ? e.cae_desc : '';
          return {
            neq: e.neq, nom: e.nom || '', autres: e.autres_noms || [], muni: e.muni, eta: e.rattachement === 'etablissement',
            sect: sx[0], cae: e.cae || '', caeLib: e.cae_lib || '', act: act,
            emp: e.emp || 'N', forme: e.forme || '', formeLib: e.forme_lib || FORME[e.forme] || e.forme || '',
            immat: e.immat || '', recent: (e.immat || '') >= seuil,
            gestion: /^72/.test(e.cae || '') || RE_GESTION.test(act),
            local: keys.some(function (k) { return local.some(function (l) { return k === l || (l.length >= 7 && k.indexOf(l) > -1) || (k.length >= 7 && l.indexOf(k) > -1); }); }),
            cherche: norm(noms.join(' ') + ' ' + act + ' ' + (e.cae_lib || '') + ' ' + e.muni) + ' ' + e.neq
          };
        });
        S.nLocal = local.length;
        S.loaded = true; S.loading = false; rendre();
      })
      .catch(function (err) {
        S.loading = false;
        document.getElementById('rqBody').innerHTML = '<div class="card"><div class="ct">Registre non disponible</div><div style="font-size:14.5px;color:var(--text2);line-height:1.6">' +
          'Les fichiers de <code>data/req/</code> n\'ont pas pu être lus (' + esc(err.message) + '). Ils sont produits par le flux de travail « Registre des entreprises - Granit » dans l\'onglet Actions du dépôt.</div></div>';
      });
  }

  /* ── Filtres ── */
  function dansPortee(r) {
    if (S.portee === 'operant') return !r.gestion;
    if (S.portee === 'employeurs') return r.emp !== 'O' && r.emp !== 'N' && !r.gestion;
    if (S.portee === 'ailleurs') return r.eta;
    if (S.portee === 'recent') return r.recent;
    return true;
  }
  function base() { return S.rows.filter(dansPortee); }
  function filtrees() {
    var q = norm(S.q), qn = S.q.replace(/\D/g, '');
    return base().filter(function (r) {
      return (!S.muni || r.muni === S.muni) && (!S.sect || r.sect === S.sect) && (!S.emp || r.emp === S.emp) && (!S.forme || r.forme === S.forme) &&
        (!q || r.cherche.indexOf(q) > -1 || (qn.length >= 6 && r.neq.indexOf(qn) > -1));
    });
  }
  function compter(list, f) { var o = {}; list.forEach(function (r) { var k = f(r); o[k] = (o[k] || 0) + 1; }); return o; }

  /* ── Rendu ── */
  function rendre() {
    var all = S.rows, b = base();
    var nOper = all.filter(function (r) { return !r.gestion; }).length;
    var nEmp = all.filter(function (r) { return r.emp !== 'O' && r.emp !== 'N' && !r.gestion; }).length;
    var nEta = all.filter(function (r) { return r.eta; }).length;
    var nRec = all.filter(function (r) { return r.recent; }).length;
    var nLocTrouve = all.filter(function (r) { return r.local; }).length;
    var portees = [['tout', 'Tout le registre', all.length], ['operant', 'Sans les sociétés de gestion', nOper], ['employeurs', 'Avec employés déclarés', nEmp],
                   ['ailleurs', 'Siège hors territoire', nEta], ['recent', 'Immatriculées depuis 12 mois', nRec]];
    var munis = Object.keys(compter(all, function (r) { return r.muni; })).sort(function (a, c) { return a.localeCompare(c, 'fr'); });
    var formes = Object.keys(compter(all, function (r) { return r.forme; })).sort();
    var h = '';
    h += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">' +
      '<span class="prov prov-reg">Registraire des entreprises du Québec - extrait le ' + esc(dateFr(S.extraction)) + '</span>' +
      '<span style="font-size:13px;color:var(--muted)">Mise à jour automatique le 3 et le 18 de chaque mois. Aucune saisie municipale requise.</span></div>';
    h += '<div class="rq-note"><strong>Comment lire ces chiffres.</strong> Une entreprise « active » est une entreprise immatriculée au Registraire, ce qui inclut les sociétés de gestion, les fermes, les organismes sans but lucratif et les entreprises sans employé. ' +
      'Les renseignements sont déclarés par les entreprises elles-mêmes. La tranche d\'employés vaut pour l\'ensemble du Québec et non pour le seul établissement local. ' +
      'Les adresses des personnes physiques sont exclues du jeu de données, de sorte que plusieurs travailleurs autonomes n\'y figurent pas.</div>';
    h += '<div class="kpi-grid">' +
      kpi('Entreprises actives', fmt(all.length), 'immatriculées dans les ' + munis.length + ' municipalités', 'Registraire') +
      kpi('Tissu opérant', fmt(nOper), 'sans les ' + fmt(all.length - nOper) + ' sociétés de gestion et de portefeuille', 'Repérage') +
      kpi('Avec employés déclarés', fmt(nEmp), 'au moins un employé au Québec, hors sociétés de gestion', 'Registraire') +
      kpi('Immatriculées depuis 12 mois', fmt(nRec), 'encore actives à la date d\'extraction', 'Registraire') + '</div>';
    h += '<div class="ftabs" style="margin-bottom:14px">' + portees.map(function (p) {
      return '<button class="ft' + (S.portee === p[0] ? ' active' : '') + '" onclick="GranitREQ.portee(\'' + p[0] + '\')">' + p[1] + ' (' + fmt(p[2]) + ')</button>';
    }).join('') + '</div>';
    h += '<div class="rq-grid2">' +
      '<div class="card"><div class="ct">Entreprises par municipalité<label class="rq-sw"><input type="checkbox" ' + (S.parHab ? 'checked' : '') + ' onchange="GranitREQ.parHab(this.checked)"> par 1 000 habitants</label></div><div style="position:relative;height:430px"><canvas id="rqMuni"></canvas></div></div>' +
      '<div class="card"><div class="ct">Entreprises par grand secteur d\'activité</div><div style="position:relative;height:430px"><canvas id="rqSect"></canvas></div></div></div>';
    h += '<div class="rq-grid2">' +
      '<div class="card"><div class="ct">Année d\'immatriculation des entreprises encore actives</div><div style="position:relative;height:220px"><canvas id="rqAn"></canvas></div>' +
      '<div style="font-size:13px;color:var(--muted);margin-top:8px;line-height:1.5">Ce graphique ne montre que les entreprises toujours actives. Il sous-estime donc les créations des années anciennes et ne mesure pas un taux de création.</div></div>' +
      '<div class="card"><div class="ct">Évolution d\'une extraction à l\'autre</div>' + blocEvolution() + '</div></div>';
    if (S.nLocal) {
      h += '<div class="card mb18" style="margin-bottom:14px"><div class="ct">Lien avec le répertoire économique local</div><div style="font-size:14.5px;color:var(--text2);line-height:1.6">' +
        '<strong>' + fmt(nLocTrouve) + '</strong> inscriptions du Registraire correspondent, par leur nom, à l\'une des ' + fmt(S.nLocal) + ' entreprises du répertoire local (onglet Entreprises). ' +
        'Elles portent la mention <span class="rq-pill rq-p-loc">Répertoire local</span> dans le tableau. L\'appariement se fait sur le nom et reste indicatif.</div></div>';
    }
    h += '<div class="co-total-bar" id="rqTotal"></div>' +
      '<div class="co-toolbar">' +
      '<input class="co-search" id="rqQ" placeholder="Rechercher par nom, activité, municipalité ou NEQ..." value="' + esc(S.q) + '" oninput="GranitREQ.set(\'q\',this.value)">' +
      sel('muni', 'Toutes les municipalités', munis.map(function (m) { return [m, m]; })) +
      sel('sect', 'Tous les secteurs', SECTEURS.concat([SECT_NC]).map(function (s) { return [s[0], s[1]]; })) +
      sel('emp', 'Toutes les tailles', EMP_ORDRE.split('').map(function (c) { return [c, 'Employés - ' + EMP[c]]; })) +
      sel('forme', 'Toutes les formes juridiques', formes.map(function (f) { return [f, FORME[f] || f]; })) +
      '<button class="rq-btn" onclick="GranitREQ.csv()">Exporter (CSV)</button></div>' +
      '<div style="overflow-x:auto"><table class="co-table"><thead><tr>' +
      '<th class="rq-th" onclick="GranitREQ.tri(\'nom\')">Entreprise</th><th class="rq-th" onclick="GranitREQ.tri(\'muni\')">Municipalité</th><th>Activité</th>' +
      '<th class="rq-th" onclick="GranitREQ.tri(\'emp\')">Employés (Québec)</th><th class="rq-th" onclick="GranitREQ.tri(\'immat\')">Immatriculée</th></tr></thead><tbody id="rqRows"></tbody></table></div>' +
      '<div class="rq-pager" id="rqPager"></div>' +
      '<div style="font-size:13px;color:var(--muted);margin-top:16px;line-height:1.55">Source. ' + esc(S.source) + '</div>';
    document.getElementById('rqBody').innerHTML = h;
    setTimeout(graphiques, 60);
    tableau();
  }
  function kpi(l, v, u, tag) {
    return '<div class="kpi"><div class="kpi-l">' + l + '<span class="prov ' + (tag === 'Registraire' ? 'prov-reg' : 'prov-est') + '">' + tag + '</span></div><div class="kpi-v">' + v + '</div><div class="kpi-u">' + u + '</div></div>';
  }
  function sel(k, tous, opts) {
    return '<select class="co-select" onchange="GranitREQ.set(\'' + k + '\',this.value)"><option value="">' + tous + '</option>' +
      opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (S[k] === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  }
  function blocEvolution() {
    var s = (S.hist && S.hist.serie) || [];
    var m = S.mouv;
    if (s.length < 2 || !m) {
      return '<div style="font-size:14.5px;color:var(--text2);line-height:1.6">Première extraction le ' + esc(dateFr(S.extraction)) + '. ' +
        'À partir de la prochaine, cette section affichera les nouvelles immatriculations, les radiations et la courbe du nombre d\'entreprises actives, municipalité par municipalité.</div>' +
        '<div style="font-size:13px;color:var(--muted);margin-top:10px;line-height:1.5">Le Registraire ne conserve pas ses versions antérieures. Chaque extraction est donc archivée dans le dépôt, ce qui constitue au fil du temps une série propre au territoire.</div>';
    }
    function li(a) { return a.length ? a.slice(0, 60).map(function (x) { return '<li>' + esc(x.nom || 'Nom non diffusé') + ' <span style="color:var(--muted)">(' + esc(x.muni) + ')</span></li>'; }).join('') : '<li style="list-style:none;margin-left:-16px;color:var(--muted)">Aucune</li>'; }
    return '<div style="position:relative;height:120px;margin-bottom:12px"><canvas id="rqHist"></canvas></div>' +
      '<div style="font-size:13px;color:var(--muted);margin-bottom:9px">Du ' + esc(dateFr(m.depuis)) + ' au ' + esc(dateFr(m.jusqu_a)) + '</div>' +
      '<div class="rq-mv"><div><h4>Nouvelles (' + m.nouvelles.length + ')</h4><ul>' + li(m.nouvelles) + '</ul></div>' +
      '<div><h4>Radiées (' + m.radiees.length + ')</h4><ul>' + li(m.radiees) + '</ul></div>' +
      '<div><h4>Réactivées (' + m.reactivees.length + ')</h4><ul>' + li(m.reactivees) + '</ul></div></div>';
  }
  function plier(s) {
    if (s.length <= 42) return s;
    var m = s.lastIndexOf(' ', 26); if (m < 12) return s;
    return [s.slice(0, m), s.slice(m + 1)];
  }
  function tuer(k) { if (charts[k]) { charts[k].destroy(); charts[k] = null; } }
  function graphiques() {
    if (!window.Chart) return;
    var b = base(), P = pop();
    var cm = compter(b, function (r) { return r.muni; });
    var lm = Object.keys(cm).map(function (m) { return [m, S.parHab && P[m] ? Math.round(cm[m] / P[m] * 10000) / 10 : cm[m]]; }).sort(function (a, c) { return c[1] - a[1]; });
    var opt = function (unite) {
      return { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return ' ' + c.raw.toLocaleString('fr-CA') + unite; } } } },
        scales: { x: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { size: 12 } } }, y: { grid: { display: false }, ticks: { font: { size: 12 }, autoSkip: false } } } };
    };
    var el = document.getElementById('rqMuni'); if (!el) return;
    tuer('muni');
    charts.muni = new Chart(el.getContext('2d'), { type: 'bar',
      data: { labels: lm.map(function (x) { return x[0]; }), datasets: [{ data: lm.map(function (x) { return x[1]; }), backgroundColor: '#1a6e3c', borderRadius: 4 }] },
      options: opt(S.parHab ? ' entreprises par 1 000 habitants' : ' entreprises') });
    var cs = compter(b, function (r) { return r.sect; });
    var ls = Object.keys(cs).map(function (k) { return [SECT_BY[k], cs[k]]; }).sort(function (a, c) { return c[1] - a[1]; });
    tuer('sect');
    charts.sect = new Chart(document.getElementById('rqSect').getContext('2d'), { type: 'bar',
      data: { labels: ls.map(function (x) { return plier(x[0][1]); }), datasets: [{ data: ls.map(function (x) { return x[1]; }), backgroundColor: ls.map(function (x) { return x[0][4]; }), borderRadius: 4 }] },
      options: opt(' entreprises') });
    var ca = compter(b.filter(function (r) { return r.immat >= '2000'; }), function (r) { return r.immat.slice(0, 4); });
    var la = Object.keys(ca).sort();
    tuer('an');
    charts.an = new Chart(document.getElementById('rqAn').getContext('2d'), { type: 'bar',
      data: { labels: la, datasets: [{ data: la.map(function (a) { return ca[a]; }), backgroundColor: '#86c9a3', borderRadius: 3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { size: 12 } } } } } });
    var eh = document.getElementById('rqHist');
    if (eh && S.hist) {
      var s = S.hist.serie; tuer('hist');
      charts.hist = new Chart(eh.getContext('2d'), { type: 'line',
        data: { labels: s.map(function (x) { return x.date; }), datasets: [{ data: s.map(function (x) { return S.muni ? (x.par_municipalite[S.muni] || 0) : x.total_actives; }), borderColor: '#1a6e3c', backgroundColor: 'rgba(26,110,60,.08)', fill: true, tension: .25, pointRadius: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { ticks: { font: { size: 12 } } } } } });
    }
  }
  function triees() {
    var l = filtrees(), k = S.sort, d = S.dir;
    l.sort(function (a, c) {
      var x, y;
      if (k === 'emp') { x = EMP_ORDRE.indexOf(a.emp); y = EMP_ORDRE.indexOf(c.emp); return (x - y) * d || a.nom.localeCompare(c.nom, 'fr'); }
      x = a[k] || '\uffff'; y = c[k] || '\uffff';
      return x.localeCompare(y, 'fr') * d || a.nom.localeCompare(c.nom, 'fr');
    });
    return l;
  }
  function tableau() {
    var l = triees(), n = l.length, pages = Math.max(1, Math.ceil(n / PAGE));
    if (S.page >= pages) S.page = pages - 1;
    var seg = l.slice(S.page * PAGE, S.page * PAGE + PAGE);
    document.getElementById('rqTotal').innerHTML = '<span><strong>' + fmt(n) + '</strong> entreprise' + (n > 1 ? 's' : '') + ' affichée' + (n > 1 ? 's' : '') + '</span>' +
      '<span style="margin-left:auto;font-size:13px;color:var(--g600)">Cliquer sur un titre de colonne pour trier</span>';
    document.getElementById('rqRows').innerHTML = seg.map(function (r) {
      var sx = SECT_BY[r.sect];
      var detail = r.caeLib || r.act;
      return '<tr><td><div style="font-weight:600">' + (r.nom ? esc(r.nom) : '<span style="color:var(--muted);font-weight:500">Nom non diffusé (entreprise individuelle)</span>') +
        (r.local ? ' <span class="rq-pill rq-p-loc">Répertoire local</span>' : '') + (r.recent ? ' <span class="rq-pill rq-p-new">Nouvelle</span>' : '') + '</div>' +
        '<div style="font-size:13px;color:var(--muted);margin-top:2px;line-height:1.35">' + (r.autres.length ? 'Aussi connue comme ' + esc(r.autres.slice(0, 3).join(', ')) + '. ' : '') + esc(r.formeLib) + ' - NEQ ' + esc(r.neq) + '</div></td>' +
        '<td><div style="font-size:14px">' + esc(r.muni) + '</div>' + (r.eta ? '<span class="rq-pill rq-p-eta">Siège hors territoire</span>' : '') + '</td>' +
        '<td><div style="font-size:14px"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + sx[4] + ';margin-right:6px"></span>' + esc(sx[1]) + '</div>' +
        '<div style="font-size:13px;color:var(--muted);margin-top:2px">' + esc(detail) + (r.caeLib && r.act && norm(r.act) !== norm(r.caeLib) ? ' (déclaré : ' + esc(r.act.toLowerCase()) + ')' : '') + (r.gestion ? ' <span class="rq-pill rq-p-ges">Société de gestion</span>' : '') + '</div></td>' +
        '<td style="font-size:14px;white-space:nowrap">' + esc(EMP[r.emp] || r.emp) + '</td>' +
        '<td style="font-size:14px;white-space:nowrap">' + esc(r.immat.slice(0, 4)) + '</td></tr>';
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">Aucun résultat</td></tr>';
    document.getElementById('rqPager').innerHTML = '<button class="rq-btn" ' + (S.page === 0 ? 'disabled' : '') + ' onclick="GranitREQ.page(-1)">Précédent</button>' +
      '<span>Page ' + (S.page + 1) + ' de ' + pages + '</span><button class="rq-btn" ' + (S.page >= pages - 1 ? 'disabled' : '') + ' onclick="GranitREQ.page(1)">Suivant</button>';
  }
  function csv() {
    var l = triees(), q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var out = [['NEQ', 'Nom', 'Autres noms', 'Municipalité', 'Rattachement', 'Grand secteur', 'Code CAE', 'Activité (CAE)', 'Activité déclarée', 'Employés au Québec', 'Forme juridique', 'Date d\'immatriculation', 'Société de gestion (repérage)', 'Source'].map(q).join(',')];
    l.forEach(function (r) {
      out.push([r.neq, r.nom, r.autres.join(' | '), r.muni, r.eta ? 'Établissement (siège hors territoire)' : 'Domicile', SECT_BY[r.sect][1], r.cae, r.caeLib, r.act, EMP[r.emp] || r.emp, r.formeLib, r.immat, r.gestion ? 'oui' : 'non',
        'Registraire des entreprises du Québec, données ouvertes, extraction du ' + S.extraction + ', CC BY-NC-SA 4.0'].map(q).join(','));
    });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + out.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'registre_entreprises_granit_' + S.extraction + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  window.GranitREQ = {
    portee: function (p) { S.portee = p; S.page = 0; rendre(); },
    parHab: function (v) { S.parHab = !!v; graphiques(); },
    set: function (k, v) { S[k] = v; S.page = 0; tableau(); if (k === 'muni') graphiques(); },
    tri: function (k) { if (S.sort === k) S.dir = -S.dir; else { S.sort = k; S.dir = (k === 'immat' || k === 'emp') ? -1 : 1; } S.page = 0; tableau(); },
    page: function (d) { S.page += d; tableau(); var t = document.getElementById('rqTotal'); if (t && t.scrollIntoView) t.scrollIntoView({ block: 'start' }); },
    csv: csv, _etat: S
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monter); else monter();
})();
