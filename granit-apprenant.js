/* granit-apprenant.js - Pilier Santé lu comme une boucle : savoirs, délibération, décision, suivi, ajustement.
   Ajoute la vue « De la donnée à la décision » (registre par enjeu et journal des lectures révisées), le tableau des
   instances et l'encadré des frontières ouvertes dans « Instances et leviers », la vue « Données et gouvernance »,
   la vue « Inégalités sociales de santé » (définitions, enquête jeunesse, dimensions de l'accès), les principes d'action
   et le regard d'équité du registre, et regroupe la navigation du pilier. Lit data/sante/apprenant.json, tenu à la main.
   Le registre est une mémoire pour la MRC : il n'attribue aucun score et n'évalue pas le conseil. */
(function () {
  'use strict';
  var URL_DATA = './data/sante/apprenant.json';
  var S = { d: null };
  var attente = null;
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var PROV = { reel: ['prov-reel', 'Réel'], terrain: ['prov-terrain', 'Terrain'], todo: ['prov-todo', 'À compléter'], est: ['prov-est', 'Estimation'] };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function prov(k) { var p = PROV[k] || PROV.reel; return '<span class="prov ' + p[0] + '">' + p[1] + '</span>'; }
  function date(s) {
    if (!s) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return (+m[3] === 1 ? '1er' : +m[3]) + ' ' + MOIS[+m[2] - 1] + ' ' + m[1];
    m = /^(\d{4})-(\d{2})$/.exec(s);
    if (m) return MOIS[+m[2] - 1].charAt(0).toUpperCase() + MOIS[+m[2] - 1].slice(1) + ' ' + m[1];
    return s;
  }
  function source(k) {
    var x = S.d && S.d.sources && S.d.sources[k]; if (!x) return '';
    return x.u ? '<a href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(x.l) + '</a>' : esc(x.l);
  }
  function charger() {
    if (S.d) return Promise.resolve(S.d);
    if (attente) return attente;
    attente = fetch(URL_DATA + '?t=' + Date.now()).then(function (r) {
      if (!r.ok) throw new Error('fichier introuvable (' + r.status + ')');
      return r.json();
    }).then(function (d) { S.d = d; return d; }).catch(function (e) { attente = null; throw e; });
    return attente;
  }
  function erreur(id, err) {
    var el = document.getElementById(id); if (!el) return;
    el.innerHTML = '<div class="card"><div class="ct">Contenu non disponible</div><div style="font-size:14.5px;color:var(--text2);line-height:1.6">' +
      'Le fichier <code>data/sante/apprenant.json</code> n\'a pas pu être lu (' + esc(err.message) + ').</div></div>';
  }

  /* ── Insertion dans la page ── */
  function vue(id, apresId, titre, sous, corpsId) {
    var apres = document.getElementById(apresId); if (!apres || document.getElementById(id)) return;
    var v = document.createElement('div');
    v.className = 'view'; v.id = id;
    v.innerHTML = '<div class="section-header"><div class="sh-left"><h2>' + titre + '</h2><p>' + sous + '</p></div>' +
      '<span class="pillar-badge pb-sa">Santé</span></div><div id="' + corpsId + '"><div class="card" style="color:var(--muted);font-size:14.5px">Chargement...</div></div>';
    apres.parentNode.insertBefore(v, apres.nextSibling);
  }
  function bouton(nav, id, vueId, libelle, svg) {
    var b = document.createElement('button');
    b.className = 'ni'; b.id = id;
    b.setAttribute('onclick', "V('" + vueId + "',this)");
    b.innerHTML = '<div class="ni-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + svg + '</svg></div>' + libelle;
    return b;
  }
  function niDe(nav, vueId) {
    var r = null;
    nav.querySelectorAll('.ni').forEach(function (b) { if ((b.getAttribute('onclick') || '').indexOf("'" + vueId + "'") > -1) r = b; });
    return r;
  }
  function etiquette(txt) { var e = document.createElement('div'); e.className = 'ngl ap-ngl'; e.textContent = txt; return e; }

  function monter() {
    if (document.getElementById('view-sa-boucle')) return;
    var css = document.createElement('style');
    css.textContent =
      '.ap-ngl{margin-top:14px}' +
      '.ap-cadre{background:var(--sa50);border:1px solid var(--sa100);border-left:3px solid var(--sa700);border-radius:var(--r2);padding:13px 16px;font-size:14px;line-height:1.65;color:#155e75;margin-bottom:16px;max-width:1040px}' +
      '.ap-cadre small{display:block;margin-top:7px;font-size:13px;color:var(--muted)}' +
      '.ap-pas{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:18px}' +
      '.ap-pas-b{background:var(--white);border:1px solid var(--border);border-radius:var(--r2);padding:11px 13px;position:relative}' +
      '.ap-pas-n{font-size:12px;font-weight:700;color:var(--pillar-color);letter-spacing:.4px}' +
      '.ap-pas-t{font-size:14px;font-weight:700;color:var(--text);margin:1px 0 2px}' +
      '.ap-pas-d{font-size:12.5px;color:var(--muted);line-height:1.4}' +
      '.ap-enj{margin-bottom:12px;padding:0;overflow:hidden}' +
      '.ap-enj summary{list-style:none;cursor:pointer;padding:16px 20px}' +
      '.ap-enj summary::-webkit-details-marker{display:none}' +
      '.ap-enj summary:focus-visible{outline:2px solid var(--pillar-color);outline-offset:-2px}' +
      '.ap-enj-h{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:15.5px;font-weight:700;color:var(--text)}' +
      '.ap-enj-h::before{content:"";width:8px;height:8px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(-45deg);transition:transform .15s;flex-shrink:0;margin-right:2px}' +
      '.ap-enj[open] .ap-enj-h::before{transform:rotate(45deg)}' +
      '.ap-det{font-size:12.5px;font-weight:600;color:var(--sa800);background:var(--sa50);border:1px solid var(--sa100);border-radius:10px;padding:1px 9px}' +
      '.ap-enj-r{font-size:14px;color:var(--text2);line-height:1.55;margin:6px 0 12px;max-width:900px}' +
      '.ap-fil{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}' +
      '.ap-fil-e{font-size:12.5px;color:var(--muted);border-top:4px solid var(--border);padding-top:6px;line-height:1.35}' +
      '.ap-fil-e b{display:block;font-size:13px;color:var(--text);font-weight:600}' +
      '.ap-fil-e.ok{border-top-color:var(--pillar-color)}' +
      '.ap-fil-e.part{border-top:4px dashed var(--sa500)}' +
      '.ap-corps{padding:4px 20px 18px;border-top:1px solid var(--border2)}' +
      '.ap-et{margin-top:14px}' +
      '.ap-et-t{font-size:13px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}' +
      '.ap-tr{display:grid;grid-template-columns:150px minmax(0,1fr);gap:12px;padding:8px 0;border-top:1px solid var(--border2);font-size:14px;line-height:1.55;color:var(--text2)}' +
      '.ap-tr:first-of-type{border-top:none}' +
      '.ap-tr-d{font-size:13px;color:var(--muted);font-weight:600}' +
      '.ap-tr small{display:block;font-size:12.5px;color:var(--muted);margin-top:2px}' +
      '.ap-tr small a,.ap-src a{color:var(--sa800)}' +
      '.ap-vide{font-size:14px;color:var(--muted);padding:4px 0}' +
      '.ap-jr{display:grid;grid-template-columns:150px minmax(0,1fr);gap:12px;padding:13px 0;border-top:1px solid var(--border2)}' +
      '.ap-jr:first-of-type{border-top:none;padding-top:2px}' +
      '.ap-jr-s{font-size:14.5px;font-weight:700;color:var(--text);margin-bottom:5px}' +
      '.ap-jr dl{display:grid;grid-template-columns:118px minmax(0,1fr);gap:4px 10px;font-size:14px;line-height:1.55;color:var(--text2);margin:0}' +
      '.ap-jr dt{font-size:13px;color:var(--muted);font-weight:600}' +
      '.ap-jr dd{margin:0}' +
      '.ap-tab{width:100%;border-collapse:collapse;font-size:14px}' +
      '.ap-tab th{font-size:12.5px;font-weight:700;color:var(--muted);text-align:left;padding:8px 8px;border-bottom:2px solid var(--border);vertical-align:bottom;line-height:1.3}' +
      '.ap-tab td{padding:10px 8px;border-bottom:1px solid var(--border2);vertical-align:top;line-height:1.5;color:var(--text2)}' +
      '.ap-tab td b{color:var(--text);font-weight:600}' +
      '.ap-tab td small{display:block;font-size:12.5px;color:var(--muted);margin-top:2px}' +
      '.ap-tab .ap-c{text-align:center;width:86px}' +
      '.ap-oui{display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--pillar-color)}' +
      '.ap-non{display:inline-block;width:12px;height:2px;background:var(--border);vertical-align:middle}' +
      '.ap-wrap{overflow-x:auto}' +
      '.ap-src{font-size:12.5px;color:var(--muted2);line-height:1.6;margin-top:10px}' +
      '.ap-li{margin:0;padding-left:18px;font-size:14px;line-height:1.7;color:var(--text2)}' +
      '.ap-anc{display:grid;gap:0}' +
      '.ap-anc-i{padding:10px 0;border-top:1px solid var(--border2);font-size:14px;line-height:1.55;color:var(--text2)}' +
      '.ap-anc-i:first-child{border-top:none}' +
      '.ap-anc-i small{display:block;font-size:12.5px;color:var(--muted);margin-top:2px}' +
      '.ap-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}' +
      '.ap-mec{border:1px solid var(--border);border-radius:var(--r2);padding:13px 15px;background:var(--bg)}' +
      '.ap-mec b{display:block;font-size:14.5px;color:var(--text);margin-bottom:3px}' +
      '.ap-mec span{font-size:14px;line-height:1.55;color:var(--text2)}' +
      '.ap-dim{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:6px}' +
      '.ap-dim button{text-align:left;font:inherit;background:var(--white);border:1px solid var(--border);border-radius:var(--r2);padding:11px 12px;cursor:pointer}' +
      '.ap-dim button:hover{border-color:var(--pillar-color)}' +
      '.ap-dim-n{font-size:22px;font-weight:700;color:var(--pillar-color);font-family:\'Fraunces\',serif;line-height:1.1}' +
      '.ap-dim-t{font-size:13.5px;font-weight:700;color:var(--text);margin:2px 0}' +
      '.ap-dim-d{font-size:12.5px;color:var(--muted);line-height:1.4}' +
      '.ap-leg{display:flex;flex-wrap:wrap;gap:14px;font-size:13px;color:var(--text2);margin:2px 0 12px}' +
      '.ap-leg i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px}' +
      '.ap-gr{margin-top:16px}' +
      '.ap-gr-t{font-size:13px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;padding-top:12px;border-top:1px solid var(--border)}' +
      '.ap-gr:first-of-type .ap-gr-t{border-top:none;padding-top:0}' +
      '.ap-it{display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:14px;padding:7px 0;align-items:center}' +
      '.ap-it-l{font-size:14px;line-height:1.4;color:var(--text2)}' +
      '.ap-q{display:block;font-size:12.5px;color:var(--muted);margin-top:1px}' +
      '.ap-q-p{color:var(--sa800);font-weight:700}' +
      '.ap-b{display:grid;grid-template-columns:minmax(0,1fr) 52px;gap:8px;align-items:center;margin:2px 0}' +
      '.ap-b-f{height:11px;background:var(--border2);border-radius:3px;overflow:hidden}' +
      '.ap-b-f i{display:block;height:100%;border-radius:3px}' +
      '.ap-b-v{font-size:13px;font-variant-numeric:tabular-nums;color:var(--text2);text-align:right}' +
      '.ap-b.g .ap-b-v{font-weight:700;color:var(--text)}' +
      '.ap-ex{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}' +
      '.ap-ex div{border:1px solid var(--border);border-radius:var(--r2);padding:13px 15px;font-size:14px;line-height:1.55;color:var(--text2)}' +
      '.ap-ex b{display:block;color:var(--text);margin-bottom:4px;font-size:14.5px}' +
      '.ap-pr{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
      '.ap-pr-b{border:1px solid var(--border);border-radius:var(--r2);padding:12px 14px;font-size:14px;line-height:1.55;color:var(--text2)}' +
      '.ap-pr-b b{display:block;color:var(--text);font-size:14.5px;margin-bottom:3px}' +
      '.ap-pr-b small{display:block;margin-top:6px;font-size:12.5px;color:var(--sa800)}' +
      '.ap-eq{background:var(--sa50);border:1px solid var(--sa100);border-radius:var(--r2);padding:13px 16px;margin-top:16px}' +
      '.ap-eq-g{display:grid;grid-template-columns:1fr 1fr;gap:12px 22px;margin-top:8px}' +
      '.ap-eq-q{font-size:13.5px;font-weight:700;color:var(--text);margin-bottom:3px}' +
      '.ap-eq ul{margin:0;padding-left:18px;font-size:14px;line-height:1.55;color:var(--text2)}' +
      '@media(max-width:1000px){.ap-2,.ap-ex,.ap-pr,.ap-eq-g{grid-template-columns:1fr}.ap-dim{grid-template-columns:1fr 1fr}.ap-it{grid-template-columns:1fr;gap:2px}.ap-pas{grid-template-columns:1fr 1fr}.ap-fil{grid-template-columns:1fr}.ap-tr,.ap-jr{grid-template-columns:1fr;gap:2px}.ap-jr dl{grid-template-columns:1fr}}';
    document.head.appendChild(css);

    vue('view-sa-iss', 'view-sa-portrait', 'Inégalités sociales de santé',
      'Des écarts de santé injustes et évitables - comment ils se fabriquent et ce que l\'on en sait dans le Granit', 'apIss');
    vue('view-sa-boucle', 'view-sa-governance', 'De la donnée à la décision',
      'Ce qui est su, discuté, décidé, suivi et ajusté, enjeu par enjeu', 'apBoucle');
    vue('view-sa-donnees', 'view-sa-vuln', 'Données et gouvernance',
      'D\'où viennent les données, comment elles arrivent ici et à quelles conditions', 'apDonnees');

    /* Navigation du pilier, regroupée selon la boucle. */
    var nav = document.getElementById('sbnSa');
    if (nav) {
      var t = nav.querySelector('.ngl'); if (t) t.textContent = 'Savoirs';
      var gov = niDe(nav, 'sa-governance'), vul = niDe(nav, 'sa-vuln'), por = niDe(nav, 'sa-portrait');
      if (por) nav.insertBefore(bouton(nav, 'apNavIss', 'sa-iss', 'Inégalités sociales de santé',
        '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20v-3"/>'), por.nextSibling);
      if (gov) {
        nav.insertBefore(etiquette('Action'), gov);
        nav.insertBefore(bouton(nav, 'apNavBoucle', 'sa-boucle', 'De la donnée à la décision',
          '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>'), gov.nextSibling);
      }
      if (vul) {
        nav.insertBefore(etiquette('Repères'), vul);
        nav.insertBefore(bouton(nav, 'apNavDonnees', 'sa-donnees', 'Données et gouvernance',
          '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>'), vul.nextSibling);
      }
    }

    var V0 = window.V;
    window.V = function (id, b) {
      V0(id, b);
      if (id === 'sa-iss') charger().then(rendreIss).catch(function (e) { erreur('apIss', e); });
      if (id === 'sa-boucle') charger().then(rendreBoucle).catch(function (e) { erreur('apBoucle', e); });
      if (id === 'sa-donnees') charger().then(rendreDonnees).catch(function (e) { erreur('apDonnees', e); });
      if (id === 'sa-governance') charger().then(rendreInstances).catch(function () {});
    };
    charger().catch(function () {});
  }

  /* ── De la donnée à la décision ── */
  function etat(liste) {
    if (!liste || !liste.length) return '';
    return liste.some(function (x) { return x.prov !== 'todo'; }) ? 'ok' : 'part';
  }
  function trace(x) {
    return '<div class="ap-tr"><div class="ap-tr-d">' + (esc(date(x.date)) || 'Sans date') + '</div><div>' + esc(x.texte) + ' ' + prov(x.prov) +
      (x.src ? '<small>' + source(x.src) + '</small>' : '') + '</div></div>';
  }
  function rendreBoucle() {
    var d = S.d, el = document.getElementById('apBoucle'); if (!d || !el) return;
    var et = d.etapes || [], enj = d.enjeux || [], dn = {};
    ((window.D && window.D.sante && window.D.sante.determinants) || []).forEach(function (x) { dn[x.id] = x.name; });
    var nDec = 0, nSuivi = 0, nAj = 0, nDecEnj = 0;
    enj.forEach(function (x) {
      var k = (x.decision || []).filter(function (y) { return y.prov !== 'todo'; }).length;
      nDec += k; if (k) nDecEnj++;
      if (etat(x.suivi) === 'ok') nSuivi++;
      if (etat(x.ajustement) === 'ok') nAj++;
    });
    var ss = window.ss;
    var h = '<div class="ap-cadre">' + esc(d.meta.cadre) + '<small>' + esc(d.meta.limite) + '</small></div>';
    var P = d.principes;
    if (P) h += '<details class="card ap-enj" style="margin-bottom:18px"><summary><div class="ap-enj-h">' + esc(P.titre) + '</div></summary><div class="ap-corps" style="padding-top:14px"><div class="ap-pr">' +
      P.liste.map(function (x) { return '<div class="ap-pr-b"><b>' + x.no + '. ' + esc(x.nom) + '</b>' + esc(x.texte) + '<small>Sur la plateforme : ' + esc(x.ou) + '</small></div>'; }).join('') +
      '</div><div class="ap-src">Source. ' + source(P.src) + '.</div></div></details>';
    h += '<div class="ap-pas">' + et.map(function (e, i) {
      return '<div class="ap-pas-b"><div class="ap-pas-n">' + (i + 1) + '</div><div class="ap-pas-t">' + esc(e.nom) + '</div><div class="ap-pas-d">' + esc(e.desc) + '</div></div>';
    }).join('') + '</div>';
    h += '<div class="ss-row">' + ss(enj.length, 'Enjeux suivis') + ss(nDec, 'Décisions tracées') +
      ss(nDecEnj + ' sur ' + enj.length, 'Enjeux avec une décision tracée') +
      ss(nSuivi + ' sur ' + enj.length, 'Enjeux avec un suivi des effets documenté') +
      ss(nAj + ' sur ' + enj.length, 'Enjeux avec un ajustement documenté') + '</div>';

    h += enj.map(function (x, i) {
      var fil = et.map(function (e) {
        var s = etat(x[e.id]);
        return '<div class="ap-fil-e ' + s + '"><b>' + esc(e.nom) + '</b>' + (s === 'ok' ? 'Documenté' : s === 'part' ? 'Prévu, à compléter' : 'À documenter') + '</div>';
      }).join('');
      var corps = et.map(function (e) {
        var l = x[e.id] || [];
        return '<div class="ap-et"><div class="ap-et-t">' + esc(e.nom) + '</div>' +
          (l.length ? l.map(trace).join('') : '<div class="ap-vide">Aucune trace pour l\'instant. ' + prov('todo') + '</div>') + '</div>';
      }).join('');
      return '<details class="card ap-enj"' + (i === 0 ? ' open' : '') + '><summary><div class="ap-enj-h">' + esc(x.nom) +
        (dn[x.det] ? '<span class="ap-det">' + esc(dn[x.det]) + '</span>' : '') + '</div>' +
        '<div class="ap-enj-r">' + esc(x.resume) + '</div><div class="ap-fil">' + fil + '</div></summary>' +
        '<div class="ap-corps">' + corps + equite(x) + '</div></details>';
    }).join('');

    var j = d.journal;
    if (j && j.entrees && j.entrees.length) {
      h += '<div class="card" style="margin-top:20px"><div class="ct">Ce que nous avons appris - journal des lectures révisées</div>' +
        '<div class="rv-p">' + esc(j.note) + '</div>' +
        j.entrees.map(function (e) {
          return '<div class="ap-jr"><div class="ap-tr-d">' + esc(date(e.date)) + '</div><div><div class="ap-jr-s">' + esc(e.sujet) + '</div><dl>' +
            '<dt>Lecture d\'avant</dt><dd>' + esc(e.avant) + '</dd><dt>Lecture actuelle</dt><dd>' + esc(e.apres) + '</dd>' +
            '<dt>Ce qui l\'a fait changer</dt><dd>' + esc(e.declencheur) + '</dd></dl></div></div>';
        }).join('') + '</div>';
    }
    el.innerHTML = h;
  }

  function equite(x) {
    var q = x.equite;
    if (!q) return '<div class="ap-eq"><div class="ap-et-t" style="margin:0">Regard d\'équité ' + prov('todo') + '</div>' +
      '<div class="ap-vide">À faire pour cet enjeu. ' + (S.d.equiteGenerique || []).map(esc).join(' ') + '</div></div>';
    return '<div class="ap-eq"><div class="ap-et-t" style="margin:0">Regard d\'équité</div>' +
      '<div class="ap-vide" style="color:var(--text2)">' + esc(q.objectif) + ' ' + esc(q.note) + '</div><div class="ap-eq-g">' +
      q.blocs.map(function (b) { return '<div><div class="ap-eq-q">' + esc(b.q) + '</div><ul>' + b.r.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></div>'; }).join('') +
      '</div><div class="ap-src">Source. ' + source(q.src) + '.</div></div>';
  }

  /* ── Inégalités sociales de santé ── */
  function rendreIss() {
    var d = S.d, el = document.getElementById('apIss'); if (!d || !el || !d.iss) return;
    var I = d.iss, J = I.jeunes, coul = ['var(--pillar-color)', '#8a9aa3', '#c3ccd1'];
    var h = '<div class="ap-cadre">' + esc(I.definition) + '</div>';
    h += '<div class="card" style="margin-bottom:18px"><div class="ct">Comment ces inégalités se fabriquent</div><div class="ap-2" style="margin-bottom:10px">' +
      I.mecanismes.map(function (m) { return '<div class="ap-mec"><b>' + esc(m.nom) + '</b><span>' + esc(m.texte) + '</span></div>'; }).join('') + '</div>' +
      '<ul class="ap-li">' + I.reperes.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '<li>' + esc(I.rural) + '</li></ul></div>';

    var M = window.GranitMADA, C = M && M.donnees && M.donnees();
    if (C && C.acces) {
      var n = M.compteAcces();
      h += '<div class="card" style="margin-bottom:18px"><div class="ct">' + esc(C.acces.titre) + ' ' + prov('terrain') + '</div><div class="rv-p">' + esc(C.acces.note) + '</div><div class="ap-dim">' +
        C.acces.dimensions.map(function (k) {
          return '<button onclick="GranitMADA.allerAcces(\'' + k.id + '\')" aria-label="' + esc(k.nom) + ', ' + (n[k.id] || 0) + ' constats, voir la liste"><div class="ap-dim-n">' + (n[k.id] || 0) + '</div><div class="ap-dim-t">' + esc(k.nom) + '</div><div class="ap-dim-d">' + esc(k.desc) + '</div></button>';
        }).join('') + '</div><div class="ap-src">Nombre de constats du milieu par dimension. Un clic ouvre la liste dans Constats du milieu.</div></div>';
    } else if (M && M.charger && !S.madaDemande) { S.madaDemande = true; M.charger().then(rendreIss).catch(function () {}); }

    if (J) {
      var max = 0; J.groupes.forEach(function (g) { g.items.forEach(function (i) { i.v.forEach(function (v) { if (v > max) max = v; }); }); });
      max = Math.ceil(max / 10) * 10;
      h += '<div class="card" style="margin-bottom:18px"><div class="ct">' + esc(J.titre) + ' ' + prov('reel') + '</div><div class="rv-p">' + esc(J.note) + '</div>' +
        (J.territoires.length > 1 ? '<div class="ap-leg">' + J.territoires.map(function (t, i) { return '<span><i style="background:' + coul[i] + '"></i>' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
        J.groupes.map(function (g) {
          return '<div class="ap-gr"><div class="ap-gr-t">' + esc(g.nom) + '</div>' + g.items.map(function (it) {
            var comp = it.q === '+' ? '<small class="ap-q ap-q-p">Supérieur au reste du Québec</small>' : it.q === '-' ? '<small class="ap-q ap-q-p">Inférieur au reste du Québec</small>' : it.q === 'ns' ? '<small class="ap-q">Comparable au reste du Québec</small>' : '';
            var cv = it.cv === '**' ? '<small class="ap-q">Valeur du Granit très imprécise, à titre indicatif</small>' : it.cv === '*' ? '<small class="ap-q">Valeur du Granit à interpréter avec prudence</small>' : '';
            return '<div class="ap-it"><div class="ap-it-l">' + esc(it.l) + comp + cv + '</div><div>' + it.v.map(function (v, i) {
              return '<div class="ap-b' + (i === 0 ? ' g' : '') + '" title="' + esc(J.territoires[i]) + '"><div class="ap-b-f"><i style="width:' + (v / max * 100).toFixed(1) + '%;background:' + coul[i] + '"></i></div><div class="ap-b-v">' + String(v.toFixed(1)).replace('.', ',') + ' %</div></div>';
            }).join('') + '</div></div>';
          }).join('') + '</div>';
        }).join('') +
        '<div class="ap-src">' + esc(J.verif || '') + ' Comparaison au reste du Québec au seuil de 5 %. Source. ' + source(J.src) + (J.via ? '; ' + source(J.via) : '') + '.</div></div>';
    }
    h += '<div class="card" style="margin-bottom:18px"><div class="ct">Trois situations du Granit</div><div class="ap-ex">' +
      I.exemples.map(function (x) { return '<div><b>' + esc(x.titre) + '</b>' + esc(x.texte) + '</div>'; }).join('') +
      '</div><div class="ap-src">Source. ' + source('table017') + '.</div></div>';
    h += '<div class="card"><div class="ct">Ce que la plateforme ne montre pas encore ' + prov('todo') + '</div><div class="rv-p" style="margin:0">' + esc(I.manque) + '</div></div>';
    el.innerHTML = h;
  }

  /* ── Instances et frontières ouvertes (vue Instances et leviers) ── */
  function rendreInstances() {
    var d = S.d, el = document.getElementById('apInstances'), an = document.getElementById('apAncrage'); if (!d) return;
    var I = d.instances, st = d.statuts || [];
    if (el && I) {
      el.innerHTML = '<div class="card" style="margin-bottom:22px"><div class="ct">Instances où ces enjeux se discutent ' + prov('reel') + '</div>' +
        '<div class="rv-p">' + esc(I.note) + '</div><div class="ap-wrap"><table class="ap-tab"><thead><tr><th>Instance</th>' +
        st.map(function (s) { return '<th class="ap-c">' + esc(s) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        I.liste.map(function (x) {
          return '<tr><td><b>' + esc(x.nom) + '</b><small>' + esc(x.mandat) + (x.precision ? ' ' + esc(x.precision) : '') + '</small></td>' +
            st.map(function (s) {
              var o = x.statuts.indexOf(s) > -1;
              return '<td class="ap-c"><span class="' + (o ? 'ap-oui' : 'ap-non') + '" role="img" aria-label="' + (o ? 'Présent' : 'Absent') + '"></span></td>';
            }).join('') + '</tr>';
        }).join('') + '</tbody></table></div><div class="ap-src">Source. ' + source(I.src) + '.</div></div>';
    }
    var A = d.ancrage;
    if (an && A) {
      an.innerHTML = '<div class="card" style="margin-top:22px"><div class="ct">' + esc(A.titre) + '</div><div class="rv-p">' + esc(A.note) + '</div><div class="ap-anc">' +
        A.items.map(function (x) { return '<div class="ap-anc-i">' + esc(x.texte) + ' ' + prov(x.prov) + '<small>' + esc(x.src) + '</small></div>'; }).join('') + '</div></div>';
    }
  }

  /* ── Données et gouvernance ── */
  function rendreDonnees() {
    var d = S.d, el = document.getElementById('apDonnees'); if (!d || !el) return;
    var G = d.donnees, jeux = G.jeux || [];
    var auto = jeux.filter(function (x) { return /^Automatique/.test(x.mode); }).length;
    var sans = jeux.filter(function (x) { return !x.conditions; }).length;
    var ss = window.ss;
    el.innerHTML = '<div class="ap-cadre">' + esc(G.note) + '</div>' +
      '<div class="ss-row">' + ss(jeux.length, 'Jeux de données') + ss(auto, 'Mis à jour automatiquement') +
      ss(jeux.length - auto, 'Saisis ou versés à la main') + ss(sans, 'Conditions de partage à documenter') + '</div>' +
      '<div class="card" style="margin-bottom:18px"><div class="ct">Principes en vigueur</div><ul class="ap-li">' +
      (G.principes || []).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="card"><div class="ct">Jeux de données de la plateforme</div><div class="ap-wrap"><table class="ap-tab"><thead><tr>' +
      '<th>Jeu de données</th><th>Fournisseur</th><th>Arrivée sur la plateforme</th><th>Conditions de réutilisation ou de partage</th></tr></thead><tbody>' +
      jeux.map(function (x) {
        return '<tr><td><b>' + esc(x.nom) + '</b><small>Vues : ' + esc(x.vues) + '</small></td><td>' + esc(x.fournisseur) + '</td>' +
          '<td>' + esc(x.mode) + '<small>' + esc(x.frequence) + '</small></td>' +
          '<td>' + (x.conditions ? esc(x.conditions) : '<span class="prov prov-todo" style="margin-left:0">À documenter</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  window.GranitApprenant = { charger: charger, donnees: function () { return S.d; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monter); else monter();
})();
