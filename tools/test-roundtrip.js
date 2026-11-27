// Vérifie qu'un chiffrier non modifié ne produit aucun changement à l'importation.
// usage : node test-roundtrip.js <data.json> <chiffrier.xlsx> [motdepasse]
const XP = require('xlsx-populate'); const fs = require('fs'); const path = require('path');
const GE = require(path.join(__dirname, '..', 'granit-excel.js'));
const { lireExtras } = require('./build-excel.js');
(async () => {
  const [, , dataPath, xlsxPath, password] = process.argv;
  const D = JSON.parse(fs.readFileSync(dataPath, 'utf8')), extras = lireExtras(dataPath);
  const wb = await XP.fromDataAsync(fs.readFileSync(xlsxPath), password ? { password } : {});
  const parsed = GE.readWorkbook(wb);
  console.log('Feuilles lues :', parsed.sheetNames.length, '· empreinte :', parsed.stamp && parsed.stamp.hash);
  const res = GE.applyImport(D, parsed, { extras });
  console.log('Idempotence — changements:', res.counts.changes, 'ajouts:', res.counts.added, 'retraits:', res.counts.removed, 'erreurs:', res.counts.errors, 'avertissements:', res.counts.warnings, '· périmé:', res.stale);
  ['changes', 'errors', 'warnings', 'added', 'removed'].forEach(k => { if (res[k].length) console.log(k, res[k].slice(0, 15)); });
  let ok = JSON.stringify(D) === JSON.stringify(res.data);
  console.log('data.json identique après ré-application :', ok);
  if (!ok) for (const k of Object.keys(D)) { if (JSON.stringify(D[k]) !== JSON.stringify(res.data[k])) console.log('  diff dans', k); }
  GE.EXTRAS.forEach(e => { if (!extras[e.key]) return; const same = JSON.stringify(extras[e.key]) === JSON.stringify(res.extras[e.key]); console.log(e.path, 'identique :', same); ok = ok && same; });
  const total = res.counts.changes + res.counts.added + res.counts.removed + res.counts.errors + res.counts.warnings;
  if (!ok || total) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
