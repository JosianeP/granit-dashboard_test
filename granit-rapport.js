/* ═══════════════════════════════════════════════════════════════════════════
   granit-rapport.js - Rapport imprimable bâti à partir des vues elles-mêmes (v4.21)

   Avant : le rapport reposait sur une liste fixe de 14 sections et sur un gabarit écrit à la main pour
   chacune. Toute vue ajoutée ensuite (tourisme, logements, plan climat, registre, constats du milieu,
   territoire apprenant, etc.) en était absente, et le contenu pouvait s'écarter de l'écran.

   Maintenant : la liste des sections est lue dans la page au moment d'ouvrir le rapport, et chaque section
   est une copie de la vue telle qu'elle s'affiche à cet instant (données, filtres et graphiques compris).
   Une vue ajoutée à la plateforme entre donc d'elle-même dans le rapport, et une donnée modifiée y paraît
   aussitôt. Ce module ne contient aucune donnée ni aucun texte de section.

   Chargé en dernier. Remplace openReportBuilder et generateReport; réutilise reportHeaderHtml, rBlock, rSrc.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var PILIERS = ['eco', 'am', 'sa'];
  var enCours = false;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function attendre(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ─── sections présentes dans la page, dans l'ordre du menu puis de la page ─── */
  function libelleMenu() {
    var m = {};
    Array.prototype.forEach.call(document.querySelectorAll('[onclick]'), function (b) {
      var x = /\bV\('([a-z0-9-]+)'/.exec(b.getAttribute('onclick') || ''); if (!x || m[x[1]]) return;
      var t = (b.textContent || '').replace(/\s+/g, ' ').trim(); if (t) m[x[1]] = t;
    });
    return m;
  }
  function sections() {
    var menu = libelleMenu(), ordre = Object.keys(menu), liste = [];
    Array.prototype.forEach.call(document.querySelectorAll('.view[id^="view-"]'), function (v) {
      var id = v.id.slice(5), p = id.split('-')[0]; if (PILIERS.indexOf(p) < 0) return;
      var h = v.querySelector('.section-header h2');
      var label = (h && h.textContent.replace(/\s+/g, ' ').trim()) || menu[id] || id;
      liste.push({ id: id, pillar: p, label: label, rang: ordre.indexOf(id) });
    });
    /* Les vues du menu d'abord, dans son ordre; les sous-vues (onglets) restent à leur place dans la page. */
    var pos = {}; liste.forEach(function (s, i) { pos[s.id] = i; });
    liste.sort(function (a, b) { return PILIERS.indexOf(a.pillar) - PILIERS.indexOf(b.pillar) || ((a.rang < 0 || b.rang < 0) ? pos[a.id] - pos[b.id] : a.rang - b.rang); });
    return liste;
  }
  /* La liste d'origine est remise à jour sur place : tout code qui la lit voit les sections réelles. */
  function synchroniser() {
    var L = sections();
    if (Array.isArray(window.REPORT_SECTIONS)) { window.REPORT_SECTIONS.length = 0; L.forEach(function (s) { window.REPORT_SECTIONS.push({ id: s.id, pillar: s.pillar, label: s.label }); }); }
    return L;
  }

  var ouvrir0 = window.openReportBuilder;
  window.openReportBuilder = function () { synchroniser(); if (typeof ouvrir0 === 'function') ouvrir0.apply(this, arguments); };

  /* ─── copie d'une vue telle qu'affichée ─── */
  function stable(el) {
    /* Attend que la vue ait fini de se dessiner : plus de message de chargement et contenu inchangé deux fois de suite. */
    var avant = -1, calme = 0, essais = 0;
    function tour() {
      var t = el.innerHTML.length, charge = /Chargement/.test(el.textContent || '');
      if (!charge && t === avant) calme++; else calme = 0;
      avant = t; essais++;
      if (calme >= 2 || essais > 28) return Promise.resolve();
      return attendre(110).then(tour);
    }
    return attendre(180).then(tour);
  }
  function copier(el, opt) {
    var c = el.cloneNode(true);
    /* graphiques : chaque canevas devient une image, sinon il s'imprime vide */
    var src = el.querySelectorAll('canvas'), dst = c.querySelectorAll('canvas');
    Array.prototype.forEach.call(dst, function (cv, i) {
      var o = src[i], img = null;
      if (opt.incCharts && o && o.width && o.height) { try { img = document.createElement('img'); img.src = o.toDataURL('image/png'); img.className = 'rpt-snap'; img.alt = 'Graphique'; var w = o.clientWidth; if (w) img.style.width = w + 'px'; } catch (e) { img = null; } }
      if (img) cv.parentNode.replaceChild(img, cv); else cv.parentNode.removeChild(cv);
    });
    if (!opt.incCharts) Array.prototype.forEach.call(c.querySelectorAll('.chart-wrap,.chart-box'), function (n) { if (!n.querySelector('table')) n.parentNode && n.parentNode.removeChild(n); });
    /* éléments d'écran sans objet sur papier */
    Array.prototype.forEach.call(c.querySelectorAll('.section-header,.subnav,.ftabs,button,input,select,textarea,script,style,.pillar-badge,.no-print'), function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    Array.prototype.forEach.call(c.querySelectorAll('details'), function (d) { d.setAttribute('open', ''); });
    Array.prototype.forEach.call(c.querySelectorAll('*'), function (n) {
      if (n.style && n.style.display === 'none') { if (n.parentNode) n.parentNode.removeChild(n); return; }
      /* sans identifiant ni gestionnaire : la copie ne doit pas entrer en conflit avec la page vivante */
      n.removeAttribute('id'); n.removeAttribute('onclick'); n.removeAttribute('onchange'); n.removeAttribute('oninput'); n.removeAttribute('tabindex');
      if (n.tagName === 'A') n.removeAttribute('href');
    });
    return c.innerHTML;
  }
  function intro(el) { var p = el.querySelector('.section-header p'); return p ? p.textContent.replace(/\s+/g, ' ').trim() : ''; }

  function progres(i, n, label) {
    $('reportRoot').innerHTML = '<div style="padding:60px 20px;text-align:center;font-size:15px;color:#4b5a52">Assemblage du rapport à partir des données affichées<br><b style="display:block;margin-top:8px;font-size:17px;color:#16332a">' + i + ' sur ' + n + '</b><span style="display:block;margin-top:6px">' + esc(label) + '</span></div>';
  }

  window.generateReport = function () {
    if (enCours) return;
    if (!window.D || !window.D.sectors) { alert('Données non chargées.'); return; }
    var L = synchroniser();
    var scope = document.querySelector('input[name="rptScope"]:checked').value;
    var o = {
      title: $('rptTitle').value.trim() || 'Rapport territorial - MRC du Granit', subtitle: $('rptSub').value.trim(), preamble: $('rptPre').value.trim(),
      recipient: $('rptRecip').value.trim(), cover: $('rptCover').checked
    };
    var opt = { incCharts: $('rptCharts').checked, incSources: $('rptSrc').checked };
    var courante = window.currentViewId, ids;
    if (scope === 'current') ids = [courante];
    else if (scope === 'pillar') { var p = String(courante).split('-')[0]; ids = L.filter(function (s) { return s.pillar === p; }).map(function (s) { return s.id; }); }
    else if (scope === 'full') ids = L.map(function (s) { return s.id; });
    else ids = Array.prototype.slice.call(document.querySelectorAll('.rpt-pick:checked')).map(function (c) { return c.value; });
    var choix = L.filter(function (s) { return ids.indexOf(s.id) >= 0; });
    if (!choix.length) choix = L.slice(0, 1);

    enCours = true;
    var boutonActif = document.querySelector('.ni.active');
    if (typeof window.closeReportBuilder === 'function') window.closeReportBuilder();
    $('reportPreview').classList.add('open'); document.body.style.overflow = 'hidden';
    var anim = window.Chart && Chart.defaults ? Chart.defaults.animation : undefined;
    if (window.Chart && Chart.defaults) Chart.defaults.animation = false;   // un graphique saisi en cours d'animation serait incomplet
    var blocs = [], i = 0;

    function suivant() {
      if (i >= choix.length) return Promise.resolve();
      var s = choix[i]; progres(i + 1, choix.length, s.label);
      var el = $('view-' + s.id);
      try { window.V(s.id, null); } catch (e) {}
      return stable(el).then(function () {
        var corps = '';
        try { var t = intro(el); corps = (t ? '<p class="rpt-narr">' + esc(t) + '</p>' : '') + '<div class="rpt-live">' + copier(el, opt) + '</div>'; }
        catch (e) { corps = '<p class="rpt-narr">Cette section n\'a pas pu être reproduite.</p>'; }
        blocs.push({ label: s.label, html: corps });
        i++; return suivant();
      });
    }
    suivant().catch(function () {}).then(function () {
      if (window.Chart && Chart.defaults) Chart.defaults.animation = anim;
      try { window.V(courante, boutonActif); } catch (e) {}
      var html = window.reportHeaderHtml(o);
      blocs.forEach(function (b, k) { html += window.rBlock(esc(b.label), b.html, (o.cover && k === 0) ? true : k > 0); });
      if (opt.incSources && window.D._sources) html += window.rBlock('Sources et références', window.rSrc('') + '<div class="rpt-srcfull">' + window.D._sources + '</div>', true);
      html += '<div class="rpt-runfoot">MRC du Granit - Document de travail - ' + new Date().toLocaleDateString('fr-CA') + '</div>';
      $('reportRoot').innerHTML = html;
      var sc = document.querySelector('.rpt-scroll'); if (sc) sc.scrollTop = 0;
      enCours = false;
    });
  };

  /* ─── mise en page des copies : lisible à l'écran de l'aperçu comme sur papier ─── */
  var css = document.createElement('style');
  css.textContent =
    '.rpt-live{font-size:12.5px;line-height:1.5;color:#1c2533}' +
    '.rpt-live .card{box-shadow:none!important;border:1px solid #dfe6e2;margin-bottom:10px;break-inside:avoid;page-break-inside:avoid}' +
    '.rpt-live img.rpt-snap{max-width:100%;height:auto;display:block;margin:0 auto}' +
    '.rpt-live *{max-height:none!important;position:static!important;animation:none!important;transition:none!important}' +
    '.rpt-live [style*="overflow"],.rpt-live .tbl-wrap,.rpt-live .table-wrap{overflow:visible!important}' +
    '.rpt-live table{width:100%;font-size:11px}' +
    '.rpt-live tr{break-inside:avoid;page-break-inside:avoid}' +
    '.rpt-live svg{max-width:100%;height:auto}' +
    '@media print{.rpt-live{font-size:10px}.rpt-live table{font-size:9px}.rpt-live .card{padding:9px 11px}}';
  document.head.appendChild(css);

  window.GranitRapport = { sections: sections };
})();
