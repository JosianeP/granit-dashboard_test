const XP = require('xlsx-populate'); const fs = require('fs'); const path = require('path');
const GE = require(path.join(__dirname, '..', 'granit-excel.js'));
(async () => {
  const [, , dataPath, xlsxPath, password] = process.argv;
  const D = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const wb = await XP.fromDataAsync(fs.readFileSync(xlsxPath), { password });
  const parsed = GE.readWorkbook(wb);
  console.log('Feuilles lues :', parsed.sheetNames.length);
  const res = GE.applyImport(D, parsed);
  console.log('Idempotence — changements:', res.counts.changes, 'ajouts:', res.counts.added, 'retraits:', res.counts.removed, 'erreurs:', res.counts.errors, 'avertissements:', res.counts.warnings);
  if (res.changes.length) console.log(res.changes.slice(0, 15));
  if (res.errors.length) console.log(res.errors.slice(0, 15));
  if (res.warnings.length) console.log(res.warnings.slice(0, 15));
  if (res.added.length) console.log(res.added.slice(0, 10));
  if (res.removed.length) console.log(res.removed.slice(0, 10));
  // comparaison structurelle D vs données réappliquées (hors recalculs arrondis)
  const a = JSON.stringify(D), b = JSON.stringify(res.data);
  console.log('JSON identique après ré-application :', a === b, a.length, b.length);
  if (a !== b) {
    // trouver premières différences par clé de premier niveau
    for (const k of Object.keys(D)) { if (JSON.stringify(D[k]) !== JSON.stringify(res.data[k])) console.log('  diff dans', k); }
    fs.writeFileSync('/tmp/reapplied.json', JSON.stringify(res.data, null, 2));
  }
})().catch(e => { console.error(e); process.exit(1); });
