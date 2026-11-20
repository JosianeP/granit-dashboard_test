/* granit-croise.js - Croisements entre les vues (v4.10)
   Rend les données extraites automatiquement visibles partout où il y a une fiche ou un bloc cliquable :
     - Registre des entreprises (granit-req.js, data/req/) dans les secteurs, les municipalités, la vue d'ensemble,
       le répertoire local, le tourisme, l'emploi et les logements;
     - services de garde du ministère de la Famille (data/garde/) et Recensement 2021 (data/logement/)
       dans la vue Logements et garderies.
   Aucune donnée n'est copiée dans data.json : tout est lu à l'affichage, de sorte que chaque extraction
   automatique se répercute dans toutes les vues sans saisie. Si un fichier manque, les vues gardent
   leur comportement d'origine. */
(function () {
  'use strict';
  var PAS = 40;
  var X = { garde: null, rec: null, sp: { sid: '', q: '', muni: '', n: PAS } };

  function R() { return window.GranitREQ; }
  /* Le registre n'est « prêt » que si granit-req.js est à la bonne version : un navigateur peut garder en cache
     une copie plus ancienne, sans les fonctions de partage. Dans ce cas, les vues gardent leur comportement d'origine. */
  function compatible() { var r = R(); return !!(r && typeof r.pret === 'function' && typeof r.charger === 'function' && typeof r.lignes === 'function' && typeof r.voir === 'function'); }
  function pret() { return compatible() && !!R().pret(); }
  /* Aucune erreur de ce module ne doit empêcher une carte de s'ouvrir : en cas d'échec, on rend la valeur de repli. */
  function sur(f, repli) {
    return function () { try { return f.apply(null, arguments); } catch (e) { if (window.console) console.warn('granit-croise', e); return repli; } };
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('fr-CA'); }
  function pl(n, s, p) { return fmt(n) + ' ' + (n > 1 ? (p || s + 's') : s); }
  function plie(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function js(o) { return esc(JSON.stringify(o)); }
  function reg() { return R().registre(); }
  function emplois(n) { return fmt(n) + (n > 1 ? ' emplois estimés' : ' emploi estimé'); }
  function exploitation(r) { return !r.gestion; }
  function employeur(r) { return r.emp !== 'O' && r.emp !== 'N' && !r.gestion; }
  function nomDe(r) { return r.usage || r.nom || ''; }
  function tri(a, b) {
    return (b.jobs - a.jobs) || ((b.local ? 1 : 0) - (a.local ? 1 : 0)) || ((b.tour ? 1 : 0) - (a.tour ? 1 : 0)) ||
      ((nomDe(a) ? 0 : 1) - (nomDe(b) ? 0 : 1)) || nomDe(a).localeCompare(nomDe(b), 'fr');
  }
  function lienReg(filtre, texte) {
    return '<button class="gx-lien" onclick="GranitREQ.voir(' + js(filtre) + ')">' + texte + ' →</button>';
  }
  function lgd(ancre, texte) { return '<button class="gx-lien" style="font-size:13px" onclick="voirLegende(\'' + ancre + '\')">' + texte + ' →</button>'; }
  function dateSrc() { return 'Registraire des entreprises du Québec, extraction du ' + esc(R().libelles.dateFr(R().extraction())); }

  /* ── Styles ── */
  function styles() {
    if (document.getElementById('gxCss')) return;
    var c = document.createElement('style'); c.id = 'gxCss';
    c.textContent =
      '.gx-lien{background:none;border:none;padding:0;font:inherit;font-size:13.5px;font-weight:700;color:var(--g700);cursor:pointer;text-align:left}' +
      '.gx-lien:hover{text-decoration:underline}' +
      '.gx-outils{display:flex;gap:8px;margin-bottom:12px}' +
      '.gx-outils input,.gx-outils select{font:inherit;font-size:14px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--white);color:var(--text);min-width:0}' +
      '.gx-outils input{flex:1}.gx-outils select{max-width:44%}' +
      '.gx-note{font-size:13px;color:var(--muted);line-height:1.5;margin:10px 0 0}' +
      '.gx-sm{font-size:13px;color:var(--muted);line-height:1.4;margin-top:3px}' +
      '.gx-plus{display:block;width:100%;margin:6px 0 4px;padding:10px;border:1px solid var(--border);border-radius:9px;background:var(--white);font:inherit;font-size:14px;font-weight:700;color:var(--g700);cursor:pointer}' +
      '.gx-plus:hover{border-color:var(--g400)}' +
      '.gx-sep{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin:16px 0 8px}' +
      '.gx-barres{display:grid;gap:5px;margin-top:6px}' +
      '.gx-b{display:grid;grid-template-columns:minmax(120px,210px) 1fr 44px;gap:9px;align-items:center;font-size:13.5px;background:none;border:none;padding:2px 0;font-family:inherit;color:var(--text);cursor:pointer;text-align:left;width:100%}' +
      '.gx-b:hover .gx-bn{color:var(--g700);text-decoration:underline}' +
      '.gx-bt{height:10px;background:var(--border);border-radius:5px;overflow:hidden}.gx-bt i{display:block;height:10px;background:var(--g600,#0b5673);border-radius:5px}' +
      '.gx-bv{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}' +
      '.gx-liste{margin:6px 0 0;padding:0;list-style:none;font-size:14px;line-height:1.5}' +
      '.gx-liste li{padding:6px 0;border-bottom:1px solid var(--border)}.gx-liste li:last-child{border-bottom:none}' +
      '.gx-liste b{font-weight:600}' +
      '.gx-reg{font-size:12.5px;color:var(--muted);margin-top:3px}' +
      '.gx-tb{width:100%;border-collapse:collapse;font-size:14px}.gx-tb td,.gx-tb th{padding:7px 8px;border-bottom:1px solid var(--border);text-align:left}' +
      '.gx-tb th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}.gx-tb td.n,.gx-tb th.n{text-align:right;font-variant-numeric:tabular-nums}' +
      '.gx-frais{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:-6px 0 16px}' +
      '.gx-frais-t{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-right:4px}' +
      '.gx-frais-i{display:inline-flex;align-items:center;gap:7px;padding:5px 12px;border-radius:999px;border:1px solid var(--border);background:var(--white);font:inherit;font-size:13px;color:var(--text2);cursor:pointer}' +
      '.gx-frais-i:hover{border-color:var(--g400)}.gx-frais-i b{font-weight:700;color:var(--text)}' +
      '.gx-frais-i i{width:8px;height:8px;border-radius:50%;background:var(--muted2)}.gx-frais-i i.auto{background:#668e3c;box-shadow:0 0 0 3px rgba(102,142,60,.18)}' +
      '.sc-reg{font-size:12.5px;color:var(--muted);margin-top:7px;line-height:1.35}.sc-reg b{color:var(--text);font-weight:700}';
    document.head.appendChild(c);
  }

  /* ════════ SECTEURS ════════ */
  function duSecteur(sid) { return R().lignes().filter(function (r) { return r.s13 === sid; }); }
  function carteSecteur(s) {
    if (!pret()) return '';
    var l = duSecteur(s.id), n = l.length, nReg = l.filter(function (r) { return !r.hors; }).length;
    if (!n) return '';
    return '<div class="sc-reg"><b>' + pl(n, 'entreprise') + '</b>' + (nReg ? ', dont ' + fmt(nReg) + ' au Registraire' : '') + '</div>';
  }
  function itemEntreprise(r) {
    var L = R().libelles, nom = nomDe(r);
    var emp = r.jobs ? '<span class="co-jobs-badge">' + fmt(r.jobs) + ' emp.</span>' :
      (!r.hors && r.emp !== 'O' && r.emp !== 'N' ? '<span class="co-jobs-badge" title="Tranche déclarée au Registraire pour l\'ensemble du Québec">' + esc(L.emp[r.emp]) + ' emp. (Qc)</span>' : '');
    var pastilles = (r.local ? ' <span class="rq-pill rq-p-loc">Répertoire local</span>' : '') + (r.tour ? ' <span class="rq-pill rq-p-tour">Tourisme</span>' : '') +
      (r.hors ? ' <span class="rq-pill rq-p-hors">Hors registre</span>' : '') + (r.recent ? ' <span class="rq-pill rq-p-new">Nouvelle</span>' : '') +
      (r.eta ? ' <span class="rq-pill rq-p-eta">Siège hors territoire</span>' : '') + (r.gestion ? ' <span class="rq-pill rq-p-ges">Société de gestion</span>' : '');
    var act = r.hors ? r.sectLoc : (r.caeLib || r.act);
    return '<div class="co-item"><div class="co-item-head"><div class="co-item-name">' + (nom ? esc(nom) : '<span style="color:var(--muted);font-weight:500">Nom non diffusé (entreprise individuelle)</span>') + '</div>' + emp + '</div>' +
      '<div class="co-muni">📍 ' + esc(r.muni) + '</div>' +
      (r.desc ? '<div class="co-desc-p">' + esc(r.desc) + '</div>' : '') +
      (act ? '<div class="gx-sm">' + esc(act) + '</div>' : '') +
      (r.hors ? '<div class="gx-reg">Fiche du répertoire local, sans inscription rattachée au Registraire</div>' :
        '<div class="gx-reg">' + (r.usage ? 'Nom légal ' + esc(r.nom) + ' - ' : '') + esc(r.formeLib) + ' - NEQ ' + esc(r.neq) + (r.immat ? ' - immatriculée en ' + esc(r.immat.slice(0, 4)) : '') + '</div>') +
      (pastilles ? '<div style="margin-top:7px">' + pastilles + '</div>' : '') + '</div>';
  }
  function panneauSecteur(sid) {
    if (!pret()) return false;
    var sec = (window.D.sectors || []).filter(function (s) { return s.id === sid; })[0]; if (!sec) return false;
    if (X.sp.sid !== sid) X.sp = { sid: sid, q: '', muni: '', n: PAS };
    var tous = duSecteur(sid).sort(tri);
    var nReg = tous.filter(function (r) { return !r.hors; }).length, nLoc = tous.filter(function (r) { return r.local || r.tour; }).length;
    var emplois = tous.reduce(function (a, r) { return a + (r.jobs || 0); }, 0);
    document.getElementById('spIcon').innerHTML = window.secIcon ? window.secIcon(sec) : esc(sec.icon);
    document.getElementById('spTitle').textContent = sec.name;
    document.getElementById('spMeta').textContent = fmt(sec.jobs) + ' emplois estimés - ' + pl(tous.length, 'entreprise');
    var munis = {}; tous.forEach(function (r) { munis[r.muni] = (munis[r.muni] || 0) + 1; });
    var h = '<div class="sp-total"><span>' + pl(nReg, 'inscription') + ' au Registraire</span><span>' + pl(nLoc, 'fiche locale', 'fiches locales') + '</span></div>' +
      '<div class="gx-outils"><input id="gxSpQ" placeholder="Rechercher dans ce secteur..." value="' + esc(X.sp.q) + '" oninput="GranitCroise.sp(\'q\',this.value)">' +
      '<select onchange="GranitCroise.sp(\'muni\',this.value)"><option value="">Toutes les municipalités</option>' +
      Object.keys(munis).sort(function (a, b) { return a.localeCompare(b, 'fr'); }).map(function (m) { return '<option value="' + esc(m) + '"' + (X.sp.muni === m ? ' selected' : '') + '>' + esc(m) + ' (' + munis[m] + ')</option>'; }).join('') + '</select></div>' +
      '<div id="gxSpListe"></div>' +
      '<p class="gx-note">Fiches locales en premier, puis entreprises du Registraire classées par code d\'activité (' + fmt(emplois) + ' emplois estimés au répertoire local). ' + lgd('lgd-secteurs', 'Comment les secteurs sont classés') + '</p>' +
      '<div style="margin-top:10px">' + lienReg({ s13: sid }, 'Ouvrir ce secteur dans le Registre (tri, filtres, export CSV)') + '</div>';
    document.getElementById('spBody').innerHTML = h;
    listeSecteur();
    document.getElementById('sectorPanel').classList.add('open');
    document.getElementById('panelBd').classList.add('open');
    return true;
  }
  function listeSecteur() {
    var el = document.getElementById('gxSpListe'); if (!el) return;
    var q = plie(X.sp.q), l = duSecteur(X.sp.sid).filter(function (r) {
      return (!X.sp.muni || r.muni === X.sp.muni) && (!q || r.cherche.indexOf(q.replace(/[^a-z0-9]+/g, ' ').trim()) > -1);
    }).sort(tri);
    el.innerHTML = (l.slice(0, X.sp.n).map(itemEntreprise).join('') || '<div style="text-align:center;color:var(--muted);padding:30px;font-size:14.5px">Aucune entreprise ne correspond.</div>') +
      (l.length > X.sp.n ? '<button class="gx-plus" onclick="GranitCroise.sp(\'n\',' + (X.sp.n + PAS) + ')">Afficher ' + Math.min(PAS, l.length - X.sp.n) + ' de plus (' + fmt(X.sp.n) + ' sur ' + fmt(l.length) + ')</button>' : '');
  }

  /* ════════ MUNICIPALITÉS ════════ */
  function deMuni(m) { var l = reg(); return m && !m.isMrc ? l.filter(function (r) { return r.muni === m.name; }) : l; }
  function compteMuni(m) { return pret() ? deMuni(m).length : null; }
  function blocMuni(m) {
    if (!pret()) return '';
    var l = deMuni(m), f = m.isMrc ? {} : { muni: m.name };
    var nExp = l.filter(exploitation).length, nEmp = l.filter(employeur).length, nRec = l.filter(function (r) { return r.recent; }).length;
    function chip(v, t, c) { return '<div class="dm-chip"><div class="dm-chip-v">' + v + '</div><div class="dm-chip-l">' + t + '</div><div class="dm-chip-c">' + c + '</div></div>'; }
    var cs = {}; l.filter(exploitation).forEach(function (r) { cs[r.s13] = (cs[r.s13] || 0) + 1; });
    var ordre = Object.keys(cs).sort(function (a, b) { return cs[b] - cs[a]; }), max = ordre.length ? cs[ordre[0]] : 1;
    var barres = ordre.map(function (k) {
      var ff = { s13: k, portee: 'operant' }; if (f.muni) ff.muni = f.muni;
      return '<button class="gx-b" onclick="GranitREQ.voir(' + js(ff) + ')"><span class="gx-bn">' + esc(R().libelles.s13(k)) + '</span><span class="gx-bt"><i style="width:' + Math.max(2, Math.round(cs[k] / max * 100)) + '%"></i></span><span class="gx-bv">' + fmt(cs[k]) + '</span></button>';
    }).join('');
    var tetes = R().lignes().filter(function (r) { return r.jobs > 0 && (m.isMrc || r.muni === m.name); }).sort(function (a, b) { return b.jobs - a.jobs; }).slice(0, 8);
    var pop = m.pop || 0;
    return '<div class="dm-panel" style="margin-top:14px"><div class="ct">Entreprises <span class="prov prov-reg">Registraire</span></div>' +
      '<div class="dm-chips">' +
      chip(fmt(l.length), 'Entreprises actives', pop ? (Math.round(l.length / pop * 10000) / 10).toLocaleString('fr-CA') + ' par 1 000 habitants' : 'immatriculées') +
      chip(fmt(nExp), 'En exploitation', 'sans les sociétés de gestion') +
      chip(fmt(nEmp), 'Avec employés déclarés', 'au moins un employé au Québec') +
      chip(fmt(nRec), 'Nouvelles', 'immatriculées depuis 12 mois') + '</div>' +
      (barres ? '<div class="gx-sep">Entreprises en exploitation par secteur - cliquer pour voir la liste</div><div class="gx-barres">' + barres + '</div>' : '') +
      (tetes.length ? '<div class="gx-sep">Principaux employeurs documentés au répertoire local</div><ul class="gx-liste">' + tetes.map(function (r) {
        return '<li><b>' + esc(nomDe(r)) + '</b> - ' + emplois(r.jobs) + '<div class="gx-sm">' + (m.isMrc ? esc(r.muni) + ' - ' : '') + esc(R().libelles.s13(r.s13)) + '</div></li>';
      }).join('') + '</ul>' : '') +
      '<div style="margin-top:12px">' + lienReg(f, 'Voir les ' + pl(l.length, 'entreprise') + (m.isMrc ? ' du territoire' : ' de ' + esc(m.name)) + ' dans le Registre') + '</div>' +
      '<p class="gx-note">' + dateSrc() + '. ' + lgd('lgd-ent', 'Comment lire ces chiffres') + '</p></div>';
  }

  /* ════════ VUE D'ENSEMBLE ════════ */
  function statsRegistre() {
    if (!pret()) return '';
    var l = reg();
    return ssx(fmt(l.length), 'Entreprises actives (Registraire)') + ssx(fmt(l.filter(exploitation).length), 'En exploitation, sans les sociétés de gestion');
  }
  function ssx(v, t) { return '<div class="ss" style="cursor:pointer" onclick="GranitREQ.voir({})" title="Ouvrir le Registre des entreprises"><div class="ss-v">' + v + '</div><div class="ss-l">' + t + '</div></div>'; }

  /* ════════ RÉPERTOIRE LOCAL ════════ */
  function ligneRepertoire(c) {
    if (!pret()) return '';
    var r = R().ficheLiee(c.id);
    if (!r) return '<div class="gx-reg">Sans inscription rattachée au Registraire</div>';
    return '<div class="gx-reg">Registraire : ' + (plie(r.nom) !== plie(c.name) ? esc(r.nom) + ' - ' : '') + 'NEQ ' + esc(r.neq) + ' - ' + esc(r.formeLib) +
      (r.immat ? ' - immatriculée en ' + esc(r.immat.slice(0, 4)) : '') + (r.caeLib ? ' - ' + esc(r.caeLib.toLowerCase()) : '') + '</div>';
  }

  /* ════════ TOURISME ════════ */
  function blocTourisme(muni) {
    if (!pret()) return '';
    var l = reg().filter(function (r) { return r.muni === muni && r.s13 === 's10' && !r.tour && !r.gestion; }).sort(tri);
    if (!l.length) return '';
    return '<div class="gx-sep" style="margin-top:14px">Aussi au Registraire, sans être membres du guide - hébergement, restauration et loisirs (' + l.length + ')</div>' +
      '<ul class="gx-liste">' + l.slice(0, 25).map(function (r) {
        return '<li><b>' + (nomDe(r) ? esc(nomDe(r)) : 'Nom non diffusé (entreprise individuelle)') + '</b><div class="gx-sm">' + esc(r.caeLib || r.act) + (r.immat ? ' - immatriculée en ' + esc(r.immat.slice(0, 4)) : '') + '</div></li>';
      }).join('') + '</ul>' +
      '<div style="margin-top:8px">' + lienReg({ muni: muni, s13: 's10' }, l.length > 25 ? 'Voir les ' + l.length + ' dans le Registre' : 'Ouvrir cette liste dans le Registre') + '</div>';
  }

  /* ════════ EMPLOI ════════ */
  function carteEmployeurs() {
    var vue = document.getElementById('view-eco-mainoeuvre'); if (!vue || !pret()) return;
    var el = document.getElementById('gxEmp');
    if (!el) { el = document.createElement('div'); el.className = 'card'; el.id = 'gxEmp'; el.style.marginTop = '14px'; vue.appendChild(el); }
    var L = R().libelles, l = reg().filter(employeur), c = {};
    l.forEach(function (r) { c[r.emp] = (c[r.emp] || 0) + 1; });
    var codes = L.empOrdre.split('').filter(function (k) { return c[k]; });
    var gros = R().lignes().filter(function (r) { return r.jobs >= 50; }).sort(function (a, b) { return b.jobs - a.jobs; }).slice(0, 10);
    el.innerHTML = '<div class="ct">Employeurs du territoire selon la taille déclarée <span class="prov prov-reg">Registraire</span></div>' +
      '<div class="two-col" style="gap:22px"><div><table class="gx-tb"><thead><tr><th>Employés au Québec</th><th class="n">Entreprises</th><th class="n">Siège hors territoire</th></tr></thead><tbody>' +
      codes.map(function (k) {
        var s = l.filter(function (r) { return r.emp === k; });
        return '<tr><td>' + lienReg({ emp: k, portee: 'employeurs' }, esc(L.emp[k])) + '</td><td class="n">' + fmt(s.length) + '</td><td class="n">' + fmt(s.filter(function (r) { return r.eta; }).length) + '</td></tr>';
      }).join('') + '<tr><td><b>Total avec employés déclarés</b></td><td class="n"><b>' + fmt(l.length) + '</b></td><td class="n"><b>' + fmt(l.filter(function (r) { return r.eta; }).length) + '</b></td></tr></tbody></table></div>' +
      '<div><div class="gx-sep" style="margin-top:0">Employeurs de 50 emplois et plus au répertoire local</div><ul class="gx-liste">' +
      (gros.map(function (r) { return '<li><b>' + esc(nomDe(r)) + '</b> - ' + emplois(r.jobs) + '<div class="gx-sm">' + esc(r.muni) + ' - ' + esc(L.s13(r.s13)) + '</div></li>'; }).join('') || '<li>Aucun</li>') + '</ul></div></div>' +
      '<p class="gx-note">Les tranches valent pour tout le Québec et ne s\'additionnent pas pour estimer l\'emploi local. ' + dateSrc() + '. ' + lgd('lgd-ent', 'Comment lire ces chiffres') + '</p>';
  }

  /* ════════ LOGEMENTS ET SERVICES DE GARDE ════════ */
  var RE_HAB = /habitation|logement|hlm|residence|villa |manoir|domaine des|foyer/;
  function habitation(muni) {
    var l = reg().filter(function (r) { return !muni || r.muni === muni; });
    return {
      org: l.filter(function (r) { return (r.forme === 'COP' || r.forme === 'APE') && (RE_HAB.test(plie(r.nom + ' ' + r.autres.join(' '))) || /^8[23]74$/.test(r.cae) || r.cae === '7511'); }),
      loc: l.filter(function (r) { return r.cae === '7511' && r.forme !== 'COP' && r.forme !== 'APE'; }),
      heb: l.filter(function (r) { return r.cae === '8628'; })
    };
  }
  function typeGarde(t) { return t === 'cpe' ? 'CPE' : t === 'garderie_subventionnee' ? 'Garderie subventionnée' : t === 'garderie_non_subventionnee' ? 'Garderie non subventionnée' : 'Garderie'; }
  function blocLogement(muni) {
    var h = '';
    if (X.garde) {
      var inst = X.garde.installations.filter(function (i) { return i.muni === muni; });
      h += '<div class="gx-sep">Installations de garde reconnues <span class="prov prov-reel">Réel</span></div>' +
        (inst.length ? '<ul class="gx-liste">' + inst.map(function (i) {
          return '<li><b>' + esc(i.nom) + '</b> - ' + (i.places != null ? fmt(i.places) + ' places' : 'places non précisées') + (i.poupons ? ', dont ' + fmt(i.poupons) + ' pour les poupons' : '') +
            '<div class="gx-sm">' + esc(typeGarde(i.type)) + (i.adresse ? ' - ' + esc(i.adresse) : '') + (i.telephone ? ' - ' + esc(i.telephone) : '') + '</div></li>';
        }).join('') + '</ul>' : '<div class="gx-sm">Aucune installation (CPE ou garderie) dans cette municipalité selon le ministère de la Famille. La desserte passe par le milieu familial.</div>');
    }
    if (X.rec && X.rec.par_municipalite && X.rec.par_municipalite[muni]) {
      var v = X.rec.par_municipalite[muni];
      if (v.logements_prives != null && v.logements_occupes != null) {
        h += '<div class="gx-sep">Recensement de 2021 <span class="prov prov-reel">Réel</span></div><div class="gx-sm" style="font-size:14px;color:var(--text2)">' +
          fmt(v.logements_prives) + ' logements privés, dont ' + fmt(v.logements_occupes) + ' occupés par des résidents habituels et ' + fmt(v.logements_prives - v.logements_occupes) + ' autres (chalets, résidences secondaires, logements vacants).' +
          (v.controle_mode_occupation && v.proprietaires != null ? ' Ménages propriétaires ' + fmt(v.proprietaires) + ', locataires ' + fmt(v.locataires) + '.' : '') + '</div>';
      }
    }
    if (pret()) {
      var o = habitation(muni);
      var bloc = function (titre, l, filtre) {
        if (!l.length) return '';
        return '<div class="gx-sep">' + titre + ' (' + l.length + ') <span class="prov prov-reg">Registraire</span></div><ul class="gx-liste">' + l.slice(0, 12).map(function (r) {
          return '<li><b>' + (nomDe(r) ? esc(nomDe(r)) : 'Nom non diffusé') + '</b><div class="gx-sm">' + esc(r.formeLib) + ((r.caeLib || r.act) ? ' - ' + esc(r.caeLib || r.act) : '') + '</div></li>';
        }).join('') + '</ul>' + (l.length > 12 ? '<div style="margin-top:6px">' + lienReg(filtre, 'Voir les ' + l.length + ' dans le Registre') + '</div>' : '');
      };
      h += bloc('Coopératives et organismes d\'habitation sans but lucratif', o.org, { muni: muni, q: 'habitation' }) +
        bloc('Centres d\'hébergement', o.heb, { muni: muni, q: 'centre d\'hebergement' }) +
        bloc('Exploitants de bâtiments résidentiels et de logements', o.loc, { muni: muni, q: 'exploitants de batiments residentiels' });
      if (o.org.length || o.loc.length || o.heb.length) h += '<p class="gx-note">Ces listes nomment des organismes et des propriétaires, et non un nombre de logements. Les organismes d\'habitation sont repérés par leur nom et leur forme juridique, ce qui reste à valider avec l\'Office d\'habitation.</p>';
    }
    return h;
  }
  /* Remplace, à l'affichage seulement, les valeurs de D.logements par les extractions automatiques. */
  function appliquerMilieu() {
    var L = window.D && window.D.logements; if (!L || !L.parMuni) return;
    if (X.garde && X.garde.resume && X.faitG !== L) {
      var G = X.garde.resume, src = 'Ministère de la Famille, liste des CPE et garderies en fonction, extraction du ' + G.extraction + '.';
      L.parMuni.forEach(function (x) {
        var g = G.par_municipalite[x.muni]; if (!g) return;
        x.garderies = x.garderies || {};
        x.garderies.cpe = g.cpe; x.garderies.garderies = g.garderies; x.garderies.placesTotal = g.installations ? g.places : null;
        x.garderies.real = true; x.garderies.source = g.installations ? src : 'Aucune installation selon le ministère de la Famille (extraction du ' + G.extraction + '). Desserte par le milieu familial, coordonnée à l\'échelle de la MRC.';
      });
      L.agregats.garderiesInstallations = G.installations;
      if (G.places_milieu_familial != null) L.agregats.placesMilieuFamilial = G.places_milieu_familial;
      L.agregats.placesGardeTotal = G.places_installation + (L.agregats.placesMilieuFamilial || 0);
      X.faitG = L;
    }
    if (X.rec && X.rec.par_municipalite && X.faitR !== L) {
      var tot = 0, loc = 0, locOk = true, n = 0, priv = 0;
      L.parMuni.forEach(function (x) {
        var v = X.rec.par_municipalite[x.muni]; if (!v || v.logements_occupes == null) return;
        x.logements = x.logements || {};
        x.logements.total = v.logements_occupes; x.logements.real = true; x.logements.est = false;
        var okLoc = v.controle_mode_occupation && v.locataires != null;
        if (okLoc) x.logements.locatifs = v.locataires; else locOk = false;
        x.logements.source = 'Recensement de 2021 (Statistique Canada), logements privés occupés par des résidents habituels' + (okLoc ? '; ménages locataires, échantillon de 25 %.' : '. Locatifs : estimation.');
        x.logements.prives = v.logements_prives;
        tot += v.logements_occupes; loc += okLoc ? v.locataires : 0; priv += v.logements_prives || 0; n++;
      });
      if (n === L.parMuni.length) { L.agregats.logementsTotal = tot; L.agregats.logementsPrives = priv; if (locOk) L.agregats.menagesLocataires = loc; }
      X.faitR = L;
    }
  }
  function noteMilieu() {
    var el = document.getElementById('lgSrc'); if (!el || (!X.garde && !X.rec)) return;
    var t = [];
    if (X.rec) t.push('Parc de logements : Recensement de 2021 (Statistique Canada), toutes les municipalités');
    if (X.garde) t.push('Services de garde : ministère de la Famille, Données Québec, extraction automatique du ' + X.garde.resume.extraction +
      (X.garde.resume.rsg_reconnues ? ' (' + X.garde.resume.rsg_reconnues + ' responsables en milieu familial reconnues, ' + fmt(X.garde.resume.places_milieu_familial) + ' places)' : ''));
    t.push('Logement social : DSP de l\'Estrie et SHQ, saisie manuelle');
    el.textContent = 'Sources : ' + t.join(' - ') + '.';
    var a = (window.D.logements || {}).agregats || {}, cg = document.getElementById('lgCapGrid');
    if (cg && a.logementsPrives && !document.getElementById('gxCapPriv')) {
      var c = document.createElement('div'); c.className = 'lg-cap'; c.id = 'gxCapPriv';
      c.innerHTML = '<div class="lg-cap-v">' + fmt(a.logementsPrives) + '</div><div class="lg-cap-l">Logements privés</div><div class="lg-cap-s">au total, chalets et résidences secondaires compris</div>';
      cg.insertBefore(c, cg.children[1] || null);
    }
  }

  /* ════════ APERÇU : fraîcheur des données ════════ */
  function fraicheur() {
    var el = document.getElementById('gxFrais'); if (!el || !window.D) return;
    var L = pret() ? R().libelles : null, t = [];
    function d(iso) { return L ? L.dateFr(iso) : iso; }
    if (pret()) t.push(['Entreprises', 'Registraire, ' + d(R().extraction()), 'auto']);
    if (X.garde) t.push(['Services de garde', 'ministère de la Famille, ' + d(X.garde.resume.extraction), 'auto']);
    if (X.rec) t.push(['Logements', 'Recensement de 2021', 'auto']);
    t.push(['Autres données', 'chiffrier de la MRC, ' + ((window.D.meta && window.D.meta.quarter) || ''), 'man']);
    el.innerHTML = '<div class="gx-frais"><span class="gx-frais-t">Données à jour</span>' + t.map(function (x) {
      return '<button class="gx-frais-i" onclick="voirLegende(\'lgd-maj\')" title="Voir les sources et le calendrier des mises à jour"><i class="' + x[2] + '"></i><b>' + esc(x[0]) + '</b> ' + esc(x[1]) + '</button>';
    }).join('') + '</div>';
  }

  /* ════════ LÉGENDE : table des 13 secteurs ════════ */
  var DEF_SECT = {
    s1: 'Fabrication de produits du bois (sauf les scieries) et de meubles',
    s2: 'Exploitation et services forestiers, scieries, camionnage et commerce de gros de produits forestiers',
    s3: 'Carrières, sablières et gravières, produits en pierre, en béton et en verre, monuments funéraires',
    s4: 'Aucun code d\'activité propre. Le secteur ne contient que des fiches du répertoire local',
    s5: 'Érablières',
    s6: 'Agriculture et services agricoles (sauf les érablières), pêche, fabrication d\'aliments et de boissons, commerce de gros agricole et alimentaire',
    s7: 'Produits métalliques, machinerie, matériel de transport et produits électriques, soudage',
    s8: 'Cuir, textile et habillement',
    s9: 'Transport et entreposage (sauf le camionnage de produits forestiers)',
    s10: 'Hébergement, restauration, loisirs et divertissement, agences de voyages, musées',
    s11: 'Services gouvernementaux, enseignement, santé et services sociaux, services publics',
    s12: 'Commerce de gros et de détail, communications, finance et assurances, services aux entreprises, services personnels et autres services',
    s13: 'Construction, entrepreneurs spécialisés et lotissement',
    autres: 'Sociétés de gestion et de portefeuille, exploitants immobiliers, associations et organismes, édition, production de films, fabrication diverse, activité non déclarée'
  };
  function legendeSecteurs() {
    var el = document.getElementById('lgdSecteurs'); if (!el || !window.D || !window.D.sectors) return;
    var ok = pret(), c = {};
    if (ok) R().lignes().forEach(function (r) { c[r.s13] = (c[r.s13] || 0) + 1; });
    var lignes = window.D.sectors.map(function (x) { return [x.id, x.name, x.jobs]; }).concat([['autres', 'Autres activités', null]]);
    el.innerHTML = '<div style="overflow-x:auto"><table class="lgd-tb"><thead><tr><th>Secteur</th><th>Ce qui y est classé</th><th class="n">Entreprises</th><th class="n">Emplois estimés</th></tr></thead><tbody>' +
      lignes.map(function (x) {
        return '<tr><td>' + esc(x[1]) + '</td><td>' + DEF_SECT[x[0]] + '</td>' +
          '<td class="n">' + (ok ? '<button class="lgd-lien" onclick="GranitREQ.voir(' + js({ s13: x[0] }) + ')">' + fmt(c[x[0]] || 0) + '</button>' : '-') + '</td>' +
          '<td class="n">' + (x[2] != null ? fmt(x[2]) : '-') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="gx-note">Les entreprises comprennent les inscriptions du Registraire et les fiches locales sans inscription rattachée. Les emplois estimés par secteur viennent du portrait de la MRC et non du Registraire.' + (ok ? ' ' + dateSrc() + '.' : '') + '</p>';
  }

  /* ════════ LÉGENDE : les quatre mesures de l'emploi, avec leurs valeurs ════════ */
  function legendeEmplois() {
    var el = document.getElementById('lgdEmplois'); if (!el || !window.D) return;
    var D = window.D, vi = (D.meta && D.meta.validatedIndicators) || {}, L = D.portraitLGP && D.portraitLGP.agregats, t = D.trends || {};
    var sj = (D.sectors || []).reduce(function (a, b) { return a + (b.jobs || 0); }, 0);
    var fj = (D.companies || []).filter(function (c) { return c.src !== 'tourisme' && c.status !== 'a_completer'; }).reduce(function (a, b) { return a + (b.jobs || 0); }, 0);
    var h = '';
    function l(titre, texte) { h += '<dt>' + titre + '</dt><dd>' + texte + '</dd>'; }
    if (vi.travailleurs_25_64_2024) l('Travailleurs de 25 à 64 ans <span class="prov prov-reel">Réel</span>', '<b>' + fmt(vi.travailleurs_25_64_2024) + '</b> résidents du Granit qui occupent un emploi, peu importe où ils travaillent (ISQ, 2024). C\'est une mesure des personnes, pas des postes situés sur le territoire.');
    if (L && L.emplois) l('Emplois industriels <span class="prov prov-reel">Réel</span>', '<b>' + fmt(L.emplois) + '</b> emplois dans les ' + fmt(L.etablissements) + ' établissements industriels avec employés (portrait LGP, avril 2026). Les services publics, le commerce et les travailleurs autonomes n\'y sont pas.');
    l('Emplois estimés par secteur <span class="prov prov-est">Estimation</span>', 'Estimations analytiques de la MRC pour chacun des 13 secteurs. Leur somme (<b>' + fmt(sj) + '</b>)' + (t.totalJobs && t.totalJobs.length ? ' dépasse le total estimé de ' + t.years[t.years.length - 1] + ' (<b>' + fmt(t.totalJobs[t.totalJobs.length - 1]) + '</b>)' : '') + ', parce que les deux séries n\'ont pas été conciliées. Elles servent à comparer les secteurs entre eux, pas à établir un total.');
    l('Emplois des fiches <span class="prov prov-est">Estimation</span>', '<b>' + fmt(fj) + '</b> emplois inscrits sur les fiches du répertoire local. C\'est un plancher documenté, puisque le répertoire ne couvre pas toutes les entreprises.');
    el.innerHTML = h;
  }

  /* ════════ Rafraîchissement des vues déjà affichées ════════ */
  function filtreActif(sel) {
    var b = document.querySelector(sel + ' .ft.active'), m = b && (b.getAttribute('onclick') || '').match(/\('([^']+)'/);
    return m ? m[1] : 'all';
  }
  function rafraichir() {
    var w = window;
    try {
      if (!w.D) return;
      appliquerMilieu();
      if (w.renderStatsStrip) w.renderStatsStrip();
      if (w.renderSectorCards) { w.renderSectorCards('overviewSectors', 'all'); w.renderSectorCards('sectorGrid', filtreActif('#sTabs')); }
      if (w.renderMuniGrid) w.renderMuniGrid(filtreActif('#mTabs'));
      if (w.filterCo && document.getElementById('coBody')) w.filterCo();
      if (w.D.tourisme && document.getElementById('trMuniAcc') && document.getElementById('trMuniAcc').innerHTML) w.renderTrMuniAcc();
      if (w.D.logements && w.renderHousing) { w.renderHousing(); if (document.getElementById('view-eco-housing').classList.contains('active') && w.renderHousingCharts) setTimeout(w.renderHousingCharts, 80); }
      apresRendu();
    } catch (e) { if (w.console) console.warn('granit-croise', e); }
  }
  function apresRendu() { try { noteMilieu(); carteEmployeurs(); legendeSecteurs(); legendeEmplois(); fraicheur(); } catch (e) {} try { if (window.GranitCarte) window.GranitCarte.rendre(); } catch (e) {} }
  function json(u) { return fetch(u + '?t=' + Date.now()).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  function demarrer() {
    styles();
    if (!window.D || !window.D.sectors) { setTimeout(demarrer, 150); return; }
    /* La note de sources de la vue Logements est réécrite à chaque rendu : la tenir à jour après coup. */
    if (window.renderHousing && !window.renderHousing._gx) {
      var h0 = window.renderHousing;
      window.renderHousing = function () { h0(); noteMilieu(); };
      window.renderHousing._gx = true;
    }
    Promise.all([json('./data/garde/granit_latest.json'), json('./data/garde/resume.json'), json('./data/logement/recensement2021.json')]).then(function (r) {
      if (r[0] && r[1] && (r[0].installations || []).length) X.garde = { installations: r[0].installations, bc: r[0].bureaux_coordonnateurs || [], resume: r[1] };
      if (r[2] && r[2].par_municipalite) X.rec = r[2];
      rafraichir();
    });
    if (compatible()) R().charger().then(rafraichir).catch(function () {});
  }

  window.GranitCroise = {
    pret: sur(pret, false), carteSecteur: sur(carteSecteur, ''), panneauSecteur: sur(panneauSecteur, false), compteMuni: sur(compteMuni, null), blocMuni: sur(blocMuni, ''),
    statsRegistre: sur(statsRegistre, ''), ligneRepertoire: sur(ligneRepertoire, ''), blocTourisme: sur(blocTourisme, ''), blocLogement: sur(blocLogement, ''),
    appliquerMilieu: sur(appliquerMilieu), rafraichir: rafraichir, apresRendu: apresRendu, _etat: X,
    sp: sur(function (k, v) { X.sp[k] = v; if (k !== 'n') X.sp.n = PAS; listeSecteur(); })
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
