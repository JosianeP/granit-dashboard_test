// Simule une mise à jour faite dans Excel, puis vérifie ce que la plateforme en tire.
// usage : node test-modif.js   (génère le chiffrier depuis ../data.json, le modifie, le réimporte)
const ExcelJS = require('exceljs'); const XP = require('xlsx-populate'); const fs = require('fs'); const path = require('path'); const assert = require('assert');
const GE = require(path.join(__dirname, '..', 'granit-excel.js'));
const { lireExtras } = require('./build-excel.js');
(async () => {
  const dataPath = path.join(__dirname, '..', 'data.json');
  const D = JSON.parse(fs.readFileSync(dataPath, 'utf8')), extras = lireExtras(dataPath);
  const buf = await (await GE.buildWorkbook(ExcelJS, D, { extras })).xlsx.writeBuffer();
  const wb = await XP.fromDataAsync(buf);
  function findField(sheet, p) { const s = wb.sheet(sheet); const u = s.usedRange().endCell().rowNumber(); for (let r = 1; r <= u; r++) if (s.cell(r, 1).value() === 'F|' + p) return s.cell(r, 3); throw new Error('champ ' + p); }
  function rows(sheet, id) { const s = wb.sheet(sheet); const u = s.usedRange().endCell().rowNumber(); let inT = false, keys = null, out = []; for (let r = 1; r <= u; r++) { const m = String(s.cell(r, 1).value() || ''); if (m === 'T|' + id) { inT = true; continue; } if (!inT) continue; if (m === 'K|') { keys = []; for (let c = 2; c < 60; c++) { const v = s.cell(r, c).value(); if (v == null || v === '') break; keys.push(String(v)); } } else if (m.startsWith('R|')) out.push({ r, key: m.slice(2), keys }); else if (m === 'E|') break; } if (!out.length) throw new Error('tableau ' + id); return out; }
  function set(sheet, row, obj) { const s = wb.sheet(sheet); Object.keys(obj).forEach(k => { const i = row.keys.indexOf(k); if (i < 0) throw new Error('colonne ' + k); s.cell(row.r, 2 + i).value(obj[k]); }); }
  const libre = (sheet, id) => rows(sheet, id).filter(x => x.key === '')[0], premier = (sheet, id) => rows(sheet, id).filter(x => x.key !== '')[0];
  const imp = async () => GE.applyImport(D, GE.readWorkbook(await XP.fromDataAsync(await wb.outputAsync())), { extras });

  // chiffres et listes déjà couverts avant la v4.21
  findField('Frontenac', 'municipalities[code=30025].pop').value(1900);
  set('Frontenac', libre('Frontenac', 'companies@30025'), { name: 'Nouvelle Scierie Test', sector: D.sectors[0].name, jobs: 12, status: 'nouveau', desc: 'Entreprise ajoutée pour test.' });
  findField('Piopolis', 'climat.parMuni[muni=Piopolis].transp').value(1000);
  // textes d'analyse
  findField("Textes d'analyse", 'sante.intro').value('Nouvelle introduction du pilier Santé.');
  // collaborations : ajout avec cellules à plusieurs éléments
  set('MRC - Collaborations', libre('MRC - Collaborations', 'collabs'), { name: 'Collaboration test', type: 'possible', inference_score: 55, companies: 'Entreprise A\nEntreprise B', municipalities: 'Lambton | Piopolis', desc: 'Test.' });
  // pilier Santé : retrait d'un levier (nom effacé), lien vers un déterminant inconnu
  const lev = premier('MRC - Santé', 'saLeviers'); const levNom = D.sante.leviers[0].name; set('MRC - Santé', lev, { name: null });
  set('MRC - Santé', premier('MRC - Santé', 'saLinks'), { det: 'dss99' });
  // constats MADA : ajout d'un constat dans le premier axe
  const axe = extras._mada.axes[0];
  set('Milieu - Constats MADA', libre('Milieu - Constats MADA', 'madaC@' + axe.id), { texte: 'Constat ajouté pour test.', t: 'enjeu', n: 2 });
  // territoire apprenant : nouvelle source, entrée au journal, trace dans un enjeu, valeur d'un indicateur
  set('Santé - Apprenant', libre('Santé - Apprenant', 'apSources'), { _k: 'pvtest', l: 'Procès-verbal de test', u: 'https://example.org/pv' });
  set('Santé - Apprenant', libre('Santé - Apprenant', 'apJournal'), { sujet: 'Décision de test', date: '2026-11-26', apres: 'Après.' });
  const enj = extras._apprenant.enjeux[0];
  set('Santé - Enjeux', libre('Santé - Enjeux', 'apE@' + enj.id + '@suivi'), { texte: 'Suivi ajouté pour test.', date: '2026-11', src: 'pvtest', prov: 'reel' });
  set('Santé - Apprenant', premier('Santé - Apprenant', 'apGrp@0'), { v0: 41.5 });
  // erreurs volontaires : texte dans un nombre, valeur hors liste
  findField('Audet', 'municipalities[code=30055].pop').value('sept cents');
  set('Santé - Enjeux', premier('Santé - Enjeux', 'apE@' + enj.id + '@savoirs'), { prov: 'inconnu' });

  let res = await imp();
  console.log('Erreurs attendues (2) :', res.errors);
  assert.strictEqual(res.errors.length, 2);
  findField('Audet', 'municipalities[code=30055].pop').value(707);
  set('Santé - Enjeux', premier('Santé - Enjeux', 'apE@' + enj.id + '@savoirs'), { prov: enj.savoirs[0].prov });
  res = await imp();
  console.log('Bilan', res.counts, '· fichiers de data/ modifiés', res.extrasChanged);
  console.log('Ajouts', res.added.map(a => a.type + ' · ' + a.name)); console.log('Retraits', res.removed.map(a => a.type + ' · ' + a.name)); console.log('Avertissements', res.warnings);
  const N = res.data, M = res.extras._mada, A = res.extras._apprenant;
  assert.strictEqual(res.errors.length, 0); assert.strictEqual(res.stale, false);
  assert.strictEqual(N.municipalities.find(m => m.code === '30025').pop, 1900);
  assert.ok(N.companies.some(c => c.name === 'Nouvelle Scierie Test'));
  assert.strictEqual(N.sante.intro, 'Nouvelle introduction du pilier Santé.');
  const c = N.collaborations[N.collaborations.length - 1]; assert.deepStrictEqual([c.name, c.companies, c.municipalities], ['Collaboration test', ['Entreprise A', 'Entreprise B'], ['Lambton', 'Piopolis']]); assert.ok(/^col\d+$/.test(c.id) && N.collaborations.filter(x => x.id === c.id).length === 1);
  assert.ok(!N.sante.leviers.some(l => l.name === levNom) && N.sante.leviers.length === D.sante.leviers.length - 1);
  assert.ok(res.warnings.some(w => /dss99/.test(w)));
  const nc = M.axes[0].constats; assert.strictEqual(nc.length, axe.constats.length + 1); assert.strictEqual(nc[nc.length - 1].texte, 'Constat ajouté pour test.');
  assert.deepStrictEqual(A.sources.pvtest, { l: 'Procès-verbal de test', u: 'https://example.org/pv' });
  assert.strictEqual(A.journal.entrees.length, extras._apprenant.journal.entrees.length + 1);
  assert.strictEqual(A.enjeux[0].suivi[A.enjeux[0].suivi.length - 1].src, 'pvtest');
  assert.strictEqual(A.iss.jeunes.groupes[0].items[0].v[0], 41.5);
  assert.ok(!('_mada' in N) && !('_apprenant' in N), 'les fichiers de data/ ne doivent pas entrer dans data.json');
  // chiffrier périmé : les données publiées changent après la génération du fichier
  const D2 = JSON.parse(JSON.stringify(D)); D2.municipalities[0].pop += 1;
  const perime = GE.applyImport(D2, GE.readWorkbook(await XP.fromDataAsync(buf)), { extras });
  assert.strictEqual(perime.stale, true); console.log('Chiffrier périmé détecté :', perime.stale, '·', perime.counts.changes, 'changement qui écraserait la valeur récente');
  console.log('OK - toutes les vérifications passent');
})().catch(e => { console.error(e); process.exit(1); });
