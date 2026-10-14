const XP = require('xlsx-populate'); const fs = require('fs'); const path = require('path');
const GE = require(path.join(__dirname, '..', 'granit-excel.js'));
(async () => {
  const D = JSON.parse(fs.readFileSync('../data.json', 'utf8'));
  const wb = await XP.fromDataAsync(fs.readFileSync('../MRC_Granit_mise_a_jour.xlsx'), { password: 'Granit2026!' });
  // helpers : trouver la cellule d'un champ ou d'une ligne de tableau
  function findField(sheet, pathStr) { const s = wb.sheet(sheet); const u = s.usedRange().endCell().rowNumber(); for (let r = 1; r <= u; r++) { if (s.cell(r, 1).value() === 'F|' + pathStr) return s.cell(r, 3); } throw new Error('champ ' + pathStr); }
  function tableRows(sheet, id) { const s = wb.sheet(sheet); const u = s.usedRange().endCell().rowNumber(); let inT = false, keys = null, rows = []; for (let r = 1; r <= u; r++) { const m = String(s.cell(r, 1).value() || ''); if (m === 'T|' + id) { inT = true; continue; } if (!inT) continue; if (m === 'K|') { keys = []; for (let c = 2; c < 60; c++) { const v = s.cell(r, c).value(); if (v == null || v === '') break; keys.push(String(v)); } } else if (m.startsWith('R|')) rows.push({ r, key: m.slice(2), keys }); else if (m === 'E|') break; } return rows; }
  function setRow(sheet, row, obj) { const s = wb.sheet(sheet); row.keys.forEach((k, i) => { if (obj[k] !== undefined) s.cell(row.r, 2 + i).value(obj[k]); }); }
  // 1. population Frontenac
  findField('Frontenac', 'municipalities[code=30025].pop').value(1900);
  // 2. KPI valeur
  const kp = tableRows('MRC - Général', 'kpis'); setRow('MRC - Général', kp[0], { value: '22 100' });
  // 3. ajouter une entreprise à Frontenac (ligne libre)
  const co = tableRows('Frontenac', 'companies@30025'); const spare = co.filter(x => x.key === '')[0];
  setRow('Frontenac', spare, { name: 'Nouvelle Scierie Test', sector: 'Forêt & scierie', jobs: 12, status: 'nouveau', desc: 'Entreprise ajoutée pour test.' });
  // 4. retirer la première entreprise existante de Lambton (effacer le nom)
  const lb = tableRows('Lambton', 'companies@30095'); const first = lb.filter(x => x.key !== '')[0]; const removedName = wb.sheet('Lambton').cell(first.r, 2).value(); wb.sheet('Lambton').cell(first.r, 2).value(null);
  // 5. ajouter une année à l'historique
  const tr = tableRows('MRC - Général', 'trends'); const sp2 = tr.filter(x => x.key === '')[0]; setRow('MRC - Général', sp2, { year: '2025', totalJobs: 7000, newBiz: 40, permitsMk: 60.1 });
  // 6. membre touristique : chambres hôtel
  const mb = tableRows('Lac-Mégantic', 'membres@30030'); const hotel = mb.filter(x => x.key && /Microtel|Hôtel|Auberge/i.test(x.key))[0]; setRow('Lac-Mégantic', hotel, { chHotel: 99 });
  // 7. climat : transport de Piopolis
  findField('Piopolis', 'climat.parMuni[muni=Piopolis].transp').value(1000);
  // 8. erreur volontaire : texte dans un nombre (Audet pop) et enum invalide (statut)
  findField('Audet', 'municipalities[code=30055].pop').value('sept cents');
  const au = tableRows('Audet', 'companies@30055'); const auFirst = au.filter(x => x.key !== '')[0]; setRow('Audet', auFirst, { status: 'ferme' });
  const out = await wb.outputAsync({ password: 'Granit2026!' }); fs.writeFileSync('/tmp/modif.xlsx', out);
  // réimport
  const wb2 = await XP.fromDataAsync(fs.readFileSync('/tmp/modif.xlsx'), { password: 'Granit2026!' });
  const res = GE.applyImport(D, GE.readWorkbook(wb2));
  console.log('ERREURS attendues (2) :', res.errors);
  // corriger les erreurs et réimporter
  findField('Audet', 'municipalities[code=30055].pop').value(707); setRow('Audet', auFirst, { status: 'actif' });
  const out2 = await wb.outputAsync({ password: 'Granit2026!' }); fs.writeFileSync('/tmp/modif2.xlsx', out2);
  const wb3 = await XP.fromDataAsync(fs.readFileSync('/tmp/modif2.xlsx'), { password: 'Granit2026!' });
  const res2 = GE.applyImport(D, GE.readWorkbook(wb3));
  console.log('counts', res2.counts); console.log(res2.changes); console.log('added', res2.added, 'removed', res2.removed, 'retiré attendu:', removedName); console.log('warnings', res2.warnings);
  const N = res2.data;
  const fr = N.municipalities.find(m => m.code === '30025'); console.log('Frontenac pop/density', fr.pop, fr.density, '| demo MRC inchangé', N.demographie.mrc.agg.tot);
  console.log('trends', N.trends.years, N.trends.totalJobs, N.trends.bySector['Acéricole']);
  console.log('new co', N.companies.filter(c => c.name === 'Nouvelle Scierie Test'), 'lambton removed?', !N.companies.some(c => c.name === removedName));
  console.log('tourisme parMuni LM chambres', N.tourisme.parMuni.find(p => p.muni === 'Lac-Mégantic').chambres, 'agregats', N.tourisme.agregats.chambresHotel, 'tour co', N.companies.filter(c => c.src === 'tourisme').length);
  const pio = N.climat.parMuni.find(x => x.muni === 'Piopolis'); console.log('Piopolis climat', pio.total, pio.perCap, pio.partMrc, pio.dom, 'MRC total', N.climat.agregats.totalGlobal, N.climat.secteurs[0]);
  console.log('updatedDate', N.meta.updatedDate);
})().catch(e => { console.error(e); process.exit(1); });
