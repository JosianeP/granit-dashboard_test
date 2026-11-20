/* granit-carte.js - Carte des 19 municipalités (v4.13)
   Porte d'entrée du tableau de bord : le territoire se voit avant de se lire.
   Lit data/carte/municipalites.geojson (produit par tools/carte_granit.py) et colore chaque municipalité
   selon l'indicateur choisi. Un clic ouvre le portrait de la municipalité. Sans le fichier, rien ne s'affiche. */
(function () {
  'use strict';
  var G = null, etat = {}, W = 760, H = 560, MARGE = 14;
  var RAMPE = ['#e3f3ea', '#b4dcc4', '#7cc09a', '#3f9566', '#14532d'];

  function fmt(n, d) { return Number(n).toLocaleString('fr-CA', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function muni(code) { return (window.D.municipalities || []).filter(function (m) { return m.code === code; })[0] || null; }
  function lg(nom) { var L = window.D.logements; return (L && L.parMuni || []).filter(function (x) { return x.muni === nom; })[0] || null; }
  function regPret() { return !!(window.GranitCroise && window.GranitCroise.pret && window.GranitCroise.pret()); }

  /* Indicateurs : v(m) rend la valeur ou null; d = décimales; u = unité; note = lecture en une ligne. */
  var INDIC = [
    { k: 'pop', l: 'Population', u: 'hab.', d: 0, v: function (m) { return m.pop; }, note: 'Décret de population 2026.' },
    { k: 'a65', l: 'Part des 65 ans et plus', u: '%', d: 0, v: function (m) { var g = m.demo && m.demo.agg; return g && g.tot ? g.a65 / g.tot * 100 : null; }, note: 'Estimations de l\'ISQ, 2025.' },
    { k: 'ent', l: 'Entreprises par 1 000 habitants', u: '', d: 0, besoin: 'reg',
      v: function (m) { var n = window.GranitCroise.compteMuni(m); return n != null && m.pop ? n / m.pop * 1000 : null; }, note: 'Entreprises actives au Registraire, rapportées à la population.' },
    { k: 'sec', l: 'Logements non occupés à l\'année', u: '%', d: 0,
      v: function (m) { var x = lg(m.name), o = x && x.logements; return o && o.prives && o.total != null ? (o.prives - o.total) / o.prives * 100 : null; },
      note: 'Chalets, résidences secondaires et logements vacants, en part des logements privés (Recensement de 2021).' },
    { k: 'loc', l: 'Ménages locataires', u: '%', d: 0,
      v: function (m) { var x = lg(m.name), o = x && x.logements; return o && o.real && o.total && o.locatifs != null ? o.locatifs / o.total * 100 : null; },
      note: 'Recensement de 2021, échantillon de 25 %.' },
    { k: 'gar', l: 'Places de garde en installation', u: 'places', d: 0,
      v: function (m) { var x = lg(m.name), o = x && x.garderies; return o && o.real ? (o.placesTotal || 0) : null; },
      note: 'CPE et garderies reconnus par le ministère de la Famille. Le milieu familial n\'est pas réparti par municipalité.' },
    { k: 'vul', l: 'Indice de vulnérabilité territoriale', u: '/ 100', d: 0, besoin: 'vul',
      v: function (m) { return window.computeVulnerability(m); }, note: 'Indice analytique fondé sur la ruralité, la densité et la distance. Ce n\'est pas un indice de défavorisation.' }
  ];
  function dispo() {
    return INDIC.filter(function (i) {
      if (i.besoin === 'reg' && !regPret()) return false;
      if (i.besoin === 'vul' && typeof window.computeVulnerability !== 'function') return false;
      return (window.D.municipalities || []).some(function (m) { try { return i.v(m) != null; } catch (e) { return false; } });
    });
  }

  /* ── Géométrie ── */
  function projeter() {
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    G.features.forEach(function (f) { f.geometry.coordinates.forEach(function (p) { p[0].forEach(function (c) { if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]; if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1]; }); }); });
    var k = Math.cos((y0 + y1) / 2 * Math.PI / 180), lw = (x1 - x0) * k, lh = y1 - y0;
    var s = Math.min((W - 2 * MARGE) / lw, (H - 2 * MARGE) / lh);
    var ox = (W - lw * s) / 2, oy = (H - lh * s) / 2;
    return function (c) { return [ox + (c[0] - x0) * k * s, oy + (y1 - c[1]) * s]; };
  }
  function chemin(geom, P) {
    return geom.coordinates.map(function (poly) {
      return poly.map(function (r) { return 'M' + r.map(function (c) { var p = P(c); return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L') + 'Z'; }).join('');
    }).join('');
  }
  /* Centre de gravité du plus grand polygone, pour poser le nom. */
  function centreDe(geom, P) {
    var best = null, bestA = 0;
    geom.coordinates.forEach(function (poly) {
      var r = poly[0].map(P), a = 0, cx = 0, cy = 0;
      for (var i = 0; i < r.length - 1; i++) { var f = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; a += f; cx += (r[i][0] + r[i + 1][0]) * f; cy += (r[i][1] + r[i + 1][1]) * f; }
      if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; }
    });
    return { p: best, aire: bestA / 2 };
  }
  function court(nom) {
    return nom.replace('Saint-Augustin-de-Woburn', 'Woburn').replace('Sainte-Cécile-de-Whitton', 'Sainte-Cécile').replace('Saint-Robert-Bellarmin', 'Saint-Robert')
      .replace('Notre-Dame-des-Bois', 'N.-D.-des-Bois').replace(/^Sainte-/, 'Ste-').replace(/^Saint-/, 'St-');
  }

  /* ── Classes de couleur : cinq classes d'effectifs égaux (quantiles) ── */
  function classes(vals) {
    var v = vals.filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; });
    var uniq = v.filter(function (x, i) { return i === 0 || x !== v[i - 1]; });
    var n = Math.min(RAMPE.length, uniq.length), bornes = [];
    for (var i = 1; i < n; i++) bornes.push(v[Math.min(v.length - 1, Math.round(i * v.length / n))]);
    bornes = bornes.filter(function (x, i) { return i === 0 || x !== bornes[i - 1]; });
    return { bornes: bornes, min: v[0], max: v[v.length - 1] };
  }
  function couleur(x, C) {
    if (x == null) return '#eef1f4';
    var i = 0; while (i < C.bornes.length && x >= C.bornes[i]) i++;
    var pas = C.bornes.length ? (RAMPE.length - 1) / C.bornes.length : 0;
    return RAMPE[Math.round(i * pas)];
  }

  /* ── Rendu ── */
  function styles() {
    if (document.getElementById('gcCss')) return;
    var c = document.createElement('style'); c.id = 'gcCss';
    c.textContent =
      '.gc{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(260px,1fr);gap:0;margin-bottom:18px;padding:0;overflow:hidden}' +
      '.gc-carte{position:relative;background:linear-gradient(180deg,#f6faf7,#eef5f0);padding:8px}' +
      '.gc-carte svg{display:block;width:100%;height:auto;max-height:560px}' +
      '.gc-m{stroke:#fff;stroke-width:1.4;cursor:pointer;transition:filter .12s,stroke .12s;outline:none}' +
      '.gc-m:hover,.gc-m:focus-visible,.gc-m.on{stroke:#0b2818;stroke-width:2.2;filter:brightness(1.04) drop-shadow(0 2px 5px rgba(11,40,24,.28))}' +
      '.gc-n{font:600 11px "DM Sans",system-ui,sans-serif;fill:#0b2818;text-anchor:middle;pointer-events:none;paint-order:stroke;stroke:rgba(255,255,255,.85);stroke-width:3px;stroke-linejoin:round}' +
      '.gc-n.inv{fill:#fff;stroke:rgba(11,40,24,.55)}' +
      '.gc-n.chef{font-size:12.5px;font-weight:700}' +
      '.gc-cote{padding:20px 22px;display:flex;flex-direction:column;gap:14px;border-left:1px solid var(--border);min-width:0}' +
      '.gc-t{font-family:"Fraunces",serif;font-size:20px;font-weight:600;color:var(--text);line-height:1.2;margin:0}' +
      '.gc-s{font-size:13.5px;color:var(--muted);line-height:1.5;margin:4px 0 0}' +
      '.gc-sel{font:inherit;font-size:14px;font-weight:600;padding:9px 11px;border:1px solid var(--border);border-radius:9px;background:var(--white);color:var(--text);width:100%}' +
      '.gc-leg{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted)}' +
      '.gc-leg-b{display:flex;flex:1;height:10px;border-radius:5px;overflow:hidden}.gc-leg-b i{flex:1}' +
      '.gc-fiche{border-top:1px solid var(--border);padding-top:14px;margin-top:auto}' +
      '.gc-fn{font-size:17px;font-weight:700;color:var(--text);margin:0 0 2px}' +
      '.gc-fv{font-family:"Fraunces",serif;font-size:30px;font-weight:600;color:var(--g700);line-height:1.1}' +
      '.gc-fl{font-size:13px;color:var(--muted)}' +
      '.gc-dl{display:grid;grid-template-columns:1fr auto;gap:5px 14px;font-size:13.5px;margin:12px 0 0}' +
      '.gc-dl dt{color:var(--muted)}.gc-dl dd{margin:0;font-weight:700;color:var(--text);text-align:right;font-variant-numeric:tabular-nums}' +
      '.gc-btn{margin-top:14px;width:100%;padding:10px 12px;border-radius:9px;border:none;background:var(--g700);color:#fff;font:inherit;font-size:14px;font-weight:700;cursor:pointer}' +
      '.gc-btn:hover{background:var(--g800)}' +
      '.gc-src{font-size:12px;color:var(--muted2);line-height:1.45}' +
      '@media(max-width:1000px){.gc{grid-template-columns:1fr}.gc-cote{border-left:none;border-top:1px solid var(--border)}}' +
      '@media print{.gc{display:none}}';
    document.head.appendChild(c);
  }
  function valeurs(ind) {
    var o = {};
    (window.D.municipalities || []).forEach(function (m) { try { o[m.code] = ind.v(m); } catch (e) { o[m.code] = null; } });
    return o;
  }
  function fiche(id, code) {
    var el = document.getElementById(id + 'Fiche'); if (!el) return;
    var ind = etat[id].ind, V = etat[id].vals;
    if (!code) {
      var ms = window.D.municipalities || [], pop = ms.reduce(function (a, m) { return a + (m.pop || 0); }, 0);
      el.innerHTML = '<p class="gc-fn">MRC du Granit</p><div class="gc-fl">' + ms.length + ' municipalités - ' + fmt(pop) + ' habitants</div>' +
        '<p class="gc-s" style="margin-top:10px">Survolez une municipalité pour voir ses chiffres. Cliquez pour ouvrir son portrait.</p>' +
        '<button class="gc-btn" onclick="openDemoModal(MRC_CODE)">Ouvrir le portrait de la MRC</button>';
      return;
    }
    var m = muni(code); if (!m) return;
    var v = V[code], x = lg(m.name), o = x && x.logements, g = x && x.garderies, d = m.demo && m.demo.agg;
    var lignes = [['Population', fmt(m.pop) + ' hab.'], ['Superficie', fmt(m.surface, 1) + ' km²']];
    if (d && d.tot) lignes.push(['65 ans et plus', fmt(d.a65 / d.tot * 100) + ' %']);
    if (regPret()) { var n = window.GranitCroise.compteMuni(m); if (n != null) lignes.push(['Entreprises actives', fmt(n)]); }
    if (o && o.total != null) lignes.push(['Logements habités à l\'année', fmt(o.total)]);
    if (g && g.real) lignes.push(['Places de garde en installation', fmt(g.placesTotal || 0)]);
    el.innerHTML = '<p class="gc-fn">' + esc(m.name) + '</p>' +
      '<div class="gc-fv">' + (v == null ? '-' : fmt(v, ind.d) + (ind.u ? ' <span style="font-size:15px;font-family:\'DM Sans\',sans-serif;font-weight:600;color:var(--muted)">' + esc(ind.u) + '</span>' : '')) + '</div>' +
      '<div class="gc-fl">' + esc(ind.l) + '</div>' +
      '<dl class="gc-dl">' + lignes.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' +
      '<button class="gc-btn" onclick="openDemoModal(\'' + code + '\')">Ouvrir le portrait de ' + esc(m.name) + '</button>';
  }
  function dessiner(id) {
    var hote = document.getElementById(id); if (!hote || !G || !window.D || !window.D.municipalities) return;
    var liste = dispo(); if (!liste.length) return;
    var e = etat[id] = etat[id] || { k: 'pop', sel: '' };
    var ind = liste.filter(function (i) { return i.k === e.k; })[0] || liste[0];
    e.ind = ind; e.k = ind.k; e.vals = valeurs(ind);
    var C = classes(Object.keys(e.vals).map(function (k) { return e.vals[k]; })), P = projeter();
    var formes = '', noms = '';
    G.features.forEach(function (f) {
      var c = f.properties.code, v = e.vals[c], col = couleur(v, C), ctr = centreDe(f.geometry, P), m = muni(c);
      formes += '<path class="gc-m' + (e.sel === c ? ' on' : '') + '" data-c="' + c + '" d="' + chemin(f.geometry, P) + '" fill="' + col + '" tabindex="0" role="button" aria-label="' +
        esc(f.properties.nom + (v == null ? '' : ', ' + fmt(v, ind.d) + ' ' + ind.u)) + '"><title>' + esc(f.properties.nom) + '</title></path>';
      if (ctr.p) {
        var sombre = col === RAMPE[3] || col === RAMPE[4], chef = m && /chef-lieu/i.test(m.role || '');
        noms += '<text class="gc-n' + (sombre ? ' inv' : '') + (chef ? ' chef' : '') + '" x="' + ctr.p[0].toFixed(1) + '" y="' + (ctr.p[1] + 4).toFixed(1) + '">' + esc(ctr.aire < 2600 ? court(f.properties.nom) : f.properties.nom.length > 16 ? court(f.properties.nom) : f.properties.nom) + '</text>';
      }
    });
    hote.className = 'card gc';
    hote.innerHTML =
      '<div class="gc-carte"><svg viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Carte des municipalités de la MRC du Granit">' + formes + noms + '</svg></div>' +
      '<div class="gc-cote"><div><h3 class="gc-t">Le territoire en un coup d\'œil</h3><p class="gc-s">' + esc(ind.note) + '</p></div>' +
      '<select class="gc-sel" aria-label="Indicateur affiché sur la carte" onchange="GranitCarte.indicateur(\'' + id + '\',this.value)">' +
      liste.map(function (i) { return '<option value="' + i.k + '"' + (i.k === ind.k ? ' selected' : '') + '>' + esc(i.l) + '</option>'; }).join('') + '</select>' +
      '<div class="gc-leg"><span>' + fmt(C.min, ind.d) + '</span><span class="gc-leg-b">' + RAMPE.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</span><span>' + fmt(C.max, ind.d) + (ind.u ? ' ' + esc(ind.u) : '') + '</span></div>' +
      '<div class="gc-fiche" id="' + id + 'Fiche"></div>' +
      '<div class="gc-src">' + esc(G._source || '') + '</div></div>';
    fiche(id, e.sel);
    var svg = hote.querySelector('svg');
    function code(t) { return t && t.getAttribute ? t.getAttribute('data-c') : null; }
    svg.addEventListener('mouseover', function (ev) { var c = code(ev.target); if (c) fiche(id, c); });
    svg.addEventListener('focusin', function (ev) { var c = code(ev.target); if (c) fiche(id, c); });
    svg.addEventListener('mouseleave', function () { fiche(id, e.sel); });
    svg.addEventListener('click', function (ev) { var c = code(ev.target); if (c) { e.sel = c; window.openDemoModal(c); } });
    svg.addEventListener('keydown', function (ev) { var c = code(ev.target); if (c && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); window.openDemoModal(c); } });
  }
  function rendre() { try { styles(); ['gcApercu', 'gcMuni'].forEach(dessiner); } catch (e) { if (window.console) console.warn('granit-carte', e); } }
  function demarrer() {
    if (!window.D || !window.D.municipalities) { setTimeout(demarrer, 150); return; }
    fetch('./data/carte/municipalites.geojson?t=' + Date.now()).then(function (r) { return r.ok ? r.json() : null; }).then(function (g) {
      if (!g || !g.features || !g.features.length) return;
      G = g; rendre();
    }).catch(function () {});
  }
  window.GranitCarte = {
    rendre: rendre,
    indicateur: function (id, k) { if (etat[id]) { etat[id].k = k; dessiner(id); } }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
