/* granit-mada.js - Vue « Constats du milieu » (groupe Milieu de vie), sa lecture par déterminant de la santé (pilier Santé),
   rappel terrain sur les fiches des déterminants et notes terrain de la vue Logements et garderies.
   Lit data/mada/constats.json, tenu à la main : ce sont des constats d'entrevue agrégés par axe MADA, sans nom de
   personne ni propos attribué. Le chiffrier trimestriel et les flux GitHub Actions n'y touchent pas.
   Sans le fichier, la vue affiche un message et les notes n'apparaissent pas. */
(function () {
  'use strict';
  var URL_DATA = './data/mada/constats.json';
  var S = { d: null, err: null, axe: 'tous', type: 'tous', det: 'tous' };
  var attente = null;
  var ORDRE = { enjeu: 0, divergence: 1, atout: 2, piste: 3 };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function terrain() { return '<span class="prov prov-terrain">Terrain</span>'; }

  function charger() {
    if (S.d) return Promise.resolve(S.d);
    if (attente) return attente;
    attente = fetch(URL_DATA + '?t=' + Date.now()).then(function (r) {
      if (!r.ok) throw new Error('fichier introuvable (' + r.status + ')');
      return r.json();
    }).then(function (d) { S.d = d; return d; }).catch(function (e) { S.err = e; attente = null; throw e; });
    return attente;
  }

  /* ── Insertion dans la page ── */
  function monter() {
    if (document.getElementById('view-eco-mada')) return;
    var css = document.createElement('style');
    css.textContent =
      '.prov-terrain{background:#f5f3ff;color:#5b21b6;border-color:#ddd6fe}' +
      '.prov-terrain::before{border-radius:1px;transform:rotate(45deg)}' +
      '.md-lect{background:#f5f3ff;border:1px solid #ddd6fe;border-radius:var(--r2);padding:13px 16px;font-size:14px;line-height:1.6;color:#3b1d82;margin-bottom:18px;max-width:1040px}' +
      '.md-top{display:grid;gap:9px}' +
      '.md-top-r{display:grid;grid-template-columns:minmax(0,1fr) 190px 74px;gap:14px;align-items:center;font-size:14px;line-height:1.45;color:var(--text2)}' +
      '.md-top-r small{display:block;font-size:12.5px;color:var(--muted)}' +
      '.md-bar{height:10px;border-radius:5px;background:var(--border2);overflow:hidden}' +
      '.md-bar i{display:block;height:100%;border-radius:5px;background:var(--pillar-color)}' +
      '.md-n{font-weight:700;color:var(--text);white-space:nowrap;font-variant-numeric:tabular-nums;font-size:14px}' +
      '.md-filtres{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 10px}' +
      '.md-filtres .md-fl{font-size:13px;color:var(--muted);font-weight:600;align-self:center;margin-right:3px;min-width:44px}' +
      '.md-axes{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0 20px}' +
      '.md-axe .ct{margin-bottom:3px}' +
      '.md-axe-s{font-size:13px;color:var(--muted);margin-bottom:12px}' +
      '.md-c{display:grid;grid-template-columns:86px minmax(0,1fr);gap:12px;padding:10px 0;border-top:1px solid var(--border2);font-size:14px;line-height:1.5;color:var(--text2)}' +
      '.md-c:first-of-type{border-top:none}' +
      '.md-pts{display:grid;grid-template-columns:repeat(5,9px);gap:3px;margin-top:5px}' +
      '.md-pts i{width:9px;height:9px;border-radius:2px;background:var(--border)}' +
      '.md-pts i.on{background:var(--pillar-color)}' +
      '.md-t{display:inline-block;font-size:12px;font-weight:600;padding:1px 8px;border-radius:10px;margin-right:7px;white-space:nowrap;border:1px solid transparent}' +
      '.md-t-enjeu{background:var(--am100);color:var(--am700);border-color:#f3d88a}' +
      '.md-t-atout{background:var(--v100);color:var(--v800);border-color:var(--v300)}' +
      '.md-t-piste{background:var(--g100);color:var(--g700);border-color:var(--g300)}' +
      '.md-t-divergence{background:var(--white);color:var(--muted);border:1px dashed var(--muted2)}' +
      '.md-chf{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:11px}' +
      '.md-chf-b{border:1px solid var(--border);border-left:3px solid #7c3aed;border-radius:10px;padding:13px 15px;background:var(--white)}' +
      '.md-chf-v{font-size:21px;font-weight:700;color:var(--text);font-family:\'Fraunces\',serif;line-height:1.15}' +
      '.md-chf-l{font-size:13.5px;color:var(--text2);margin-top:4px;line-height:1.45}' +
      '.md-org{columns:2;column-gap:28px;margin:0;padding-left:18px;font-size:14px;line-height:1.75;color:var(--text2)}' +
      '.md-vide{font-size:14px;color:var(--muted);padding:6px 0}' +
      '.md-note{background:#faf8ff;border:1px solid #ddd6fe;border-left:3px solid #7c3aed;border-radius:var(--r2);padding:13px 16px;margin:0 0 18px;font-size:14px;line-height:1.6;color:var(--text2)}' +
      '.md-note-t{font-weight:700;color:var(--text);margin-bottom:5px;display:flex;flex-wrap:wrap;align-items:center;gap:4px}' +
      '.md-note ul{margin:0;padding-left:18px}' +
      '.md-note-l{background:none;border:none;padding:0;margin-top:7px;font:inherit;font-weight:600;color:#5b21b6;cursor:pointer;text-decoration:underline}' +
      '#lgAttente .md-note{margin:14px 0 0}' +
      '.md-det-h{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:3px}' +
      '.md-det-h .ct{margin:0}' +
      '.md-det-sc{font-size:12.5px;font-weight:600;color:var(--muted);border:1px solid var(--border);border-radius:10px;padding:1px 9px;white-space:nowrap}' +
      '.md-ax{display:block;font-size:12.5px;color:var(--muted);margin-top:2px}' +
      '.md-det-t{margin-top:9px;padding:9px 10px;border:1px solid #ddd6fe;border-radius:var(--r2);background:#faf8ff;font-size:13px;line-height:1.5;color:var(--text2)}' +
      '.md-det-t b{display:block;font-weight:700;color:var(--text);margin-bottom:2px}' +
      '.md-det-t .md-note-l{margin-top:5px;font-size:13px}' +
      '@media(max-width:1000px){.md-axes{grid-template-columns:1fr}.md-top-r{grid-template-columns:minmax(0,1fr) 74px}.md-top-r .md-bar{display:none}.md-org{columns:1}}';
    document.head.appendChild(css);

    var view = document.createElement('div');
    view.className = 'view'; view.id = 'view-eco-mada';
    view.innerHTML =
      '<div class="section-header"><div class="sh-left"><h2>Constats du milieu</h2>' +
      '<p>Ce que les organismes du territoire observent, par axe de la démarche MADA</p></div>' +
      '<span class="pillar-badge pb-eco">Économie</span></div>' +
      '<div id="mdBody"><div class="card" style="color:var(--muted);font-size:14.5px">Chargement des constats...</div></div>';
    var apres = document.getElementById('view-eco-housing');
    if (!apres) return;
    apres.parentNode.insertBefore(view, apres.nextSibling);

    /* Bouton de navigation : masqué comme les autres entrées de #sbnEco, il sert de repère à niOf() pour le groupe Milieu de vie. */
    var nav = document.getElementById('sbnEco');
    if (nav) {
      var ref = null;
      nav.querySelectorAll('.ni').forEach(function (b) { if ((b.getAttribute('onclick') || '').indexOf("'eco-housing'") > -1) ref = b; });
      var btn = document.createElement('button');
      btn.className = 'ni'; btn.id = 'mdNav';
      btn.setAttribute('onclick', "V('eco-mada',this)");
      btn.innerHTML = '<div class="ni-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 8h8M8 12h5"/></svg></div>Constats du milieu';
      if (ref) nav.insertBefore(btn, ref.nextSibling); else nav.appendChild(btn);
    }

    /* Pilier Santé : mêmes constats, classés par déterminant de la santé. */
    var portrait = document.getElementById('view-sa-portrait');
    if (portrait) {
      var vs = document.createElement('div');
      vs.className = 'view'; vs.id = 'view-sa-mada';
      vs.innerHTML =
        '<div class="section-header"><div class="sh-left"><h2>Constats du milieu et déterminants de la santé</h2>' +
        '<p>Ce que les organismes observent, mis en regard des déterminants du portrait territorial</p></div>' +
        '<span class="pillar-badge pb-sa">Santé</span></div>' +
        '<div id="mdBodySa"><div class="card" style="color:var(--muted);font-size:14.5px">Chargement des constats...</div></div>';
      portrait.parentNode.insertBefore(vs, portrait.nextSibling);
      var navSa = document.getElementById('sbnSa');
      if (navSa) {
        var refSa = null;
        navSa.querySelectorAll('.ni').forEach(function (b) { if ((b.getAttribute('onclick') || '').indexOf("'sa-portrait'") > -1) refSa = b; });
        var bs = document.createElement('button');
        bs.className = 'ni'; bs.id = 'mdNavSa';
        bs.setAttribute('onclick', "V('sa-mada',this)");
        bs.innerHTML = btn ? btn.innerHTML : 'Constats du milieu';
        if (refSa) navSa.insertBefore(bs, refSa.nextSibling); else navSa.appendChild(bs);
      }
    }

    var V0 = window.V;
    window.V = function (id, b) { V0(id, b); if (id === 'eco-mada') ouvrir(); if (id === 'sa-mada') ouvrirSante(); };

    /* Rappel terrain sur chaque fiche de déterminant du portrait. */
    var RS0 = window.renderSdohPortrait;
    if (typeof RS0 === 'function') window.renderSdohPortrait = function () { RS0.apply(this, arguments); rappelDeterminants(); };

    /* Notes terrain de la vue Logements et garderies : elles se rajoutent après chaque rendu de la vue. */
    var RH0 = window.renderHousing, RA0 = window.renderLgAttente;
    if (typeof RH0 === 'function') window.renderHousing = function () { RH0.apply(this, arguments); noteLogement(); };
    if (typeof RA0 === 'function') window.renderLgAttente = function () { RA0.apply(this, arguments); noteAttente(); };
    charger().then(function () { noteLogement(); noteAttente(); rappelDeterminants(); }).catch(function () {});
  }

  function ouvrir() {
    charger().then(rendre).catch(function (err) {
      var el = document.getElementById('mdBody'); if (!el) return;
      el.innerHTML = '<div class="card"><div class="ct">Constats non disponibles</div><div style="font-size:14.5px;color:var(--text2);line-height:1.6">' +
        'Le fichier <code>data/mada/constats.json</code> n\'a pas pu être lu (' + esc(err.message) + ').</div></div>';
    });
  }
  function aller() {
    var b = document.getElementById('mdNav');
    if (window.switchPillar && document.getElementById('sbnEco') && document.getElementById('sbnEco').style.display === 'none') {
      var pt = document.getElementById('pt-eco'); if (pt) window.switchPillar('eco', pt);
    }
    window.V('eco-mada', b);
    window.scrollTo(0, 0);
  }

  /* ── Rendu de la vue ── */
  function sur(n, tot) { return n + ' sur ' + tot; }
  function points(n, tot) {
    var h = '';
    for (var i = 0; i < tot; i++) h += '<i' + (i < n ? ' class="on"' : '') + '></i>';
    return '<div class="md-pts" aria-hidden="true">' + h + '</div>';
  }
  function trier(cs) {
    return cs.slice().sort(function (a, b) { return (ORDRE[a.t] - ORDRE[b.t]) || (b.n - a.n); });
  }
  function rendre() {
    var d = S.d, el = document.getElementById('mdBody'); if (!d || !el) return;
    var m = d.meta || {}, tot = m.organismesRencontres || 10, axes = d.axes || [], types = d.types || {};
    var nb = 0, enjeux = [];
    axes.forEach(function (a) {
      (a.constats || []).forEach(function (c) { nb++; if (c.t === 'enjeu') enjeux.push({ c: c, a: a }); });
    });
    enjeux.sort(function (x, y) { return y.c.n - x.c.n; });
    var seuil = enjeux.length >= 5 ? enjeux[4].c.n : 0;
    var top = enjeux.filter(function (x) { return x.c.n >= seuil; }).slice(0, 8);
    var tr = axes.filter(function (a) { return a.id === 'transport'; })[0];
    var ss = window.ss || function (v, l) { return '<div class="ss"><div class="ss-v">' + v + '</div><div class="ss-l">' + l + '</div></div>'; };

    var h = '<div class="md-lect">' + terrain().replace('class="prov', 'style="margin-left:0;margin-right:8px" class="prov') + esc(m.lecture || '') + '</div>';

    h += '<div class="ss-row">' +
      ss(tot, 'Organismes rencontrés') +
      ss(axes.length, 'Axes de la démarche MADA') +
      ss(nb, 'Constats retenus') +
      (tr ? ss(sur(tr.organismes, tot), 'Organismes qui nomment le transport') : '') +
      ss(esc(m.periode || ''), 'Période des rencontres') + '</div>';

    h += '<div class="card" style="margin-bottom:18px"><div class="ct">Les enjeux qui reviennent le plus ' + terrain() + '</div><div class="md-top">' +
      top.map(function (x) {
        return '<div class="md-top-r"><div>' + esc(x.c.texte) + '<small>' + x.a.no + '. ' + esc(x.a.nom) + '</small></div>' +
          '<div class="md-bar" aria-hidden="true"><i style="width:' + Math.round(x.c.n / tot * 100) + '%"></i></div>' +
          '<div class="md-n">' + sur(x.c.n, tot) + '</div></div>';
      }).join('') + '</div></div>';

    h += '<div class="md-filtres" role="group" aria-label="Filtrer par axe"><span class="md-fl">Axe</span>' +
      '<button class="ft' + (S.axe === 'tous' ? ' active' : '') + '" onclick="GranitMADA.filtre(\'axe\',\'tous\')">Tous</button>' +
      axes.map(function (a) { return '<button class="ft' + (S.axe === a.id ? ' active' : '') + '" onclick="GranitMADA.filtre(\'axe\',\'' + a.id + '\')">' + esc(a.nom) + '</button>'; }).join('') + '</div>';
    h += '<div class="md-filtres" role="group" aria-label="Filtrer par type de constat"><span class="md-fl">Type</span>' +
      '<button class="ft' + (S.type === 'tous' ? ' active' : '') + '" onclick="GranitMADA.filtre(\'type\',\'tous\')">Tous</button>' +
      Object.keys(types).map(function (k) { return '<button class="ft' + (S.type === k ? ' active' : '') + '" onclick="GranitMADA.filtre(\'type\',\'' + k + '\')">' + esc(types[k]) + '</button>'; }).join('') + '</div>';

    var cartes = axes.filter(function (a) { return S.axe === 'tous' || S.axe === a.id; }).map(function (a) {
      var cs = trier(a.constats || []).filter(function (c) { return S.type === 'tous' || S.type === c.t; });
      var corps = cs.length ? cs.map(function (c) {
        return '<div class="md-c"><div><div class="md-n">' + sur(c.n, tot) + '</div>' + points(c.n, tot) + '</div>' +
          '<div><span class="md-t md-t-' + esc(c.t) + '">' + esc(types[c.t] || c.t) + '</span>' + esc(c.texte) + '</div></div>';
      }).join('') : '<div class="md-vide">Aucun constat de ce type pour cet axe.</div>';
      return '<div class="card md-axe"><div class="ct">' + a.no + '. ' + esc(a.nom) + '</div>' +
        '<div class="md-axe-s">Axe abordé par ' + sur(a.organismes, tot) + ' organismes</div>' + corps + '</div>';
    }).join('');
    h += '<div class="md-axes"' + (S.axe !== 'tous' ? ' style="grid-template-columns:1fr"' : '') + '>' + cartes + '</div>';

    var ch = d.chiffres;
    if (ch && ch.items && ch.items.length) {
      h += '<div class="card" style="margin-bottom:18px"><div class="ct">Chiffres avancés en entrevue ' + terrain() + '</div>' +
        '<div class="rv-p">' + esc(ch.note || '') + '</div><div class="md-chf">' +
        ch.items.map(function (i) { return '<div class="md-chf-b"><div class="md-chf-v">' + esc(i.valeur) + '</div><div class="md-chf-l">' + esc(i.libelle) + '</div></div>'; }).join('') +
        '</div></div>';
    }

    h += '<div class="card"><div class="ct">Organismes rencontrés</div><ul class="md-org">' +
      (m.organismes || []).map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul>' +
      '<div class="rv-src" style="margin-top:12px">' + esc(m.source || '') + ' ' + esc(m.demarche || '') + '. ' + esc(m.aCompleter || '') +
      ' Les constats sont regroupés par axe; aucun propos n\'est attribué à un organisme.</div></div>';

    el.innerHTML = h;
  }

  /* ── Lecture par déterminant de la santé (pilier Santé) ── */
  function determinants() { return (window.D && window.D.sante && window.D.sante.determinants) || []; }
  function parDet() {
    var m = {};
    (S.d.axes || []).forEach(function (a) {
      (a.constats || []).forEach(function (c) {
        var k = c.det || a.det; if (!k) return;
        (m[k] = m[k] || []).push({ t: c.t, n: c.n, texte: c.texte, axe: a });
      });
    });
    return m;
  }
  function ouvrirSante() {
    charger().then(rendreSante).catch(function (err) {
      var el = document.getElementById('mdBodySa'); if (!el) return;
      el.innerHTML = '<div class="card"><div class="ct">Constats non disponibles</div><div style="font-size:14.5px;color:var(--text2);line-height:1.6">' +
        'Le fichier <code>data/mada/constats.json</code> n\'a pas pu être lu (' + esc(err.message) + ').</div></div>';
    });
  }
  function allerSante(det) {
    S.det = det || 'tous';
    if (window.switchPillar && document.getElementById('sbnSa') && document.getElementById('sbnSa').style.display === 'none') {
      var pt = document.getElementById('pt-sa'); if (pt) window.switchPillar('sa', pt);
    }
    window.V('sa-mada', document.getElementById('mdNavSa'));
    window.scrollTo(0, 0);
  }
  function rendreSante() {
    var d = S.d, el = document.getElementById('mdBodySa'); if (!d || !el) return;
    var m = d.meta || {}, tot = m.organismesRencontres || 10, types = d.types || {}, map = parDet();
    var dets = determinants().filter(function (x) { return map[x.id]; });
    var sans = determinants().filter(function (x) { return !map[x.id]; });
    var ss = window.ss;
    var h = '<div class="md-lect">' + terrain().replace('class="prov', 'style="margin-left:0;margin-right:8px" class="prov') + esc(m.lectureSante || m.lecture || '') + '</div>';

    h += '<div class="ss-row">' + dets.map(function (x) {
      var cs = map[x.id], e = cs.filter(function (c) { return c.t === 'enjeu'; }).length;
      return ss(e + ' sur ' + cs.length, 'Enjeux parmi les constats - ' + esc(x.name));
    }).join('') + '</div>';

    h += '<div class="md-filtres" role="group" aria-label="Filtrer par déterminant"><span class="md-fl" style="min-width:86px">Déterminant</span>' +
      '<button class="ft' + (S.det === 'tous' ? ' active' : '') + '" onclick="GranitMADA.filtre(\'det\',\'tous\')">Tous</button>' +
      dets.map(function (x) { return '<button class="ft' + (S.det === x.id ? ' active' : '') + '" onclick="GranitMADA.filtre(\'det\',\'' + x.id + '\')">' + esc(x.name) + '</button>'; }).join('') + '</div>';

    var cartes = dets.filter(function (x) { return S.det === 'tous' || S.det === x.id; }).map(function (x) {
      var cs = trier(map[x.id]);
      return '<div class="card md-axe"><div class="md-det-h"><div class="ct">' + esc(x.name) + '</div>' +
        '<span class="md-det-sc">Score ' + esc(x.score) + ' sur 100 - ' + esc(x.level) + '</span></div>' +
        '<div class="md-axe-s">' + cs.length + ' constat' + (cs.length > 1 ? 's' : '') + ' du milieu rattaché' + (cs.length > 1 ? 's' : '') + ' à ce déterminant</div>' +
        cs.map(function (c) {
          return '<div class="md-c"><div><div class="md-n">' + sur(c.n, tot) + '</div>' + points(c.n, tot) + '</div>' +
            '<div><span class="md-t md-t-' + esc(c.t) + '">' + esc(types[c.t] || c.t) + '</span>' + esc(c.texte) +
            '<span class="md-ax">Axe MADA ' + c.axe.no + ' - ' + esc(c.axe.nom) + '</span></div></div>';
        }).join('') + '</div>';
    }).join('');
    h += '<div class="md-axes"' + (S.det !== 'tous' ? ' style="grid-template-columns:1fr"' : '') + '>' + cartes + '</div>';

    h += '<div class="card"><div class="rv-src" style="margin-top:0">' +
      (sans.length ? 'Sans constat rattaché : ' + sans.map(function (x) { return esc(x.name); }).join(', ') + '. ' + esc(m.sansConstat || '') + ' ' : '') +
      esc(m.source || '') + ' ' + tot + ' organismes rencontrés; aucun propos n\'est attribué à un organisme.</div>' +
      '<button class="md-note-l" onclick="GranitMADA.aller()">Voir les constats par axe MADA, les chiffres avancés et la liste des organismes</button></div>';
    el.innerHTML = h;
  }
  function rappelDeterminants() {
    var grid = document.getElementById('sdohGrid'); if (!S.d || !grid) return;
    var map = parDet(), dets = determinants(), tot = (S.d.meta || {}).organismesRencontres || 10;
    var cards = grid.querySelectorAll('.det-card');
    dets.forEach(function (x, i) {
      var card = cards[i], cs = map[x.id]; if (!card || !cs || card.querySelector('.md-det-t')) return;
      var enj = cs.filter(function (c) { return c.t === 'enjeu'; }).sort(function (a, b) { return b.n - a.n; });
      var box = document.createElement('div'); box.className = 'md-det-t';
      box.innerHTML = '<b>Ce que dit le milieu ' + terrain() + '</b>' +
        (enj.length ? esc(enj[0].texte) + ' (' + sur(enj[0].n, tot) + ' organismes)' : esc(trier(cs)[0].texte)) +
        '<br><button class="md-note-l" onclick="GranitMADA.allerSante(\'' + x.id + '\')">' + (cs.length > 1 ? 'Voir les ' + cs.length + ' constats liés' : 'Voir le constat lié') + '</button>';
      card.appendChild(box);
    });
  }

  /* ── Notes terrain dans la vue Logements et garderies ── */
  function noteHtml(n) {
    if (!n) return '';
    return '<div class="md-note-t">' + esc(n.titre) + ' ' + terrain() + '</div><ul>' +
      (n.points || []).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' +
      '<button class="md-note-l" onclick="GranitMADA.aller()">Voir tous les constats du milieu</button>';
  }
  function noteLogement() {
    var n = S.d && S.d.notesVues && S.d.notesVues.logementSocial, cg = document.getElementById('lgCapGrid');
    if (!n || !cg) return;
    var box = document.getElementById('mdNoteLog');
    if (!box) { box = document.createElement('div'); box.id = 'mdNoteLog'; box.className = 'md-note'; cg.parentNode.insertBefore(box, cg.nextSibling); }
    box.innerHTML = noteHtml(n);
  }
  function noteAttente() {
    var n = S.d && S.d.notesVues && S.d.notesVues.attenteGarde, el = document.getElementById('lgAttente');
    if (!n || !el || el.style.display === 'none' || el.querySelector('.md-note')) return;
    var box = document.createElement('div'); box.className = 'md-note'; box.innerHTML = noteHtml(n);
    el.appendChild(box);
  }

  window.GranitMADA = {
    charger: charger,
    aller: aller,
    allerSante: allerSante,
    filtre: function (quoi, v) { S[quoi] = v; if (quoi === 'det') rendreSante(); else rendre(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monter); else monter();
})();
