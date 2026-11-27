/* ═══════════════════════════════════════════════════════════════════════════
   granit-import.js - Mise à jour du tableau de bord par chiffrier Excel (v4.21)

   Parcours, pensé pour une personne qui ne programme pas :
     1. télécharger le chiffrier à jour (toutes les sections, sans mot de passe);
     2. le remplir dans Excel, puis le glisser n'importe où dans la page;
     3. lire le résumé des changements, puis « Appliquer et publier ».
   La publication crée un seul commit qui contient data.json et, s'ils ont changé, les fichiers
   data/mada/constats.json et data/sante/apprenant.json.

   Dépend de : granit-excel.js (GranitExcel), xlsx-populate.min.js (XlsxPopulate), exceljs.min.js (ExcelJS),
   granit-securite.js (GranitSecurite) et des globales de la plateforme (D, saveLs, renderAll,
   getMLSuggestions, allMLPairs, toast). GranitMADA et GranitApprenant fournissent les fichiers de data/.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var XL = { file: null, buffer: null, result: null, step: 'file', pending: null, published: false };
  var GH_KEY = 'mrcg7_gh';
  var MAX_OCTETS = 15 * 1024 * 1024;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function libsReady() { return typeof GranitExcel !== 'undefined' && typeof XlsxPopulate !== 'undefined'; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function assainir(o) { return (typeof GranitSecurite !== 'undefined' && GranitSecurite.assainir) ? GranitSecurite.assainir(o) : o; }
  function plur(n, mot) { return n + ' ' + mot + (n > 1 ? 's' : ''); }

  /* ─── fichiers de data/ tenus par d'autres modules (constats MADA, territoire apprenant) ─── */
  var MODULES = { _mada: function () { return window.GranitMADA; }, _apprenant: function () { return window.GranitApprenant; } };
  function loadExtras() {
    var extras = {};
    return Promise.all(GranitExcel.EXTRAS.map(function (e) {
      var m = MODULES[e.key] && MODULES[e.key]();
      if (!m || !m.charger) return null;
      return m.charger().then(function (d) { if (d) extras[e.key] = clone(d); }).catch(function () {});
    })).then(function () { return extras; });
  }

  /* ─── ouverture / fermeture ─── */
  window.openXlImport = function () { $('xlOv').classList.add('open'); if (!XL.file || XL.step === 'publish') xlReset(); };
  window.closeXlImport = function () { $('xlOv').classList.remove('open'); };
  window.xlReset = function () { XL = { file: null, buffer: null, result: null, step: 'file', pending: XL.published ? null : XL.pending, published: false }; xlStepFile(); };
  window.xlBg = function (e) { if (e.target === $('xlOv')) closeXlImport(); };

  function head(title, sub) { $('xlTitle').innerHTML = esc(title); $('xlSub').textContent = sub || ''; }

  /* ─── étape 1 : obtenir le chiffrier, puis le déposer ─── */
  function xlStepFile() {
    XL.step = 'file';
    var c = ghConf(), ready = ghReady(c);
    head('Mettre à jour les données', 'Trois gestes : télécharger le chiffrier, le remplir dans Excel, le glisser ici.');
    $('xlBody').innerHTML =
      (XL.pending ? '<div class="xl-line xl-line-warn" style="margin-bottom:12px">Des changements appliqués sur ce poste ne sont pas encore publiés. <a href="#" onclick="xlStepPublishOpen();return false">Reprendre la publication</a></div>' : '') +
      '<div class="xl-steps">' +
        '<div class="xl-step"><b>1</b><span>Téléchargez le chiffrier à jour. Il contient toutes les sections de la plateforme, telles que publiées en ce moment.<br><button class="btn btn-p" style="margin-top:8px" id="xlTplBtn" onclick="xlTemplate()">Télécharger le chiffrier à jour</button></span></div>' +
        '<div class="xl-step"><b>2</b><span>Ouvrez-le dans Excel et remplissez les cellules jaunes. Un onglet par thème, un onglet par municipalité. Enregistrez.</span></div>' +
        '<div class="xl-step"><b>3</b><span>Glissez le fichier ici ou n\'importe où dans la page. Rien n\'est modifié avant que vous ayez vu le résumé des changements.</span></div>' +
      '</div>' +
      '<div class="xl-drop" id="xlDrop" style="margin-top:12px" onclick="document.getElementById(\'xlFile\').click()">' +
        '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>' +
        '<div class="xl-drop-t">Déposez le chiffrier rempli ici</div><div class="xl-drop-s">ou cliquez pour le choisir (fichier .xlsx)</div>' +
      '</div>' +
      '<input type="file" id="xlFile" accept=".xlsx" style="display:none" onchange="xlPick(event)">' +
      '<div class="xl-note">' + (ready
        ? 'Ce poste est autorisé à publier dans <b>' + esc(c.owner + '/' + c.repo) + '</b>. Après vérification, un seul clic met le site à jour pour tout le monde.'
        : 'Ce poste n\'est pas encore autorisé à publier. Vous pouvez tout de même déposer un chiffrier pour voir le résultat; l\'autorisation se configure une seule fois, à l\'étape de publication.') + '</div>';
    $('xlFoot').innerHTML = '<button class="btn" onclick="closeXlImport()">Fermer</button>';
    if (!libsReady()) $('xlBody').insertAdjacentHTML('afterbegin', '<div class="xl-err">Les bibliothèques d\'importation (xlsx-populate, exceljs, granit-excel.js) ne sont pas chargées. Vérifiez que ces fichiers accompagnent index.html.</div>');
  }
  window.xlPick = function (e) { var f = e.target.files[0]; if (f) xlHandleFile(f); e.target.value = ''; };

  function xlHandleFile(file) {
    if (!/\.xlsx$/i.test(file.name)) { toast('Seul un chiffrier .xlsx est accepté'); return; }
    if (file.size > MAX_OCTETS) { toast('Fichier trop volumineux pour un chiffrier de la plateforme'); return; }
    XL.file = file; XL.result = null;
    $('xlOv').classList.add('open');
    var r = new FileReader();
    r.onload = function (ev) { XL.buffer = ev.target.result; if (isEncrypted(XL.buffer)) xlStepPassword(); else xlRead(); };
    r.readAsArrayBuffer(file);
  }
  window.xlHandleFile = xlHandleFile;

  /* ─── étape 2 (rare) : mot de passe d'un chiffrier chiffré produit avant la v4.21 ─── */
  function isEncrypted(buf) { var b = new Uint8Array(buf.slice(0, 8)); return !(b[0] === 0x50 && b[1] === 0x4B); }
  function xlStepPassword() {
    XL.step = 'pw';
    head('Chiffrier reçu : ' + XL.file.name, 'Ce fichier est protégé par un mot de passe (ancien format).');
    $('xlBody').innerHTML = '<div class="pw"><h3>Mot de passe du chiffrier</h3>' +
      '<p>Le mot de passe est celui qui ouvre le fichier dans Excel. Il n\'est jamais enregistré. Les chiffriers téléchargés depuis la plateforme n\'en ont plus.</p>' +
      '<input type="password" id="xlPw" placeholder="Mot de passe" onkeydown="if(event.key===\'Enter\')xlRead()">' +
      '<div id="xlPwErr" class="pw-err"></div>' +
      '<button class="btn btn-p" style="margin-top:11px;width:260px" onclick="xlRead()">Ouvrir et vérifier</button></div>';
    $('xlFoot').innerHTML = '<button class="btn" onclick="xlReset()">Autre fichier</button><button class="btn" onclick="closeXlImport()">Annuler</button>';
    setTimeout(function () { var e = $('xlPw'); if (e) e.focus(); }, 60);
  }

  /* ─── étape 3 : lecture et résumé ─── */
  window.xlRead = function () {
    var enc = isEncrypted(XL.buffer), pwEl = $('xlPw'), pw = (enc && pwEl) ? pwEl.value : '';
    var err = $('xlPwErr'); if (err) err.textContent = '';
    if (enc && !pw) { if (err) err.textContent = 'Entrez le mot de passe.'; return; }
    head('Lecture du chiffrier', 'Vérification de chaque cellule.');
    $('xlBody').innerHTML = '<div class="xl-line">Lecture en cours…</div>'; $('xlFoot').innerHTML = '';
    var opts = pw ? { password: pw } : {};
    Promise.all([XlsxPopulate.fromDataAsync(XL.buffer, opts), loadExtras()]).then(function (r) {
      var parsed = GranitExcel.readWorkbook(r[0]);
      if (!parsed.sheetNames.length) throw new Error('STRUCT');
      var res = GranitExcel.applyImport(D, parsed, { extras: r[1] });
      /* Tout ce qui vient du chiffrier est assaini avant d'être affiché ou publié. */
      assainir(res.data); Object.keys(res.extras || {}).forEach(function (k) { assainir(res.extras[k]); });
      XL.result = res; xlStepPreview(res);
    }).catch(function (e) {
      var msg = String(e && e.message || e);
      if (/STRUCT/.test(msg)) { xlFail('Ce fichier ne contient aucune feuille reconnue par la plateforme. Téléchargez le chiffrier à jour et reportez-y vos données.'); return; }
      if (enc) { xlStepPassword(); var er = $('xlPwErr'); if (er) er.textContent = 'Mot de passe incorrect (ou fichier endommagé).'; return; }
      xlFail('Lecture impossible. Le fichier est peut-être endommagé ou n\'est pas un chiffrier Excel (.xlsx). Détail : ' + msg);
    });
  };
  function xlFail(message) {
    head('Chiffrier non reconnu', XL.file ? XL.file.name : '');
    $('xlBody').innerHTML = '<div class="xl-err">' + esc(message) + '</div>';
    $('xlFoot').innerHTML = '<button class="btn btn-p" onclick="xlReset()">Revenir</button>';
  }

  function fmt(v) { return esc(GranitExcel.fmtVal(Array.isArray(v) ? v.join(' | ') : v)); }
  function xlStepPreview(res) {
    XL.step = 'preview';
    var c = res.counts, blocked = c.errors > 0;
    head('Résumé des changements', blocked ? 'Des cellules non conformes bloquent la mise à jour. Corrigez-les dans Excel, puis déposez le fichier à nouveau.' : 'Rien n\'est encore modifié. Vérifiez, puis appliquez.');
    var h = '';
    if (res.stale) h += '<div class="xl-err"><b>Chiffrier plus ancien que les données publiées.</b> Les données de la plateforme ont changé depuis que ce fichier a été téléchargé. Les valeurs listées plus bas remplaceraient donc peut-être des données plus récentes. Vérifiez chaque ligne ou repartez d\'un chiffrier à jour.</div>';
    h += '<div class="xl-sum">' +
      tile(c.changes, 'champ' + (c.changes > 1 ? 's' : '') + ' modifié' + (c.changes > 1 ? 's' : ''), 'xl-t-ok') + tile(c.added, 'ajout' + (c.added > 1 ? 's' : ''), 'xl-t-add') + tile(c.removed, 'retrait' + (c.removed > 1 ? 's' : ''), 'xl-t-rem') +
      tile(c.errors, 'erreur' + (c.errors > 1 ? 's' : ''), c.errors ? 'xl-t-err' : '') + tile(c.warnings, 'avertissement' + (c.warnings > 1 ? 's' : ''), c.warnings ? 'xl-t-warn' : '') + '</div>';
    if (res.errors.length) h += '<div class="fs"><div class="fs-t">Cellules à corriger (feuille et cellule indiquées)</div>' + res.errors.map(function (e) { return '<div class="xl-line xl-line-err">' + esc(e) + '</div>'; }).join('') + '</div>';
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
    var any = res.changes.length || res.added.length || res.removed.length;
    if (!any && !res.errors.length) h += '<div class="xl-line">Aucune différence entre le chiffrier et les données actuelles de la plateforme. Il n\'y a rien à publier.</div>';
    if (any) h += '<div class="xl-note">Après application, les totaux qui dépendent de ces données sont recalculés (densités, portrait démographique de la MRC, totaux touristiques, parc de logements, plan climat).</div>';
    $('xlBody').innerHTML = h;
    var canApply = !blocked && any, ready = ghReady(ghConf());
    $('xlFoot').innerHTML = '<button class="btn" onclick="xlReset()">Autre fichier</button><button class="btn" onclick="closeXlImport()">Annuler</button>' +
      (canApply ? (ready ? '<button class="btn" onclick="xlApply()">Appliquer sur ce poste seulement</button><button class="btn btn-p" onclick="xlApply(true)">Appliquer et publier</button>'
        : '<button class="btn btn-p" onclick="xlApply()">Appliquer</button>') : '');
  }
  function tile(n, l, cls) { return '<div class="xl-tile ' + (cls || '') + '"><div class="xl-tile-v">' + n + '</div><div class="xl-tile-l">' + l + '</div></div>'; }

  /* ─── étape 4 : application sur ce poste ─── */
  window.xlApply = function (publier) {
    var res = XL.result; if (!res || res.errors.length) return;
    D = res.data; saveLs(); allMLPairs = getMLSuggestions();
    var files = [{ key: 'data', label: 'data.json', content: JSON.stringify(D, null, 2) }];
    GranitExcel.EXTRAS.forEach(function (e) {
      if (!res.extrasChanged || !res.extrasChanged[e.key]) return;
      var m = MODULES[e.key] && MODULES[e.key](); if (m && m.remplacer) m.remplacer(res.extras[e.key]);
      files.push({ key: e.key, label: e.path, content: GranitExcel.serialize(e.key, res.extras[e.key]) });
    });
    renderAll();
    var n = res.counts.changes + res.counts.added + res.counts.removed;
    XL.pending = { files: files, message: 'Mise à jour des données - ' + (D.meta.quarter || '') + ' (chiffrier Excel, ' + plur(n, 'changement') + ')' };
    XL.published = false;
    xlStepPublish();
    if (publier) xlPublish();
  };

  /* ─── étape 5 : publication ─── */
  function ghConf() {
    var c = {}; try { c = JSON.parse(localStorage.getItem(GH_KEY) || '{}'); } catch (e) { c = {}; }
    if (!c.owner || !c.repo) { var m = /^([^.]+)\.github\.io$/.exec(location.hostname); if (m) { c.owner = c.owner || m[1]; var seg = location.pathname.split('/').filter(Boolean)[0]; if (seg && !/\.html$/.test(seg)) c.repo = c.repo || seg; } }
    c.branch = c.branch || 'main'; c.path = c.path || 'data.json'; return c;
  }
  function ghReady(c) { return !!(c.owner && c.repo && c.token); }
  window.ghSave = function (c) { try { localStorage.setItem(GH_KEY, JSON.stringify(c)); } catch (e) {} };
  window.ghConf = ghConf;

  function ghErreur(statut, message) {
    if (statut === 401) return 'Le jeton est invalide ou expiré. Créez-en un nouveau dans GitHub, puis autorisez de nouveau ce poste.';
    if (statut === 403 || statut === 404) return 'Le jeton n\'a pas le droit d\'écrire dans ce dépôt (permission « Contents : Read and write »), ou le nom du dépôt est inexact.';
    if (statut === 409 || statut === 422) return 'Le dépôt a changé pendant la publication. Réessayez dans un instant.';
    if (!statut) return 'Connexion à GitHub impossible. Vérifiez la connexion Internet, puis réessayez.';
    return 'GitHub a répondu ' + statut + (message ? ' (' + message + ')' : '') + '.';
  }
  function gh(c, method, url, body) {
    var headers = { 'Authorization': 'Bearer ' + c.token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (body) headers['Content-Type'] = 'application/json';
    return fetch('https://api.github.com/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + url, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
      .catch(function () { var e = new Error(ghErreur(0)); e.statut = 0; throw e; })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(ghErreur(r.status, j && j.message)); e.statut = r.status; throw e; } return j; }); });
  }
  /* Un seul commit pour tous les fichiers : la plateforme ne se retrouve jamais à moitié mise à jour. */
  function ghCommit(c, files, message) {
    var dossier = c.path.indexOf('/') >= 0 ? c.path.slice(0, c.path.lastIndexOf('/') + 1) : '';
    var ref = '/git/refs/heads/' + c.branch.split('/').map(encodeURIComponent).join('/');
    var parent;
    return gh(c, 'GET', ref.replace('/git/refs/', '/git/ref/')).then(function (r) {
      parent = r.object.sha; return gh(c, 'GET', '/git/commits/' + parent);
    }).then(function (cm) {
      return gh(c, 'POST', '/git/trees', { base_tree: cm.tree.sha, tree: files.map(function (f) { return { path: f.key === 'data' ? c.path : dossier + f.label, mode: '100644', type: 'blob', content: f.content }; }) });
    }).then(function (tree) {
      return gh(c, 'POST', '/git/commits', { message: message, tree: tree.sha, parents: [parent] });
    }).then(function (cm) {
      return gh(c, 'PATCH', ref, { sha: cm.sha }).then(function () { return cm; });
    });
  }

  window.xlStepPublishOpen = function () { if (XL.pending) xlStepPublish(); };
  function xlStepPublish() {
    XL.step = 'publish';
    var c = ghConf(), ready = ghReady(c), P = XL.pending || { files: [] };
    head('Données appliquées sur ce poste', 'Vous voyez maintenant les nouvelles données. Publiez-les pour que tout le monde les voie.');
    var liste = P.files.map(function (f) { return '<code>' + esc(f.label) + '</code>'; }).join(', ');
    var h = '<div class="xl-pub-card" style="margin-bottom:12px"><div class="xl-pub-t">Publier sur le site</div>';
    if (ready) {
      h += '<p>Un seul enregistrement (commit) sera créé dans <b>' + esc(c.owner + '/' + c.repo) + '</b>, branche ' + esc(c.branch) + '. Fichiers touchés : ' + liste + '. Le site se met à jour en une à deux minutes.</p>' +
        '<button class="btn btn-p" id="ghBtn" onclick="xlPublish()">Publier maintenant</button><div id="ghMsg" class="xl-muted" style="margin-top:8px"></div>';
    } else {
      h += '<p>Ce poste n\'est pas encore autorisé à publier. L\'autorisation se fait une seule fois, avec un jeton d\'accès GitHub fourni par la personne responsable du dépôt. Le jeton reste dans ce navigateur; il n\'est jamais écrit dans les données.</p>' + tokenForm(c);
    }
    h += '</div>';
    h += '<details class="xl-det"><summary>Autre méthode : téléverser les fichiers à la main</summary><div style="padding:10px 2px;font-size:14px;line-height:1.6;color:var(--text2)">Téléchargez chaque fichier, puis déposez-le dans GitHub au même emplacement que l\'ancien (bouton « Add file », « Upload files », puis « Commit changes »).<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
      P.files.map(function (f, i) { return '<button class="btn" onclick="xlDownload(' + i + ')">Télécharger ' + esc(f.label) + '</button>'; }).join('') + '</div></div></details>';
    if (ready) h += '<div class="xl-note">Poste autorisé à publier. <a href="#" onclick="xlForgetToken();return false">Retirer l\'autorisation de ce poste</a></div>';
    $('xlBody').innerHTML = h;
    $('xlFoot').innerHTML = '<button class="btn" onclick="xlReset()">Importer un autre chiffrier</button><button class="btn" onclick="closeXlImport()">Fermer</button>';
  }
  function tokenForm(c) {
    var auto = /\.github\.io$/.test(location.hostname) && c.owner && c.repo;
    return '<div class="fgrid">' +
      (auto ? '' : '<div class="fg"><label>Compte GitHub (propriétaire)</label><input id="xlGhO" value="' + esc(c.owner || '') + '"></div><div class="fg"><label>Dépôt</label><input id="xlGhR" value="' + esc(c.repo || '') + '"></div>') +
      '<div class="fg" style="grid-column:1/-1"><label>Jeton d\'accès GitHub' + (auto ? ' pour ' + esc(c.owner + '/' + c.repo) : '') + '</label><input id="xlTok" type="password" autocomplete="off" placeholder="github_pat_…" onkeydown="if(event.key===\'Enter\')xlSaveToken()"></div></div>' +
      '<button class="btn btn-p" id="xlTokBtn" style="margin-top:8px" onclick="xlSaveToken()">Vérifier et autoriser ce poste</button><div id="xlTokMsg" class="xl-muted" style="margin-top:8px"></div>';
  }
  window.xlSaveToken = function () {
    var c = ghConf(), msg = $('xlTokMsg'), btn = $('xlTokBtn');
    if ($('xlGhO')) c.owner = $('xlGhO').value.trim(); if ($('xlGhR')) c.repo = $('xlGhR').value.trim();
    c.token = ($('xlTok').value || '').trim();
    if (!c.owner || !c.repo || !c.token) { msg.textContent = 'Entrez le jeton' + ($('xlGhO') ? ', le compte et le dépôt.' : '.'); return; }
    btn.disabled = true; msg.textContent = 'Vérification auprès de GitHub…';
    gh(c, 'GET', '').then(function (repo) {
      if (repo && repo.permissions && repo.permissions.push === false) { var e = new Error(ghErreur(403)); throw e; }
      window.ghSave(c); toast('Ce poste est autorisé à publier');
      if (XL.step === 'publish') xlStepPublish(); else xlStepFile();
    }).catch(function (e) { btn.disabled = false; msg.textContent = e.message || String(e); });
  };
  window.xlForgetToken = function () { var c = ghConf(); delete c.token; window.ghSave(c); toast('Autorisation retirée de ce poste'); if (XL.step === 'publish') xlStepPublish(); else xlStepFile(); };
  window.xlDownload = function (i) {
    var f = XL.pending && XL.pending.files[i]; if (!f) return;
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([f.content], { type: 'application/json' })); a.download = f.label.split('/').pop(); a.click();
  };

  window.xlPublish = function () {
    var c = ghConf(), btn = $('ghBtn'), msg = $('ghMsg'), P = XL.pending; if (!ghReady(c) || !P || !btn) return;
    btn.disabled = true; msg.textContent = 'Publication en cours…';
    ghCommit(c, P.files, P.message).catch(function (e) {
      /* Le dépôt a bougé entre la lecture et l'écriture (flux automatique, autre poste) : un second essai suffit. */
      if (e.statut === 409 || e.statut === 422) return ghCommit(c, P.files, P.message); throw e;
    }).then(function (cm) {
      XL.pending = null; XL.published = true;
      head('Publié', 'Le site se met à jour d\'ici une à deux minutes.');
      $('xlBody').innerHTML = '<div class="xl-line xl-line-add"><b>Mise à jour publiée.</b> ' + plur(P.files.length, 'fichier') + ' enregistré' + (P.files.length > 1 ? 's' : '') + ' en un seul commit.' +
        (cm && cm.html_url ? ' <a href="' + esc(cm.html_url) + '" target="_blank" rel="noopener">Voir le détail dans GitHub</a>' : '') + '</div>' +
        '<div class="xl-note">Les autres personnes verront les nouvelles données en rechargeant la page dans une à deux minutes. Pour la prochaine mise à jour, repartez d\'un chiffrier fraîchement téléchargé.</div>';
      $('xlFoot').innerHTML = '<button class="btn btn-p" onclick="closeXlImport()">Terminer</button>';
      toast('Données publiées');
    }).catch(function (e) { btn.disabled = false; msg.textContent = 'Publication non faite. ' + (e.message || e); });
  };

  /* ─── chiffrier à jour (gabarit) ─── */
  window.xlTemplate = function () {
    if (typeof ExcelJS === 'undefined' || !libsReady()) { toast('Bibliothèques Excel introuvables'); return; }
    var btn = $('xlTplBtn'); if (btn) { btn.disabled = true; btn.textContent = 'Préparation du chiffrier…'; }
    loadExtras().then(function (extras) { return GranitExcel.buildWorkbook(ExcelJS, D, { extras: extras }); }).then(function (wb) { return wb.xlsx.writeBuffer(); }).then(function (buf) {
      var d = new Date(), name = 'MRC_Granit_mise_a_jour_' + d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + '.xlsx';
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = name; a.click();
      toast(name + ' téléchargé');
    }).catch(function (e) { toast('Génération impossible : ' + (e.message || e)); }).then(function () { if (btn) { btn.disabled = false; btn.textContent = 'Télécharger le chiffrier à jour'; } });
  };

  /* ─── glisser-déposer sur toute la page ─── */
  var dragDepth = 0;
  document.addEventListener('dragenter', function (e) { if (!e.dataTransfer || !Array.prototype.some.call(e.dataTransfer.types || [], function (t) { return t === 'Files'; })) return; e.preventDefault(); dragDepth++; $('dropOv').classList.add('open'); });
  document.addEventListener('dragover', function (e) { if ($('dropOv').classList.contains('open')) e.preventDefault(); });
  document.addEventListener('dragleave', function (e) { if (!$('dropOv').classList.contains('open')) return; dragDepth--; if (dragDepth <= 0) { dragDepth = 0; $('dropOv').classList.remove('open'); } });
  document.addEventListener('drop', function (e) {
    if (!$('dropOv').classList.contains('open')) return; e.preventDefault(); dragDepth = 0; $('dropOv').classList.remove('open');
    var f = e.dataTransfer.files && e.dataTransfer.files[0]; if (!f) return;
    if (/\.json$/i.test(f.name)) {
      /* Un data.json déposé passe par le même contrôle que « Importer JSON » : structure vérifiée et contenu assaini. */
      var r = new FileReader();
      r.onload = function (ev) { try { D = GranitSecurite.validerImport(ev.target.result); saveLs(); allMLPairs = getMLSuggestions(); renderAll(); toast('data.json importé - ' + (D.meta.quarter || '')); } catch (err) { toast('Import refusé. ' + (err && err.message ? err.message : 'JSON invalide.')); } };
      r.readAsText(f); return;
    }
    xlHandleFile(f);
  });
})();
