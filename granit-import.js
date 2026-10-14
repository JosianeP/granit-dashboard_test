/* ═══════════════════════════════════════════════════════════════════════════
   granit-import.js — Interface d'importation du chiffrier Excel (v4.7)
   Dépend de : granit-excel.js (GranitExcel), xlsx-populate.min.js (XlsxPopulate),
   exceljs.min.js (ExcelJS, pour la régénération du gabarit) et des globales de la
   plateforme (D, saveLs, renderAll, getMLSuggestions, allMLPairs, toast).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var XL = { file: null, buffer: null, result: null, step: 'file' };
  var GH_KEY = 'mrcg7_gh';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function libsReady() { return typeof GranitExcel !== 'undefined' && typeof XlsxPopulate !== 'undefined'; }

  /* ─── ouverture / fermeture ─── */
  window.openXlImport = function () { $('xlOv').classList.add('open'); if (!XL.file || XL.step === 'publish') xlReset(); };
  window.closeXlImport = function () { $('xlOv').classList.remove('open'); };
  window.xlReset = function () { XL = { file: null, buffer: null, result: null, step: 'file' }; xlStepFile(); };
  window.xlBg = function (e) { if (e.target === $('xlOv')) closeXlImport(); };

  function head(title, sub) { $('xlTitle').innerHTML = esc(title); $('xlSub').textContent = sub || ''; }

  /* ─── étape 1 : fichier ─── */
  function xlStepFile() {
    XL.step = 'file';
    head('Mise à jour trimestrielle par chiffrier Excel', 'Glissez le chiffrier chiffré ou choisissez-le, puis entrez son mot de passe.');
    $('xlBody').innerHTML =
      '<div class="xl-drop" id="xlDrop" onclick="document.getElementById(\'xlFile\').click()">' +
        '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>' +
        '<div class="xl-drop-t">Déposez le chiffrier ici</div><div class="xl-drop-s">ou cliquez pour le choisir · fichier .xlsx chiffré, une feuille par municipalité</div>' +
      '</div>' +
      '<input type="file" id="xlFile" accept=".xlsx" style="display:none" onchange="xlPick(event)">' +
      '<div class="xl-steps">' +
        '<div class="xl-step"><b>1</b><span>Le secrétariat remplit les cellules jaunes du chiffrier (une feuille par municipalité, feuilles « MRC - … » pour le territoire) et l\'enregistre.</span></div>' +
        '<div class="xl-step"><b>2</b><span>Le chiffrier est déposé ici. La plateforme vérifie chaque valeur et présente le résumé des changements avant toute modification.</span></div>' +
        '<div class="xl-step"><b>3</b><span>Les données sont appliquées, les champs dérivés recalculés, puis publiées (GitHub) ou exportées en data.json.</span></div>' +
      '</div>' +
      '<div class="xl-tools"><button class="btn" onclick="xlTemplate()">Régénérer le gabarit Excel à partir des données actuelles</button><span>Utile si des données ont été modifiées autrement que par le chiffrier.</span></div>';
    $('xlFoot').innerHTML = '<button class="btn" onclick="closeXlImport()">Fermer</button>';
    if (!libsReady()) $('xlBody').insertAdjacentHTML('afterbegin', '<div class="xl-err">Les bibliothèques d\'importation (xlsx-populate, exceljs, granit-excel.js) ne sont pas chargées. Vérifiez que ces fichiers accompagnent index.html.</div>');
  }
  window.xlPick = function (e) { var f = e.target.files[0]; if (f) xlHandleFile(f); e.target.value = ''; };

  function xlHandleFile(file) {
    if (!/\.xlsx$/i.test(file.name)) { toast('⚠️ Seul un chiffrier .xlsx est accepté'); return; }
    XL.file = file; XL.result = null;
    $('xlOv').classList.add('open');
    var r = new FileReader();
    r.onload = function (ev) { XL.buffer = ev.target.result; xlStepPassword(); };
    r.readAsArrayBuffer(file);
  }
  window.xlHandleFile = xlHandleFile;

  /* ─── étape 2 : mot de passe ─── */
  function isEncrypted(buf) { var b = new Uint8Array(buf.slice(0, 8)); return !(b[0] === 0x50 && b[1] === 0x4B); }
  function xlStepPassword() {
    XL.step = 'pw';
    var enc = isEncrypted(XL.buffer);
    head('Chiffrier reçu : ' + XL.file.name, enc ? 'Le fichier est chiffré. Entrez son mot de passe pour le lire.' : 'Attention : ce fichier n\'est pas chiffré.');
    $('xlBody').innerHTML = '<div class="pw"><div style="font-size:40px;margin-bottom:10px">' + (enc ? '🔐' : '📄') + '</div><h3>' + (enc ? 'Mot de passe du chiffrier' : 'Fichier non chiffré') + '</h3>' +
      '<p>' + (enc ? 'Le mot de passe est celui qui ouvre le fichier dans Excel. Il n\'est jamais enregistré.' : 'Le chiffrier attendu est chiffré par mot de passe. Vous pouvez tout de même poursuivre si ce fichier provient bien du secrétariat.') + '</p>' +
      (enc ? '<input type="password" id="xlPw" placeholder="Mot de passe…" onkeydown="if(event.key===\'Enter\')xlRead()">' : '') +
      '<div id="xlPwErr" class="pw-err"></div>' +
      '<button class="btn btn-p" style="margin-top:11px;width:260px" onclick="xlRead()">' + (enc ? 'Déchiffrer et vérifier →' : 'Vérifier le chiffrier →') + '</button></div>';
    $('xlFoot').innerHTML = '<button class="btn" onclick="xlReset()">Autre fichier</button><button class="btn" onclick="closeXlImport()">Annuler</button>';
    setTimeout(function () { var e = $('xlPw'); if (e) e.focus(); }, 60);
  }

  /* ─── étape 3 : lecture et aperçu ─── */
  window.xlRead = function () {
    var pwEl = $('xlPw'), pw = pwEl ? pwEl.value : '';
    var err = $('xlPwErr'); if (err) err.textContent = '';
    if (isEncrypted(XL.buffer) && !pw) { if (err) err.textContent = 'Entrez le mot de passe.'; return; }
    head('Lecture du chiffrier…', 'Déchiffrement et vérification de chaque cellule.');
    var opts = pw ? { password: pw } : {};
    XlsxPopulate.fromDataAsync(XL.buffer, opts).then(function (wb) {
      var parsed = GranitExcel.readWorkbook(wb);
      if (!parsed.sheetNames.length) throw new Error('STRUCT');
      var res = GranitExcel.applyImport(D, parsed);
      XL.result = res; xlStepPreview(res);
    }).catch(function (e) {
      var msg = String(e && e.message || e);
      var human = /STRUCT/.test(msg) ? 'Ce fichier ne contient aucune feuille reconnue par la plateforme. Utilisez le gabarit officiel.' : (pw ? 'Mot de passe incorrect (ou fichier endommagé).' : 'Lecture impossible : ' + msg);
      xlStepPassword(); var er = $('xlPwErr'); if (er) er.textContent = human;
    });
  };

  function fmt(v) { return esc(GranitExcel.fmtVal(v)); }
  function xlStepPreview(res) {
    XL.step = 'preview';
    var c = res.counts, blocked = c.errors > 0;
    head('Résumé des changements — ' + XL.file.name, blocked ? 'Des cellules non conformes bloquent l\'importation. Corrigez-les dans Excel puis déposez le fichier à nouveau.' : 'Rien n\'est encore modifié. Vérifiez puis appliquez.');
    var h = '<div class="xl-sum">' +
      tile(c.changes, 'champ' + (c.changes > 1 ? 's' : '') + ' modifié' + (c.changes > 1 ? 's' : ''), 'xl-t-ok') + tile(c.added, 'ajout' + (c.added > 1 ? 's' : ''), 'xl-t-add') + tile(c.removed, 'retrait' + (c.removed > 1 ? 's' : ''), 'xl-t-rem') +
      tile(c.errors, 'erreur' + (c.errors > 1 ? 's' : ''), c.errors ? 'xl-t-err' : '') + tile(c.warnings, 'avertissement' + (c.warnings > 1 ? 's' : ''), c.warnings ? 'xl-t-warn' : '') + '</div>';
    if (res.errors.length) h += '<div class="fs"><div class="fs-t">Cellules non conformes (à corriger)</div>' + res.errors.map(function (e) { return '<div class="xl-line xl-line-err">' + esc(e) + '</div>'; }).join('') + '</div>';
    if (res.warnings.length) h += '<div class="fs"><div class="fs-t">Avertissements</div>' + res.warnings.map(function (e) { return '<div class="xl-line xl-line-warn">' + esc(e) + '</div>'; }).join('') + '</div>';
    if (res.removed.length) h += '<div class="fs"><div class="fs-t">Éléments retirés (nom effacé ou ligne supprimée)</div>' + res.removed.map(function (e) { return '<div class="xl-line xl-line-rem">' + esc(e.type) + ' · <b>' + esc(e.name) + '</b> <span class="xl-muted">' + esc(e.sheet) + '</span></div>'; }).join('') + '</div>';
    if (res.added.length) h += '<div class="fs"><div class="fs-t">Éléments ajoutés</div>' + res.added.map(function (e) { return '<div class="xl-line xl-line-add">' + esc(e.type) + ' · <b>' + esc(e.name) + '</b> <span class="xl-muted">' + esc(e.sheet) + '</span></div>'; }).join('') + '</div>';
    if (res.changes.length) {
      var bySheet = {}; res.changes.forEach(function (ch) { (bySheet[ch.sheet] = bySheet[ch.sheet] || []).push(ch); });
      h += '<div class="fs"><div class="fs-t">Champs modifiés par feuille</div>';
      Object.keys(bySheet).forEach(function (sh) {
        h += '<details class="xl-det" open><summary>' + esc(sh) + ' <span class="xl-muted">' + bySheet[sh].length + '</span></summary><table class="xl-tbl"><thead><tr><th>Champ</th><th>Avant</th><th>Après</th></tr></thead><tbody>' +
          bySheet[sh].map(function (ch) { return '<tr><td>' + esc(ch.label) + '</td><td class="xl-old">' + fmt(ch.old) + '</td><td class="xl-new">' + fmt(ch.new) + '</td></tr>'; }).join('') + '</tbody></table></details>';
      });
      h += '</div>';
    }
    if (!res.changes.length && !res.added.length && !res.removed.length && !res.errors.length) h += '<div class="xl-line">Aucune différence entre le chiffrier et les données actuelles de la plateforme.</div>';
    h += '<div class="xl-note">Après application : densités, portrait démographique de la MRC, totaux touristiques, parc de logements, totaux du plan climat et fiches « tourisme » sont recalculés automatiquement.</div>';
    $('xlBody').innerHTML = h;
    var canApply = !blocked && (res.changes.length || res.added.length || res.removed.length);
    $('xlFoot').innerHTML = '<button class="btn" onclick="xlReset()">Autre fichier</button><button class="btn" onclick="closeXlImport()">Annuler</button>' +
      (canApply ? '<button class="btn btn-p" onclick="xlApply()">✅ Appliquer à la plateforme</button>' : '');
  }
  function tile(n, l, cls) { return '<div class="xl-tile ' + (cls || '') + '"><div class="xl-tile-v">' + n + '</div><div class="xl-tile-l">' + l + '</div></div>'; }

  /* ─── étape 4 : application ─── */
  window.xlApply = function () {
    var res = XL.result; if (!res || res.errors.length) return;
    D = res.data; saveLs(); allMLPairs = getMLSuggestions(); renderAll();
    xlStepPublish();
  };

  /* ─── étape 5 : publication ─── */
  function ghConf() {
    var c = {}; try { c = JSON.parse(localStorage.getItem(GH_KEY) || '{}'); } catch (e) { c = {}; }
    if (!c.owner || !c.repo) { var m = /^([^.]+)\.github\.io$/.exec(location.hostname); if (m) { c.owner = c.owner || m[1]; var seg = location.pathname.split('/').filter(Boolean)[0]; if (seg && !/\.html$/.test(seg)) c.repo = c.repo || seg; } }
    c.branch = c.branch || 'main'; c.path = c.path || 'data.json'; return c;
  }
  window.ghSave = function (c) { try { localStorage.setItem(GH_KEY, JSON.stringify(c)); } catch (e) {} };
  window.ghConf = ghConf;

  function xlStepPublish() {
    XL.step = 'publish';
    var c = ghConf(), ready = !!(c.owner && c.repo && c.token);
    head('Données appliquées — ' + (D.meta.quarter || ''), 'La plateforme affiche maintenant les nouvelles données sur cet ordinateur. Publiez-les pour que tout le monde les voie.');
    $('xlBody').innerHTML =
      '<div class="xl-pub">' +
        '<div class="xl-pub-card' + (ready ? '' : ' xl-pub-off') + '"><div class="xl-pub-t">Publier sur GitHub Pages</div>' +
          (ready ? '<p>Un commit « data.json » sera créé dans <b>' + esc(c.owner + '/' + c.repo) + '</b> (branche ' + esc(c.branch) + '). Le site en ligne se met à jour en une à deux minutes.</p><button class="btn btn-p" id="ghBtn" onclick="xlPublish()">🚀 Publier maintenant</button><div id="ghMsg" class="xl-muted" style="margin-top:8px"></div>'
            : '<p>La publication automatique n\'est pas configurée sur ce navigateur. Un responsable peut l\'activer dans « Modifier les données » → Publication GitHub (dépôt et jeton d\'accès).</p>') +
        '</div>' +
        '<div class="xl-pub-card"><div class="xl-pub-t">Ou exporter data.json</div><p>Téléchargez le fichier, puis sur GitHub ouvrez <b>data.json</b> → ✏️ → collez le contenu → <b>Commit</b>.</p><button class="btn" onclick="exportJSON()">💾 Télécharger data.json</button></div>' +
      '</div>' +
      '<div class="xl-note">Conservez le chiffrier : il sert de base à la prochaine mise à jour. Pour repartir des données publiées, utilisez « Régénérer le gabarit Excel ».</div>';
    $('xlFoot').innerHTML = '<button class="btn" onclick="xlReset()">Importer un autre chiffrier</button><button class="btn btn-p" onclick="closeXlImport()">Terminer</button>';
  }

  function utf8b64(str) {
    var bytes = new TextEncoder().encode(str), bin = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin);
  }
  window.xlPublish = function () {
    var c = ghConf(), btn = $('ghBtn'), msg = $('ghMsg'); if (!c.token) return;
    btn.disabled = true; msg.textContent = 'Publication en cours…';
    var api = 'https://api.github.com/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + '/contents/' + c.path.split('/').map(encodeURIComponent).join('/');
    var headers = { 'Authorization': 'Bearer ' + c.token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    fetch(api + '?ref=' + encodeURIComponent(c.branch), { headers: headers }).then(function (r) { if (r.status === 404) return null; if (!r.ok) throw new Error('GET ' + r.status); return r.json(); }).then(function (cur) {
      var body = { message: 'Mise à jour des données — ' + (D.meta.quarter || '') + ' (chiffrier Excel)', content: utf8b64(JSON.stringify(D, null, 2)), branch: c.branch };
      if (cur && cur.sha) body.sha = cur.sha;
      return fetch(api, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: JSON.stringify(body) });
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error((j && j.message) || ('PUT ' + r.status)); return j; }); }).then(function (j) {
      var url = j && j.commit && j.commit.html_url;
      msg.innerHTML = '✅ Publié. ' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">Voir le commit</a> · ' : '') + 'Le site se rafraîchit d\'ici une à deux minutes.';
      toast('🚀 data.json publié sur GitHub');
    }).catch(function (e) { btn.disabled = false; msg.textContent = '❌ Échec : ' + (e.message || e) + '. Vérifiez le jeton (permission « Contents : lecture et écriture ») et le nom du dépôt, ou exportez data.json.'; });
  };

  /* ─── régénération du gabarit ─── */
  window.xlTemplate = function () {
    if (typeof ExcelJS === 'undefined') { toast('⚠️ exceljs.min.js introuvable'); return; }
    var pw = prompt('Mot de passe qui protégera le chiffrier (au moins 8 caractères) :', '');
    if (pw === null) return; if (pw.length < 8) { toast('⚠️ Mot de passe trop court (8 caractères minimum)'); return; }
    toast('⏳ Génération du chiffrier…');
    GranitExcel.buildWorkbook(ExcelJS, D, { password: pw }).then(function (wb) { return wb.xlsx.writeBuffer(); }).then(function (buf) { return XlsxPopulate.fromDataAsync(buf); }).then(function (xp) { return xp.outputAsync({ password: pw }); }).then(function (blob) {
      var name = 'MRC_Granit_mise_a_jour_' + String(D.meta.quarter || '').replace(/\s+/g, '-') + '.xlsx';
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob])); a.download = name; a.click();
      toast('💾 ' + name + ' généré (chiffré)');
    }).catch(function (e) { toast('❌ Génération impossible : ' + (e.message || e)); });
  };

  /* ─── glisser-déposer sur toute la page ─── */
  var dragDepth = 0;
  document.addEventListener('dragenter', function (e) { if (!e.dataTransfer || !Array.prototype.some.call(e.dataTransfer.types || [], function (t) { return t === 'Files'; })) return; e.preventDefault(); dragDepth++; $('dropOv').classList.add('open'); });
  document.addEventListener('dragover', function (e) { if ($('dropOv').classList.contains('open')) e.preventDefault(); });
  document.addEventListener('dragleave', function (e) { if (!$('dropOv').classList.contains('open')) return; dragDepth--; if (dragDepth <= 0) { dragDepth = 0; $('dropOv').classList.remove('open'); } });
  document.addEventListener('drop', function (e) {
    if (!$('dropOv').classList.contains('open')) return; e.preventDefault(); dragDepth = 0; $('dropOv').classList.remove('open');
    var f = e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
    if (/\.json$/i.test(f.name)) { var r = new FileReader(); r.onload = function (ev) { try { D = JSON.parse(ev.target.result); saveLs(); renderAll(); toast('✅ data.json importé — ' + D.meta.quarter); } catch (err) { toast('❌ JSON invalide'); } }; r.readAsText(f); return; }
    xlHandleFile(f);
  });
})();
