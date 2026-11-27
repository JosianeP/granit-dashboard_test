/* ═══════════════════════════════════════════════════════════════════════════
   granit-reperes.js - Chiffres de synthèse sans boîtes (v4.22)

   Les rangées de tuiles (une boîte par chiffre) sont remplacées, partout, par deux formes de lecture :
     1. une phrase qui dit le résultat en langage courant, les chiffres dans le texte, là où un gabarit
        de phrase existe pour la rangée (voir PHRASES);
     2. une liste de repères à points de conduite (libellé ..... valeur), sans cadre ni fond, pour le reste.
   La feuille de style s'applique à toutes les familles de tuiles (.ss, .kpi, .tr-cap, .lg-cap, .cl-cap) :
   une rangée ajoutée plus tard prend donc cette forme d'elle-même. Les phrases lisent les valeurs déjà
   affichées par la plateforme; ce module ne contient aucune donnée.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var RANGEES = '.ss-row,.kpi-grid,.tr-cap-grid,.lg-cap-grid,.cl-cap-grid';
  var B = 'body ';

  /* ─── 1. mise en forme : plus de boîtes ─── */
  var css = document.createElement('style');
  css.textContent = [
    /* la rangée devient une liste sur deux ou trois colonnes de texte */
    B + '.ss-row,' + B + '.kpi-grid,' + B + '.tr-cap-grid,' + B + '.lg-cap-grid,' + B + '.cl-cap-grid{display:block;columns:300px 3;column-gap:46px;margin:0 0 26px;padding:10px 0 2px;border-top:1px solid var(--border);max-width:1180px}',
    B + '.ss,' + B + '.kpi,' + B + '.tr-cap,' + B + '.lg-cap,' + B + '.cl-cap{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 8px;break-inside:avoid;background:none;border:0;border-radius:0;box-shadow:none;padding:5px 0;margin:0;text-align:left;transform:none;overflow:visible;position:static}',
    B + '.ss:hover,' + B + '.kpi:hover{box-shadow:none;transform:none}',
    B + '.kpi::after{display:none}',
    /* points de conduite entre le libellé et la valeur */
    B + '.ss::before,' + B + '.kpi::before,' + B + '.tr-cap::before,' + B + '.lg-cap::before,' + B + '.cl-cap::before{content:"";order:2;flex:1 1 18px;min-width:18px;border-bottom:1px dotted #b6c2bc;transform:translateY(-4px)}',
    B + '.ss-l,' + B + '.kpi-l,' + B + '.tr-cap-l,' + B + '.lg-cap-l,' + B + '.cl-cap-l{order:1;margin:0;font-size:14px;font-weight:500;line-height:1.35;color:var(--text2);text-transform:none;letter-spacing:0;max-width:72%}',
    B + '.ss-v,' + B + '.kpi-v,' + B + '.tr-cap-v,' + B + '.lg-cap-v,' + B + '.cl-cap-v{order:3;margin:0;font-family:"Fraunces",serif;font-size:17px;font-weight:700;line-height:1.2;color:var(--pillar-color);letter-spacing:-.01em;white-space:nowrap}',
    /* précisions sous le libellé : unité, source, variation */
    B + '.kpi-u,' + B + '.tr-cap-s,' + B + '.lg-cap-s,' + B + '.cl-cap-s{order:4;flex:0 0 100%;margin:0;font-size:12.5px;line-height:1.4;color:var(--muted)}',
    B + '.kpi-d{order:5;flex:0 0 100%;margin:1px 0 0;padding:0;background:none;border-radius:0;font-size:12.5px;font-weight:600}',
    B + '.kpi-l .prov,' + B + '.ss-l .prov{margin-left:7px}',
    /* phrase de synthèse */
    '.rp-phrase{max-width:820px;margin:0 0 14px;font-size:17.5px;line-height:1.6;color:var(--text)}',
    '.rp-phrase .rp-n{font-family:"Fraunces",serif;font-weight:700;color:var(--pillar-color);white-space:nowrap}',
    '.rp-unites{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:0 0 18px;max-width:820px}',
    '.rp-u{width:15px;height:15px;border-radius:3px;background:var(--pillar-color)}',
    '.rp-u.b{opacity:.55}.rp-u.c{opacity:.26}',
    '.rp-leg{font-size:13px;color:var(--muted);margin-left:10px}',
    '.rp-cle{display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--pillar-color);margin:0 4px 0 10px;vertical-align:-1px}',
    '.rp-cle.b{opacity:.55}.rp-cle.c{opacity:.26}',
    '.rp-pris{display:none!important}',
    '@media(max-width:700px){.rp-phrase{font-size:16px}}',
    '@media print{.rp-phrase{font-size:12px}' + B + '.ss-v,' + B + '.kpi-v,' + B + '.tr-cap-v,' + B + '.lg-cap-v,' + B + '.cl-cap-v{font-size:12px}' + B + '.ss-l,' + B + '.kpi-l,' + B + '.tr-cap-l,' + B + '.lg-cap-l,' + B + '.cl-cap-l{font-size:10.5px}}'
  ].join('');
  document.head.appendChild(css);

  /* ─── 2. phrases de synthèse ─── */
  function n(t) { return '<span class="rp-n">' + t + '</span>'; }
  function entier(t) { var x = parseInt(String(t).replace(/[^\d]/g, ''), 10); return isNaN(x) ? null : x; }
  function accord(k, un, plusieurs) { return k === 1 ? un : n(k) + ' ' + plusieurs; }

  /* Chaque gabarit reçoit lire(motif) qui renvoie le texte de la valeur dont le libellé correspond, ou null.
     Il rend le HTML de la phrase, ou null si un chiffre manque : la liste de repères reste alors complète. */
  var PHRASES = {
    muniStats: function (lire) {
      var pop = lire(/^Pop/), u = entier(lire(/^Urbain/)), r = entier(lire(/^Rural$/)), e = entier(lire(/éloigné/)), sup = lire(/^Superficie/);
      if (!pop || u == null || r == null || e == null) return null;
      var tot = u + r + e, cases = '';
      [[u, ''], [r, ' b'], [e, ' c']].forEach(function (g) { for (var i = 0; i < g[0]; i++) cases += '<span class="rp-u' + g[1] + '"></span>'; });
      return '<p class="rp-phrase">' + n(pop) + ' personnes vivent dans ' + n(tot) + ' municipalités' + (sup ? ', sur ' + n(sup) : '') + '. ' +
        accord(u, 'Une seule est urbaine', 'sont urbaines') + ', ' + accord(r, 'une est rurale', 'sont rurales') + ' et ' + accord(e, 'une est rurale éloignée', 'sont rurales éloignées') + '.</p>' +
        '<div class="rp-unites" role="img" aria-label="' + tot + ' municipalités : ' + u + ' urbaine, ' + r + ' rurales, ' + e + ' rurales éloignées">' + cases +
        '<span class="rp-leg">Un carré par municipalité<span class="rp-cle"></span>urbaine<span class="rp-cle b"></span>rurale<span class="rp-cle c"></span>rurale éloignée</span></div>';
    },
    statsStrip: function (lire) {
      var pop = lire(/^Population/), mun = lire(/^Municipalités$/), sup = lire(/^Superficie terrestre/), a65 = lire(/^65 ans/), fr = lire(/^Faible revenu/);
      if (!pop || !mun || !sup) return null;
      var s = 'La MRC du Granit compte ' + n(pop) + ' habitants dans ' + n(mun) + ' municipalités, sur ' + n(sup) + ' de superficie terrestre.';
      if (a65 && fr) s += ' Les 65 ans et plus forment ' + n(a65) + ' de la population et ' + n(fr) + ' des familles vivent avec un faible revenu.';
      return '<p class="rp-phrase">' + s + '</p>';
    }
  };

  function traiter(row) {
    var f = PHRASES[row.id]; if (!f) return;
    var tuiles = Array.prototype.slice.call(row.children).filter(function (t) { return t.nodeType === 1; }), pris = [];
    function lire(motif) {
      for (var i = 0; i < tuiles.length; i++) {
        var l = tuiles[i].querySelector('.ss-l,.kpi-l,.tr-cap-l,.lg-cap-l,.cl-cap-l'), v = tuiles[i].querySelector('.ss-v,.kpi-v,.tr-cap-v,.lg-cap-v,.cl-cap-v');
        if (l && v && motif.test(l.textContent.trim())) { var t = v.textContent.trim(); if (!t || t === '—') return null; pris.push(tuiles[i]); return t; }
      }
      return null;
    }
    var html = null; try { html = f(lire); } catch (e) { html = null; }
    var hote = row.previousElementSibling && row.previousElementSibling.classList.contains('rp-hote') ? row.previousElementSibling : null;
    if (!html) { if (hote) hote.parentNode.removeChild(hote); return; }
    if (!hote) { hote = document.createElement('div'); hote.className = 'rp-hote'; row.parentNode.insertBefore(hote, row); }
    if (hote.innerHTML !== html) hote.innerHTML = html;
    /* un chiffre dit dans la phrase n'est pas répété dans la liste */
    pris.forEach(function (t) { t.classList.add('rp-pris'); });
  }

  /* La plateforme réécrit ses rangées à chaque rendu : la phrase suit, sans intervention. */
  function suivre(row) {
    if (row._rp || !PHRASES[row.id]) return; row._rp = true;
    traiter(row);
    new MutationObserver(function () { traiter(row); }).observe(row, { childList: true });
  }
  function monter() {
    Array.prototype.forEach.call(document.querySelectorAll(RANGEES), suivre);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (x) { if (x.nodeType !== 1) return; if (x.matches && x.matches(RANGEES)) suivre(x); Array.prototype.forEach.call(x.querySelectorAll ? x.querySelectorAll(RANGEES) : [], suivre); }); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monter); else monter();

  window.GranitReperes = { phrases: PHRASES };
})();
